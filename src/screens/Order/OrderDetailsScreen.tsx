import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StatusBar,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { AddressSelectionModal } from '@/components/AddressSelectionModal';
import { LocationSelectionScreen } from '@/screens/Location/LocationSelectionScreen';
import { ordersService } from '@/services/orders.service';
import { addressService, AddressResponse } from '@/services/address.service';
import { paymentService } from '@/services/payment.service';
import { authService } from '@/services/auth.service';
import { homeService } from '@/services/home.service';
import { useCart } from '@/context/CartContext';
import { useConfirmation } from '@/context/ConfirmationContext';

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
  deliveryAddress?: string;
  cartItems?: CartItem[];
  onBack?: () => void;
  onEditCustomization?: (itemId: string, variantId: string, currentAddOnIds: string[], currentQuantity?: number) => void;
  onPlaceOrder?: () => void;
  onOrderSuccess?: (orderId: number) => void;
  onOrderCancel?: () => void;
  showCustomizationModal?: boolean;
  onUpdateCart?: (itemId: string, variantId: string | undefined, newQuantity: number) => void;
}

export const OrderDetailsScreen: React.FC<OrderDetailsScreenProps> = ({
  restaurantName = 'KFC',
  restaurantId,
  deliveryAddress = 'Chennai | F1, Jeyalakshmi Appartments...',
  cartItems = [],
  onBack,
  onEditCustomization,
  onPlaceOrder,
  onOrderSuccess,
  onOrderCancel,
  showCustomizationModal = false,
  onUpdateCart,
}) => {
  const { cart, clearCart } = useCart();
  const { showConfirmation } = useConfirmation();
  const [orderExpanded, setOrderExpanded] = useState(true);
  const [deliveryExpanded, setDeliveryExpanded] = useState(true);
  const [tipExpanded, setTipExpanded] = useState(true);
  const [promoExpanded, setPromoExpanded] = useState(true);
  const [billExpanded, setBillExpanded] = useState(true);
  const [cancellationExpanded, setCancellationExpanded] = useState(true);

  const [localCartItems, setLocalCartItems] = useState<CartItem[]>(cartItems);
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [customTipAmount, setCustomTipAmount] = useState('');
  const [selfPickup, setSelfPickup] = useState(false);
  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('1');
  const [showLocationSelection, setShowLocationSelection] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [addresses, setAddresses] = useState<AddressResponse[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

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

  // Fetch addresses from API
  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setIsLoadingAddresses(true);
      const response = await addressService.getAddresses();

      if (response.success && response.data) {
        setAddresses(response.data);

        // Set the default address as selected, or first address if no default
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
              title: 'Error',
              message: 'Service not available at the selected location',
              confirmText: 'OK',
              cancelText: 'Close',
              onConfirm: () => {},
            });
          }
        } else if (response.data.length > 0) {
          setSelectedAddressId(response.data[0].id.toString());

          // Check if the first address is within serviceable area (Madurai bounds)
          const isServiceable = homeService.isLocationServiceable(
            response.data[0].latitude,
            response.data[0].longitude
          );

          if (!isServiceable) {
            showConfirmation({
              title: 'Error',
              message: 'Service not available at the selected location',
              confirmText: 'OK',
              cancelText: 'Close',
              onConfirm: () => {},
            });
          }
        }
      } else {
        showConfirmation({
          title: 'Error',
          message: response.error || 'Failed to load addresses',
          confirmText: 'OK',
          cancelText: 'Close',
          onConfirm: () => {},
        });
      }
    } catch (error: any) {
      showConfirmation({
        title: 'Error',
        message: error.message || 'Failed to load addresses',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  // Sync local cart items with parent cart items
  useEffect(() => {
    setLocalCartItems(cartItems);
  }, [cartItems]);

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
    if (!restaurantId) {
      showConfirmation({
        title: 'Error',
        message: 'Restaurant information is missing',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
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
          title: 'Error',
          message: 'Service not available at the selected location',
          confirmText: 'OK',
          cancelText: 'Close',
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

    setIsPlacingOrder(true);

    try {
      const cartItems = Object.values(cart);

      // Step 1: Add all cart items to the server cart
      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];

        // Handle regular items
        if (!item.isCustomizable || !item.variants) {
          const addToCartRequest = {
            restaurant_id: restaurantId,
            item_id: parseInt(item.id),
            quantity: item.quantity || 1,
            special_instructions: notes,
          };

          const addResult = await ordersService.addToCart(addToCartRequest);

          if (!addResult.success) {
            throw new Error(`Failed to add ${item.name} to cart: ${addResult.error}`);
          }
        } else {
          // Handle items with variants/customizations
          for (const variant of item.variants || []) {
            // Build customizations array from stored customization groups
            const customizations = [];
            if (variant.customizationGroups && variant.customizationGroups.length > 0) {
              variant.customizationGroups.forEach(group => {
                customizations.push({
                  customization_group_id: group.group_id,
                  selected_options: group.selected_option_ids
                });
              });
            }

            const addToCartRequest = {
              restaurant_id: restaurantId,
              item_id: parseInt(item.id),
              quantity: variant.quantity,
              customizations: customizations.length > 0 ? customizations : undefined,
              special_instructions: notes,
            };

            const addResult = await ordersService.addToCart(addToCartRequest);

            if (!addResult.success) {
              throw new Error(`Failed to add customization to cart: ${addResult.error}`);
            }
          }
        }
      }

      // Step 2: Create order with online payment
      const createOrderRequest = {
        delivery_address_id: parseInt(selectedAddressId),
        payment_method: 'online' as const,
        notes: notes || undefined,
      };

      const orderResponse = await ordersService.createOrder(createOrderRequest);

      if (orderResponse.success && orderResponse.data) {
        // Get order data - API returns data nested under 'order' key
        const orderData = orderResponse.data.order || orderResponse.data;
        const orderNumber = orderData.order_number || orderData.orderNumber || 'N/A';
        const orderId = orderData.id || orderData.order_id;

        // Process online payment via Razorpay
        // Get user details for payment
        const user = await authService.getCurrentUser();

        const paymentResult = await paymentService.processPayment(
          orderId,
          {
            name: user?.name || 'User',
            email: user?.email,
            phone: user?.phoneNumber || '',
          }
        );

        if (paymentResult.success) {
          // Payment successful - clear cart and show success
          clearCart();

          showConfirmation({
            title: 'Payment Successful! 🎉',
            message: orderNumber !== 'N/A'
              ? `Your order #${orderNumber} has been placed and paid successfully.`
              : 'Your order has been placed and paid successfully.',
            confirmText: 'View Order',
            cancelText: 'Close',
            confirmButtonColor: '#00B14F',
            showRibbon: false,
            onConfirm: () => {
              if (onOrderSuccess && orderId) {
                onOrderSuccess(orderId);
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
        } else {
          // Payment failed - cancel the order to prevent it from staying in database
          try {
            await ordersService.cancelOrder(orderId, 'Payment failed');
          } catch (cancelError) {
            // Failed to cancel order - error is logged silently
          }

          showConfirmation({
            title: 'Payment Failed',
            message: 'Payment could not be processed. Please try again or contact support if the issue persists.',
            confirmText: 'OK',
            cancelText: 'Close',
            confirmButtonColor: '#DC2626',
            onConfirm: () => {},
          });
        }
      } else {
        showConfirmation({
          title: 'Error',
          message: orderResponse.error || 'Failed to place order',
          confirmText: 'OK',
          cancelText: 'Close',
          onConfirm: () => {},
        });
      }
    } catch (error: any) {
      showConfirmation({
        title: 'Error',
        message: error.message || 'Failed to place order',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
    } finally{
      setIsPlacingOrder(false);
    }
  };

  const handleIncrement = (itemId: string, variantId?: string) => {
    // Find current item first to get proper quantity
    const currentItem = localCartItems.find(i => variantId ? i.variantId === variantId : i.id === itemId);
    if (!currentItem) return;

    const newQuantity = currentItem.quantity + 1;

    // Update local state
    setLocalCartItems(prev =>
      prev.map(item => {
        const matchesItem = variantId ? item.variantId === variantId : item.id === itemId;
        return matchesItem
          ? { ...item, quantity: newQuantity }
          : item;
      })
    );

    // Update parent cart state
    if (onUpdateCart) {
      onUpdateCart(itemId, variantId, newQuantity);
    }
  };

  const handleDecrement = (itemId: string, variantId?: string) => {
    // Find current item first
    const currentItem = localCartItems.find(i => variantId ? i.variantId === variantId : i.id === itemId);
    if (!currentItem) return;

    const newQuantity = currentItem.quantity - 1;

    if (newQuantity === 0) {
      // Remove item from cart
      setLocalCartItems(prev =>
        prev.filter(i => variantId ? i.variantId !== variantId : i.id !== itemId)
      );

      // Update parent cart state
      if (onUpdateCart) {
        onUpdateCart(itemId, variantId, 0);
      }
    } else {
      // Decrease quantity
      setLocalCartItems(prev =>
        prev.map(i => {
          const matchesItem = variantId ? i.variantId === variantId : i.id === itemId;
          return matchesItem
            ? { ...i, quantity: newQuantity }
            : i;
        })
      );

      // Update parent cart state
      if (onUpdateCart) {
        onUpdateCart(itemId, variantId, newQuantity);
      }
    }
  };

  // Calculate totals
  const itemTotal = localCartItems.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;
    const subtotal = price * quantity;
    return sum + subtotal;
  }, 0);

  const gstAndCharges = Math.round(itemTotal * 0.18); // 18% GST
  const deliveryFee = selfPickup ? 0 : 29;
  const platformFee = 10;

  // Calculate tip amount based on selection
  const tipAmount = (() => {
    if (selectedTip === null) return 0;
    if (selectedTip === -1) {
      // "Other" is selected, use custom amount
      const customAmount = parseInt(customTipAmount) || 0;
      return customAmount;
    }
    return selectedTip;
  })();

  const totalAmount = itemTotal + gstAndCharges + deliveryFee + platformFee + tipAmount;

  // If location selection is shown, render it as an overlay
  if (showLocationSelection) {
    return (
      <View style={styles.container}>
        <LocationSelectionScreen
          onBack={() => setShowLocationSelection(false)}
          onLocationConfirm={async (location) => {
            setShowLocationSelection(false);
            // Refresh addresses after adding new one
            await fetchAddresses();
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
              <Text style={styles.restaurantName}>{restaurantName}</Text>
              <View style={styles.addressContainer}>
                <MaterialIcons name="location-on" size={14} color="#FFFFFF" />
                <Text style={styles.addressText} numberOfLines={1}>
                  {deliveryAddress}
                </Text>
              </View>
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
                        <TouchableOpacity onPress={() => handleDecrement(item.id, item.variantId)} activeOpacity={0.7}>
                          <Text style={styles.quantityButton}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{item.quantity}</Text>
                        <TouchableOpacity onPress={() => handleIncrement(item.id, item.variantId)} activeOpacity={0.7}>
                          <Text style={styles.quantityButton}>+</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.priceContainer}>
                        <Text style={styles.finalPrice}>₹{itemPrice}</Text>
                      </View>
                    </View>
                  );
                })}

                {/* Add More Items Button */}
                <TouchableOpacity style={styles.addMoreButton} activeOpacity={0.7} onPress={onBack}>
                  <Text style={styles.addMoreButtonText}>+ Add More Items</Text>
                </TouchableOpacity>

                {/* Notes */}
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Notes</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="I need more spicy and tasty"
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
                      <Text style={styles.deliveryAtText} numberOfLines={1}>
                        {selectedAddress ? formatAddress(selectedAddress) : deliveryAddress}
                      </Text>
                    </View>
                    <MaterialIcons name="expand-more" size={20} color="rgba(0, 0, 0, 0.5)" />
                  </TouchableOpacity>
                </View>

                {/* Delivery Duration */}
                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>Delivery Duration</Text>
                  <View style={styles.deliveryTimeBox}>
                    <MaterialIcons name="access-time" size={20} color="#00B14F" />
                    <Text style={styles.deliveryTimeText}>
                      Delivery in <Text style={styles.deliveryTimeBold}>15 - 20 mins</Text>
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Tip Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setTipExpanded(!tipExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Tip for your delivery partner</Text>
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
                      ]}
                      onPress={() => {
                        setSelectedTip(selectedTip === amount ? null : amount);
                        setCustomTipAmount(''); // Clear custom amount when selecting preset
                      }}
                      activeOpacity={0.7}
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
                  <TouchableOpacity
                    style={[
                      styles.tipButton,
                      selectedTip === -1 && styles.tipButtonSelected,
                    ]}
                    onPress={() => setSelectedTip(selectedTip === -1 ? null : -1)}
                    activeOpacity={0.7}
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
                </View>

                {/* Custom Tip Input */}
                {selectedTip === -1 && (
                  <View style={styles.customTipContainer}>
                    <Text style={styles.customTipLabel}>Enter custom tip amount</Text>
                    <View style={styles.customTipInputContainer}>
                      <Text style={styles.rupeeSymbol}>₹</Text>
                      <TextInput
                        style={styles.customTipInput}
                        placeholder="0"
                        placeholderTextColor="rgba(0, 0, 0, 0.4)"
                        value={customTipAmount}
                        onChangeText={setCustomTipAmount}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                )}

                <Text style={styles.tipInfo}>
                  100% of the tip will go to your delivery partner.
                </Text>
              </View>
            )}
          </View>

          {/* Apply Promo Code Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setPromoExpanded(!promoExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Apply Promo Code</Text>
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
                    onChangeText={setPromoCode}
                  />
                  <TouchableOpacity style={styles.applyButton} activeOpacity={0.8}>
                    <Text style={styles.applyButtonText}>APPLY</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

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
                  <Text style={styles.billValue}>₹{itemTotal}</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>GST and Restaurant Charges</Text>
                  <Text style={styles.billValue}>₹{gstAndCharges}</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Delivery Partner Fee</Text>
                  <Text style={styles.billValue}>₹{deliveryFee}</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Platform Fee</Text>
                  <Text style={styles.billValue}>₹{platformFee}</Text>
                </View>
                {tipAmount > 0 && (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Tip for Delivery Partner</Text>
                    <Text style={styles.billValue}>₹{tipAmount}</Text>
                  </View>
                )}
                <View style={styles.billDivider} />
                <View style={styles.billTotalRow}>
                  <Text style={styles.billTotalLabel}>To Pay</Text>
                  <Text style={styles.billTotalValue}>₹{totalAmount}</Text>
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
      </Animated.View>

      {/* Address Selection Modal */}
      <AddressSelectionModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        addresses={addresses}
        selectedAddressId={selectedAddressId}
        onSelectAddress={(addressId) => {
          // Find the address and check if it's within serviceable area (Madurai bounds)
          const address = addresses.find(addr => addr.id.toString() === addressId);

          if (address) {
            const isServiceable = homeService.isLocationServiceable(
              address.latitude,
              address.longitude
            );

            if (!isServiceable) {
              showConfirmation({
                title: 'Error',
                message: 'Service not available at the selected location',
                confirmText: 'OK',
                cancelText: 'Close',
                onConfirm: () => {},
              });
              setShowAddressModal(false);
              return;
            }
          }

          setSelectedAddressId(addressId);
          setShowAddressModal(false);
        }}
        onAddNewAddress={() => {
          setShowAddressModal(false);
          setShowLocationSelection(true);
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    fontSize: 14,
    lineHeight: 21,
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
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 8,
    marginRight: 8,
    minWidth: 60,
  },
  quantityButton: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    lineHeight: 21,
    color: '#00B14F',
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
    fontSize: 16,
    lineHeight: 24,
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
  customTipInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#00B14F',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    lineHeight: 24,
    color: '#000000',
    padding: 0,
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
  },
  applyButtonText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
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
});
