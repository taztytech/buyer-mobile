import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Animated,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { AddressSelectionModal } from '@/components/AddressSelectionModal';
import { CodConfirmationModal } from '@/components/CodConfirmationModal';
import { LocationSelectionScreen } from '@/screens/Location/LocationSelectionScreen';
import { ordersService } from '@/services/orders.service';
import { addressService, AddressResponse, MAX_ADDRESSES } from '@/services/address.service';
import { paymentService, PaymentErrorType } from '@/services/payment.service';
import { homeService } from '@/services/home.service';
import { cartService, CartSummary, CartResponse } from '@/services/cart.service';
import offersService from '@/services/offers.service';
import {
  formatRupees,
  usableWalletBalance,
  walletService,
  WalletSummary,
} from '@/services/wallet.service';
import { restaurantService } from '@/services/restaurant.service';
import { paymentConfigService } from '@/services/payment-config.service';
import { useCart } from '@/context/CartContext';
import { useConfirmation } from '@/context/ConfirmationContext';
import { MAX_ITEM_QUANTITY } from '@/constants/cart.constants';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
  customizations?: string;
  variantId?: string;
  addOnIds?: string[];
}

interface OrderDetailsScreenProps {
  restaurantName?: string;
  restaurantId?: number;
  restaurantAddress?: string;
  deliveryAddress?: string;
  cartItems?: CartItem[];
  selectedLocation?: {
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
  visible?: boolean;
  onBack?: () => void;
  onAddMoreItems?: () => void;
  /** Open the Tazty Wallet's Add-money sheet; checkout is shown again on return. */
  onAddMoneyToWallet?: () => void;
  onEditCustomization?: (itemId: string, variantId: string, currentAddOnIds: string[], currentQuantity?: number) => void;
  onPlaceOrder?: () => void;
  onOrderSuccess?: (orderId: number) => void;
  onOrderCancel?: () => void;
  showCustomizationModal?: boolean;
  onUpdateCart?: (itemId: string, variantId: string | undefined, newQuantity: number) => void;
  onAddressChange?: () => void;
}

export const OrderDetailsScreen: React.FC<OrderDetailsScreenProps> = ({
  restaurantName,
  restaurantId,
  restaurantAddress,
  deliveryAddress,
  cartItems = [],
  selectedLocation,
  visible = true,
  onBack,
  onAddMoreItems,
  onAddMoneyToWallet,
  onEditCustomization,
  onPlaceOrder,
  onOrderSuccess,
  onOrderCancel,
  showCustomizationModal = false,
  onUpdateCart,
  onAddressChange,
}) => {
  const {
    cart,
    clearCart,
    updateQuantity,
    removeFromCart,
    reloadCart,
    setRestaurantInfo,
    restaurantId: contextRestaurantId,
    restaurantName: contextRestaurantName
  } = useCart();
  const { showConfirmation } = useConfirmation();
  const [orderExpanded, setOrderExpanded] = useState(true);
  const [deliveryExpanded, setDeliveryExpanded] = useState(true);
  const [tipExpanded, setTipExpanded] = useState(true);
  const [promoExpanded, setPromoExpanded] = useState(true);
  const [billExpanded, setBillExpanded] = useState(true);
  const [deliveryLocationExpanded, setDeliveryLocationExpanded] = useState(true);
  const [cancellationExpanded, setCancellationExpanded] = useState(true);

  const showQuantityLimitAlert = () => {
    showConfirmation({
      title: 'Quantity limit reached',
      message: `You can add up to ${MAX_ITEM_QUANTITY} units of each item.`,
      confirmText: 'OK',
      cancelText: '',
      confirmButtonColor: '#00B14F',
      onConfirm: () => { },
    });
  };

  // Initialize localCartItems from CartContext if cartItems prop is empty
  const [localCartItems, setLocalCartItems] = useState<CartItem[]>(() => {
    if (cartItems && cartItems.length > 0) {
      return cartItems;
    }
    // Convert cart from context to CartItem[] format
    return Object.values(cart).flatMap(item => {
      if (item.isCustomizable && item.variants) {
        return item.variants.map(variant => ({
          id: item.id,
          name: item.name,
          price: variant.price,
          quantity: variant.quantity,
          isVeg: item.isVeg,
          variantId: variant.variantId,
          addOnIds: variant.addOns,
        }));
      }
      return [{
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 0,
        isVeg: item.isVeg,
      }];
    });
  });
  const getLocalItemTotalQuantity = (itemId: string) => {
    return localCartItems.reduce((sum, cartItem) => {
      if (cartItem.id === itemId) {
        return sum + cartItem.quantity;
      }
      return sum;
    }, 0);
  };

  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [customTipAmount, setCustomTipAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'online' | 'cod'>('online');
  // Tazty Wallet at checkout: on by default when there is a balance; the
  // customer can switch it off. Never with COD.
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [walletCanPay, setWalletCanPay] = useState(false);
  const [useWallet, setUseWallet] = useState(true);
  // Whether this customer may add money right now (top-up on, or a test user).
  const [walletTopupAllowed, setWalletTopupAllowed] = useState(false);
  const [selfPickup, setSelfPickup] = useState(false);
  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(undefined);
  const [showLocationSelection, setShowLocationSelection] = useState(false);
  const [showCodConfirmModal, setShowCodConfirmModal] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [addresses, setAddresses] = useState<AddressResponse[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [cartSummary, setCartSummary] = useState<CartSummary | null>(null);
  const [isLoadingCartSummary, setIsLoadingCartSummary] = useState(false);
  // Set when the cart could not be priced. Every bill line falls back to 0 when
  // cartSummary is null, so without this the screen shows a confident ₹0.00
  // bill and an enabled Place Order button after a failed fetch.
  const [cartSummaryError, setCartSummaryError] = useState('');
  const [cartData, setCartData] = useState<any>(null);
  const [isUpdatingTip, setIsUpdatingTip] = useState(false);
  const [maxTipAmount, setMaxTipAmount] = useState<number | null>(null);
  const [tipError, setTipError] = useState('');
  const [promoError, setPromoError] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [showTaxTooltip, setShowTaxTooltip] = useState(false);

  // Track latest update sequence to ensure we only apply cart_summary from the most recent update
  const updateSequenceRef = useRef<number>(0);
  const pendingUpdateRef = useRef<{ itemId: string; quantity: number; sequence: number } | null>(null);

  const isCartItemNotFoundError = (error: any): boolean => {
    const message = (error?.message || '').toString().toLowerCase();
    return message.includes('cart item not found');
  };

  // Convenience accessors for backend-calculated amounts (no client-side recomputation)
  const itemTotal = cartSummary?.subtotal ?? 0;
  const deliveryFee = cartSummary?.delivery_fee ?? 0;
  const gstAndCharges = cartSummary?.total_tax_amount ?? 0;
  const discountAmount = cartSummary?.discount_amount ?? 0;
  const platformFee = (cartSummary as any)?.platform_fee ?? 0;
  const includePlatformFee = (cartSummary as any)?.include_platform_fee ?? false;
  const backendTipAmount = (cartSummary as any)?.tip_amount ?? 0;
  const totalAmount = cartSummary?.final_amount ?? 0;
  // The server holds exactly this much when the order is placed: promo credit
  // with a minimum order above this total cannot be spent, so it is left out.
  const walletBalance = usableWalletBalance(walletSummary, totalAmount);
  const walletApplied =
    walletCanPay && useWallet && selectedPaymentMethod === 'online'
      ? Math.min(walletBalance, totalAmount)
      : 0;
  const amountToPay = Math.max(0, Math.round((totalAmount - walletApplied) * 100) / 100);
  const estimatedDeliveryTimeRaw = (cartSummary as any)?.estimated_delivery_time ?? null;
  const deliveryFeeTax = (cartSummary as any)?.delivery_fee_tax ?? 0;
  const platformFeeTax = (cartSummary as any)?.platform_fee_tax ?? 0;
  const taxAmount = (cartSummary as any)?.tax_amount ?? 0;
  console.log('📦 OrderDetails: cartSummary', cartSummary);
  // Format estimated delivery time to user-friendly format
  // Handles two formats:
  // 1. ISO date string: "2025-12-12T12:00:00.000Z" - format it
  // 2. Time range string: "11-17 minutes" - show as is
  const formatEstimatedDeliveryTime = (timeString: string | null): string | null => {
    if (!timeString) return null;

    // Check if it's a time range format (e.g., "11-17 minutes")
    // Pattern: contains numbers, dash, and "minute" or "mins"
    const timeRangePattern = /^\d+-\d+\s*(minutes?|mins?)$/i;
    if (timeRangePattern.test(timeString.trim())) {
      // Return as is for time range format
      return timeString;
    }

    // Try to parse as ISO date string
    try {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) {
        // If parsing fails, return as is (might be another format)
        return timeString;
      }

      // Format as "Dec 12, 2025 at 12:00 PM"
      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const formattedTime = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      return `${formattedDate} at ${formattedTime}`;
    } catch (error) {
      // If any error occurs, return the original string
      return timeString;
    }
  };

  const estimatedDeliveryTime = formatEstimatedDeliveryTime(estimatedDeliveryTimeRaw);

  // COD availability based on backend configuration from /home API
  const codSettings = paymentConfigService.getCodSettings();
  const isCodEnabled = codSettings?.cod_enabled ?? false;
  const codMinAmount = codSettings?.cod_min_amount ?? 0;
  const codMaxAmount = codSettings?.cod_max_amount ?? Number.MAX_SAFE_INTEGER;

  /**
   * Offer orders are standalone: no extra items, and quantity is fixed at 1.
   *
   * Read from the cart rather than from offersService's in-memory flag. That
   * flag only clears on a successful ONLINE confirm, so it would stay set
   * after a COD offer order or an abandoned one and wrongly lock the next
   * normal order; and being in-memory it is lost on restart, wrongly
   * unlocking an offer cart that is still there. The cart row is the truth.
   */
  const cartHasOffer = ((cartData?.items ?? []) as any[]).some(
    (i) => !!i?.promo_offer_id,
  );

  // An offer configured as online-only must not present COD at all. The API
  // rejects it anyway, but only after the customer has chosen and committed —
  // hiding it here means they never pick an option that cannot succeed.
  // The payment mode is only known from the in-memory claim, so gate it on the
  // cart actually holding an offer; otherwise a stale flag from an abandoned
  // offer would hide COD on an ordinary order.
  const offerIsOnlineOnly =
    cartHasOffer && offersService.isPendingOfferOnlineOnly();

  const isCodAllowed =
    isCodEnabled &&
    !offerIsOnlineOnly &&
    totalAmount >= codMinAmount &&
    totalAmount <= codMaxAmount;

  // Wallet balance for checkout, fresh every time the screen is shown. A
  // failure just means no wallet option - checkout works exactly as before.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    walletService.getSummary().then(summary => {
      if (cancelled) return;
      setWalletCanPay(!!summary?.enabled && !!summary?.can_pay);
      setWalletSummary(summary);
      setUseWallet(true);
    });
    walletService
      .getTopupLimits()
      .then(limits => {
        if (!cancelled) setWalletTopupAllowed(!!limits?.enabled);
      })
      .catch(() => {
        if (!cancelled) setWalletTopupAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    // If COD is no longer allowed (e.g. amount changed), force switch back to online
    if (!isCodAllowed && selectedPaymentMethod === 'cod') {
      setSelectedPaymentMethod('online');
    }
  }, [isCodAllowed, selectedPaymentMethod]);

