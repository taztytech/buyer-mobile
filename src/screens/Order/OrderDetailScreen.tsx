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
  Dimensions,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
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
  const { getOrderById, state } = useOrders();
  const [contextOrder, setContextOrder] = useState<any>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPhoneNumber, setUserPhoneNumber] = useState<string>('');
  const [supportNumber, setSupportNumber] = useState<string>('');
  const [showTrackingWebView, setShowTrackingWebView] = useState(false);
  const [selectedOrderIdForTracking, setSelectedOrderIdForTracking] = useState<string | null>(null);
  const [trackingOrderData, setTrackingOrderData] = useState<any>(null);
  const [isLoadingTrackingData, setIsLoadingTrackingData] = useState(false);
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
  // Watch state.byId directly to catch FCM updates immediately
  // Extract status and updated_at for dependency tracking without redeclaration
  const _contextOrderFromState = orderId ? state.byId[orderId] : undefined;
  const _contextStatus = _contextOrderFromState?.status;
  const _contextUpdatedAt = _contextOrderFromState?.updated_at;
  
  useEffect(() => {
    if (!orderId) return;
    // Watch state.byId directly - this updates when FCM notifications arrive
    const orderFromContext = state.byId[orderId];
    if (orderFromContext) {
      console.log('📦 OrderDetail: FCM update detected for order', orderId, {
        status: orderFromContext.status,
        updated_at: orderFromContext.updated_at,
      });
      setContextOrder(orderFromContext);
    } else {
      // Fallback to getOrderById if not in state.byId
      const order = getOrderById(orderId);
      setContextOrder(order || null);
    }
    // The linter errors are caused by the use of undeclared variables in the dependency array.
    // Change contextStatus/contextUpdatedAt in deps to _contextStatus/_contextUpdatedAt instead.
  }, [orderId, _contextStatus, _contextUpdatedAt, getOrderById, visible]);

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

  // Fetch order details for tracking bottom sheet from API
  // This gets the FULL order data (not just status from FCM)
  const fetchTrackingOrderData = useCallback(async (orderId: string, silent: boolean = false) => {
    if (!orderId) return;

    try {
      if (!silent) {
        setIsLoadingTrackingData(true);
      }
      
      const response = await ordersService.getOrderById(Number(orderId));

      if (response.success && response.data) {
        console.log('📦 Tracking: API response received with updated status data', {
          orderId,
          status: response.data.status,
          updatedAt: response.data.updated_at,
          hasFullData: true,
          silent,
        });
        
        // Always update trackingOrderData when API response arrives
        // This ensures bottom sheet reloads with latest data
        setTrackingOrderData((prevData: any) => {
          // Check if API response has newer data than what we have
          if (!prevData || 
              response.data.updated_at !== prevData.updated_at ||
              response.data.status !== prevData.status) {
            console.log('✅ Tracking: API response has updated data - Reloading bottom sheet', {
              orderId,
              oldStatus: prevData?.status,
              newStatus: response.data.status,
              oldUpdatedAt: prevData?.updated_at,
              newUpdatedAt: response.data.updated_at,
              source: 'API',
              willReload: true,
            });
            // Return new data - this triggers bottom sheet reload
            return response.data;
          }
          
          // Even if status hasn't changed, update with latest API data to ensure we have full data
          console.log('📦 Tracking: API response received - Updating with latest full data', {
            orderId,
            status: response.data.status,
            source: 'API',
          });
          return response.data;
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch tracking order data:', err);
    } finally {
      if (!silent) {
        setIsLoadingTrackingData(false);
      }
    }
  }, []);

  // Subscribe to FCM updates for tracking order
  // Get the order directly from state.byId - this will update when FCM notifications arrive
  const trackingContextOrder = selectedOrderIdForTracking ? state.byId[selectedOrderIdForTracking] : undefined;
  
  // Get status and updated_at as separate values for reliable change detection
  const contextStatus = trackingContextOrder?.status;
  const contextUpdatedAt = trackingContextOrder?.updated_at;
  
  // LOG: Track order status watching - log current status values
  useEffect(() => {
    if (!selectedOrderIdForTracking) return;
    
    console.log('📊 TRACK ORDER STATUS WATCH (OrderDetail):', {
      orderId: selectedOrderIdForTracking,
      fcmStatus: contextStatus || 'N/A',
      fcmUpdatedAt: contextUpdatedAt || 'N/A',
      apiStatus: trackingOrderData?.status || 'N/A',
      apiUpdatedAt: trackingOrderData?.updated_at || 'N/A',
      displayStatus: (trackingContextOrder || trackingOrderData)?.status || 'N/A',
      hasFCMData: !!trackingContextOrder,
      hasAPIData: !!trackingOrderData,
    });
  }, [selectedOrderIdForTracking, contextStatus, contextUpdatedAt, trackingOrderData?.status, trackingOrderData?.updated_at]);
  
  // FCM LISTENER + API WATCHER: Listen to FCM updates AND watch API response data
  // When FCM status update arrives:
  // 1. Immediately update UI with FCM status (fast, real-time) - triggers bottom sheet reload
  // 2. Then fetch full order data from API (complete data with all fields)
  // 3. When API response arrives, it updates trackingOrderData which triggers bottom sheet reload
  // CRITICAL: Watch state.byId[orderId] status and updated_at directly to catch FCM updates immediately
  // Get the latest order from state.byId inside useEffect to ensure we always have the latest
  useEffect(() => {
    if (!selectedOrderIdForTracking) return;

    // Get the latest order from state.byId (this updates when FCM arrives)
    const latestContextOrder = state.byId[selectedOrderIdForTracking];
    
    // If context order exists (from FCM), sync it to local state AND fetch latest API data
    if (latestContextOrder) {
      setTrackingOrderData((prevData: any) => {
        // If no previous data, use context order directly
        if (!prevData) {
          console.log('📦 Tracking: Initializing from FCM context', {
            orderId: selectedOrderIdForTracking,
            status: latestContextOrder.status,
          });
          return { ...latestContextOrder };
        }

        // Check if status or updated_at has changed
        // IMPORTANT: This works for ANY status change (confirmed, packed, picked, out-for-delivery, delivered, cancelled, etc.)
        // No status is restricted - any status update from FCM will automatically update the UI
        const statusChanged = prevData.status !== latestContextOrder.status;
        const updatedAtChanged = prevData.updated_at !== latestContextOrder.updated_at;
        
        if (statusChanged || updatedAtChanged) {
          console.log('✅ Tracking: FCM update detected - Updating UI and fetching latest API data', {
            orderId: selectedOrderIdForTracking,
            oldStatus: prevData.status,
            newStatus: latestContextOrder.status,
            oldUpdatedAt: prevData.updated_at,
            newUpdatedAt: latestContextOrder.updated_at,
            source: 'FCM',
            note: 'This handles ANY status update automatically',
          });
          
          // LOG: Status change detected - works for ALL status types
          console.log('📊 TRACK ORDER STATUS CHANGE (OrderDetail):', {
            orderId: selectedOrderIdForTracking,
            previousStatus: prevData.status || 'N/A',
            newStatus: latestContextOrder.status || 'N/A',
            statusChanged: statusChanged,
            updatedAtChanged: updatedAtChanged,
            statusType: 'ANY_STATUS_UPDATE', // Confirms we handle all status types
            timestamp: new Date().toISOString(),
          });
          
          // Step 1: Immediately update UI with FCM data (fast, real-time)
          // This triggers bottom sheet reload with FCM status
          const updatedData = {
            ...prevData,
            ...latestContextOrder,
            // Preserve order_number if it exists in prevData but not in context
            order_number: latestContextOrder.order_number || prevData.order_number,
            // Preserve restaurant details if they exist in prevData but not in context
            restaurant: latestContextOrder.restaurant || prevData.restaurant,
          };
          
          // Step 2: Fetch latest full order data from API (silent fetch - no loading indicator)
          // When API response arrives, it will update trackingOrderData which triggers bottom sheet reload
          fetchTrackingOrderData(selectedOrderIdForTracking, true).catch((err) => {
            console.error('Failed to fetch latest API data after FCM update:', err);
          });
          
          return updatedData;
        }

        // No change detected, return previous data
        return prevData;
      });
    }
  }, [selectedOrderIdForTracking, contextStatus, contextUpdatedAt, state.byId, fetchTrackingOrderData]);
  
  // API RESPONSE WATCHER: Watch for changes in API response data and reload bottom sheet
  // This ensures whenever the API response updates (status/timeline), the bottom sheet reflects changes
  useEffect(() => {
    if (!selectedOrderIdForTracking || !trackingOrderData) return;

    // Watch for changes in status or updated_at from API response
    const apiStatus = trackingOrderData.status;
    const apiUpdatedAt = trackingOrderData.updated_at;

    console.log('🔄 Tracking: API response data watched - Bottom sheet will reload on changes', {
      orderId: selectedOrderIdForTracking,
      status: apiStatus,
      updatedAt: apiUpdatedAt,
      source: 'API',
    });
    
    // LOG: API status update
    console.log('📊 TRACK ORDER API STATUS UPDATE (OrderDetail):', {
      orderId: selectedOrderIdForTracking,
      apiStatus: apiStatus || 'N/A',
      apiUpdatedAt: apiUpdatedAt || 'N/A',
      fcmStatus: contextStatus || 'N/A',
      timestamp: new Date().toISOString(),
    });

    // The bottom sheet will automatically re-render when trackingOrderData changes
    // This useEffect ensures we're watching the API response data
    // The UI uses displayOrder = trackingContextOrder || trackingOrderData
    // So when trackingOrderData updates, the bottom sheet reloads with new data
  }, [selectedOrderIdForTracking, trackingOrderData?.status, trackingOrderData?.updated_at]);


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

          {/* Cancellation Reason Card - only show for cancelled orders */}
          {orderData.status === 'cancelled' && orderData.cancel_reason && (
            <View style={[styles.card, styles.cancellationCard]}>
              <View style={styles.cancellationHeader}>
                <MaterialIcons name="cancel" size={24} color="#DC2626" />
                <Text style={styles.cancellationTitle}>Order Cancellation</Text>
              </View>
              
              <Text style={styles.cancellationReason}>
                {orderData.cancel_reason.reason || 'Order has been cancelled'}
              </Text>
            </View>
          )}

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
                                // Set order ID for tracking and fetch data for bottom sheet
                                if (orderId) {
                                  setSelectedOrderIdForTracking(orderId);
                                  fetchTrackingOrderData(orderId);
                                }
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
        onRequestClose={() => {
          setShowTrackingWebView(false);
          setSelectedOrderIdForTracking(null);
          setTrackingOrderData(null);
        }}
      >
        <View style={styles.webViewModalContainer}>
          <SafeAreaView style={styles.webViewContainer} edges={['top']}>
            <View style={styles.webViewHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowTrackingWebView(false);
                  setSelectedOrderIdForTracking(null);
                  setTrackingOrderData(null);
                }}
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
          
          {/* Bottom Sheet Overlay */}
          <View style={styles.trackingBottomSheet}>
            {isLoadingTrackingData ? (
              <View style={styles.trackingLoadingContainer}>
                <ActivityIndicator size="large" color="#00B14F" />
                <Text style={styles.trackingLoadingText}>Loading order status...</Text>
              </View>
            ) : trackingOrderData ? (
              <ScrollView
                style={styles.trackingBottomSheetContent}
                contentContainerStyle={styles.trackingBottomSheetContentContainer}
                showsVerticalScrollIndicator={true}
              >
                {(() => {
                  // WATCHING BOTH:
                  // 1. trackingContextOrder = FCM updates (real-time status from notifications)
                  // 2. trackingOrderData = API response (full order data with updated status from API)
                  // Priority: FCM (real-time) > API (full data)
                  // Both have the updated status - FCM is faster, API has complete data
                  const displayOrder = trackingContextOrder || trackingOrderData;
                  const displayStatus = displayOrder?.status;
                  
                  // Get agent info from tracking array - find latest entry with agent details
                  const trackingArray = displayOrder?.tracking || [];
                  let agentName: string | null = null;
                  let agentPhone: string | null = null;
                  
                  // Find the latest tracking entry with agent_name or agent_phone
                  // Iterate from the end to get the most recent agent assignment
                  for (let i = trackingArray.length - 1; i >= 0; i--) {
                    const trackingEntry = trackingArray[i];
                    if (trackingEntry) {
                      // If we find an entry with agent_name, use it
                      if (trackingEntry.agent_name) {
                        agentName = trackingEntry.agent_name;
                        agentPhone = trackingEntry.agent_phone || null;
                        break;
                      }
                      // If we find an entry with agent_phone but no name, still use it
                      if (trackingEntry.agent_phone && !agentName) {
                        agentName = null;
                        agentPhone = trackingEntry.agent_phone;
                      }
                    }
                  }
                  
                  // Format estimated delivery time - extract only time from ISO string
                  const formatDeliveryTime = (dateString: string | null | undefined): string => {
                    if (!dateString) return '';
                    try {
                      const date = new Date(dateString);
                      if (isNaN(date.getTime())) return '';
                      return date.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      });
                    } catch {
                      return '';
                    }
                  };
                  
                  const deliveryTime = formatDeliveryTime(displayOrder?.estimated_delivery_time);
                  
                  // Get status config
                  const statusConfig = mapOrderStatusToUI(displayStatus);
                  
                  // Check if order is delivered
                  const isDelivered = (displayStatus || '').toLowerCase().trim() === 'delivered' || 
                                      (displayStatus || '').toLowerCase().trim() === 'completed';
                  
                  // Format timestamp to show only time
                  const formatTimestamp = (timestamp: string | null | undefined): string => {
                    if (!timestamp) return '';
                    try {
                      const date = new Date(timestamp);
                      if (isNaN(date.getTime())) return '';
                      return date.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      });
                    } catch {
                      return '';
                    }
                  };
                  
                  // Determine timeline state for each tracking entry
                  // If delivered, all items are completed. Otherwise, last entry is current
                  const getTimelineState = (index: number, totalItems: number) => {
                    if (isDelivered) {
                      // If delivered, all items are completed
                      return 'completed';
                    }
                    if (index < totalItems - 1) {
                      return 'completed'; // All previous items are completed
                    } else {
                      return 'current'; // Last item is current
                    }
                  };
                  
                  return (
                    <>
                      {/* Top Section: Restaurant Info + Status */}
                      <View style={styles.trackingTopSection}>
                        <View style={styles.trackingRestaurantLeft}>
                          {displayOrder.restaurant?.logo_url ? (
                            <Image
                              source={{ uri: displayOrder.restaurant.logo_url }}
                              style={styles.trackingRestaurantLogo}
                              defaultSource={require('@/assets/dummy-restaurent.png')}
                            />
                          ) : (
                            <View style={styles.trackingRestaurantLogoPlaceholder}>
                              <MaterialIcons name="restaurant" size={20} color="#999" />
                            </View>
                          )}
                          <View style={styles.trackingRestaurantDetails}>
                            <Text style={styles.trackingRestaurantName}>
                              {displayOrder.restaurant?.name || 'Unknown Restaurant'}
                            </Text>
                            {displayOrder.delivery_address?.address3 && (
                              <Text style={styles.trackingRestaurantAddress}>
                                {displayOrder.delivery_address.address3}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={[styles.trackingStatusBadge, { backgroundColor: statusConfig.bgColor }]}>
                          <MaterialIcons 
                            name={statusConfig.iconName as any} 
                            size={16} 
                            color={statusConfig.color} 
                          />
                          <Text style={[styles.trackingStatusText, { color: statusConfig.color }]}>
                            {statusConfig.label}
                          </Text>
                        </View>
                      </View>
                      
                      {/* Items List */}
                      {displayOrder.items && displayOrder.items.length > 0 && (
                        <View style={styles.trackingItemsContainer}>
                          {displayOrder.items.map((item: any, index: number) => (
                            <Text key={index} style={styles.trackingItemText}>
                              {item.quantity || 1}× {item.item_name || 'Item'}
                            </Text>
                          ))}
                        </View>
                      )}
                      
                      {/* Divider */}
                      <View style={styles.trackingDivider} />
                      
                      {/* Estimated Delivery Time or Completed Status */}
                      {isDelivered ? (
                        <View style={styles.trackingCompletedContainer}>
                          <MaterialIcons name="check-circle" size={64} color="#00B14F" />
                          <Text style={styles.trackingCompletedText}>Completed</Text>
                        </View>
                      ) : deliveryTime ? (
                        <View style={styles.trackingDeliveryTimeContainer}>
                          <Text style={styles.trackingDeliveryTimeValue}>{deliveryTime}</Text>
                          <Text style={styles.trackingDeliveryTimeLabel}>ESTIMATED DELIVERY TIME</Text>
                        </View>
                      ) : null}
                      
                      {/* Vertical Timeline */}
                      <View style={styles.trackingTimelineVerticalContainer}>
                        {trackingArray.map((trackingEntry: any, index: number) => {
                          const state = getTimelineState(index, trackingArray.length);
                          const isCompleted = state === 'completed';
                          const isCurrent = state === 'current';
                          
                          return (
                            <View key={trackingEntry.id || index} style={styles.trackingTimelineItem}>
                              <View style={styles.trackingTimelineItemContent}>
                                {/* Icon */}
                                <View style={[
                                  styles.trackingTimelineIcon,
                                  isCompleted && styles.trackingTimelineIconCompleted,
                                  isCurrent && !isDelivered && styles.trackingTimelineIconCurrent,
                                  !isCompleted && !isCurrent && styles.trackingTimelineIconUpcoming,
                                ]}>
                                  {isCompleted || isDelivered ? (
                                    <MaterialIcons name="check" size={8} color="#FFFFFF" />
                                  ) : isCurrent ? (
                                    <ActivityIndicator size="small" color="#3B82F6" />
                                  ) : (
                                    <MaterialIcons name="radio-button-unchecked" size={8} color="#BFBCBA" />
                                  )}
                                </View>
                                
                                {/* Connector line (except for last item) */}
                                {index < trackingArray.length - 1 && (
                                  <View style={[
                                    styles.trackingTimelineConnector,
                                    isCompleted && styles.trackingTimelineConnectorCompleted,
                                    !isCompleted && styles.trackingTimelineConnectorUpcoming,
                                  ]} />
                                )}
                              </View>
                              
                              {/* Label - Display message from tracking array */}
                              <View style={styles.trackingTimelineLabelContainer}>
                                <Text style={[
                                  styles.trackingTimelineLabel,
                                  isCurrent && !isDelivered && styles.trackingTimelineLabelCurrent,
                                  !isCurrent && styles.trackingTimelineLabelDefault,
                                ]}>
                                  {trackingEntry.message || 'Status update'}
                                </Text>
                                {/* Timestamp below message */}
                                {trackingEntry.timestamp && (
                                  <Text style={styles.trackingTimelineTimestamp}>
                                    {formatTimestamp(trackingEntry.timestamp)}
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                      
                      {/* Divider */}
                      <View style={styles.trackingDivider} />
                      
                      {/* Agent Details */}
                      <View style={styles.trackingPartnerRow}>
                        <Text style={styles.trackingPartnerName}>
                          {agentName || 'No Delivery Agent Assigned'}
                        </Text>
                        <Text style={styles.trackingPartnerPhone}>
                          {agentPhone || ' '}
                        </Text>
                      </View>
                      
                      {/* Bottom spacing - two lines */}
                      <View style={styles.trackingBottomSpacing} />
                    </>
                  );
                })()}
              </ScrollView>
            ) : null}
          </View>
        </View>
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
  cancellationCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  cancellationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  cancellationTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#DC2626',
    lineHeight: 24,
  },
  cancellationReason: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#991B1B',
    lineHeight: 21,
  },
  webViewModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  trackingBottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    // Enhanced shadow for better visibility
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 15, // Android shadow
  },
  trackingBottomSheetContent: {
    flex: 1,
  },
  trackingBottomSheetContentContainer: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 40, // Two lines worth of space at the bottom
  },
  trackingLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  trackingLoadingText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    marginTop: 8,
  },
  trackingTopSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  trackingRestaurantLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 12,
  },
  trackingRestaurantLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: 'rgba(185, 185, 185, 0.2)',
  },
  trackingRestaurantLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: 'rgba(185, 185, 185, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingRestaurantDetails: {
    flex: 1,
    gap: 0,
  },
  trackingRestaurantName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: '#000000',
    marginBottom: 2,
  },
  trackingRestaurantAddress: {
    fontFamily: 'Poppins',
    fontSize: 11,
    lineHeight: 16,
    color: '#000000',
    opacity: 0.85,
  },
  trackingStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    gap: 4,
    height: 26,
    justifyContent: 'center',
  },
  trackingStatusText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    lineHeight: 16,
  },
  trackingItemsContainer: {
    marginBottom: 12,
    gap: 4,
  },
  trackingItemText: {
    fontFamily: 'Poppins',
    fontSize: 11,
    lineHeight: 16,
    color: '#000000',
    opacity: 0.85,
  },
  trackingDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginVertical: 12,
  },
  trackingDeliveryTimeContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  trackingDeliveryTimeValue: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 26,
    lineHeight: 36,
    textAlign: 'center',
    color: '#000000',
    marginBottom: 4,
  },
  trackingDeliveryTimeLabel: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    textTransform: 'uppercase',
    color: '#000000',
  },
  trackingTimelineVerticalContainer: {
    flexDirection: 'column',
    marginVertical: 12,
    paddingLeft: 4,
  },
  trackingTimelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    position: 'relative',
  },
  trackingTimelineItemContent: {
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  trackingTimelineIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    zIndex: 1,
  },
  trackingTimelineIconCompleted: {
    backgroundColor: '#00B14F',
  },
  trackingTimelineIconCurrent: {
    backgroundColor: '#3B82F6',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  trackingTimelineIconUpcoming: {
    backgroundColor: '#BFBCBA',
  },
  trackingTimelineLabelContainer: {
    flex: 1,
    paddingTop: 2,
  },
  trackingTimelineLabel: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'left',
    color: '#000000',
  },
  trackingTimelineLabelDefault: {
    color: '#000000',
  },
  trackingTimelineLabelCurrent: {
    color: '#3B82F6',
    fontFamily: 'Poppins_600SemiBold',
  },
  trackingTimelineTimestamp: {
    fontFamily: 'Poppins',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'left',
    color: '#888888',
    marginTop: 4,
  },
  trackingTimelineConnector: {
    position: 'absolute',
    top: 14,
    left: 7,
    width: 1,
    height: '100%',
    zIndex: 0,
  },
  trackingTimelineConnectorCompleted: {
    backgroundColor: '#00B14F',
  },
  trackingTimelineConnectorUpcoming: {
    backgroundColor: '#B1B1B1',
  },
  trackingPartnerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  trackingPartnerName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 17,
    lineHeight: 24,
    textTransform: 'capitalize',
    color: '#181C2E',
    flex: 1,
  },
  trackingPartnerPhone: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    color: '#888888',
    textAlign: 'right',
  },
  trackingBottomSpacing: {
    height: 32, // Two lines worth of space (16px per line)
  },
  trackingCompletedContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  trackingCompletedText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    color: '#00B14F',
    marginTop: 8,
  },
});




