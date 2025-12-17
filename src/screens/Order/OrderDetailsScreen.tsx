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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { AddressSelectionModal } from '@/components/AddressSelectionModal';
import { LocationSelectionScreen } from '@/screens/Location/LocationSelectionScreen';
import { ordersService } from '@/services/orders.service';
import { addressService, AddressResponse, MAX_ADDRESSES } from '@/services/address.service';
import { paymentService, PaymentErrorType } from '@/services/payment.service';
import { homeService } from '@/services/home.service';
import { cartService, CartSummary } from '@/services/cart.service';
import { restaurantService } from '@/services/restaurant.service';
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
  onEditCustomization,
  onPlaceOrder,
  onOrderSuccess,
  onOrderCancel,
  showCustomizationModal = false,
  onUpdateCart,
  onAddressChange,
}) => {
  const { cart, clearCart, updateQuantity, removeFromCart, setRestaurantInfo, restaurantId: contextRestaurantId, restaurantName: contextRestaurantName } = useCart();
  const { showConfirmation } = useConfirmation();
  const [orderExpanded, setOrderExpanded] = useState(true);
  const [deliveryExpanded, setDeliveryExpanded] = useState(true);
  const [tipExpanded, setTipExpanded] = useState(true);
  const [promoExpanded, setPromoExpanded] = useState(true);
  const [billExpanded, setBillExpanded] = useState(true);
  const [cancellationExpanded, setCancellationExpanded] = useState(true);

  const showQuantityLimitAlert = () => {
    showConfirmation({
      title: 'Quantity limit reached',
      message: `You can add up to ${MAX_ITEM_QUANTITY} units of each item.`,
      confirmText: 'OK',
      cancelText: '',
      confirmButtonColor: '#00B14F',
      onConfirm: () => {},
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
  const [selfPickup, setSelfPickup] = useState(false);
  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(undefined);
  const [showLocationSelection, setShowLocationSelection] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [addresses, setAddresses] = useState<AddressResponse[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [cartSummary, setCartSummary] = useState<CartSummary | null>(null);
  const [isLoadingCartSummary, setIsLoadingCartSummary] = useState(false);
  const [cartData, setCartData] = useState<any>(null);
  const [isUpdatingTip, setIsUpdatingTip] = useState(false);
  const [maxTipAmount, setMaxTipAmount] = useState<number | null>(null);
  const [tipError, setTipError] = useState('');
  const [promoError, setPromoError] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const lastAutoRemovedTotalRef = useRef<number | null>(null);
  
  // Track latest update sequence to ensure we only apply cart_summary from the most recent update
  const updateSequenceRef = useRef<number>(0);
  const pendingUpdateRef = useRef<{ itemId: string; quantity: number; sequence: number } | null>(null);

  // Convenience accessors for backend-calculated amounts (no client-side recomputation)
  const itemTotal = cartSummary?.subtotal ?? 0;
  const deliveryFee = cartSummary?.delivery_fee ?? 0;
  const gstAndCharges = cartSummary?.tax_amount ?? 0;
  const discountAmount = cartSummary?.discount_amount ?? 0;
  const platformFee = (cartSummary as any)?.platform_fee ?? 0;
  const includePlatformFee = (cartSummary as any)?.include_platform_fee ?? false;
  const backendTipAmount = (cartSummary as any)?.tip_amount ?? 0;
  const totalAmount = cartSummary?.final_amount ?? 0;
  const estimatedDeliveryTimeRaw = (cartSummary as any)?.estimated_delivery_time ?? null;
  
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

  // Determine if a coupon is currently applied based on discount amount
  const isCouponApplied = !!cartSummary && (cartSummary.discount_amount ?? 0) > 0;
  
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

      const timings = response.data.timings;
      const isOpen = timings ? homeService.isRestaurantOpen(timings) : true;

      if (!isOpen) {
        showConfirmation({
          title: 'Restaurant is currently closed',
          message: 'This restaurant is closed right now. You can place the order when it reopens.',
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#00B14F',
          onConfirm: () => {},
        });
        return false;
      }

      return true;
    } catch {
      // On any unexpected error, allow and let backend enforce rules
      return true;
    }
  };

  // Fetch addresses and cart summary from API
  useEffect(() => {
    fetchAddresses();
    fetchCartSummary();
  }, []);

  // Refetch addresses when screen becomes visible (e.g., after account switch)
  useEffect(() => {
    if (visible) {
      fetchAddresses();
    }
  }, [visible]);

  // Fetch cart summary when cart changes (debounced to avoid too many API calls)
  useEffect(() => {
    // Use a timeout to debounce the API call
    const timeoutId = setTimeout(() => {
      fetchCartSummary();
    }, 300); // Wait 300ms after cart changes before fetching

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(cart).length, localCartItems.length]); // Use cart length instead of JSON.stringify

  // Automatically remove promo code if total amount goes below ₹100
  useEffect(() => {
    // Only check if cart summary is loaded and we have a valid total amount
    if (!cartSummary || totalAmount === 0) {
      return;
    }

    // Check if cart has preorder items - if so, skip coupon removal logic
    const hasPreorderItems = cartData?.items?.some((item: any) => 
      item.is_preorder === true && 
      item.preorder_campaign && 
      item.preorder_campaign.id
    );

    // If cart has preorder items, don't remove coupon automatically
    if (hasPreorderItems) {
      return;
    }

    // Check if coupon is applied and total is below ₹100
    const MINIMUM_ORDER_AMOUNT = 100;
    const shouldRemovePromo = isCouponApplied && totalAmount < MINIMUM_ORDER_AMOUNT;

    // Prevent duplicate removals for the same total amount
    // Only remove if this is a new low total (different from last auto-removed total)
    if (shouldRemovePromo && lastAutoRemovedTotalRef.current !== totalAmount) {
      // Mark this total as handled
      lastAutoRemovedTotalRef.current = totalAmount;

      // Automatically remove the promo code
      const autoRemovePromo = async () => {
        try {
          setIsApplyingPromo(true);
          setPromoError('');

          const response = await cartService.removeCoupon();

          if (response.success && response.cart_summary) {
            // Update cart summary with new values (without discount)
            setCartSummary(response.cart_summary);

            // Clear promo code input
            setPromoCode('');
            setPromoError('');

            // Show user-friendly message explaining why promo was removed
            showConfirmation({
              title: 'Promo Code Removed',
              message: `Your order total is below ₹${MINIMUM_ORDER_AMOUNT}. Promo codes require a minimum order value of ₹${MINIMUM_ORDER_AMOUNT}.`,
              confirmText: 'OK',
              cancelText: '',
              confirmButtonColor: '#00B14F',
              onConfirm: () => {},
            });
          } else {
            // If removal fails, show error
            setPromoError(response.message || 'Failed to remove promo code.');
          }
        } catch (error: any) {
          setPromoError(error?.message || 'Failed to remove promo code.');
        } finally {
          setIsApplyingPromo(false);
        }
      };

      autoRemovePromo();
    }

    // Reset the ref when total goes back above minimum (allows future auto-removal if needed)
    if (totalAmount >= MINIMUM_ORDER_AMOUNT && lastAutoRemovedTotalRef.current !== null) {
      lastAutoRemovedTotalRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalAmount, isCouponApplied, cartSummary, cartData]);

  const fetchCartSummary = async () => {
    try {
      setIsLoadingCartSummary(true);
      const cartResponse = await cartService.getCart();

      if (cartResponse) {
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
          if (promoCode.trim() === '') {
            if (cartResponse.summary.applied_offer?.offer_code) {
              setPromoCode(cartResponse.summary.applied_offer.offer_code);
            }
          }
          // Note: We don't clear promo code if user has entered something, even if backend has no offer
          // This allows user to keep typing/editing without interruption
        }
      } else {
        setCartData(null);
      }
    } catch (error: any) {
      setCartData(null);
    } finally {
      setIsLoadingCartSummary(false);
    }
  };

  // Get restaurant name and address from cart API data
  const displayRestaurantName = cartData?.restaurant_name || contextRestaurantName || restaurantName || '';
  const displayRestaurantAddress = cartData?.restaurant_address  || '';

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
              onConfirm: () => {},
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
          onConfirm: () => {},
        });
      }
    } catch (error: any) {
      showConfirmation({
        title: '',
        message: error.message || 'Failed to load addresses',
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => {},
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

  const handlePlaceOrder = async () => {
    if (!effectiveRestaurantId) {
      showConfirmation({
        title: 'Error',
        message: 'Restaurant information is missing',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
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
          onConfirm: () => {},
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
        onConfirm: () => {},
      });
      return;
    }

    // Final guard: ensure restaurant is open before creating order & starting payment
    const isOpen = await ensureRestaurantOpenBeforeOrder();
    if (!isOpen) {
      return;
    }

    setIsPlacingOrder(true);

    try {
      // Cart is already synced with backend via CartContext
      // So we can directly create order from the backend cart

      // Create order with online payment
      const createOrderRequest = {
        delivery_address_id: parseInt(selectedAddressId),
        payment_method: 'online' as const,
        notes: notes || undefined,
      };

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

        // Extract payment_details from order response
        // Payment details are in responseData.payment_details
        const paymentDetails = responseData.payment_details;
        
        // Check if payment is required
        if (!paymentDetails) {
          // If no payment_details, order might be COD or payment not required
          // Clear local cart for COD orders (backend handles API clearing)
          clearCart(false);
          setNotes(''); // Reset notes for next order
          setSelectedTip(null); // Reset tip selection
          setCustomTipAmount(''); // Reset custom tip amount
          
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

        // Process online payment via Razorpay using payment_details from order response
        const paymentResult = await paymentService.processPayment(
          orderId,
          paymentDetails
        );

        if (paymentResult.success) {
          // Payment successful - clear local cart and reset form (backend handles API clearing)
          clearCart(false);
          setNotes(''); // Reset notes for next order
          setSelectedTip(null); // Reset tip selection
          setCustomTipAmount(''); // Reset custom tip amount

          showConfirmation({
            title: 'Payment Successful! 🎉',
            message: orderNumber !== 'N/A'
              ? `Your order #${orderNumber} has been placed and paid successfully.`
              : 'Your order has been placed and paid successfully.',
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

          // Only mark as payment failed if it's not a user cancellation or network error
          if (shouldMarkAsFailed) {
            try {
              // Use payment failure endpoint to mark order as payment_failed
              await paymentService.handlePaymentFailure(orderId, {
                reason: errorMessage,
              });
            } catch (failureError) {
              // If payment failure endpoint fails, try cancel order as fallback
              try {
                await ordersService.cancelOrder(orderId, `Payment failed: ${errorMessage}`);
              } catch (cancelError) {
                // If both fail, log but don't block user flow
                console.error('Failed to mark order as payment failed:', failureError, cancelError);
              }
            }
          }

          // Don't reset form or clear cart - user can try again with same selections
          // Cart is preserved so user can retry placing the order

          // Show appropriate confirmation with "Try Again" button for all error types
          // User stays on OrderDetailsScreen (cart page) to try again
          showConfirmation({
            title,
            message,
            confirmText: 'Try Again',
            cancelText: '',
            confirmButtonColor: '#00B14F',
            onConfirm: () => {
              // Just close the dialog - user stays on OrderDetailsScreen (cart page) to try again
              // No navigation needed, cart is preserved
            },
          });
        }
      } else {
        showConfirmation({
          title: '',
          message: orderResponse.error || 'Failed to place order',
          confirmText: 'OK',
          cancelText: '',
          onConfirm: () => {},
        });
      }
    } catch (error: any) {
      showConfirmation({
        title: '',
        message: error.message || 'Failed to place order',
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => {},
      });
    } finally{
      setIsPlacingOrder(false);
    }
  };

  const handleIncrement = async (itemId: string, variantId?: string) => {
    // Find current item first to get proper quantity
    const currentItem = localCartItems.find(i => variantId ? i.variantId === variantId : i.id === itemId);
    if (!currentItem) return;
    const totalQuantityForItem = getLocalItemTotalQuantity(itemId);
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
          onConfirm: () => {},
        });
      }
      
      // Still try to fetch cart summary if this was the latest update
      if (pendingUpdateRef.current?.sequence === currentSequence) {
        fetchCartSummary();
        pendingUpdateRef.current = null;
      }
    });

    // Only re-apply promo code if it was previously successfully applied (after clicking Apply button)
    // This ensures discount is recalculated correctly when cart items change
    // Note: We don't await this - it will be handled when cart_summary updates
    // Skip applying coupon if cart has preorder items
    if (isCouponApplied && promoCode && promoCode.trim() !== '' && !hasPreorderItems) {
      // Delay promo re-application slightly to let cart_summary update first
      setTimeout(async () => {
        try {
          const normalizedCode = promoCode.trim().toUpperCase();
          const response = await cartService.applyCoupon(normalizedCode);
          if (response.success && response.cart_summary) {
            setCartSummary(response.cart_summary);
            setPromoError('');
          } else {
            // If promo becomes invalid, clear it from state
            setPromoCode('');
            setPromoError(response.message || 'Promo code is no longer valid.');
          }
        } catch (error) {
          // Silent fail - discount will be updated via cart summary
          // If promo becomes invalid, it will be handled by auto-remove logic
        }
      }, 400); // Wait 400ms after quantity update (debounce + API call time)
    }

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
      }).catch(() => {
        // On error, still try to fetch cart summary if this was the latest update
        if (pendingUpdateRef.current?.sequence === currentSequence) {
          fetchCartSummary();
          pendingUpdateRef.current = null;
        }
      });

      // Only re-apply promo code if it was previously successfully applied (after clicking Apply button)
      // This ensures discount is recalculated correctly when cart items change
      if (isCouponApplied && promoCode && promoCode.trim() !== '') {
        // Delay promo re-application slightly to let cart_summary update first
        setTimeout(async () => {
          try {
            const normalizedCode = promoCode.trim().toUpperCase();
            const response = await cartService.applyCoupon(normalizedCode);
            if (response.success && response.cart_summary) {
              setCartSummary(response.cart_summary);
              setPromoError('');
            } else {
              // If promo becomes invalid, clear it from state
              setPromoCode('');
              setPromoError(response.message || 'Promo code is no longer valid.');
            }
          } catch (error) {
            // Silent fail - discount will be updated via fetchCartSummary
            // If promo becomes invalid, it will be handled by auto-remove logic
          }
        }, 400); // Wait 400ms after remove (API call time)
      }

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
            onConfirm: () => {},
          });
        }
        
        // Still try to fetch cart summary if this was the latest update
        if (pendingUpdateRef.current?.sequence === currentSequence) {
          fetchCartSummary();
          pendingUpdateRef.current = null;
        }
      });

      // Only re-apply promo code if it was previously successfully applied (after clicking Apply button)
      // This ensures discount is recalculated correctly when cart items change
      // Skip applying coupon if cart has preorder items
      if (isCouponApplied && promoCode && promoCode.trim() !== '' && !hasPreorderItems) {
        // Delay promo re-application slightly to let cart_summary update first
        setTimeout(async () => {
          try {
            const normalizedCode = promoCode.trim().toUpperCase();
            const response = await cartService.applyCoupon(normalizedCode);
            if (response.success && response.cart_summary) {
              setCartSummary(response.cart_summary);
              setPromoError('');
            } else {
              // If promo becomes invalid, clear it from state
              setPromoCode('');
              setPromoError(response.message || 'Promo code is no longer valid.');
            }
          } catch (error) {
            // Silent fail - discount will be updated via cart summary
            // If promo becomes invalid, it will be handled by auto-remove logic
          }
        }, 400); // Wait 400ms after quantity update (debounce + API call time)
      }

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

      {/* Main Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

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
                {localCartItems.map((item) => {
                  const isAtQuantityLimit = getLocalItemTotalQuantity(item.id) >= MAX_ITEM_QUANTITY;
                  const itemPrice = item.price * item.quantity;

                  return (
                    <View key={item.variantId || item.id} style={styles.orderItem}>
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
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text style={styles.quantityButton}>-</Text>
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

                {/* Add More Items Button */}
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

                {/* Notes */}
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Notes</Text>
                  <TextInput
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
                              !selectedAddress && styles.deliveryAtTextPlaceholder
                            ]} 
                            numberOfLines={1}
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
                        <TextInput
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
                    <TextInput
                      style={styles.promoCodeInput}
                      placeholder="Enter promo code"
                      placeholderTextColor="rgba(0, 0, 0, 0.4)"
                      value={promoCode}
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
                  <Text style={styles.billLabel}>Taxes and Charges</Text>
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
                <View style={styles.billDivider} />
                <View style={styles.billTotalRow}>
                  <Text style={styles.billTotalLabel}>To Pay</Text>
                  <Text style={styles.billTotalValue}>₹{totalAmount.toFixed(2)}</Text>
                </View>
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

      {/* Footer */}
      <View style={styles.footer}>
        <SafeAreaView edges={['bottom']} style={styles.footerSafeArea}>
          <View style={styles.footerContent}>
            <View style={styles.paymentInfo}>
              <MaterialIcons
                name="credit-card"
                size={20}
                color="#00B14F"
              />
              <View style={styles.paymentInfoTextContainer}>
                <Text style={styles.paymentInfoTitle}>Online Payment</Text>
                <Text style={styles.paymentInfoSubtitle}>UPI, Cards & More</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.placeOrderButton, isPlacingOrder && styles.placeOrderButtonDisabled]}
              activeOpacity={0.8}
              onPress={handlePlaceOrder}
              disabled={isPlacingOrder}
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
                onConfirm: () => {},
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
              onConfirm: () => {},
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
                onConfirm: () => {},
              });
            }
          } catch (error: any) {
            showConfirmation({
              title: '',
              message: error.message || 'Failed to set default address',
              confirmText: 'OK',
              cancelText: '',
              onConfirm: () => {},
            });
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 10,
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
    borderRadius: 8,
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
});
