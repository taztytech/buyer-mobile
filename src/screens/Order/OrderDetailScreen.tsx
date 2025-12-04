import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ordersService } from '@/services/orders.service';
import { authService } from '@/services/auth.service';
import { storageService } from '@/services/storage.service';

interface OrderDetailScreenProps {
  orderId?: string;
  visible?: boolean;
  onBack?: () => void;
  onThankDriver?: () => void;
  onRateOrder?: (orderId: string, orderData?: any) => void;
  onReorder?: () => void;
  onTrackOrder?: () => void;
  onDownloadInvoice?: () => void;
}

export const OrderDetailScreen: React.FC<OrderDetailScreenProps> = ({
  orderId,
  visible = false,
  onBack,
  onThankDriver,
  onRateOrder,
  onReorder,
  onTrackOrder,
  onDownloadInvoice,
}) => {
  const [orderData, setOrderData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPhoneNumber, setUserPhoneNumber] = useState<string>('');
  const [supportNumber, setSupportNumber] = useState<string>('');

  // Fetch order details function
  const fetchOrderDetails = useCallback(async () => {
    if (!orderId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await ordersService.getOrderById(Number(orderId));

      if (response.success && response.data) {

        setOrderData(response.data);
      } else {
        setError(response.error || 'Failed to load order details');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load order details');
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  // Reset loading state when orderId changes
  useEffect(() => {
    if (orderId) {
      setIsLoading(true);
      setOrderData(null);
      setError(null);
    }
  }, [orderId]);

  // Fetch order details when screen becomes visible or orderId changes
  useEffect(() => {
    if (visible && orderId) {
      fetchOrderDetails();
    }
  }, [visible, orderId, fetchOrderDetails]);

  // Fetch user's phone number on mount
  useEffect(() => {
    const fetchUserPhone = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user?.phoneNumber) {
          setUserPhoneNumber(user.phoneNumber);
        }
      } catch (error) {
        // Error fetching user phone
      }
    };

    fetchUserPhone();
  }, []);

  // Fetch support number (same logic as ContactUsScreen)
  useEffect(() => {
    if (!visible) {
      return;
    }

    const fetchSupportDetails = async () => {
      try {
        // Try API first
        const response = await authService.getProfile();

        if (response.success && response.data?.user) {
          const user = response.data.user as any;
          setSupportNumber(user.support_number || '');
        } else {
          // Fallback to stored user
          const storedUser = await storageService.getUser();
          if (storedUser) {
            setSupportNumber((storedUser as any).support_number || '');
          }
        }
      } catch {
        try {
          const storedUser = await storageService.getUser();
          if (storedUser) {
            setSupportNumber((storedUser as any).support_number || '');
          }
        } catch {
          // Silent fail – leave default
        }
      }
    };

    fetchSupportDetails();
  }, [visible]);

  const handleCallSupport = () => {
    if (!supportNumber) return;
    const telUrl = `tel:${supportNumber.replace(/\s+/g, '')}`;
    Linking.openURL(telUrl).catch(() => {});
  };

  // Helper function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  // Calculate bill details from items if summary is missing or zero
  const calculateBillFromItems = (orderData: any) => {
    
    if (!orderData.items || !Array.isArray(orderData.items)) {
      
      return {
        subtotal: 0,
        tax_amount: 0,
        delivery_fee: 0,
        discount_amount: 0,
        tip_amount: 0,
        platform_fee: 0,
        include_platform_fee: false,
        total_amount: 0,
      };
    }

    const subtotal = orderData.items.reduce((sum: number, item: any) => {
      const itemTotal = item.total_price || item.item_total || (item.price || 0) * (item.quantity || 0);
      return sum + itemTotal;
    }, 0);

    // If summary exists and has values, use it; otherwise calculate from items
    const summary = orderData.summary || {};
    
    const tax_amount = summary.tax_amount || summary.tax || 0;
    const delivery_fee = summary.delivery_fee || 0;
    const discount_amount = summary.discount_amount || summary.discount || 0;
    const tip_amount = summary.tip_amount || 0;
    const platform_fee = summary.platform_fee || 0;
    const include_platform_fee = summary.include_platform_fee || false;
    const summarySubtotal = summary.subtotal || summary.item_total || 0;
    // Use final_amount from API, fallback to total_amount or total if not available
    const finalTotal = summary.final_amount || summary.total_amount || summary.total || 0;
    
    const finalSubtotal = summarySubtotal || subtotal;

    const bill = {
      subtotal: finalSubtotal,
      tax_amount,
      delivery_fee,
      discount_amount,
      tip_amount,
      platform_fee,
      include_platform_fee,
      total_amount: finalTotal,
    };

    return bill;
  };

  // Helper function to map status
  const getStatusDisplay = (status: string, orderData?: any) => {
    // Check for payment failed status - priority check
    let actualStatus = status;
    
    // Check payment_status field first - if payment failed, show payment failed regardless of order status
    if (orderData?.payment_status?.toLowerCase() === 'failed' || 
        orderData?.payment_status?.toLowerCase() === 'payment_failed' ||
        status?.toLowerCase() === 'payment_failed') {
      actualStatus = 'payment_failed';
    } else if (status === 'cancelled' && orderData?.payment_method === 'online' && 
        orderData?.cancellation_reason?.toLowerCase().includes('payment failed')) {
      actualStatus = 'payment_failed';
    } else if (orderData?.payment_method === 'online' && 
               orderData?.payment_status?.toLowerCase() === 'pending' && 
               (status?.toLowerCase() === 'pending' || status?.toLowerCase() === 'cancelled')) {
      // If payment is pending but order is cancelled/pending for online payment, it's likely a payment failure
      actualStatus = 'payment_failed';
    }

    const statusMap: { [key: string]: { title: string; color: string } } = {
      'delivered': { title: 'Your order was delivered!', color: '#00B14F' },
      'confirmed': { title: 'Restaurant  Accepted & Started Preparing!', color: '#00B14F' },
      'preparing': { title: 'Order is being prepared', color: '#F59E0B' },
      'out_for_delivery': { title: 'Order is on the way!', color: '#F59E0B' },
      'pending_payment': { title: 'Payment pending', color: '#DC2626' },
      'payment_failed': { title: 'Payment Failed', color: '#DC2626' },
      'cancelled': { title: 'Order cancelled', color: '#DC2626' },
    };
    return statusMap[actualStatus] || { title: 'Order status', color: '#00B14F' };
  };

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
        <Text style={styles.headerTitle}>Order Details</Text>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={handleCallSupport}
          activeOpacity={0.7}
        >
          <MaterialIcons name="phone" size={20} color="#FFFFFF" />
          <Text style={styles.chatButtonText}>Call For Support</Text>
        </TouchableOpacity>
      </View>

      <SafeAreaView style={styles.container} edges={['bottom']}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00B14F" />
            <Text style={styles.loadingText}>Loading order details...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={64} color="rgba(0, 0, 0, 0.2)" />
            <Text style={styles.errorTitle}>Failed to load order</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchOrderDetails}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !orderData ? (
          <View style={styles.errorContainer}>
            <MaterialIcons name="receipt-long" size={64} color="rgba(0, 0, 0, 0.2)" />
            <Text style={styles.errorTitle}>Order not found</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
          {/* Delivery Status Card - Illustration + Banner */}fv
          <View style={[styles.card, styles.statusCard]}>
            <View style={styles.statusIllustrationContainer}>
              <Image
                source={require('../../../assets/delivery_man.png')}
                style={styles.statusIllustration}
                resizeMode="contain"
              />
            </View>

            <View style={styles.statusBanner}>
              {/* <MaterialIcons
                name={
                  orderData.status === 'delivered'
                    ? 'check-circle'
                    : getStatusDisplay(orderData.status, orderData).title === 'Payment Failed'
                    ? 'payment'
                    : orderData.status === 'cancelled'
                    ? 'cancel'
                    : 'access-time'
                }
                size={22}
                color="#111827"
              /> */}
              <View style={styles.statusBannerTextContainer}>
                <View style={styles.statusBannerTitleRow}>
                  <Text style={styles.statusBannerTitle}>
                    {getStatusDisplay(orderData.status, orderData).title}
                  </Text>
                </View>
                <Text style={styles.statusBannerSubtitle}>
                  Order id #{orderData.order_number}
                </Text>
              </View>
            </View>

            {/* Driver Info - only show if tracking data available */}
            {orderData.tracking &&
              orderData.tracking.length > 0 &&
              orderData.tracking[0].agent_name && (
                <>
                  <View style={styles.driverSection}>
                    {orderData.tracking[0].agent_photo_url ? (
                      <Image
                        source={{ uri: orderData.tracking[0].agent_photo_url }}
                        style={styles.driverAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.driverAvatar,
                          styles.driverAvatarPlaceholder,
                        ]}
                      >
                        <MaterialIcons name="person" size={32} color="#999" />
                      </View>
                    )}
                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName}>
                        {orderData.tracking[0].agent_name}
                      </Text>
                      <Text style={styles.driverLabel}>Your delivery driver</Text>
                      {orderData.tracking[0].agent_phone && (
                        <Text style={styles.driverPhone}>
                          {orderData.tracking[0].agent_phone}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Thank Driver Button - only show for delivered orders */}
                  {orderData.status === 'delivered' && (
                    <TouchableOpacity
                      style={styles.thankButton}
                      onPress={onThankDriver}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="thumb-up" size={20} color="#FFFFFF" />
                      <Text style={styles.thankButtonText}>Thank Driver</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
          </View>

          {/* Restaurant Info Card */}
          <View style={styles.card}>
            <View style={styles.orderHeaderContainer}>
              {/* Restaurant Logo */}
              <Image
                source={{ uri: orderData.restaurant.logo_url }}
                style={styles.restaurantLogo}
                defaultSource={require('@/assets/dummy-restaurent.png')}
              />
              
              {/* Text Content */}
              <View style={styles.orderHeaderContent}>
                {/* First Row: Restaurant Name + Price */}
                <View style={styles.orderHeaderRow}>
                  <Text style={styles.restaurantName}>{orderData.restaurant.name}</Text>
                  <Text style={styles.orderAmount}>₹{(() => {
                    const bill = calculateBillFromItems(orderData);
                    return bill.total_amount.toFixed(2);
                  })()}</Text>
                </View>

                {/* Second Row: Location + Date */}
                <View style={styles.orderHeaderRow}>
                  <Text style={styles.restaurantLocation}>
                    {orderData.delivery_address?.city || 'Location'}
                  </Text>
                  <Text style={styles.orderDate}>{formatDate(orderData.created_at)}</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {orderData.overall_rating && orderData.overall_rating > 0 ? (
                <View style={styles.ratingDisplay}>
                  <MaterialIcons name="star" size={20} color="#F59E0B" />
                  <Text style={styles.ratingText}>{orderData.overall_rating.toFixed(1)}</Text>
                </View>
              ) : orderData.status === 'delivered' ? (
                <TouchableOpacity
                  style={styles.rateButton}
                  onPress={() => onRateOrder && onRateOrder(orderId || '', orderData)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="star-outline" size={20} color="#001E1F" />
                  <Text style={styles.rateButtonText}>Rate Order</Text>
                </TouchableOpacity>
              ) : null}
              {orderData.status === 'delivered' || orderData.status === 'cancelled' ? (
                <TouchableOpacity
                  style={styles.reorderButton}
                  onPress={onReorder}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                  <Text style={styles.reorderButtonText}>Reorder</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.reorderButton}
                  onPress={onTrackOrder}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="location-on" size={20} color="#FFFFFF" />
                  <Text style={styles.reorderButtonText}>Track Order</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Item Details Card */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Item Details</Text>
            <View style={styles.itemDetailsContainer}>
              {orderData.items.map((item: any, index: number) => {
                const isVeg = item.is_veg !== false; // Default to veg if not specified
                const imageUrl = item.image_url || item.image || null;
                
                return (
                  <View key={item.id}>
                    <View style={styles.itemDetailRow}>
                      {/* Product Image */}
                      {imageUrl && (
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.itemDetailImage}
                          resizeMode="cover"
                          defaultSource={require('@/assets/dummy-restaurent.png')}
                        />
                      )}
                      
                      <View style={styles.itemDetailLeft}>
                        <View style={styles.itemDetailNameRow}>
                          {/* Veg/Non-veg Icon */}
                          <View style={[
                            styles.vegIndicator,
                            !isVeg && styles.nonVegIndicator
                          ]}>
                            <View style={[
                              styles.vegDot,
                              !isVeg && styles.nonVegDot
                            ]} />
                          </View>
                          {/* Product Name and Quantity */}
                          <Text style={styles.itemDetailName}>
                            {item.item_name} × {item.quantity}
                          </Text>
                        </View>
                        {item.customizations && item.customizations.length > 0 && (
                          <View style={styles.customizationsContainer}>
                            {item.customizations.map((customization: any, idx: number) => (
                              <Text key={idx} style={styles.customizationText}>
                                {customization.customization_group_name}:{' '}
                                {customization.selected_options.map((opt: any) => opt.name).join(', ')}
                              </Text>
                            ))}
                          </View>
                        )}
                        {item.variants && item.variants.length > 0 && (
                          <View style={styles.customizationsContainer}>
                            {item.variants.map((variant: any, idx: number) => (
                              <Text key={idx} style={styles.customizationText}>
                                {variant.variant_group_name}: {variant.selected_variant.name}
                              </Text>
                            ))}
                          </View>
                        )}
                        {item.special_instructions && (
                          <Text style={styles.specialInstructionsText}>
                            Note: {item.special_instructions}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.itemDetailPrice}>₹{item.total_price}</Text>
                    </View>
                    {index < orderData.items.length - 1 && <View style={styles.itemDivider} />}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Notes Section - only show if notes exist */}
          {orderData.notes && orderData.notes.trim() !== '' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={styles.notesContainer}>
                <MaterialIcons name="note" size={24} color="#00B14F" />
                <Text style={styles.notesText}>{orderData.notes}</Text>
              </View>
            </View>
          )}

          {/* Delivery Address Card */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={24} color="#00B14F" />
              <Text style={styles.addressText}>
                {[
                  orderData.delivery_address?.address1,
                  orderData.delivery_address?.address2,
                  orderData.delivery_address?.address3,
                  orderData.delivery_address?.city,
                  orderData.delivery_address?.state,
                  orderData.delivery_address?.pincode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            </View>
            <View style={styles.dashedDivider} />
            <View style={styles.addressRow}>
              <MaterialIcons name="phone" size={24} color="#00B14F" />
              <Text style={styles.addressText}>
                {orderData.delivery_address?.alternate_phone_number || userPhoneNumber || 'N/A'}
              </Text>
            </View>
          </View>

          {/* Bill Summary Card */}
          <View style={styles.card}>
            <View style={styles.billHeader}>
              <Text style={styles.sectionTitle}>Bill Summary</Text>
              {/* {orderData.invoice?.available && (
                <TouchableOpacity
                  style={styles.invoiceButton}
                  onPress={onDownloadInvoice}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="download" size={18} color="#00B14F" />
                  <Text style={styles.invoiceButtonText}>Invoice</Text>
                </TouchableOpacity>
              )} */}
            </View>

            {(() => {
              const bill = calculateBillFromItems(orderData);
              return (
                <>
                  <View style={styles.billItems}>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Subtotal</Text>
                      <Text style={styles.billValue}>₹{bill.subtotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Delivery Fee</Text>
                      <Text style={styles.billValue}>₹{bill.delivery_fee.toFixed(2)}</Text>
                    </View>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Platform Fee</Text>
                      <Text style={
                        (bill.include_platform_fee || bill.platform_fee === 0) 
                          ? styles.billValue 
                          : styles.billValueStrikethrough
                      }>
                        ₹{bill.platform_fee.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Delivery Partner tip</Text>
                      <Text style={styles.billValue}>₹{bill.tip_amount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>GST and Charges</Text>
                      <Text style={styles.billValue}>₹{bill.tax_amount.toFixed(2)}</Text>
                    </View>
                    {bill.discount_amount > 0 && (
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Discount</Text>
                        <Text style={[styles.billValue, { color: '#00B14F' }]}>
                          -₹{bill.discount_amount.toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.dashedDivider} />

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>₹{bill.total_amount.toFixed(2)}</Text>
                  </View>
                </>
              );
            })()}
          </View>

          {/* Payment Method Card */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.paymentRow}>
              <View style={styles.paymentIcon}>
                <MaterialIcons
                  name={orderData.payment_method === 'cod' ? 'money' : 'account-balance-wallet'}
                  size={24}
                  color="#00B14F"
                />
              </View>
              <Text style={styles.paymentText}>
                {orderData.payment_method === 'cod' ? 'Cash on Delivery' :
                 orderData.payment_method === 'online' ? 'Online' :
                 orderData.payment_method === 'upi' ? 'Paid by UPI' :
                 orderData.payment_method.toUpperCase()}
                {orderData.payment_status && ` (${orderData.payment_status})`}
              </Text>
            </View>
          </View>
        </ScrollView>
        )}
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
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 76,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 27,
    opacity: 0.85,
    flex: 1,
    marginLeft: 8,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatButtonText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 21,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 14,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  statusTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    color: '#001E1F',
    lineHeight: 30,
    textAlign: 'center',
  },
  orderNumberText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.7)',
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 2,
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 16,
  },
  driverAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#00B14F',
  },
  driverInfo: {
    alignItems: 'flex-start',
  },
  driverName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#001E1F',
    lineHeight: 27,
  },
  driverLabel: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 21,
  },
  thankButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#00B14F',
    borderRadius: 8,
    gap: 8,
  },
  thankButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  orderHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  restaurantLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  orderHeaderContent: {
    flex: 1,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  restaurantName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#001E1F',
    lineHeight: 27,
    flex: 1,
  },
  restaurantLocation: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 21,
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  itemName: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
  },
  orderDate: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 21,
    textAlign: 'right',
  },
  orderAmount: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#001E1F',
    lineHeight: 27,
    textAlign: 'right',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  rateButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  rateButtonText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
  },
  ratingDisplay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  ratingText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#001E1F',
    lineHeight: 24,
  },
  reorderButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#00B14F',
    gap: 8,
  },
  reorderButtonText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 21,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#001E1F',
    lineHeight: 27,
    marginBottom: 12,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  notesText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  addressText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
    flex: 1,
  },
  dashedDivider: {
    height: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 12,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  invoiceButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#00B14F',
    lineHeight: 21,
  },
  billItems: {
    gap: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 21,
  },
  billValue: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 21,
  },
  billValueStrikethrough: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.5)',
    lineHeight: 21,
    textDecorationLine: 'line-through',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#001E1F',
    lineHeight: 27,
  },
  totalValue: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#001E1F',
    lineHeight: 27,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: '#001E1F',
    lineHeight: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.6)',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#001E1F',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.6)',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#00B14F',
    borderRadius: 8,
  },
  retryButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  driverAvatarPlaceholder: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverPhone: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.6)',
    marginTop: 2,
  },
  moreItemsText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.6)',
    marginTop: 4,
  },
  itemDetailsContainer: {
    gap: 8,
  },
  itemDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemDetailImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E8E8E8',
  },
  itemDetailLeft: {
    flex: 1,
    marginRight: 12,
  },
  itemDetailNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  itemDetailName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
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
  nonVegIndicator: {
    borderColor: '#DC2626',
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
  itemDetailPrice: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
  },
  customizationsContainer: {
    marginTop: 2,
    gap: 1,
  },
  customizationText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 18,
  },
  specialInstructionsText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.8)',
    lineHeight: 18,
    marginTop: 2,
    fontStyle: 'italic',
  },
  itemDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 8,
  },
  statusCard: {
    alignItems: 'center',
  },
  statusIllustrationContainer: {
    alignItems: 'center',
    // marginBottom: 6,
  },
  statusIllustration: {
    width: 180,
    height: 100,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FACC15',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  statusBannerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  statusBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 2,
  },
  statusBannerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    textAlign: 'center',
    flexShrink: 1,
    color: '#111827',
    lineHeight: 22,
  },
  statusBannerSubtitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    textAlign: 'center',
    color: '#111827',
    lineHeight: 18,
    marginTop: 2,
  },
});