  const backendAppliedOfferCode =
    (cartSummary as any)?.applied_offer?.offer_code ||
    (cartData as any)?.summary?.applied_offer?.offer_code ||
    '';

  // Determine if a coupon is currently applied.
  // IMPORTANT: free_delivery coupons may set delivery_fee=0 without setting discount_amount,
  // so discount_amount alone is not a reliable signal.
  const isCouponApplied =
    !!cartSummary &&
    (
      (cartSummary.discount_amount ?? 0) > 0 ||
      !!(appliedCouponCode || backendAppliedOfferCode)
    );

  // Check if cart has any preorder items (used to hide promo code section and skip coupon removal)
  const hasPreorderItems = cartData?.items?.some((item: any) =>
    item.is_preorder === true &&
    item.preorder_campaign &&
    item.preorder_campaign.id
  ) ?? false;

  const selectedAddress = addresses.find(addr => addr.id.toString() === selectedAddressId);

  // Helper function to format address for display
  const formatAddress = (address: AddressResponse): string => {
    const parts = [
      address.address1,
      address.address2,
      address.address3,
      address.city,
      address.state,
      address.pincode,
    ].filter(Boolean);
    return parts.join(', ');
  };

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const tipShakeAnim = useRef(new Animated.Value(0)).current;
  const customTipInputRef = useRef<TextInput>(null);

