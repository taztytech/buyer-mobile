import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  ActivityIndicator,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { ordersService, OrderListItem } from '@/services/orders.service';
import { Shimmer } from '@/components/Shimmer';
import { useOrders } from '@/context/OrdersContext';
import { mapOrderStatusToUI } from '@/utils/orderStatusMapping';

// Unused interface - kept for reference
// interface OrderItem {
//   id: string;
//   name: string;
//   image?: any;
//   isVeg: boolean;
// }

// Unused interface - kept for reference
// interface Order {
//   id: string;
//   restaurantName: string;
//   restaurantLocation: string;
//   restaurantLogo: any;
//   orderDate: string;
//   totalAmount: number;
//   status: 'delivered' | 'cancelled' | 'ongoing';
//   items: OrderItem[];
// }

interface OrdersScreenProps {
  visible?: boolean;
  onBack?: () => void;
  onOrderDetails?: (orderId: string) => void;
  onReorder?: (orderId: string) => void;
  onRateOrder?: (orderId: string, orderData?: any) => void;
  onTrackOrder?: (orderId: string) => void;
  onHelp?: (order: OrderListItem) => void;
  onViewMore?: () => void; // Unused but kept for API compatibility
  // Optional: orderId to highlight when navigating from notification
  highlightOrderId?: string | null;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  visible = false,
  onBack,
  onOrderDetails,
  onReorder,
  onRateOrder,
  onTrackOrder,
  onHelp,
  onViewMore: _onViewMore, // Unused but kept for API compatibility
  highlightOrderId,
}) => {
  // Use Orders Context for global state
  const { dispatch, getOrdersList } = useOrders();
  
  // Get orders from context (live updates from FCM)
  const contextOrders = getOrdersList();
  
  // Local state for API pagination and loading
  const [localOrders, setLocalOrders] = useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Refs to prevent API overload
  const isRequestInProgress = useRef(false);
  const lastRequestedPage = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const highlightedOrderRef = useRef<string | null>(null);
  
  // Merge context orders (with FCM updates) with local orders from API
  // Priority: Context orders (have latest FCM updates) > Local orders
  const orders = React.useMemo(() => {
    const contextOrderMap = new Map(contextOrders.map(o => [o.id.toString(), o]));
    const merged = [...localOrders];
    
    // Update local orders with context updates
    merged.forEach((order, index) => {
      const contextOrder = contextOrderMap.get(order.id.toString());
      if (contextOrder) {
        merged[index] = contextOrder;
        contextOrderMap.delete(order.id.toString());
      }
    });
    
    // Add any new orders from context that aren't in local
    contextOrderMap.forEach((order) => {
      merged.push(order);
    });
    
    // Sort by updated_at descending (most recent first)
    return merged.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [contextOrders, localOrders]);

  // Sync localOrders to context store after state updates
  useEffect(() => {
    if (localOrders.length > 0) {
      dispatch({
        type: 'BULK_SET_ORDERS',
        payload: localOrders,
      });
    }
  }, [localOrders, dispatch]);

  useEffect(() => {
    // Fetch fresh data whenever screen becomes visible
    if (visible) {
      setCurrentPage(1);
      fetchOrders(1, true);
    }
  }, [visible]);

  const fetchOrders = async (page: number = 1, reset: boolean = false) => {
    // Prevent duplicate requests for the same page
    if (!reset && lastRequestedPage.current === page) {
      return;
    }

    // Prevent concurrent requests
    if (isRequestInProgress.current) {
      return;
    }

    try {
      isRequestInProgress.current = true;
      lastRequestedPage.current = page;

      if (reset) {
        setIsLoading(true);
        lastRequestedPage.current = 0; // Reset when fetching first page
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      const response = await ordersService.getOrders(5, page);

      if (response.success && response.data) {
        // Type assertion to handle different API response structures
        const responseData = response.data as any;
        
        // Try different response structures the API might return
        const ordersArray =
          responseData.data || // Double-wrapped response
          responseData.orders || // Direct orders array
          (Array.isArray(responseData) ? responseData : []); // Data is already array

        // Get total from various possible locations in response
        const total =
          responseData.total ||
          responseData.meta?.total || // Added meta.total
          responseData.data?.total ||
          responseData.pagination?.total ||
          responseData.metadata?.total ||
          ordersArray.length; // Fallback to array length

        if (reset) {
          setLocalOrders(ordersArray);
        } else {
          // Append new orders to existing ones, filtering out duplicates
          setLocalOrders(prev => {
            const existingIds = new Set(prev.map(o => o.id));
            const newOrders = ordersArray.filter((order: any) => !existingIds.has(order.id));
            return [...prev, ...newOrders];
          });
        }
        setTotalOrders(total);
        setCurrentPage(page);
      } else {
        setError(response.error || 'Failed to load orders');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      isRequestInProgress.current = false;
    }
  };

  // Auto-load more orders when scrolling near bottom (infinite scroll)
  const handleViewMore = useCallback(() => {
    // Prevent if already loading or no more orders
    if (isRequestInProgress.current || isLoadingMore || orders.length >= totalOrders) {
      return;
    }
    const nextPage = currentPage + 1;
    fetchOrders(nextPage, false);
  }, [currentPage, orders.length, totalOrders, isLoadingMore]);

  // Infinite scroll handler - automatically load more when near bottom
  const handleScroll = useCallback(({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Clear any pending timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Capture scroll position values immediately
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const paddingToBottom = 300; // Trigger when 300px from bottom
    const isNearBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;

    // Debounce: wait 200ms after scrolling stops before checking if we need to load more
    scrollTimeoutRef.current = setTimeout(() => {
      if (
        !isLoading &&
        !isLoadingMore &&
        !isRequestInProgress.current &&
        orders.length > 0 &&
        orders.length < totalOrders &&
        isNearBottom
      ) {
        // Automatically load more orders (infinite scroll)
        handleViewMore();
      }
    }, 200);
  }, [isLoading, isLoadingMore, orders.length, totalOrders, handleViewMore]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Format date to match the design
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      });
    } catch (error) {
      return 'N/A';
    }
  };

  // Scroll to highlighted order when navigating from notification
  useEffect(() => {
    if (highlightOrderId && orders.length > 0 && scrollViewRef.current) {
      const orderIndex = orders.findIndex(o => o.id.toString() === highlightOrderId);
      if (orderIndex >= 0 && highlightedOrderRef.current !== highlightOrderId) {
        highlightedOrderRef.current = highlightOrderId;
        // Scroll to order after a short delay to ensure layout is complete
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: orderIndex * 250, // Approximate height per card
            animated: true,
          });
        }, 500);
      }
    }
  }, [highlightOrderId, orders]);

  // Mock data kept for fallback (commented out)
  /*
  const mockOrders: Order[] = [
    {
      id: '0',
      restaurantName: 'KFC',
      restaurantLocation: 'Keelkattlai',
      restaurantLogo: require('@/assets/dummy-restaurent.png'),
      orderDate: 'July 06, 2025',
      totalAmount: 69,
      status: 'ongoing',
      items: [
        {
          id: '1',
          name: 'Chicken Roll',
          isVeg: false,
        },
      ],
    },
    {
      id: '1',
      restaurantName: 'KFC',
      restaurantLocation: 'Velachery',
      restaurantLogo: require('@/assets/dummy-restaurent.png'),
      orderDate: 'July 05, 2025',
      totalAmount: 69,
      status: 'delivered',
      items: [
        {
          id: '1',
          name: 'Chicken Roll',
          isVeg: false,
        },
      ],
    },
    {
      id: '2',
      restaurantName: 'KFC',
      restaurantLocation: 'Velachery',
      restaurantLogo: require('@/assets/dummy-restaurent.png'),
      orderDate: 'July 05, 2025',
      totalAmount: 69,
      status: 'delivered',
      items: [
        {
          id: '1',
          name: 'Chicken Roll',
          isVeg: false,
        },
      ],
    },
    {
      id: '3',
      restaurantName: 'KFC',
      restaurantLocation: 'Velachery',
      restaurantLogo: require('@/assets/dummy-restaurent.png'),
      orderDate: 'July 05, 2025',
      totalAmount: 69,
      status: 'delivered',
      items: [
        {
          id: '1',
          name: 'Chicken Roll',
          image: require('@/assets/icon.png'),
          isVeg: false,
        },
        {
          id: '2',
          name: 'Chicken Popcorn',
          image: require('@/assets/icon.png'),
          isVeg: false,
        },
        {
          id: '3',
          name: 'Chicken Shawarma',
          image: require('@/assets/icon.png'),
          isVeg: false,
        },
      ],
    },
  ];
  */

  const handleReorder = (orderId: string) => {
    if (onReorder) {
      onReorder(orderId);
    }
  };

  const handleRateOrder = (orderId: string) => {
    if (onRateOrder) {
      // Find the order from the orders array
      const order = orders.find(o => o.id.toString() === orderId);
      onRateOrder(orderId, order);
    }
  };

  const [showTrackingWebView, setShowTrackingWebView] = useState(false);
  const [selectedTrackingUrl, setSelectedTrackingUrl] = useState<string | null>(null);

  const handleTrackOrder = (orderId: string, order?: OrderListItem) => {
    // Check if order has tracking_url
    const trackingUrl = (order as any)?.tracking_url || null;
    
    if (trackingUrl && trackingUrl !== null) {
      // Open WebView with tracking URL
      setSelectedTrackingUrl(trackingUrl);
      setShowTrackingWebView(true);
    } else if (onTrackOrder) {
      // Fallback to parent handler if no tracking URL
      onTrackOrder(orderId);
    }
  };

  const handleHelp = (order: OrderListItem) => {
    if (onHelp) {
      onHelp(order);
    }
  };

  const handleCallSupportFromCancelled = () => {
    const supportNumber = '8098777720';
    if (!supportNumber) return;
    const telUrl = `tel:${supportNumber.replace(/\s+/g, '')}`;
    Linking.openURL(telUrl).catch(() => {});
  };

  const handleOrderPress = (orderId: string) => {
    if (onOrderDetails) {
      onOrderDetails(orderId);
    }
  };

  const renderOrderCard = (order: OrderListItem) => {
    // Use status mapping utility for consistent status display
    // Check for payment failed status first (priority)
    let statusToMap = order.status;
    if (
      order.payment_status?.toLowerCase() === 'failed' ||
      order.payment_status?.toLowerCase() === 'payment_failed' ||
      order.status?.toLowerCase() === 'payment_failed'
    ) {
      statusToMap = 'payment_failed';
    } else if (
      order.payment_status?.toLowerCase() === 'pending' &&
      (order.status?.toLowerCase() === 'pending' || order.status?.toLowerCase() === 'cancelled')
    ) {
      // If payment is pending but order is cancelled/pending, it's likely a payment failure
      statusToMap = 'payment_failed';
    }

    // Get status config from mapping utility
    const statusConfig = mapOrderStatusToUI(statusToMap);
    
    // Check if this order should be highlighted
    const isHighlighted = highlightOrderId === order.id.toString();

    // Show order number from API response (e.g., "ORD-20251208-084")
    // The API returns "order_number" field, so we use it directly
    const orderNumber = order.order_number || (order as any).orderNumber || `ORD-${order.id}`;
    
    // Get total amount - check multiple possible locations in API response
    const totalAmount = order.total_amount || (order as any).summary?.total_amount || (order as any).total || 0;

    // Disable opening order details for payment failed orders
    const isPaymentFailed = statusToMap === 'payment_failed';

    return (
      <TouchableOpacity
        style={[
          styles.orderCard,
          { paddingBottom: isPaymentFailed ? 0 : 20 },
          isHighlighted && styles.highlightedCard,
        ]}
        activeOpacity={isPaymentFailed ? 1 : 0.7}
        onPress={isPaymentFailed ? undefined : () => handleOrderPress(order.id.toString())}
        disabled={isPaymentFailed}
      >
        {/* Header Row */}
        <View style={styles.orderHeader}>
          <View style={styles.restaurantInfo}>
            <Image
              source={{ uri: order.restaurant?.logo_url || '' }}
              style={styles.restaurantLogo}
              defaultSource={require('@/assets/dummy-restaurent.png')}
            />
            <View style={styles.restaurantDetails}>
              <Text style={styles.restaurantName}>{order.restaurant?.name || 'Unknown Restaurant'}</Text>
              <Text style={styles.restaurantLocation}>{orderNumber}</Text>
            </View>
          </View>
          <View style={styles.orderMeta}>
            <Text style={styles.orderAmount}>₹{totalAmount}</Text>
          </View>
        </View>

        {/* Status + Meta Row */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <MaterialIcons name={statusConfig.iconName as any} size={16} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
          <View style={styles.orderMeta}>
            <Text style={styles.orderDate}>{formatDate(order.created_at || '')}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Order Items */}
        <View style={styles.itemsContainer}>
          {/* Show first 2 items */}
          <View style={styles.multipleItems}>
            {(order.items || []).slice(0, 2).map((item: any, index: number) => (
              <View key={`${order.id}-item-${item.id || index}-${index}`} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.quantity || 1}x {item.item_name || 'Item'}</Text>
              </View>
            ))}
            {/* Show +X more items if there are more than 2 */}
            {order.items && order.items.length > 2 && (
              <Text style={styles.moreItemsText}>
                +{order.items.length - 2} more item{order.items.length - 2 > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {statusToMap !== 'delivered' && statusToMap !== 'cancelled' && statusToMap !== 'payment_failed' ? (
            <>
              {/* <TouchableOpacity
                style={styles.rateButton}
                onPress={() => handleHelp(order)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="help-outline" size={18} color="#001E1F" />
                <Text style={styles.rateButtonText}>Help</Text>
              </TouchableOpacity> */}
              <TouchableOpacity
                style={[
                  styles.reorderButton,
                  (!(order as any)?.tracking_url || (order as any)?.tracking_url === null) && styles.disabledButton
                ]}
                onPress={() => handleTrackOrder(order.id.toString(), order)}
                activeOpacity={(!(order as any)?.tracking_url || (order as any)?.tracking_url === null) ? 1 : 0.8}
                disabled={!(order as any)?.tracking_url || (order as any)?.tracking_url === null}
              >
                <MaterialIcons 
                  name="location-on" 
                  size={18} 
                  color={(!(order as any)?.tracking_url || (order as any)?.tracking_url === null) ? "#CCCCCC" : "#FFFFFF"} 
                />
                <Text style={[
                  styles.reorderButtonText,
                  (!(order as any)?.tracking_url || (order as any)?.tracking_url === null) && styles.disabledButtonText
                ]}>
                  Track Order
                </Text>
              </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reorderButton}
                  onPress={() => handleOrderPress(order.id.toString())}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="visibility" size={18} color="#FFFFFF" />
                  <Text style={styles.reorderButtonText}>View Order</Text>
                </TouchableOpacity>
            </>
          ) : (
            <>
              {isPaymentFailed ? (
                // For payment failed orders, don't show any buttons
                null
              ) : statusToMap === 'cancelled' ? (
                // For cancelled orders, show Call Support button instead of Help
                <TouchableOpacity
                  style={styles.rateButton}
                  onPress={handleCallSupportFromCancelled}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="phone" size={18} color="#001E1F" />
                  <Text style={styles.rateButtonText}>Support</Text>
                </TouchableOpacity>
              ) : order.overall_rating && order.overall_rating > 0 ? (
                // For delivered orders with rating, show rating display
                <View style={styles.ratingDisplay}>
                  <MaterialIcons name="star" size={20} color="#F59E0B" />
                  <Text style={styles.ratingText}>{order.overall_rating.toFixed(1)}</Text>
                </View>
              ) : (
                // For delivered orders without rating, show Rate Order button
                <TouchableOpacity
                  style={styles.rateButton}
                  onPress={() => handleRateOrder(order.id.toString())}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="star-outline" size={18} color="#001E1F" />
                  <Text style={styles.rateButtonText}>Rate Order</Text>
                </TouchableOpacity>
              )}
              {/* Reorder button - shown for all non-ongoing orders except payment_failed */}
              {/* {statusToMap !== 'payment_failed' && (
                <TouchableOpacity
                  style={styles.reorderButton}
                  onPress={() => handleReorder(order.id.toString())}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="visibility" size={18} color="#FFFFFF" />
                  <Text style={styles.reorderButtonText}>Reorder</Text>
                </TouchableOpacity>
              )} */}
               {!isPaymentFailed && (
                <TouchableOpacity
                  style={styles.reorderButton}
                  onPress={() => handleOrderPress(order.id.toString())}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="visibility" size={18} color="#FFFFFF" />
                  <Text style={styles.reorderButtonText}>View Order</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      <SafeAreaView style={styles.container} edges={['bottom']}>

      {/* Search and Filter - Hidden */}
      {/* <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={24} color="rgba(0, 30, 31, 0.5)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="rgba(0, 30, 31, 0.5)"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="filter-list" size={24} color="#00B14F" />
        </TouchableOpacity>
      </View> */}

      {/* Orders List */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={100}
        onScroll={handleScroll}
      >
        {isLoading ? (
          // Loading shimmer
          <>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.orderCard}>
                <Shimmer width="100%" height={200} borderRadius={20} />
              </View>
            ))}
          </>
        ) : error ? (
          // Error state
          <View style={styles.emptyState}>
            <MaterialIcons name="error-outline" size={64} color="rgba(0, 0, 0, 0.2)" />
            <Text style={styles.emptyTitle}>Failed to load orders</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchOrders(1, true)}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : orders.length === 0 ? (
          // Empty state
          <View style={styles.emptyState}>
            <MaterialIcons name="receipt-long" size={64} color="rgba(0, 0, 0, 0.2)" />
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptyText}>
              Your order history will appear here once you place an order
            </Text>
          </View>
        ) : (
          <>
            {orders.map((order, index) => (
              <React.Fragment key={`order-${order.id}-${index}`}>
                {renderOrderCard(order)}
              </React.Fragment>
            ))}

            {/* Infinite scroll loading indicator */}
            {isLoadingMore && (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#00B14F" />
                <Text style={styles.loadingMoreText}>Loading more orders...</Text>
              </View>
            )}

            {/* Show message when all orders are loaded */}
            {!isLoadingMore && orders.length >= totalOrders && orders.length > 0 && (
              <View style={styles.endOfListContainer}>
                <Text style={styles.endOfListText}>You've reached the end</Text>
              </View>
            )}

            {/* App Version */}
            <Text style={styles.appVersion}>App Version 1.2</Text>
          </>
        )}
      </ScrollView>

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
          {selectedTrackingUrl && (
            <WebView
              source={{ uri: selectedTrackingUrl }}
              style={styles.webView}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webViewLoadingContainer}>
                  <ActivityIndicator size="large" color="#00B14F" />
                </View>
              )}
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
    gap: 12,
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
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 16,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 14,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#001E1F',
    paddingVertical: 0,
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 20,
    paddingLeft: 20,
    paddingRight: 20,
    // paddingBottom is set conditionally in component based on payment_failed status
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  restaurantLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  restaurantDetails: {
    flex: 1,
  },
  restaurantName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#001E1F',
    lineHeight: 27,
  },
  restaurantLocation: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 21,
  },
  orderMeta: {
    alignItems: 'flex-end',
  },
  orderDate: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 18,
  },
  orderAmount: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#001E1F',
    lineHeight: 27,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    gap: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  statusText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 21,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 12,
  },
  itemsContainer: {
    marginBottom: 16,
  },
  singleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  itemName: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
  },
  multipleItems: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemImage: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  moreItemsText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 21,
    marginTop: 4,
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
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  loadingMoreText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 21,
  },
  endOfListContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  endOfListText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.5)',
    lineHeight: 21,
  },
  appVersion: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.5)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 24,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#001E1F',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
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
  highlightedCard: {
    borderWidth: 2,
    borderColor: '#00B14F',
    backgroundColor: '#F0FDF4',
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
});
