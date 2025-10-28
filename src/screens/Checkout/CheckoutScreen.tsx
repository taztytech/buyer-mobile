import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useCart } from '@/context/CartContext';
import { ordersService } from '@/services/orders.service';
import { useConfirmation } from '@/context/ConfirmationContext';
import { addressService, AddressResponse } from '@/services/address.service';
import { paymentService } from '@/services/payment.service';
import { authService } from '@/services/auth.service';

interface DeliveryAddress {
  id: number;
  type: string;
  address: string;
  city: string;
  is_default: boolean;
}

interface CheckoutScreenProps {
  onBack?: () => void;
  onOrderSuccess?: (orderId: number) => void;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  onBack,
  onOrderSuccess,
}) => {
  const { cart, getTotalPrice, restaurantName, restaurantLogo, clearCart, restaurantId } = useCart();
  const { showConfirmation } = useConfirmation();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(null);
  const [notes, setNotes] = useState('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cod' | 'online'>('cod');

  const subtotal = getTotalPrice();
  const deliveryFee = 30;
  const tax = Math.round(subtotal * 0.05); // 5% tax
  const total = subtotal + deliveryFee + tax;

  // Fetch user's delivery addresses
  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setIsLoadingAddress(true);
      const response = await addressService.getAddresses();

      if (response.success && response.data && response.data.length > 0) {
        // Find the default address or use the first one
        const defaultAddress = response.data.find((addr: AddressResponse) => addr.is_default) || response.data[0];

        // Convert API address format to DeliveryAddress format
        setDeliveryAddress({
          id: defaultAddress.id,
          type: defaultAddress.type,
          address: [defaultAddress.address1, defaultAddress.address2, defaultAddress.address3]
            .filter(Boolean)
            .join(', '),
          city: defaultAddress.city,
          is_default: defaultAddress.is_default,
        });
      } else {
        // Fallback to mock data if no addresses found
        setDeliveryAddress({
          id: 1,
          type: 'home',
          address: '123 Main Street',
          city: 'Madurai',
          is_default: true,
        });
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      // Fallback to mock data on error
      setDeliveryAddress({
        id: 1,
        type: 'home',
        address: '123 Main Street',
        city: 'Madurai',
        is_default: true,
      });
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!deliveryAddress) {
      showConfirmation({
        title: 'Error',
        message: 'Please select a delivery address',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
      return;
    }

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
            const addToCartRequest = {
              restaurant_id: restaurantId,
              item_id: parseInt(item.id),
              quantity: variant.quantity,
              special_instructions: notes,
            };

            const addResult = await ordersService.addToCart(addToCartRequest);

            if (!addResult.success) {
              throw new Error(`Failed to add ${variant.variantName} to cart: ${addResult.error}`);
            }
          }
        }
      }

      // Step 2: Create order
      const createOrderRequest = {
        delivery_address_id: deliveryAddress.id,
        payment_method: selectedPaymentMethod,
        notes: notes || undefined,
      };

      const orderResponse = await ordersService.createOrder(createOrderRequest);

      if (orderResponse.success && orderResponse.data) {
        // Get order data - API returns data nested under 'order' key
        const orderData = orderResponse.data.order || orderResponse.data;
        const orderNumber = orderData.order_number || orderData.orderNumber || 'N/A';
        const orderId = orderData.id || orderData.order_id;

        // Step 3: Handle payment based on method
        if (selectedPaymentMethod === 'online') {
          console.log('🟢 [Checkout] Online payment selected, starting payment flow');
          // Process online payment via Razorpay
          setIsPlacingOrder(true);

          // Get user details
          const user = await authService.getCurrentUser();
          console.log('🟢 [Checkout] User details:', user);

          const paymentResult = await paymentService.processPayment(
            orderId,
            {
              name: user?.name || 'User',
              email: user?.email,
              phone: user?.phoneNumber || '',
            }
          );

          console.log('🟢 [Checkout] Payment result:', paymentResult);

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
              onConfirm: () => {
                if (onOrderSuccess && orderId) {
                  onOrderSuccess(orderId);
                }
              },
            });
          } else {
            // Payment failed
            showConfirmation({
              title: 'Payment Failed',
              message: paymentResult.error || 'Payment could not be processed. Your order has been created but not confirmed. Please try again.',
              confirmText: 'Retry Payment',
              cancelText: 'Cancel Order',
              confirmButtonColor: '#DC2626',
              onConfirm: () => {
                // Retry payment
                handlePlaceOrder();
              },
            });
          }
        } else {
          // COD payment - clear cart and show success immediately
          clearCart();

          showConfirmation({
            title: 'Order Placed! 🎉',
            message: orderNumber !== 'N/A'
              ? `Your order #${orderNumber} has been placed successfully.`
              : 'Your order has been placed successfully.',
            confirmText: 'View Order',
            cancelText: 'Close',
            confirmButtonColor: '#00B14F',
            onConfirm: () => {
              if (onOrderSuccess && orderId) {
                onOrderSuccess(orderId);
              }
            },
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

  const cartItems = Object.values(cart);

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
      </View>

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Delivery Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            {isLoadingAddress ? (
              <View style={styles.addressCard}>
                <ActivityIndicator size="small" color="#00B14F" />
                <Text style={styles.loadingText}>Loading address...</Text>
              </View>
            ) : deliveryAddress ? (
              <View style={styles.addressCard}>
                <View style={styles.addressHeader}>
                  <MaterialIcons name="location-on" size={20} color="#00B14F" />
                  <Text style={styles.addressType}>{deliveryAddress.type.toUpperCase()}</Text>
                </View>
                <Text style={styles.addressText}>
                  {deliveryAddress.address}, {deliveryAddress.city}
                </Text>
              </View>
            ) : (
              <View style={styles.addressCard}>
                <Text style={styles.addressText}>No delivery address found</Text>
              </View>
            )}
          </View>

          {/* Restaurant Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Restaurant</Text>
            <View style={styles.restaurantCard}>
              {restaurantLogo && (
                <Image source={{ uri: restaurantLogo }} style={styles.restaurantLogo} />
              )}
              <Text style={styles.restaurantName}>{restaurantName}</Text>
            </View>
          </View>

          {/* Order Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Items</Text>
            {cartItems.map((item) => (
              <View key={item.id}>
                {!item.isCustomizable || !item.variants ? (
                  // Regular item
                  <View style={styles.cartItem}>
                    <View style={styles.itemInfo}>
                      <View style={styles.vegIndicator}>
                        <View style={[styles.vegDot, !item.isVeg && styles.nonVegDot]} />
                      </View>
                      <Text style={styles.itemName}>{item.name}</Text>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={styles.itemQuantity}>x{item.quantity || 1}</Text>
                      <Text style={styles.itemPrice}>
                        ₹{item.price * (item.quantity || 1)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  // Item with variants
                  item.variants?.map((variant, index) => (
                    <View key={`${item.id}-${index}`} style={styles.cartItem}>
                      <View style={styles.itemInfo}>
                        <View style={styles.vegIndicator}>
                          <View style={[styles.vegDot, !item.isVeg && styles.nonVegDot]} />
                        </View>
                        <View>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <Text style={styles.variantName}>{variant.variantName}</Text>
                        </View>
                      </View>
                      <View style={styles.itemRight}>
                        <Text style={styles.itemQuantity}>x{variant.quantity}</Text>
                        <Text style={styles.itemPrice}>
                          ₹{variant.price * variant.quantity}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            ))}
          </View>

          {/* Bill Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bill Details</Text>
            <View style={styles.billCard}>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Subtotal</Text>
                <Text style={styles.billValue}>₹{subtotal}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Delivery Fee</Text>
                <Text style={styles.billValue}>₹{deliveryFee}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Taxes</Text>
                <Text style={styles.billValue}>₹{tax}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.billRow}>
                <Text style={styles.billTotalLabel}>Total Amount</Text>
                <Text style={styles.billTotalValue}>₹{total}</Text>
              </View>
            </View>
          </View>

          {/* Payment Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>

            {/* Cash on Delivery */}
            <TouchableOpacity
              style={[
                styles.paymentCard,
                selectedPaymentMethod === 'cod' && styles.paymentCardSelected
              ]}
              onPress={() => setSelectedPaymentMethod('cod')}
              activeOpacity={0.7}
            >
              <View style={styles.paymentLeft}>
                <MaterialIcons name="payments" size={24} color="#00B14F" />
                <View>
                  <Text style={styles.paymentMethod}>Cash on Delivery</Text>
                  <Text style={styles.paymentDescription}>Pay when you receive</Text>
                </View>
              </View>
              <View style={[
                styles.radioButton,
                selectedPaymentMethod === 'cod' && styles.radioButtonSelected
              ]}>
                {selectedPaymentMethod === 'cod' && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
            </TouchableOpacity>

            {/* Online Payment */}
            <TouchableOpacity
              style={[
                styles.paymentCard,
                selectedPaymentMethod === 'online' && styles.paymentCardSelected
              ]}
              onPress={() => setSelectedPaymentMethod('online')}
              activeOpacity={0.7}
            >
              <View style={styles.paymentLeft}>
                <MaterialIcons name="credit-card" size={24} color="#00B14F" />
                <View>
                  <Text style={styles.paymentMethod}>Pay Online</Text>
                  <Text style={styles.paymentDescription}>UPI, Card, Wallet & More</Text>
                </View>
              </View>
              <View style={[
                styles.radioButton,
                selectedPaymentMethod === 'online' && styles.radioButtonSelected
              ]}>
                {selectedPaymentMethod === 'online' && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Place Order Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.placeOrderButton, isPlacingOrder && styles.placeOrderButtonDisabled]}
            onPress={handlePlaceOrder}
            disabled={isPlacingOrder}
            activeOpacity={0.8}
          >
            {isPlacingOrder ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.placeOrderButtonText}>Place Order</Text>
                <Text style={styles.placeOrderAmount}>₹{total}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  safeAreaTop: {
    backgroundColor: '#00B14F',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 76,
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 27,
    opacity: 0.85,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#001E1F',
    lineHeight: 24,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressType: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
  },
  addressText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.7)',
    lineHeight: 21,
  },
  loadingText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  restaurantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restaurantLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  restaurantName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#001E1F',
    lineHeight: 24,
  },
  cartItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  vegIndicator: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: '#00B14F',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00B14F',
  },
  nonVegDot: {
    backgroundColor: '#DC2626',
  },
  itemName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
  },
  variantName: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 18,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  itemQuantity: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.7)',
    lineHeight: 21,
  },
  itemPrice: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
  },
  billCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.7)',
    lineHeight: 21,
  },
  billValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  billTotalLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#001E1F',
    lineHeight: 24,
  },
  billTotalValue: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: '#00B14F',
    lineHeight: 24,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentCardSelected: {
    borderColor: '#00B14F',
    backgroundColor: 'rgba(0, 177, 79, 0.05)',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  paymentMethod: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
  },
  paymentDescription: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 18,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D9D9D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#00B14F',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00B14F',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  placeOrderButton: {
    backgroundColor: '#00B14F',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  placeOrderButtonDisabled: {
    opacity: 0.6,
  },
  placeOrderButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  placeOrderAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 27,
  },
});