  const triggerTipError = (message: string) => {
    setTipError(message);
    tipShakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(tipShakeAnim, {
        toValue: 8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(tipShakeAnim, {
        toValue: -8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(tipShakeAnim, {
        toValue: 8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(tipShakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Use cart context restaurant info if available, otherwise use props
  const effectiveRestaurantId = contextRestaurantId || restaurantId;

  const ensureRestaurantOpenBeforeOrder = async (): Promise<boolean> => {
    if (!effectiveRestaurantId) {
      return true;
    }

    try {
      // Prefer selected address coordinates if available, otherwise fall back
      const lat = selectedAddress?.latitude ?? 9.9252;
      const lng = selectedAddress?.longitude ?? 78.1198;

      const response = await restaurantService.getRestaurantDetails(effectiveRestaurantId, {
        lat,
        lng,
        include_items: false,
      });

      if (!response.success || !response.data) {
        return true;
      }

      // Use top-level is_open only for store open/close.
      // Do not derive open state from timings.
      const isOpen =
        typeof response.data.is_open === 'boolean' ? response.data.is_open : true;

      if (!isOpen) {
        showConfirmation({
          title: 'Restaurant is currently closed',
          message: 'This restaurant is closed right now. You can place the order when it reopens.',
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#00B14F',
          onConfirm: () => { },
        });
        return false;
      }

      return true;
    } catch {
      // On any unexpected error, allow and let backend enforce rules
      return true;
    }
  };

  // Fetch addresses only when checkout is visible (avoids duplicate calls on mount + visible)
  useEffect(() => {
    if (visible) {
      fetchAddresses();
    }
  }, [visible]);

  // IMPORTANT:
  // We intentionally do NOT auto-refetch cart summary on every cart/localCartItems change.
  // The cart summary is refreshed when checkout becomes visible and on explicit user actions
  // that already call `fetchCartSummary()`.

  // Promo removal is button-only (handleRemovePromoCode). No automatic remove-coupon API calls.

  /** Pass `preloadedCart` after `reloadCart()` to avoid a duplicate GET /cart. */
  const fetchCartSummary = async (preloadedCart?: CartResponse) => {
    try {
      setIsLoadingCartSummary(true);
      setCartSummaryError('');
      const cartResponse = preloadedCart ?? (await cartService.getCart());

      if (cartResponse.items.length > 0) {
        setCartData(cartResponse);
        if (cartResponse.summary) {
          setCartSummary(cartResponse.summary);

          // Extract dynamic tip metadata from backend if available
          const summaryAny = cartResponse.summary as any;
          if (typeof summaryAny.max_tip_amount === 'number') {
            setMaxTipAmount(summaryAny.max_tip_amount);
          }

          const tipAmount = summaryAny.tip_amount;
          if (typeof tipAmount === 'number') {
            setSelectedTip(tipAmount > 0 ? tipAmount : null);
          }

          // Only restore promo code from backend if field is empty (preserve user input)
          // This prevents overwriting what the user has typed
          const offerCodeFromBackend = cartResponse.summary.applied_offer?.offer_code || '';
          setAppliedCouponCode(offerCodeFromBackend);
          if (promoCode.trim() === '' && offerCodeFromBackend) {
            setPromoCode(offerCodeFromBackend);
          }
          // Note: We don't clear promo code if user has entered something, even if backend has no offer
          // This allows user to keep typing/editing without interruption
        } else {
          // Items but no summary: the server could not price the cart.
          setCartSummary(null);
          setCartSummaryError(
            "We couldn't calculate your bill. Please try again.",
          );
        }
      } else {
        setCartData(null);
        // Backend cart is empty. Ensure UI item list doesn't keep showing stale local/cartContext items.
        setLocalCartItems([]);
        setCartSummary(null);
        setSelectedTip(null);
      }
    } catch (error: any) {
      // Previously this swallowed the error and left every bill line at its
      // ₹0.00 fallback, so a failed cart fetch was indistinguishable from a
      // free order and checkout stayed enabled. Surface it and block payment.
      console.error('[OrderDetails] Cart summary fetch failed:', error?.message);
      setCartData(null);
      setCartSummary(null);
      setCartSummaryError(
        error?.message || "We couldn't load your bill. Please try again.",
      );
    } finally {
      setIsLoadingCartSummary(false);
    }
  };

  // Refresh cart whenever checkout becomes visible so billing matches the server after rapid menu adds.
  // Single GET /cart: reloadCart returns the payload; fetchCartSummary reuses it (no duplicate call).
  useEffect(() => {
    if (!visible) return;
    void (async () => {
      let preloaded: CartResponse | null = null;
      try {
        preloaded = await reloadCart();
      } catch {
        // Ignore reload errors; fetchCartSummary may still call getCart.
      }
      await fetchCartSummary(preloaded ?? undefined);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Get restaurant name and address from cart API data
  const displayRestaurantName = cartData?.restaurant_name || contextRestaurantName || restaurantName || '';
  const displayRestaurantAddress = cartData?.restaurant_address || '';

  const fetchAddresses = async () => {
    try {
      setIsLoadingAddresses(true);
      const response = await addressService.getAddresses();

      if (response.success && response.data) {
        setAddresses(response.data);

        // Only set the default address as selected if it exists
        // Don't auto-select first address if no default exists - let user choose
        const defaultAddress = response.data.find(addr => addr.is_default);
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id.toString());

          // Check if the default address is within serviceable area (Madurai bounds)
          const isServiceable = homeService.isLocationServiceable(
            defaultAddress.latitude,
            defaultAddress.longitude
          );

          if (!isServiceable) {
            showConfirmation({
              title: 'Oops!',
              message: 'Service not available at the selected location',
              confirmText: 'OK',
              cancelText: '',
              onConfirm: () => { },
            });
          }
        }
        // If no default address exists, don't auto-select any address
        // User will need to manually select and set one as default
      } else {
        showConfirmation({
          title: '',
          message: response.error || 'Failed to load addresses',
          confirmText: 'OK',
          cancelText: '',
          onConfirm: () => { },
        });
      }
    } catch (error: any) {
      showConfirmation({
        title: '',
        message: error.message || 'Failed to load addresses',
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => { },
      });
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  // Sync local cart items with parent cart items or cart context
  useEffect(() => {
    if (cartItems && cartItems.length > 0) {
      // Use prop if provided
      setLocalCartItems(cartItems);
    } else {
      // Otherwise sync from cart context
      const items = Object.values(cart).flatMap(item => {
        if (item.isCustomizable && item.variants) {
          return item.variants.map(variant => ({
            id: item.id,
            name: item.name,
            price: variant.price,
            quantity: variant.quantity,
            isVeg: item.isVeg,
            variantId: variant.variantId,
            addOnIds: variant.addOns,
          }));
        }
        return [{
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 0,
          isVeg: item.isVeg,
        }];
      });
      // Only update if items actually changed
      setLocalCartItems(prevItems => {
        const prevJson = JSON.stringify(prevItems);
        const newJson = JSON.stringify(items);
        return prevJson === newJson ? prevItems : items;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cart), cartItems?.length]);

  const visibleOrderItems = localCartItems.filter((item) => {
    const hasName = typeof item?.name === 'string' && item.name.trim().length > 0;
    const hasValidPrice = Number.isFinite(Number(item?.price));
    const hasValidQuantity = Number.isFinite(Number(item?.quantity)) && Number(item.quantity) > 0;
    return hasName && hasValidPrice && hasValidQuantity;
  });

  // Animate background when modals open/close
  useEffect(() => {
    // Reset animations immediately when location selection is shown
    if (showLocationSelection) {
      scaleAnim.setValue(1);
      translateYAnim.setValue(0);
      return;
    }

    if (showAddressModal || showCustomizationModal) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 30,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showAddressModal, showLocationSelection, showCustomizationModal]);

  /**
   * Reactivate cart with retry logic
   * This ensures the cart is made active when payment is cancelled
   */
  const reactivateCartWithRetry = async (cartId: number, maxRetries: number = 3): Promise<boolean> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[OrderDetails] Reactivating cart (attempt ${attempt}/${maxRetries})...`);
        const response = await cartService.updateCart(cartId, { is_active: true });

        if (response.success) {
          console.log('[OrderDetails] Cart reactivated successfully');
          return true;
        } else {
          console.warn(`[OrderDetails] Cart reactivation failed (attempt ${attempt}):`, response.error);
          // If not the last attempt, wait before retrying
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Exponential backoff
          }
        }
      } catch (error) {
        console.error(`[OrderDetails] Cart reactivation error (attempt ${attempt}):`, error);
        // If not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Exponential backoff
        }
      }
    }

    console.error('[OrderDetails] Failed to reactivate cart after all retries');
    return false;
  };

  const handlePlaceOrder = async () => {
    if (!effectiveRestaurantId) {
      showConfirmation({
        title: 'Error',
        message: 'Restaurant information is missing',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => { },
      });
      return;
    }

    // Check if user has any addresses
    if (addresses.length === 0) {
      showConfirmation({
        title: 'Address Required',
        message: 'Please add a delivery address to place your order',
        confirmText: 'Add Address',
        cancelText: 'Cancel',
        confirmButtonColor: '#00B14F',
        onConfirm: () => {
          setShowLocationSelection(true);
        },
      });
      return;
    }

    // Check if an address is selected
    if (!selectedAddressId || !selectedAddress) {
      showConfirmation({
        title: 'Address Required',
        message: 'Please select a delivery address',
        confirmText: 'Select Address',
        cancelText: 'Cancel',
        confirmButtonColor: '#00B14F',
        onConfirm: () => {
          setShowAddressModal(true);
        },
      });
      return;
    }

    // Check if there's a default address, if not, require user to set one
    const hasDefaultAddress = addresses.some(addr => addr.is_default);
    if (!hasDefaultAddress) {
      showConfirmation({
        title: 'Default Address Required',
        message: 'Please set a default address before placing your order. You can set a default address in the address selection modal.',
        confirmText: 'Select Address',
        cancelText: 'Cancel',
        confirmButtonColor: '#00B14F',
        onConfirm: () => {
          setShowAddressModal(true);
        },
      });
      return;
    }

    // Check if the selected address is within serviceable area (Madurai bounds)
    if (selectedAddress) {
      const isServiceable = homeService.isLocationServiceable(
        selectedAddress.latitude,
        selectedAddress.longitude
      );

      if (!isServiceable) {
        showConfirmation({
          title: 'Oops!',
          message: 'Service not available at the selected location',
          confirmText: 'OK',
          cancelText: '',
          onConfirm: () => { },
        });
        return;
      }
    }

    if (Object.keys(cart).length === 0) {
      showConfirmation({
        title: 'Error',
        message: 'Your cart is empty',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => { },
      });
      return;
    }

    // COD: Show confirmation modal before placing order
    if (selectedPaymentMethod === 'cod') {
      setShowCodConfirmModal(true);
      return;
    }

    proceedWithPlaceOrder();
  };

  const proceedWithPlaceOrder = async () => {
    if (!selectedAddressId) return;
    // Final guard: ensure restaurant is open before creating order & starting payment
    setIsPlacingOrder(true);

    try {
      const isOpen = await ensureRestaurantOpenBeforeOrder();
      if (!isOpen) {
        setIsPlacingOrder(false);
        return;
      }
    } catch (error) {
      setIsPlacingOrder(false);
      return;
    }

    try {
      // Cart is already synced with backend via CartContext
      // So we can directly create order from the backend cart

      // Create order with selected payment method
      const createOrderRequest = {
        delivery_address_id: parseInt(selectedAddressId),
        payment_method: selectedPaymentMethod,
        notes: notes || undefined,
        ...(walletApplied > 0 ? { use_wallet: true } : {}),
      };

      console.log(
        '[OrderDetails][handlePlaceOrder] Creating order with payload:--',
        createOrderRequest,
      );

      const orderResponse = await ordersService.createOrder(createOrderRequest);

      if (orderResponse.success && orderResponse.data) {
        // Get order data - API might return data nested under 'order' key or directly
        const responseData = orderResponse.data as any;
        const orderData = responseData.order || responseData;
        const orderNumber = orderData.order_number || orderData.orderNumber || 'N/A';
        const orderId = orderData.id || orderData.order_id;

        // Validate orderId exists
        if (!orderId) {
          console.error('Order ID not found in response:', orderData);
          showConfirmation({
            title: '',
            message: 'Order was created but order ID is missing. Please check My Orders.',
            confirmText: 'OK',
            cancelText: '',
            confirmButtonColor: '#DC2626',
            onConfirm: () => {
              if (onOrderCancel) {
                onOrderCancel();
              }
            },
          });
          return;
        }

        // Paid fully from the Tazty Wallet: no Razorpay step. Same success
        // path as a paid online order (the offer booking is confirmed the way
        // paymentService does after Razorpay).
        if (responseData.paid_with_wallet === true) {
          await offersService.confirmForOrder(orderId, 'online');
          clearCart(false);
          setNotes('');
          setSelectedTip(null);
          setCustomTipAmount('');
          setPromoCode('');
          setPromoError('');
          setIsPlacingOrder(false);
          showConfirmation({
            title: 'Order Successful! 🎉',
            message: `Paid ${formatRupees(responseData.wallet_amount)} from your Tazty Wallet.`,
            confirmText: 'View Order Details',
            cancelText: '',
            confirmButtonColor: '#00B14F',
            showRibbon: false,
            onConfirm: () => {
              const numericOrderId = typeof orderId === 'number' ? orderId : parseInt(orderId, 10);
              if (onOrderSuccess && numericOrderId && !isNaN(numericOrderId)) {
                onOrderSuccess(numericOrderId);
              } else if (onPlaceOrder) {
                onPlaceOrder();
              }
            },
            onCancel: () => {
              if (onOrderCancel) {
                onOrderCancel();
              }
            },
          });
          return;
        }

        // Extract payment_details from order response
        // Payment details are in responseData.payment_details
        const paymentDetails = responseData.payment_details;

        // Check if payment is required
        if (!paymentDetails && selectedPaymentMethod !== "cod") {
          // If no payment_details, order might be COD or payment not required
          // Clear local cart for COD orders (backend handles API clearing)
          clearCart(false);
          setNotes(''); // Reset notes for next order
          setSelectedTip(null); // Reset tip selection
          setCustomTipAmount(''); // Reset custom tip amount
          // Clear promo UI state so it doesn't persist into next checkout
          setPromoCode('');
          setPromoError('');

          setIsPlacingOrder(false); // Reset loading state before showing confirmation

          showConfirmation({
            title: '',
            message: 'Order created successfully. Payment details not found.',
            confirmText: 'OK',
            cancelText: '',
            confirmButtonColor: '#00B14F',
            onConfirm: () => {
              if (onOrderSuccess && orderId) {
                onOrderSuccess(orderId);
              }
            },
          });
          return;
        }

        // Reset loading state before opening Razorpay to prevent blank screen
        // This ensures the UI remains visible during the transition to Razorpay
        setIsPlacingOrder(false);

        // Small delay to ensure UI is ready before opening Razorpay
        // This prevents the blank screen issue that occurs sometimes when Razorpay opens
        // Using requestAnimationFrame to ensure UI is fully rendered before opening Razorpay
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            // Additional small delay to ensure all UI updates are complete
            setTimeout(() => {
              resolve();
            }, 100);
          });
        });

        // Process online payment via Razorpay using payment_details from order response
        const analyticsAmountRupees = Number(
          responseData?.summary?.final_amount ??
          orderData?.summary?.final_amount ??
          orderData?.total_amount ??
          responseData?.total_amount ??
          NaN,
        );
        const paymentResult = await paymentService.processPayment(
          orderId,
          paymentDetails,
          Number.isFinite(analyticsAmountRupees) ? analyticsAmountRupees : undefined,
        );

        // CRITICAL: After Razorpay closes, ensure UI is fully restored before showing dialogs
        // Razorpay is a native module that takes over the screen, so we need to wait for
        // React Native to fully restore the UI before showing any modals/dialogs
        // This prevents the black screen issue
        await new Promise<void>((resolve) => {
          // Use requestAnimationFrame to ensure UI is fully rendered
          // This is critical after returning from native modules like Razorpay
          requestAnimationFrame(() => {
            // Additional delay to ensure all interactions and animations are complete
            setTimeout(() => {
              resolve();
            }, 200); // Slightly longer delay to ensure UI is stable
          });
        });

        if (paymentResult.success || selectedPaymentMethod === "cod") {
          // COD had no confirm step at all: only the online path (inside
          // paymentService) converted a held offer slot into a confirmed
          // claim. A COD offer booking therefore stayed "reserved" until the
          // server's reaper released the slot — the seat was given away and
          // the seller never saw a confirmed booking. Online is already
          // confirmed by paymentService, so only COD is handled here.
          if (selectedPaymentMethod === "cod") {
            await offersService.confirmForOrder(orderId, 'cod');
          }

          // Payment successful - clear local cart and reset form (backend handles API clearing)
          clearCart(false);
          setNotes(''); // Reset notes for next order
          setSelectedTip(null); // Reset tip selection
          setCustomTipAmount(''); // Reset custom tip amount
          // Clear promo UI state so it doesn't persist into next checkout
          setPromoCode('');
          setPromoError('');

          showConfirmation({
            title: `${selectedPaymentMethod !== "cod" ? "Payment" : "Order"} Successful! 🎉'`,
            message: orderNumber !== 'N/A'
              ?`${selectedPaymentMethod === "cod" ? `Your order #${orderNumber} has been placed successfully.` : 'Your order has been placed and paid successfully.'}`
              : `${selectedPaymentMethod === "cod" ? "Your order has been placed successfully." : 'Your order has been placed and paid successfully.'}`,
            confirmText: 'View Order Details',
            cancelText: '',
            confirmButtonColor: '#00B14F',
            showRibbon: false,
            onConfirm: () => {
              // Ensure orderId is a number
              const numericOrderId = typeof orderId === 'number' ? orderId : parseInt(orderId, 10);
              if (onOrderSuccess && numericOrderId && !isNaN(numericOrderId)) {
                onOrderSuccess(numericOrderId);
              } else if (onPlaceOrder) {
                onPlaceOrder();
              } else {
                console.error('Navigation failed: orderId is invalid or callbacks not provided', { orderId, numericOrderId, onOrderSuccess, onPlaceOrder });
              }
            },
            onCancel: () => {
              if (onOrderCancel) {
                onOrderCancel();
              }
            },
          });
        } else {
          // Handle payment error types: Network Error, Payment Cancelled, Payment Failed
          const errorType = paymentResult.errorType || PaymentErrorType.USER_CANCELLED;
          const errorMessage = paymentResult.error || 'Payment could not be processed';

          // Determine title and message based on error type
          // Cart is NOT cleared on payment failure/cancellation - user can try again
          let title = 'Payment Cancelled';
          let message = 'Payment was cancelled. You can try again placing the order.';
          let shouldMarkAsFailed = false;

          switch (errorType) {
            case PaymentErrorType.USER_CANCELLED:
              title = 'Payment Cancelled';
              message = 'Payment was cancelled. You can try again placing the order.';
              shouldMarkAsFailed = false;
              break;

            case PaymentErrorType.NETWORK_ERROR:
              title = 'Connection Problem';
              message = 'We couldn\'t connect to complete your payment. Please check your internet connection and try again placing the order.';
              shouldMarkAsFailed = false;
              break;

            case PaymentErrorType.PAYMENT_FAILED:
              title = 'Payment Failed';
              message = `${errorMessage} You can try again placing the order.`;
              shouldMarkAsFailed = true;
              break;

            default:
              // Default to cancelled (user backing out or any other error)
              title = 'Payment Cancelled';
              message = 'Payment was cancelled. You can try again placing the order.';
              shouldMarkAsFailed = false;
          }

          // Wallet money reserved for this order goes straight back when the
          // customer leaves the payment screen. Without this call it stayed
          // held (history "Paid for order", balance ₹0) until the server's
          // sweep. Not on a network error: that payment may still land, and
          // the server returns the hold itself if it does not.
          const walletUsed = Number(responseData?.wallet_amount || 0);
          if (
            !shouldMarkAsFailed &&
            walletUsed > 0 &&
            errorType !== PaymentErrorType.NETWORK_ERROR
          ) {
            try {
              await paymentService.handlePaymentFailure(orderId, {
                reason: 'Payment cancelled by customer',
              });
              message = `Payment was cancelled. Your ₹${walletUsed} Tazty Wallet money is back in your wallet. You can try again placing the order.`;
            } catch (releaseError) {
              console.error('Failed to release wallet hold after cancel:', releaseError);
            }
          }

          // Only mark as payment failed if it's not a user cancellation or network error
          if (shouldMarkAsFailed) {
            try {
              // Use payment failure endpoint to mark order as payment_failed
              await paymentService.handlePaymentFailure(orderId, {
                reason: errorMessage,
              });
            } catch (failureError) {
              // If payment failure endpoint fails, just log the error
              // Don't try to cancel order as fallback - let the order remain in its current state
              console.error('Failed to mark order as payment failed:', failureError);
            }
          }

          // Reactivate cart when payment is cancelled/failed
          // This is critical for allowing user to retry the order
          // Use retry logic to ensure it succeeds even if network is slow
          if (cartData?.id) {
            // Call reactivation with retry logic - don't await to avoid blocking UI
            // But log the result for debugging
            reactivateCartWithRetry(cartData.id).then((success) => {
              if (success) {
                console.log('[OrderDetails] Cart reactivated successfully after payment cancellation');
              } else {
                console.warn('[OrderDetails] Cart reactivation failed after all retries - user may need to refresh');
              }
            }).catch((error) => {
              console.error('[OrderDetails] Unexpected error during cart reactivation:', error);
            });
          } else {
            console.warn('[OrderDetails] No cart ID available to reactivate');
          }

          // Don't reset form or clear cart - user can try again with same selections
          // Cart is preserved so user can retry placing the order

          // CRITICAL: After Razorpay closes (even on failure), ensure UI is fully restored
          // Wait for UI to be ready before showing error dialog to prevent black screen
          await new Promise<void>((resolve) => {
            // Use requestAnimationFrame to ensure UI is fully rendered
            requestAnimationFrame(() => {
              // Additional delay to ensure all interactions and animations are complete
              setTimeout(() => {
                resolve();
              }, 200);
            });
          });

          // Show appropriate confirmation with "Try Again" button for all error types
          // User stays on OrderDetailsScreen (cart page) to try again
          // Note: Cart reactivation already happened above, button just closes dialog
          showConfirmation({
            title,
            message,
            confirmText: 'Try Again',
            cancelText: '',
            confirmButtonColor: '#00B14F',
            onConfirm: () => {
              // Just close the dialog - user stays on OrderDetailsScreen (cart page) to try again
              // Cart reactivation already happened automatically when user returned from Razorpay
            },
          });
        }
      } else {
        showConfirmation({
          title: '',
          message: orderResponse.error || 'Failed to place order',
          confirmText: 'OK',
          cancelText: '',
          onConfirm: () => { },
        });
      }
    } catch (error: any) {
      showConfirmation({
        title: '',
        message: error.message || 'Failed to place order',
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => { },
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleIncrement = async (itemId: string, variantId?: string) => {
    // Find current item first to get proper quantity
    const currentItem = localCartItems.find(i => variantId ? i.variantId === variantId : i.id === itemId);
    if (!currentItem) return;

    // If this is a preorder item, enforce quantity limit of 1 (same rule as CartContext / RestaurantScreen)
    const baseCartItem = cart[itemId];
    const isPreorderItem = baseCartItem?.isPreorder === true;
    const totalQuantityForItem = getLocalItemTotalQuantity(itemId);

    if (isPreorderItem && totalQuantityForItem >= 1) {
      // Don't allow increasing quantity beyond 1 for preorder items
      showConfirmation({
        title: '',
        message: 'Only one quantity is allowed for preorder items. You can add this item only once.',
        confirmText: 'OK',
        cancelText: '',
        confirmButtonColor: '#00B14F',
        onConfirm: () => { },
      });
      return;
    }

    if (totalQuantityForItem >= MAX_ITEM_QUANTITY) {
      showQuantityLimitAlert();
      return;
    }

    const newQuantity = currentItem.quantity + 1;

    // Update local state immediately for responsive UI
    setLocalCartItems(prev =>
      prev.map(item => {
        const matchesItem = variantId ? item.variantId === variantId : item.id === itemId;
        return matchesItem
          ? { ...item, quantity: newQuantity }
          : item;
      })
    );

    // Increment sequence number for this update
    updateSequenceRef.current += 1;
    const currentSequence = updateSequenceRef.current;
    pendingUpdateRef.current = { itemId, quantity: newQuantity, sequence: currentSequence };

    updateQuantity(itemId, newQuantity).then((updatedCartSummary) => {
      // Only apply cart_summary if this is still the latest update
      if (pendingUpdateRef.current?.sequence === currentSequence && updatedCartSummary) {
        setCartSummary(updatedCartSummary);

        // Extract dynamic tip metadata from backend if available
        const summaryAny = updatedCartSummary as any;
        if (typeof summaryAny.max_tip_amount === 'number') {
          setMaxTipAmount(summaryAny.max_tip_amount);
        }

        const tipAmount = summaryAny.tip_amount;
        if (typeof tipAmount === 'number') {
          setSelectedTip(tipAmount > 0 ? tipAmount : null);
        }

        // Clear pending update if this was the latest
        if (pendingUpdateRef.current?.sequence === currentSequence) {
          pendingUpdateRef.current = null;
        }
      } else if (pendingUpdateRef.current?.sequence === currentSequence && !updatedCartSummary) {
        // Fallback: fetch cart summary if updateQuantity didn't return it
        // This can happen if the item doesn't have cartItemId yet
        fetchCartSummary();
      }
    }).catch((error: any) => {
      if (isCartItemNotFoundError(error)) {
        // Fast taps can race with backend removal; keep UI consistent and resync silently.
        setLocalCartItems(prev =>
          prev.filter(item => (variantId ? item.variantId !== variantId : item.id !== itemId))
        );
        fetchCartSummary();
        pendingUpdateRef.current = null;
        return;
      }

      // On error, check if it's a cart update error and show message
      // Always show error if it has a message (cart update errors will have isCartUpdateError flag)
      if (error?.isCartUpdateError || error?.message) {
        // Revert local quantity change on error
        setLocalCartItems(prev =>
          prev.map(item => {
            const matchesItem = variantId ? item.variantId === variantId : item.id === itemId;
            return matchesItem
              ? { ...item, quantity: currentItem.quantity }
              : item;
          })
        );

        // Show error message from API
        const errorMessage = error?.message || 'Failed to update cart item';
        showConfirmation({
          title: '',
          message: errorMessage,
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#00B14F',
          onConfirm: () => { },
        });
      }

      // Still try to fetch cart summary if this was the latest update
      if (pendingUpdateRef.current?.sequence === currentSequence) {
        fetchCartSummary();
        pendingUpdateRef.current = null;
      }
    });

    // Note: Coupon is NOT re-applied on cart update. updateQuantity/removeFromCart return
    // cart_summary with applied discount; re-validation only when explicitly applied or
    // when total drops below minimum (handled by auto-remove useEffect).

    // Also call parent callback if provided (for backward compatibility)
    if (onUpdateCart) {
      onUpdateCart(itemId, variantId, newQuantity);
    }
  };

  const handleDecrement = async (itemId: string, variantId?: string) => {
    // Find current item first
    const currentItem = localCartItems.find(i => variantId ? i.variantId === variantId : i.id === itemId);
    if (!currentItem) return;

    const newQuantity = currentItem.quantity - 1;

    if (newQuantity === 0) {
      // Remove item from cart locally
      setLocalCartItems(prev =>
        prev.filter(i => variantId ? i.variantId !== variantId : i.id !== itemId)
      );

      // Increment sequence number for this update
      updateSequenceRef.current += 1;
      const currentSequence = updateSequenceRef.current;
      pendingUpdateRef.current = { itemId, quantity: 0, sequence: currentSequence };

      removeFromCart(itemId).then((updatedCartSummary) => {
        // Only apply cart_summary if this is still the latest update
        if (pendingUpdateRef.current?.sequence === currentSequence && updatedCartSummary) {
          setCartSummary(updatedCartSummary);

          // Extract dynamic tip metadata from backend if available
          const summaryAny = updatedCartSummary as any;
          if (typeof summaryAny.max_tip_amount === 'number') {
            setMaxTipAmount(summaryAny.max_tip_amount);
          }

          const tipAmount = summaryAny.tip_amount;
          if (typeof tipAmount === 'number') {
            setSelectedTip(tipAmount > 0 ? tipAmount : null);
          }

          // Clear pending update if this was the latest
          if (pendingUpdateRef.current?.sequence === currentSequence) {
            pendingUpdateRef.current = null;
          }
        } else if (pendingUpdateRef.current?.sequence === currentSequence && !updatedCartSummary) {
          // Fallback: fetch cart summary if removeFromCart didn't return it
          fetchCartSummary();
        }
      }).catch((error: any) => {
        if (isCartItemNotFoundError(error)) {
          setLocalCartItems(prev =>
            prev.filter(item => (variantId ? item.variantId !== variantId : item.id !== itemId))
          );
        }
        // On error, still try to fetch cart summary if this was the latest update
        if (pendingUpdateRef.current?.sequence === currentSequence) {
          fetchCartSummary();
          pendingUpdateRef.current = null;
        }
      });

      // Also call parent callback if provided (for backward compatibility)
      if (onUpdateCart) {
        onUpdateCart(itemId, variantId, 0);
      }
    } else {
      // Decrease quantity locally
      setLocalCartItems(prev =>
        prev.map(i => {
          const matchesItem = variantId ? i.variantId === variantId : i.id === itemId;
          return matchesItem
            ? { ...i, quantity: newQuantity }
            : i;
        })
      );

      // Increment sequence number for this update
      updateSequenceRef.current += 1;
      const currentSequence = updateSequenceRef.current;
      pendingUpdateRef.current = { itemId, quantity: newQuantity, sequence: currentSequence };

      updateQuantity(itemId, newQuantity).then((updatedCartSummary) => {
        // Only apply cart_summary if this is still the latest update
        if (pendingUpdateRef.current?.sequence === currentSequence && updatedCartSummary) {
          setCartSummary(updatedCartSummary);

          // Extract dynamic tip metadata from backend if available
          const summaryAny = updatedCartSummary as any;
          if (typeof summaryAny.max_tip_amount === 'number') {
            setMaxTipAmount(summaryAny.max_tip_amount);
          }

          const tipAmount = summaryAny.tip_amount;
          if (typeof tipAmount === 'number') {
            setSelectedTip(tipAmount > 0 ? tipAmount : null);
          }

          // Clear pending update if this was the latest
          if (pendingUpdateRef.current?.sequence === currentSequence) {
            pendingUpdateRef.current = null;
          }
        } else if (pendingUpdateRef.current?.sequence === currentSequence && !updatedCartSummary) {
          // Fallback: fetch cart summary if updateQuantity didn't return it
          fetchCartSummary();
        }
      }).catch((error: any) => {
        if (isCartItemNotFoundError(error)) {
          // Item already removed on backend due rapid taps; remove stale row silently.
          setLocalCartItems(prev =>
            prev.filter(item => (variantId ? item.variantId !== variantId : item.id !== itemId))
          );
          fetchCartSummary();
          pendingUpdateRef.current = null;
          return;
        }

        // On error, check if it's a cart update error and show message
        // Always show error if it has a message (cart update errors will have isCartUpdateError flag)
        if (error?.isCartUpdateError || error?.message) {
          // Revert local quantity change on error
          setLocalCartItems(prev =>
            prev.map(item => {
              const matchesItem = variantId ? item.variantId === variantId : item.id === itemId;
              return matchesItem
                ? { ...item, quantity: currentItem.quantity }
                : item;
            })
          );

          // Show error message from API
          const errorMessage = error?.message || 'Failed to update cart item';
          showConfirmation({
            title: '',
            message: errorMessage,
            confirmText: 'OK',
            cancelText: '',
            confirmButtonColor: '#00B14F',
            onConfirm: () => { },
          });
        }

        // Still try to fetch cart summary if this was the latest update
        if (pendingUpdateRef.current?.sequence === currentSequence) {
          fetchCartSummary();
          pendingUpdateRef.current = null;
        }
      });

      // Also call parent callback if provided (for backward compatibility)
      if (onUpdateCart) {
        onUpdateCart(itemId, variantId, newQuantity);
      }
    }
  };

  // Handle tip selection and API call
  // When user clicks tip, calls PUT /api/buyer/cart/tip and displays cart_summary from response
  const handleTipSelection = async (amount: number | null) => {
    // Clear any previous validation error when changing selection
    setTipError('');

    // If deselecting (amount is null), set tip to 0
    const tipToSend = amount === null ? 0 : amount;

    // Validate against dynamic max tip amount from backend if available
    if (tipToSend > 0 && maxTipAmount !== null && tipToSend > maxTipAmount) {
      triggerTipError(`Maximum tip amount is ₹${maxTipAmount}.`);
      return;
    }

    // Optimistic update: Update selectedTip immediately for instant UI feedback
    const previousTip = selectedTip;
    setSelectedTip(amount);

    try {
      setIsUpdatingTip(true);

      // Call PUT /api/buyer/cart/tip API
      const response = await cartService.createTip(tipToSend);

      if (response.success && response.cart_summary) {
        // Always use cart_summary from the tip API response
        // This cart_summary contains all bill details including final_amount with tip included
        setCartSummary(response.cart_summary);

        const summaryAny = response.cart_summary as any;

        // Update dynamic max tip amount from backend if provided
        if (typeof response.max_tip_amount === 'number') {
          setMaxTipAmount(response.max_tip_amount);
        } else if (typeof summaryAny.max_tip_amount === 'number') {
          setMaxTipAmount(summaryAny.max_tip_amount);
        }

        // Update selectedTip from API response to ensure consistency
        const tipFromResponse =
          response.tip_amount ?? summaryAny.tip_amount;
        if (tipFromResponse !== undefined && tipFromResponse !== null) {
          const finalTip = tipFromResponse > 0 ? tipFromResponse : null;
          setSelectedTip(finalTip);

          // If it's a custom tip (not 10, 20, 30), update customTipAmount to match
          if (finalTip !== null && finalTip !== 10 && finalTip !== 20 && finalTip !== 30) {
            setCustomTipAmount(finalTip.toString());
          }
        }
      } else {
        // Revert optimistic update on error
        setSelectedTip(previousTip);
        // Surface error inline below the field instead of a popup
        triggerTipError(response.message || 'Failed to update tip amount. Please try again.');
      }
    } catch (error: any) {
      // Revert optimistic update on error
      setSelectedTip(previousTip);
      // Show error message inline
      triggerTipError(error.message || 'Failed to update tip amount. Please try again.');
    } finally {
      setIsUpdatingTip(false);
    }
  };

  // All bill-related amounts are now taken directly from the backend-provided cartSummary.

  // Handle custom tip add button
  const handleAddCustomTip = async () => {
    // Disallow decimal values explicitly
    if (customTipAmount.includes('.')) {
      triggerTipError('Please enter a whole number tip amount. Decimal values are not allowed.');
      return;
    }

    const amount = parseInt(customTipAmount, 10);

    // Validate input
    if (isNaN(amount) || amount <= 0) {
      triggerTipError('Please enter a valid tip amount greater than 0.');
      return;
    }

    // Validate max tip amount using backend-provided limit when available
    if (maxTipAmount !== null && amount > maxTipAmount) {
      triggerTipError(`Maximum tip amount is ₹${maxTipAmount}. Please enter a lower amount.`);
      return;
    }

    // Call API to update tip (handleTipSelection will update selectedTip optimistically)
    await handleTipSelection(amount);

    // Keep the customTipAmount so the button can display it
    // Don't clear it - it will be used to show the selected custom tip amount
  };

  // Handle promo code apply
  const handleApplyPromoCode = async () => {
    if (isApplyingPromo) {
      return;
    }

    // Clear previous error
    setPromoError('');

    // Don't allow applying coupon if cart has preorder items
    if (hasPreorderItems) {
      setPromoError('Promo codes cannot be applied to preorder items.');
      return;
    }

    const trimmedCode = promoCode.trim();

    if (!trimmedCode) {
      setPromoError('Please enter a promo code.');
      return;
    }

    // Check if base order total (before any promo discount) is below minimum order amount
    const MINIMUM_ORDER_AMOUNT = 100;
    // Calculate base total: current total + existing discount (if any)
    const baseTotal = totalAmount + discountAmount;

    // Validate minimum order amount before applying promo
    // The backend will also validate this, but we check here for better UX
    // if (baseTotal < MINIMUM_ORDER_AMOUNT) {
    //   setPromoError(`Minimum order value of ₹${MINIMUM_ORDER_AMOUNT} required to apply promo codes.`);
    //   return;
    // }

    // Enforce uppercase-only input (letters are uppercased; digits remain as-is)
    const normalizedCode = trimmedCode.toUpperCase();
    if (normalizedCode !== promoCode) {
      // Sync state to normalized value for UI consistency
      setPromoCode(normalizedCode);
    }

    try {
      setIsApplyingPromo(true);

      const response = await cartService.applyCoupon(normalizedCode);

      if (response.success && response.cart_summary) {
        // Use updated cart summary from backend
        setCartSummary(response.cart_summary);
        // Ensure UI switches to "Remove" even for free_delivery coupons where discount_amount stays 0
        setAppliedCouponCode(normalizedCode);

        // Clear any existing error on success
        setPromoError('');
      } else {
        // Show error message from API at the bottom of the screen
        setPromoError(response.message || 'Failed to apply promo code.');
      }
    } catch (error: any) {
      setPromoError(error?.message || 'Failed to apply promo code.');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  // Handle promo code removal
  const handleRemovePromoCode = async () => {
    if (isApplyingPromo) {
      return;
    }

    // Clear previous error
    setPromoError('');

    try {
      setIsApplyingPromo(true);

      const response = await cartService.removeCoupon();

      if (response.success && response.cart_summary) {
        // Use updated cart summary from backend (without discount)
        setCartSummary(response.cart_summary);

        // Clear promo code input and any errors on success
        setPromoCode('');
        setAppliedCouponCode('');
        setPromoError('');
      } else {
        // Show error message from API at the bottom of the screen
        setPromoError(response.message || 'Failed to remove promo code.');
      }
    } catch (error: any) {
      setPromoError(error?.message || 'Failed to remove promo code.');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  // If location selection is shown, render it as an overlay
  if (showLocationSelection) {
    return (
      <View style={styles.container}>
        <LocationSelectionScreen
          onBack={() => setShowLocationSelection(false)}
          onLocationConfirm={async () => {
            setShowLocationSelection(false);
            // Refresh addresses after adding new one
            await fetchAddresses();
            await fetchCartSummary();
            if (onAddressChange) {
              onAddressChange();
            }
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00B14F" />

      <Animated.View
        style={[
          styles.animatedContainer,
          {
            transform: [
              { scale: scaleAnim },
              { translateY: translateYAnim },
            ],
            borderTopLeftRadius: (showAddressModal || showCustomizationModal) ? 20 : 0,
            borderTopRightRadius: (showAddressModal || showCustomizationModal) ? 20 : 0,
          },
        ]}
      >

        {/* Header */}
        <View style={styles.header}>
          <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
                <MaterialIcons name="chevron-left" size={24} color="#000000" />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                {displayRestaurantName ? (
                  <Text style={styles.restaurantName}>{displayRestaurantName}</Text>
                ) : null}
                {displayRestaurantAddress ? (
                  <View style={styles.addressContainer}>
                    <MaterialIcons name="location-on" size={14} color="#FFFFFF" />
                    <Text style={styles.addressText} numberOfLines={1}>
                      {displayRestaurantAddress}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Main Content & Footer wrapped in KeyboardAvoidingView */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={() => setShowTaxTooltip(false)}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              {/* ... existing content ... */}

              {/* Your Order Section */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => setOrderExpanded(!orderExpanded)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionTitle}>Your Order</Text>
                  <MaterialIcons
                    name={orderExpanded ? 'expand-less' : 'expand-more'}
                    size={24}
                    color="#000000"
                  />
                </TouchableOpacity>

                {orderExpanded && (
                  <View style={styles.sectionContent}>
                    {/* Order Items */}
                    {visibleOrderItems.length === 0 ? null : visibleOrderItems.map((item, index) => {
                      // An offer is always quantity 1 — the server forces it and
                      // the per-user limit makes anything else meaningless, so
                      // "+" could only fail.
                      const isAtQuantityLimit =
                        cartHasOffer ||
                        getLocalItemTotalQuantity(item.id) >= MAX_ITEM_QUANTITY;
                      const itemPrice = (Number(item.price) || 0) * (Number(item.quantity) || 0);
                      const lineKey = `${item.id}-${item.variantId || 'base'}-${item.addOnIds?.join('_') || 'no-addon'}-${index}`;

                      return (
                        <View key={lineKey} style={styles.orderItem}>
                          <View style={styles.orderItemDetails}>
                            <View style={styles.itemNameRow}>
                              <View style={[
                                styles.vegIconSmall,
                                !item.isVeg && styles.nonVegIconSmall
                              ]}>
                                <View style={[
                                  styles.vegDotSmall,
                                  !item.isVeg && styles.nonVegDotSmall
                                ]} />
                              </View>
                              <Text style={styles.orderItemName}>{item.name}</Text>
                            </View>
                            {/* Show customization row for all customizable items */}
                            {item.variantId && (
                              <TouchableOpacity
                                style={styles.customizationsRow}
                                onPress={() => {
                                  if (onEditCustomization && item.variantId) {
                                    onEditCustomization(item.id, item.variantId, item.addOnIds || [], item.quantity);
                                  }
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.orderItemCustomizations} numberOfLines={1} ellipsizeMode="tail">
                                  {item.customizations && item.customizations.trim() !== ''
                                    ? item.customizations
                                    : 'No add-ons selected'}
                                </Text>
                                <MaterialIcons name="keyboard-arrow-down" size={16} color="rgba(0, 0, 0, 0.5)" />
                              </TouchableOpacity>
                            )}
                            {/* Only show unit price for non-customizable items */}
                            {!item.variantId && (
                              <Text style={styles.orderItemPrice}>₹{item.price}</Text>
                            )}
                          </View>
                          <View style={styles.quantityControl}>
                            <TouchableOpacity
                              onPress={() => handleDecrement(item.id, item.variantId)}
                              activeOpacity={0.7}
                              disabled={cartHasOffer}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Text
                                style={[
                                  styles.quantityButton,
                                  cartHasOffer && styles.quantityButtonDisabled,
                                ]}
                              >
                                -
                              </Text>
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>{item.quantity}</Text>
                            <TouchableOpacity
                              onPress={() => handleIncrement(item.id, item.variantId)}
                              activeOpacity={0.7}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              disabled={isAtQuantityLimit}
                            >
                              <Text
                                style={[
                                  styles.quantityButton,
                                  isAtQuantityLimit && styles.quantityButtonDisabled,
                                ]}
                              >
                                +
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <View style={styles.priceContainer}>
                            <Text style={styles.finalPrice}>₹{itemPrice}</Text>
                          </View>
                        </View>
                      );
                    })}

                    {/* Add More Items Button — hidden for offer orders, which
                        are standalone. The API rejects a second item, so this
                        button could only ever produce an error. */}
                    {!cartHasOffer && (
                      <TouchableOpacity
                        style={styles.addMoreButton}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (onAddMoreItems) {
                            onAddMoreItems();
                          } else if (onBack) {
                            onBack();
                          }
                        }}
                      >
                        <Text style={styles.addMoreButtonText}>+ Add More Items</Text>
                      </TouchableOpacity>
                    )}

                    {/* Notes */}
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Notes</Text>
                      <TextInput autoCorrect={false}
                        style={styles.notesInput}
                        placeholder="Add special instructions for your order"
                        placeholderTextColor="rgba(0, 0, 0, 0.4)"
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Delivery Details Section */}
              <View style={styles.section}>
                {addresses.length === 0 ? (
                  // Show only Add Address button when no addresses exist
                  <View style={styles.sectionContent}>
                    <TouchableOpacity
                      style={styles.addAddressButton}
                      activeOpacity={0.7}
                      onPress={() => setShowLocationSelection(true)}
                    >
                      <MaterialIcons name="add-location" size={20} color="#00B14F" />
                      <Text style={styles.addAddressButtonText}>Add Address</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Show full delivery details when addresses exist
                  <>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => setDeliveryExpanded(!deliveryExpanded)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.sectionTitle}>Delivery Details</Text>
                      <MaterialIcons
                        name={deliveryExpanded ? 'expand-less' : 'expand-more'}
                        size={24}
                        color="#000000"
                      />
                    </TouchableOpacity>

                    {deliveryExpanded && (
                      <View style={styles.sectionContent}>
                        {/* Delivery At */}
                        <View style={styles.subsection}>
                          <Text style={styles.subsectionTitle}>Delivery At</Text>
                          <TouchableOpacity
                            style={styles.deliveryAtBox}
                            activeOpacity={0.7}
                            onPress={() => setShowAddressModal(true)}
                          >
                            <View style={styles.deliveryAtContent}>
                              <MaterialIcons name="location-on" size={20} color="#00B14F" />
                              <Text
                                style={[
                                  styles.deliveryAtText,
                                  !selectedAddress && styles.deliveryAtTextPlaceholder,
                                ]}
                                numberOfLines={5}
                              >
                                {selectedAddress
                                  ? formatAddress(selectedAddress)
                                  : 'Select a default address before placing order'}
                              </Text>
                            </View>
                            <MaterialIcons name="expand-more" size={20} color="rgba(0, 0, 0, 0.5)" />
                          </TouchableOpacity>
                        </View>

                        {/* Delivery Duration - show only when we have an estimated time from API */}
                        {estimatedDeliveryTime ? (
                          <View style={styles.subsection}>
                            <Text style={styles.subsectionTitle}>Estimated Delivery Time</Text>
                            <View style={styles.deliveryTimeBox}>
                              <MaterialIcons name="access-time" size={20} color="#00B14F" />
                              <Text style={styles.deliveryTimeText}>
                                Delivery in{' '}
                                <Text style={styles.deliveryTimeBold}>
                                  {estimatedDeliveryTime}
                                </Text>
                              </Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Tip Section */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => setTipExpanded(!tipExpanded)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionTitle}>Add a Tip</Text>
                  <MaterialIcons
                    name={tipExpanded ? 'expand-less' : 'expand-more'}
                    size={24}
                    color="#000000"
                  />
                </TouchableOpacity>

                {tipExpanded && (
                  <View style={styles.sectionContent}>
                    <View style={styles.tipButtons}>
                      {[10, 20, 30].map((amount) => (
                        <TouchableOpacity
                          key={amount}
                          style={[
                            styles.tipButton,
                            selectedTip === amount && styles.tipButtonSelected,
                            isUpdatingTip && styles.tipButtonDisabled,
                          ]}
                          onPress={() => {
                            if (isUpdatingTip) return;
                            // Toggle: if already selected, deselect (send 0), otherwise select (send amount)
                            const newTip = selectedTip === amount ? null : amount;
                            handleTipSelection(newTip);
                            setCustomTipAmount(''); // Clear custom amount when selecting preset
                          }}
                          activeOpacity={0.7}
                          disabled={isUpdatingTip}
                        >
                          <Text
                            style={[
                              styles.tipButtonText,
                              selectedTip === amount && styles.tipButtonTextSelected,
                            ]}
                          >
                            ₹{amount}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {/* Show entered amount as button if user has typed something OR if a custom tip is selected, otherwise show "Other" */}
                      {(customTipAmount && customTipAmount.trim() !== '') || (selectedTip !== null && selectedTip !== 10 && selectedTip !== 20 && selectedTip !== 30 && selectedTip !== -1) ? (
                        <TouchableOpacity
                          style={[
                            styles.tipButton,
                            (selectedTip === -1 || (selectedTip !== null && selectedTip !== 10 && selectedTip !== 20 && selectedTip !== 30)) && styles.tipButtonSelected,
                            isUpdatingTip && styles.tipButtonDisabled,
                          ]}
                          onPress={() => {
                            if (isUpdatingTip) return;
                            // Clicking the entered amount button allows editing
                            // If we have a selected custom tip amount, populate the input with it
                            if (selectedTip !== null && selectedTip !== -1 && selectedTip !== 10 && selectedTip !== 20 && selectedTip !== 30) {
                              setCustomTipAmount(selectedTip.toString());
                            }
                            // Set selectedTip to -1 to show input field and focus it
                            setSelectedTip(-1);
                            // Focus the input field after a short delay to ensure it's rendered
                            setTimeout(() => {
                              customTipInputRef.current?.focus();
                            }, 100);
                          }}
                          activeOpacity={0.7}
                          disabled={isUpdatingTip}
                        >
                          <Text
                            style={[
                              styles.tipButtonText,
                              (selectedTip === -1 || (selectedTip !== null && selectedTip !== 10 && selectedTip !== 20 && selectedTip !== 30)) && styles.tipButtonTextSelected,
                            ]}
                          >
                            ₹{(() => {
                              // Show customTipAmount if available, otherwise show selectedTip if it's a custom amount
                              if (customTipAmount && customTipAmount.trim() !== '') {
                                return customTipAmount;
                              }
                              if (selectedTip !== null && selectedTip !== -1 && selectedTip !== 10 && selectedTip !== 20 && selectedTip !== 30) {
                                return selectedTip.toString();
                              }
                              return '0';
                            })()}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.tipButton,
                            selectedTip === -1 && styles.tipButtonSelected,
                            isUpdatingTip && styles.tipButtonDisabled,
                          ]}
                          onPress={() => {
                            if (isUpdatingTip) return;
                            if (selectedTip === -1) {
                              // If already selected, deselect it (send 0)
                              handleTipSelection(null);
                              setCustomTipAmount('');
                            } else {
                              // Just show input, don't call API yet
                              // Update state immediately for instant UI feedback
                              setSelectedTip(-1);
                              setCustomTipAmount('');
                            }
                          }}
                          activeOpacity={0.7}
                          disabled={isUpdatingTip}
                        >
                          <Text
                            style={[
                              styles.tipButtonText,
                              selectedTip === -1 && styles.tipButtonTextSelected,
                            ]}
                          >
                            Other
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {selectedTip === -1 && (
                      <View style={styles.customTipContainer}>
                        <Text style={styles.customTipLabel}>Enter custom tip amount</Text>
                        <View style={styles.customTipInputRow}>
                          <Animated.View
                            style={[
                              styles.customTipInputContainer,
                              { transform: [{ translateX: tipShakeAnim }] },
                            ]}
                          >
                            <Text style={styles.rupeeSymbol}>₹</Text>
                            <TextInput autoCorrect={false}
                              ref={customTipInputRef}
                              style={styles.customTipInput}
                              placeholder="0"
                              placeholderTextColor="rgba(0, 0, 0, 0.4)"
                              value={customTipAmount}
                              onChangeText={(text) => {
                                // Allow only digits, no decimals, and limit to 3 digits (max 999)
                                const numericValue = text.replace(/[^0-9]/g, '');
                                const limitedValue = numericValue.slice(0, 3);
                                setCustomTipAmount(limitedValue);
                              }}
                              keyboardType="number-pad"
                            />
                          </Animated.View>
                          <TouchableOpacity
                            style={[styles.addTipButton, isUpdatingTip && styles.addTipButtonDisabled]}
                            onPress={handleAddCustomTip}
                            activeOpacity={0.7}
                            disabled={isUpdatingTip}
                          >
                            {isUpdatingTip ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={styles.addTipButtonText}>Add</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                        {tipError ? (
                          <Text style={styles.tipErrorText}>{tipError}</Text>
                        ) : null}
                      </View>
                    )}

                    <Text style={styles.tipInfo}>
                      100% of the tip will go to your delivery partner.
                    </Text>
                  </View>
                )}
              </View>

              {/* Apply Promo Code Section - Hide if cart has preorder items */}
              {!hasPreorderItems && (
                <View style={styles.section}>
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => setPromoExpanded(!promoExpanded)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sectionTitle}>Promo Code</Text>
                    <MaterialIcons
                      name={promoExpanded ? 'expand-less' : 'expand-more'}
                      size={24}
                      color="#000000"
                    />
                  </TouchableOpacity>

                  {promoExpanded && (
                    <View style={styles.sectionContent}>
                      <View style={styles.promoCodeContainer}>
                        <TextInput autoCorrect={false}
                          style={styles.promoCodeInput}
                          placeholder="Enter promo code"
                          placeholderTextColor="rgba(0, 0, 0, 0.4)"
                          value={promoCode}
                          editable={!isCouponApplied}
                          onChangeText={(text) => {
                            // Normalize to uppercase and hard-limit to 15 characters
                            const uppercased = text.toUpperCase();
                            const limited = uppercased.slice(0, 15);

                            setPromoCode(limited);

                            // Clear backend promo error when user edits the code
                            if (promoError) {
                              setPromoError('');
                            }
                          }}
                          autoCapitalize="characters"
                        />
                        <TouchableOpacity
                          style={[
                            styles.applyButton,
                            (isApplyingPromo ||
                              (!isCouponApplied && !promoCode.trim())) && styles.applyButtonDisabled,
                          ]}
                          onPress={isCouponApplied ? handleRemovePromoCode : handleApplyPromoCode}
                          activeOpacity={0.8}
                          disabled={
                            isApplyingPromo ||
                            (!isCouponApplied && !promoCode.trim())
                          }
                        >
                          {isApplyingPromo ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.applyButtonText}>
                              {isCouponApplied ? 'Remove' : 'Apply'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Bill Details Section */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => setBillExpanded(!billExpanded)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionTitle}>Bill Details</Text>
                  <MaterialIcons
                    name={billExpanded ? 'expand-less' : 'expand-more'}
                    size={24}
                    color="#000000"
                  />
                </TouchableOpacity>

                {billExpanded && (
                  <View style={styles.sectionContent}>
                    {!!cartSummaryError && (
                      <View style={styles.billErrorBox} testID="bill-error">
                        <MaterialIcons name="error-outline" size={18} color="#DC2626" />
                        <Text style={styles.billErrorText}>{cartSummaryError}</Text>
                      </View>
                    )}
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Item Total</Text>
                      <Text style={styles.billValue}>₹{itemTotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Delivery Fee</Text>
                      <Text style={styles.billValue}>₹{deliveryFee.toFixed(2)}</Text>
                    </View>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Platform Fee</Text>
                      <View style={styles.platformFeeValueContainer}>
                        <Text style={
                          (includePlatformFee || platformFee === 0)
                            ? styles.billValue
                            : styles.billValueStrikethrough
                        }>
                          ₹{platformFee.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                    {backendTipAmount > 0 && (
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Delivery Partner tip</Text>
                        <Text style={styles.billValue}>₹{backendTipAmount.toFixed(2)}</Text>
                      </View>
                    )}
                    <View style={styles.billRow}>
                      <View style={styles.billLabelContainer}>
                        <Text style={styles.billLabel}>Taxes and Charges</Text>
                        <View style={styles.infoIconWrapper}>
                          <TouchableOpacity
                            onPress={() => setShowTaxTooltip(!showTaxTooltip)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <MaterialIcons name="info" size={16} color="rgba(0, 0, 0, 0.6)" />
                          </TouchableOpacity>
                          {showTaxTooltip && (
                            <View style={styles.taxTooltip}>
                              <View style={styles.taxTooltipContent}>
                                <View style={styles.taxTooltipRow}>
                                  <Text style={styles.taxTooltipLabel}>Delivery Fee Tax</Text>
                                  <Text style={styles.taxTooltipValue}>
                                    ₹{deliveryFeeTax.toFixed(2)}
                                  </Text>
                                </View>
                                <View style={styles.taxTooltipRow}>
                                  <Text style={styles.taxTooltipLabel}>Platform Fee Tax</Text>
                                  <Text
                                    style={[
                                      styles.taxTooltipValue,
                                      !(includePlatformFee || platformFee === 0) && styles.billValueStrikethrough,
                                    ]}
                                  >
                                    ₹{platformFeeTax.toFixed(2)}
                                  </Text>
                                </View>
                                <View style={styles.taxTooltipRow}>
                                  <Text style={styles.taxTooltipLabel}>Tax Amount</Text>
                                  <Text style={styles.taxTooltipValue}>
                                    ₹{taxAmount.toFixed(2)}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.taxTooltipArrow} />
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={styles.billValue}>₹{gstAndCharges?.toFixed(2) ?? '0.00'}</Text>
                    </View>
                    {discountAmount > 0 && (
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Discount</Text>
                        <Text style={[styles.billValue, { color: '#00B14F' }]}>
                          -₹{discountAmount.toFixed(2)}
                        </Text>
                      </View>
                    )}
                    {walletApplied > 0 && (
                      <View style={styles.billRow} testID="checkout-wallet-row">
                        <Text style={styles.billLabel}>Tazty Wallet</Text>
                        <Text style={[styles.billValue, { color: '#00B14F' }]}>
                          -₹{walletApplied.toFixed(2)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.billDivider} />
                    <View style={styles.billTotalRow}>
                      <Text style={styles.billTotalLabel}>To Pay</Text>
                      <Text style={styles.billTotalValue} testID="checkout-to-pay">
                        ₹{amountToPay.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Payment Method Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Payment Method</Text>
                </View>

                <View style={[styles.sectionContent, styles.paymentSectionContent]}>
                  {/* Tazty Wallet at ₹0: still shown, so customers know it is
                      there and can top it up without leaving checkout. */}
                  {walletCanPay && walletBalance <= 0 && (
                    <View
                      style={[
                        styles.paymentOption,
                        selectedPaymentMethod === 'cod' && styles.paymentOptionDisabled,
                      ]}
                      testID="checkout-wallet-empty"
                    >
                      <View style={styles.paymentOptionContent}>
                        <View style={styles.paymentOptionTopRow}>
                          <View style={styles.paymentOptionLeft}>
                            <MaterialIcons name="account-balance-wallet" size={24} color="#00B14F" />
                            <Text style={styles.paymentOptionText}>
                              Tazty Wallet ({formatRupees(0)})
                            </Text>
                          </View>
                          {walletTopupAllowed && onAddMoneyToWallet ? (
                            <TouchableOpacity
                              style={styles.walletAddButton}
                              onPress={onAddMoneyToWallet}
                              activeOpacity={0.8}
                              testID="checkout-wallet-add-money"
                            >
                              <MaterialIcons name="add" size={16} color="#FFFFFF" />
                              <Text style={styles.walletAddButtonText}>Add money</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                        <Text style={styles.paymentOptionHelperText}>
                          {selectedPaymentMethod === 'cod'
                            ? "Tazty Wallet can't be used with Cash on Delivery."
                            : walletTopupAllowed && onAddMoneyToWallet
                              ? 'Add money to pay with your wallet.'
                              : 'Your wallet balance will show here.'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Tazty Wallet: on by default when there is a balance */}
                  {walletCanPay && walletBalance > 0 && (
                    <TouchableOpacity
                      style={[
                        styles.paymentOption,
                        walletApplied > 0 && styles.paymentOptionSelected,
                        selectedPaymentMethod === 'cod' && styles.paymentOptionDisabled,
                      ]}
                      onPress={() => setUseWallet(v => !v)}
                      disabled={selectedPaymentMethod === 'cod'}
                      activeOpacity={0.8}
                      testID="checkout-use-wallet"
                    >
                      <View style={styles.paymentOptionContent}>
                        <View style={styles.paymentOptionTopRow}>
                          <View style={styles.paymentOptionLeft}>
                            <MaterialIcons name="account-balance-wallet" size={24} color="#00B14F" />
                            <Text style={styles.paymentOptionText}>
                              Use Tazty Wallet ({formatRupees(walletBalance)})
                            </Text>
                          </View>
                          <View style={styles.walletRowRight}>
                            {walletTopupAllowed && onAddMoneyToWallet ? (
                              <TouchableOpacity
                                style={styles.walletAddChip}
                                onPress={onAddMoneyToWallet}
                                activeOpacity={0.8}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                testID="checkout-wallet-add-more"
                              >
                                <MaterialIcons name="add" size={14} color="#00B14F" />
                                <Text style={styles.walletAddChipText}>Add</Text>
                              </TouchableOpacity>
                            ) : null}
                            <MaterialIcons
                              name={walletApplied > 0 ? 'check-box' : 'check-box-outline-blank'}
                              size={24}
                              color={walletApplied > 0 ? '#00B14F' : 'rgba(0, 0, 0, 0.25)'}
                            />
                          </View>
                        </View>
                        <Text style={styles.paymentOptionHelperText}>
                          {selectedPaymentMethod === 'cod'
                            ? "Tazty Wallet can't be used with Cash on Delivery."
                            : walletApplied > 0 && amountToPay === 0
                              ? 'Your wallet covers this whole order.'
                              : walletApplied > 0
                                ? `${formatRupees(walletApplied)} from your wallet, the rest online.`
                                : 'Tap to use your wallet balance.'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.paymentOption,
                      selectedPaymentMethod === 'online' && styles.paymentOptionSelected,
                    ]}
                    onPress={() => setSelectedPaymentMethod('online')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.paymentOptionLeft}>
                      <MaterialIcons name="credit-card" size={24} color="#00B14F" />
                      <Text style={styles.paymentOptionText}>Online Payment</Text>
                    </View>
                    <MaterialIcons
                      name={selectedPaymentMethod === 'online' ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={24}
                      color={selectedPaymentMethod === 'online' ? '#00B14F' : 'rgba(0, 0, 0, 0.25)'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.paymentOption,
                      !isCodEnabled && styles.paymentOptionDisabled,
                      selectedPaymentMethod === 'cod' && isCodAllowed && styles.paymentOptionSelected,
                    ]}
                    onPress={() => {
                      if (isCodAllowed) {
                        setSelectedPaymentMethod('cod');
                      }
                    }}
                    disabled={!isCodAllowed}
                    activeOpacity={0.8}
                  >
                    <View style={styles.paymentOptionContent}>
                      <View style={styles.paymentOptionTopRow}>
                        <View style={styles.paymentOptionLeft}>
                          <MaterialIcons name="account-balance-wallet" size={24} color="#00B14F" />
                          <Text style={styles.paymentOptionText}>Cash on Delivery (COD)</Text>
                        </View>
                        {isCodAllowed && (
                          <MaterialIcons
                            name={selectedPaymentMethod === 'cod' ? 'radio-button-checked' : 'radio-button-unchecked'}
                            size={24}
                            color={selectedPaymentMethod === 'cod' ? '#00B14F' : 'rgba(0, 0, 0, 0.25)'}
                          />
                        )}
                      </View>

                      {isCodEnabled && !isCodAllowed && (
                        <Text style={styles.paymentOptionHelperText}>
                          COD is available only for orders between ₹{codMinAmount} and ₹{codMaxAmount}.
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Delivery Location Warning Section */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => setDeliveryLocationExpanded(!deliveryLocationExpanded)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionTitle}>Delivery Policy</Text>
                  <MaterialIcons
                    name={deliveryLocationExpanded ? 'expand-less' : 'expand-more'}
                    size={24}
                    color="#000000"
                  />
                </TouchableOpacity>

                {deliveryLocationExpanded && (
                  <View style={styles.sectionContent}>
                    <Text style={styles.cancellationText}>
                      Please ensure the delivery location is pinned correctly on the map. If the address is far from the pinned location, additional delivery charges may apply. Order cancellations due to incorrect location are non-refundable.
                    </Text>
                  </View>
                )}
              </View>

              {/* Cancellation Policy Section */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => setCancellationExpanded(!cancellationExpanded)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionTitle}>Cancellation Policy</Text>
                  <MaterialIcons
                    name={cancellationExpanded ? 'expand-less' : 'expand-more'}
                    size={24}
                    color="#000000"
                  />
                </TouchableOpacity>

                {cancellationExpanded && (
                  <View style={styles.sectionContent}>
                    <Text style={styles.cancellationText}>
                      Help us reduce food waste by avoiding cancellation after placing your
                      order. A 100% cancellation fee will be applied.
                    </Text>
                  </View>
                )}
              </View>

              {/* Add bottom padding for footer */}
              <View style={styles.bottomPadding} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Footer */}
        <View style={styles.footer}>
          <SafeAreaView edges={['bottom']} style={styles.footerSafeArea}>
            <View style={styles.footerContent}>
              <View style={styles.paymentInfo}>
                <MaterialIcons
                  name={selectedPaymentMethod === 'online' ? 'credit-card' : 'account-balance-wallet'}
                  size={20}
                  color="#00B14F"
                />
                <View style={styles.paymentInfoTextContainer}>
                  <Text style={styles.paymentInfoTitle}>
                    {selectedPaymentMethod === 'online' ? 'Online Payment' : 'Cash on Delivery'}
                  </Text>
                  <Text style={styles.paymentInfoSubtitle}>
                    {selectedPaymentMethod === 'online' ? 'UPI, Cards & More' : 'Pay at your doorstep'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.placeOrderButton,
                  (isPlacingOrder || !cartSummary) && styles.placeOrderButtonDisabled,
                ]}
                activeOpacity={0.8}
                onPress={handlePlaceOrder}
                // No summary means no priced bill. Letting the order through
                // here is how a ₹0.00 checkout became placeable.
                disabled={isPlacingOrder || !cartSummary}
              >
                <Text style={styles.placeOrderButtonText}>Place Order</Text>
                {isPlacingOrder ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
        {/* Promo error bar at the bottom of the screen */}
        {promoError ? (
          <View style={styles.promoErrorBar}>
            <Text style={styles.promoErrorBarText} numberOfLines={2}>
              {promoError}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <CodConfirmationModal
        visible={showCodConfirmModal}
        amount={totalAmount}
        onPlaceOrder={() => {
          setShowCodConfirmModal(false);
          proceedWithPlaceOrder();
        }}
        onCancel={() => setShowCodConfirmModal(false)}
      />

      {/* Address Selection Modal */}
      <AddressSelectionModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        addresses={addresses}
        selectedAddressId={selectedAddressId}
        onSelectAddress={async (addressId) => {
          // Find the address and check if it's within serviceable area (Madurai bounds)
          const address = addresses.find(addr => addr.id.toString() === addressId);

          if (address) {
            const isServiceable = homeService.isLocationServiceable(
              address.latitude,
              address.longitude
            );

            if (!isServiceable) {
              showConfirmation({
                title: 'Oops!',
                message: 'Service not available at the selected location',
                confirmText: 'OK',
                cancelText: '',
                onConfirm: () => { },
              });
              setShowAddressModal(false);
              return;
            }
          }

          // Set the selected address as default if it's not already the default
          const selectedAddress = addresses.find(addr => addr.id.toString() === addressId);
          if (selectedAddress && !selectedAddress.is_default) {
            try {
              const updateResponse = await addressService.updateAddress(addressId, {
                is_default: true,
              });

              if (updateResponse.success) {
                // Refresh addresses to get updated list with new default
                await fetchAddresses();
                // Trigger homepage refresh when address changes
                if (onAddressChange) {
                  onAddressChange();
                }
              }
            } catch (error: any) {
              // If setting default fails, still proceed with address selection
              console.error('Failed to set default address:', error);
            }
          } else {
            // Even if address is already default, trigger refresh to update distances
            if (onAddressChange) {
              onAddressChange();
            }
          }

          setSelectedAddressId(addressId);
          setShowAddressModal(false);
          await fetchCartSummary();
        }}
        onAddNewAddress={() => {
          if (addresses.length >= MAX_ADDRESSES) {
            showConfirmation({
              title: 'Address limit reached',
              message: `You can save up to ${MAX_ADDRESSES} delivery addresses. Please delete one before adding a new address.`,
              confirmText: 'OK',
              cancelText: '',
              onConfirm: () => { },
            });
            return;
          }
          setShowAddressModal(false);
          setShowLocationSelection(true);
        }}
        onSetDefaultAddress={async (addressId) => {
          try {
            const updateResponse = await addressService.updateAddress(addressId, {
              is_default: true,
            });

            if (updateResponse.success) {
              // Refresh addresses to get updated list
              await fetchAddresses();
              // Trigger homepage refresh when address changes
              if (onAddressChange) {
                onAddressChange();
              }
              // Also select this address if not already selected
              if (selectedAddressId !== addressId) {
                setSelectedAddressId(addressId);
              }
            } else {
              showConfirmation({
                title: 'Error',
                message: updateResponse.error || 'Failed to set default address',
                confirmText: 'OK',
                cancelText: 'Close',
                onConfirm: () => { },
              });
            }
          } catch (error: any) {
            showConfirmation({
              title: '',
              message: error.message || 'Failed to set default address',
              confirmText: 'OK',
              cancelText: '',
              onConfirm: () => { },
            });
          }
        }}
      />

      {/* Click outside overlay to close tooltip */}
      {showTaxTooltip && (
        <Pressable
          style={styles.tooltipOverlay}
          onPress={() => setShowTaxTooltip(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  walletAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00B14F',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  walletAddButtonText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  walletRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  walletAddChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: '#00B14F',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  walletAddChipText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: 0.2,
    color: '#00B14F',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  animatedContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#00B14F',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerSafeArea: {
    backgroundColor: '#00B14F',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTextContainer: {
    flex: 1,
  },
  restaurantName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    lineHeight: 30,
    color: '#FFFFFF',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  addressText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    marginLeft: 4,
    marginRight: 2,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    flex: 1,
  },
  sectionContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  paymentSectionContent: {
    paddingBottom: 0,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderItemDetails: {
    flex: 1,
    marginRight: 12,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vegIconSmall: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nonVegIconSmall: {
    borderColor: '#FF0000',
  },
  vegDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00B14F',
  },
  nonVegDotSmall: {
    backgroundColor: '#FF0000',
  },
  orderItemName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    flex: 1,
  },
  customizationsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 2,
    maxWidth: '85%',
  },
  orderItemCustomizations: {
    fontFamily: 'Poppins',
    fontSize: 11,
    lineHeight: 16,
    color: '#00B14F',
    marginRight: 4,
    flexShrink: 1,
  },
  orderItemPrice: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 8,
    marginRight: 8,
    minWidth: 75,
  },
  quantityButton: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    lineHeight: 21,
    color: '#00B14F',
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    marginHorizontal: 6,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.5)',
    textDecorationLine: 'line-through',
  },
  finalPrice: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  addMoreButton: {
    borderWidth: 2,
    borderColor: '#00B14F',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  addMoreButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
    color: '#00B14F',
  },
  notesContainer: {
    marginTop: 4,
  },
  notesLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.6)',
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    minHeight: 50,
  },
  subsection: {
    marginBottom: 16,
  },
  subsectionTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    marginBottom: 8,
  },
  deliveryAtBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
  },
  deliveryAtContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  deliveryAtText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    marginLeft: 8,
    flex: 1,
  },
  deliveryAtTextPlaceholder: {
    color: 'rgba(0, 0, 0, 0.4)',
    fontStyle: 'italic',
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#00B14F',
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addAddressButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
    color: '#00B14F',
  },
  deliveryOptionBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
  },
  deliveryOptionContent: {
    flex: 1,
  },
  deliveryOptionTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  deliveryOptionSubtitle: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#00B14F',
    marginTop: 2,
  },
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#00B14F',
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  deliveryTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
  },
  deliveryTimeText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    marginLeft: 8,
  },
  deliveryTimeBold: {
    fontFamily: 'Poppins_700Bold',
  },
  tipButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tipButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
  },
  tipButtonSelected: {
    backgroundColor: '#00B14F',
    borderColor: '#00B14F',
  },
  tipButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  tipButtonTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
  },
  tipButtonDisabled: {
    opacity: 0.5,
  },
  tipInfo: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(0, 0, 0, 0.5)',
    textAlign: 'center',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.10)',
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
  },
  paymentOptionSelected: {
    borderColor: 'rgba(0, 177, 79, 0.45)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  paymentOptionDisabled: {
    opacity: 0.5,
  },
  paymentOptionHelperText: {
    marginTop: 6,
    marginLeft: 36,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  paymentOptionContent: {
    flex: 1,
  },
  paymentOptionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentOptionText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    marginLeft: 12,
  },
  customTipContainer: {
    marginTop: 16,
    marginBottom: 12,
  },
  customTipLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.6)',
    marginBottom: 8,
  },
  customTipInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customTipInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#00B14F',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addTipButton: {
    backgroundColor: '#00B14F',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTipButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
  },
  addTipButtonDisabled: {
    opacity: 0.6,
  },
  rupeeSymbol: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 27,
    color: '#00B14F',
    marginRight: 8,
  },
  customTipInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 16,
    // lineHeight: 24,
    color: '#000000',
    padding: 0,
  },
  tipErrorText: {
    marginTop: 6,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11,
    lineHeight: 16,
    color: '#DC2626',
  },
  promoCodeContainer: {
    flexDirection: 'row',
  },
  promoCodeInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  applyButton: {
    backgroundColor: '#00B14F',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  applyButtonText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
  },
  applyButtonDisabled: {
    opacity: 0.6,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  billErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  billErrorText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#DC2626',
  },
  billLabel: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  billValue: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: '#000000',
  },
  platformFeeValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billValueStrikethrough: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(0, 0, 0, 0.5)',
    textDecorationLine: 'line-through',
  },
  billDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 12,
  },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  billTotalLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    lineHeight: 24,
    color: '#00B14F',
  },
  billTotalValue: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    lineHeight: 24,
    color: '#00B14F',
  },
  cancellationText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  bottomPadding: {
    height: 20,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  footerSafeArea: {
    backgroundColor: '#FFFFFF',
  },
  footerContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  paymentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.10)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  paymentInfoTextContainer: {
    marginLeft: 8,
    justifyContent: 'center',
  },
  paymentInfoTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
  },
  paymentInfoSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    lineHeight: 15,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  placeOrderButton: {
    flexDirection: 'row',
    backgroundColor: '#00B14F',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeOrderButtonText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    marginRight: 8,
  },
  placeOrderButtonDisabled: {
    opacity: 0.6,
  },
  promoErrorBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 115,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
  },
  promoErrorBarText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  billLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoIconWrapper: {
    position: 'relative',
  },
  tooltipOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  taxTooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    marginBottom: 8,
    marginLeft: -120,
    width: 240,
    zIndex: 1000,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  taxTooltipContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  taxTooltipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taxTooltipLabel: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  taxTooltipValue: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
  },
  taxTooltipDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 8,
  },
  taxTooltipTotalLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    lineHeight: 20,
    color: '#000000',
  },
  taxTooltipTotalValue: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    lineHeight: 20,
    color: '#00B14F',
  },
  taxTooltipArrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
});
