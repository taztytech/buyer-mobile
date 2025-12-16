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
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { ordersService } from '@/services/orders.service';
import { authService } from '@/services/auth.service';
import { useOrders } from '@/context/OrdersContext';
import { useRef } from 'react';
import { mapOrderStatusToUI } from '@/utils/orderStatusMapping';

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
  const { getOrderById } = useOrders();
  const [contextOrder, setContextOrder] = useState<any>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPhoneNumber, setUserPhoneNumber] = useState<string>('');
  const [supportNumber, setSupportNumber] = useState<string>('');
  const [showTrackingWebView, setShowTrackingWebView] = useState(false);
  const lastFetchedStatusRef = useRef<string | null>(null);
  const lastFetchedAtRef = useRef<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Subscribe to live context updates (FCM) for this order
  useEffect(() => {
    if (!orderId) return;
    const orderFromContext = getOrderById(orderId);
    setContextOrder(orderFromContext || null);
  }, [orderId, getOrderById, visible]);

  // Merge live context updates into local orderData to reflect status changes instantly
  useEffect(() => {
    if (!contextOrder) return;
    setOrderData((prev: any) => {
      if (!prev) return contextOrder;
      return {
        ...prev,
        ...contextOrder,
        restaurant: contextOrder.restaurant || prev.restaurant,
        items: contextOrder.items || prev.items,
        summary: contextOrder.summary || prev.summary,
        status: contextOrder.status || prev.status,
        updated_at: contextOrder.updated_at || prev.updated_at,
      };
    });
  }, [contextOrder]);

  // If FCM/context status changes, refetch full details once to stay in sync
  useEffect(() => {
    if (!visible || !orderId || !contextOrder) return;
    const currentStatus = (contextOrder.status || '').toString();
    const lastFetchedStatus = lastFetchedStatusRef.current;
    const now = Date.now();
    // Avoid spamming: only refetch if status changed AND at least 5s since last fetch
    if (currentStatus !== lastFetchedStatus && now - lastFetchedAtRef.current > 5000) {
      lastFetchedStatusRef.current = currentStatus;
      lastFetchedAtRef.current = now;
      fetchOrderDetails();
    }
  }, [visible, orderId, contextOrder, fetchOrderDetails]);

  const handleRefresh = async () => {
    if (!orderId) return;
    setIsRefreshing(true);
    try {
      await fetchOrderDetails();
    } finally {
      setIsRefreshing(false);
    }
  };

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

  // Fetch support number from cache first, only call API if not cached
  useEffect(() => {
    if (!visible) {
      return;
    }

    const fetchSupportDetails = async () => {
      const supportDetails = await authService.getSupportDetails(false);
      setSupportNumber(supportDetails.support_number);
    };

    fetchSupportDetails();
  }, [visible]);

  const handleCallSupport = async () => {
    // Get support number from cache first, only call API if not found
    const supportDetails = await authService.getSupportDetails(false);
    const numberToCall = supportDetails.support_number;
    
    if (!numberToCall) return;
    const telUrl = `tel:${numberToCall.replace(/\s+/g, '')}`;
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

  // Helper function to format estimated delivery time
  const formatEstimatedDeliveryTime = (timeString: string | null | undefined): string | null => {
    if (!timeString) return null;
    
    try {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) {
        return null;
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
      return null;
    }
  };

  // Get estimated delivery time (handle preorder vs normal orders)
  const hasPreorderItems =
    orderData?.has_preorder_items === true ||
    (Array.isArray(orderData?.items) &&
      orderData.items.some((item: any) => item.is_preorder === true));

  const preorderDeliveryTimeRaw = hasPreorderItems
    ? orderData?.preorder_delivery_date || orderData?.estimated_delivery_time
    : null;

  const normalEstimatedDeliveryTimeRaw = !hasPreorderItems
    ? orderData?.estimated_delivery_time || orderData?.preorder_delivery_date
    : null;

  const preorderDeliveryTime = formatEstimatedDeliveryTime(preorderDeliveryTimeRaw);
  const normalEstimatedDeliveryTime = formatEstimatedDeliveryTime(normalEstimatedDeliveryTimeRaw);

  const deliveryTimeLabel = 'Estimated Delivery Time';

  const deliveryTimeValue = hasPreorderItems
    ? preorderDeliveryTime
    : normalEstimatedDeliveryTime;

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

    // Normalize status to lowercase for consistent matching
    const normalizedStatus = actualStatus?.toLowerCase().trim();

    // Status messages from API configuration
    const statusMessages: { [key: string]: { title: string; color: string } } = {
      'billed': { 
        title: 'Your order has been billed and is being processed.', 
        color: '#00B14F' 
      },
      'packed': { 
        title: 'Your order has been packed and is ready for pickup.', 
        color: '#F59E0B' 
      },
      'agent_assigned': { 
        title: 'A delivery partner has been assigned to your order.', 
        color: '#3B82F6' 
      },
      'agent-assigned': { 
        title: 'A delivery partner has been assigned to your order.', 
        color: '#3B82F6' 
      },
      'agent_arrived_restaurant': { 
        title: 'The delivery partner has arrived at the restaurant to pick up your order.', 
        color: '#3B82F6' 
      },
      'agent-arrived-restaurant': { 
        title: 'The delivery partner has arrived at the restaurant to pick up your order.', 
        color: '#3B82F6' 
      },
      'picked': { 
        title: 'Your order has been picked up by the delivery partner.', 
        color: '#3B82F6' 
      },
      'out_for_delivery': { 
        title: 'Your order is on the way to your location.', 
        color: '#F59E0B' 
      },
      'out-for-delivery': { 
        title: 'Your order is on the way to your location.', 
        color: '#F59E0B' 
      },
      'delivered': { 
        title: 'Your order has been delivered.', 
        color: '#00B14F' 
      },
      'completed': { 
        title: 'Your order has been delivered.', 
        color: '#00B14F' 
      },
      'cancelled': { 
        title: 'Your order has been cancelled.', 
        color: '#DC2626' 
      },
      'canceled': { 
        title: 'Your order has been cancelled.', 
        color: '#DC2626' 
      },
      'rejected': { 
        title: 'Your order has been cancelled.', 
        color: '#DC2626' 
      },
    };

    // Check if we have a specific message for this status
    if (statusMessages[normalizedStatus]) {
      return statusMessages[normalizedStatus];
    }

    // Fallback to other statuses
    const statusMap: { [key: string]: { title: string; color: string } } = {
      'confirmed': { title: 'Your order has been successfully placed', color: '#00B14F' },
      'preparing': { title: 'Order is being prepared', color: '#F59E0B' },
      'pending_payment': { title: 'Payment pending', color: '#DC2626' },
      'payment_failed': { title: 'Payment Failed', color: '#DC2626' },
      'payment_pending': { title: 'Payment pending', color: '#DC2626' },
      'pending': { title: 'Order pending', color: '#F59E0B' },
    };
    
    return statusMap[normalizedStatus] || { title: 'Order status', color: '#00B14F' };
  };

  const statusDisplay = orderData ? getStatusDisplay(orderData.status, orderData) : null;
  
  // Get status config for consistent colors (same as Orders page)
  // Use the actual status for color mapping, but handle payment_failed specially
  const getStatusForColorMapping = (status: string, orderData?: any): string => {
    // Check payment_status field first - if payment failed, show payment failed regardless of order status
    if (orderData?.payment_status?.toLowerCase() === 'failed' || 
        orderData?.payment_status?.toLowerCase() === 'payment_failed' ||
        status?.toLowerCase() === 'payment_failed') {
      return 'payment_failed';
    } else if (status === 'cancelled' && orderData?.payment_method === 'online' && 
        orderData?.cancellation_reason?.toLowerCase().includes('payment failed')) {
      return 'payment_failed';
    } else if (orderData?.payment_method === 'online' && 
               orderData?.payment_status?.toLowerCase() === 'pending' && 
               (status?.toLowerCase() === 'pending' || status?.toLowerCase() === 'cancelled')) {
      return 'payment_failed';
    }
    return status;
  };
  
  const statusConfig = orderData ? mapOrderStatusToUI(getStatusForColorMapping(orderData.status, orderData)) : null;

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
          <Text style={styles.chatButtonText}>Support</Text>
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
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#00B14F"
                colors={['#00B14F']}
              />
            }
          >
          {/* Delivery Status Card - Illustration + Banner */}
          <View style={[styles.card, styles.statusCard]}>
            <View style={styles.statusIllustrationContainer}>
              <Image
                source={require('../../../assets/delivery_man.png')}
                style={styles.statusIllustration}
                resizeMode="contain"
              />
            </View>

            <View
              style={[
                styles.statusBanner,
                { backgroundColor: statusConfig?.bgColor || '#FACC15' },
              ]}
            >
              {/* <MaterialIcons
                name={
                  orderData.status === 'delivered'
                    ? 'check-circle'
                    : (statusDisplay?.title || '').toLowerCase() === 'payment failed'
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
                  <Text style={[
                    styles.statusBannerTitle,
                    { color: statusConfig?.color || '#111827' }
                  ]}>
                    {statusDisplay?.title || 'Order status'}
                  </Text>
                </View>
                <Text style={[
                  styles.statusBannerSubtitle,
                  { color: statusConfig?.color || '#111827' }
                ]}>
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
              {/* {orderData.status === 'delivered' || orderData.status === 'cancelled' ? (
                <TouchableOpacity
                  style={styles.reorderButton}
                  onPress={onReorder}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                  <Text style={styles.reorderButtonText}>Reorder</Text>
                </TouchableOpacity>
              ) : ( */}
                <View style={styles.trackOrderContainer}>
                  {(() => {
                    // Track Order is enabled ONLY for: picked, out-for-delivery, on-the-way, delivered
                    // Disabled for: confirmed (order placed), billed (order accepted), packed (order ready), agent-assigned
                    const rawStatus = (orderData?.status || '').toString().toLowerCase();
                    // Normalize: underscores/spaces to hyphen
                    const normalizedStatus = rawStatus.replace(/[_\s]+/g, '-');
                    
                    // Explicitly disabled statuses - tracking is NOT allowed for these
                    const disabledStatuses = [
                      'confirmed',
                      'billed',
                      'packed',
                      'agent-assigned',
                      'agent_assigned',
                      'agent-arrived-restaurant',
                      'agent_arrived_restaurant',
                      'cancelled',
                      'canceled',
                      'rejected',
                      'payment-failed',
                      'payment_failed',
                      'pending',
                      'pending-payment',
                      'pending_payment',
                      'preparing'
                    ];
                    
                    // Define enabled statuses - tracking only works from "picked" status onward
                    const enabledStatuses = [
                      'picked',
                      'out-for-delivery',
                      'out_for_delivery',
                      'on-the-way',
                      'on_the_way',
                      'delivered',
                      'completed'
                    ];
                    
                    // Check if status is explicitly disabled first - force disable
                    const isExplicitlyDisabled = disabledStatuses.includes(normalizedStatus);
                    
                    // Enable tracking only if status is in enabled list AND not explicitly disabled
                    const isTrackingEnabled = !isExplicitlyDisabled && enabledStatuses.includes(normalizedStatus);
                    
                    return (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.reorderButton,
                            !isTrackingEnabled && styles.disabledButton
                          ]}
                          onPress={() => {
                            if (isTrackingEnabled) {
                              // If tracking_url exists, use it; otherwise navigate to tracking screen
                              if (orderData?.tracking_url && orderData.tracking_url !== null) {
                                setShowTrackingWebView(true);
                              } else if (onTrackOrder) {
                                // Fallback to tracking screen if no URL but status allows it
                                onTrackOrder();
                              }
                            }
                          }}
                          activeOpacity={!isTrackingEnabled ? 1 : 0.8}
                          disabled={!isTrackingEnabled}
                        >
                          <MaterialIcons 
                            name="location-on" 
                            size={20} 
                            color={!isTrackingEnabled ? "#CCCCCC" : "#FFFFFF"} 
                          />
                          <Text style={[
                            styles.reorderButtonText,
                            !isTrackingEnabled && styles.disabledButtonText
                          ]}>
                            Track Order
                          </Text>
                        </TouchableOpacity>
                        {!isTrackingEnabled && (
                          <Text style={styles.trackingDisabledMessage}>
                            Tracking unlocks after your order is picked up.
                          </Text>
                        )}
                      </>
                    );
                  })()}
                </View>
              {/* )} */}
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
                          {/* <View style={[
                            styles.vegIndicator,
                            !isVeg && styles.nonVegIndicator
                          ]}>
                            <View style={[
                              styles.vegDot,
                              !isVeg && styles.nonVegDot
                            ]} />
                          </View> */}
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
            {/* Show delivery time - handle preorder vs normal orders */}
            {deliveryTimeValue && (
              <>
                <View style={styles.dashedDivider} />
                <View style={styles.addressRow}>
                  <MaterialIcons name="access-time" size={24} color="#00B14F" />
                  <View style={styles.estimatedDeliveryContainer}>
                    <Text style={styles.estimatedDeliveryLabel}>{deliveryTimeLabel}</Text>
                    <Text style={styles.estimatedDeliveryValue}>{deliveryTimeValue}</Text>
                  </View>
                </View>
              </>
            )}
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

      {/* Tracking WebView Modal */}
      <Modal
        visible={showTrackingWebView}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTrackingWebView(false)}
      >
        <SafeAreaView style={styles.webViewContainer} edges={['top']}>
          <View style={styles.webViewHeader}>
            <TouchableOpacity
              onPress={() => setShowTrackingWebView(false)}
              style={styles.webViewBackButton}
            >
              <MaterialIcons name="close" size={24} color="#001E1F" />
            </TouchableOpacity>
            <Text style={styles.webViewHeaderTitle}>Track Order</Text>
            <View style={styles.webViewBackButton} />
          </View>
          {orderData?.tracking_url && (
            <WebView
              source={{ uri: orderData.tracking_url }}
              style={styles.webView}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webViewLoadingContainer}>
                  <ActivityIndicator size="large" color="#00B14F" />
                </View>
              )}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('WebView error:', nativeEvent);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('WebView HTTP error:', nativeEvent.statusCode, nativeEvent.description);
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              mixedContentMode="always"
            />
          )}
        </SafeAreaView>
      </Modal>
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
  estimatedDeliveryContainer: {
    flex: 1,
  },
  estimatedDeliveryLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 18,
    marginBottom: 2,
  },
  estimatedDeliveryValue: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
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
    marginBottom: 6,
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
  disabledButton: {
    backgroundColor: '#E5E5E5',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#CCCCCC',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E4',
    backgroundColor: '#FFFFFF',
  },
  webViewBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webViewHeaderTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#001E1F',
    flex: 1,
    textAlign: 'center',
  },
  webView: {
    flex: 1,
  },
  webViewLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  trackingDisabledMessage: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.6)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  trackOrderContainer: {
    flex: 1,
    alignItems: 'center',
  },
});




