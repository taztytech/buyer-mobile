import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ordersService, OrderListItem } from '@/services/orders.service';
import { Shimmer } from '@/components/Shimmer';

interface OrderItem {
  id: string;
  name: string;
  image?: any;
  isVeg: boolean;
}

interface Order {
  id: string;
  restaurantName: string;
  restaurantLocation: string;
  restaurantLogo: any;
  orderDate: string;
  totalAmount: number;
  status: 'delivered' | 'cancelled' | 'ongoing';
  items: OrderItem[];
}

interface OrdersScreenProps {
  visible?: boolean;
  onBack?: () => void;
  onOrderDetails?: (orderId: string) => void;
  onReorder?: (orderId: string) => void;
  onRateOrder?: (orderId: string, orderData?: any) => void;
  onTrackOrder?: (orderId: string) => void;
  onHelp?: (orderId: string) => void;
  onViewMore?: () => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  visible = false,
  onBack,
  onOrderDetails,
  onReorder,
  onRateOrder,
  onTrackOrder,
  onHelp,
  onViewMore,
}) => {
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    // Fetch fresh data whenever screen becomes visible
    if (visible) {
      setCurrentPage(1);
      fetchOrders(1, true);
    }
  }, [visible]);

  const fetchOrders = async (page: number = 1, reset: boolean = false) => {
    try {
      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      const response = await ordersService.getOrders(5, page);

      if (response.success && response.data) {
        // Try different response structures the API might return
        const ordersArray =
          response.data.data || // Double-wrapped response
          response.data.orders || // Direct orders array
          (Array.isArray(response.data) ? response.data : []); // Data is already array

        // Get total from various possible locations in response
        const total =
          response.data.total ||
          response.data.meta?.total || // Added meta.total
          response.data.data?.total ||
          response.data.pagination?.total ||
          response.data.metadata?.total ||
          ordersArray.length; // Fallback to array length

        if (reset) {
          setOrders(ordersArray);
        } else {
          // Append new orders to existing ones, filtering out duplicates
          setOrders(prev => {
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
    }
  };

  const handleViewMore = () => {
    const nextPage = currentPage + 1;
    fetchOrders(nextPage, false);
  };

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

  // Map API status to UI status
  const mapStatus = (status: string | null | undefined): 'delivered' | 'cancelled' | 'ongoing' | 'payment_failed' => {
    if (!status) return 'ongoing';
    const statusMap: { [key: string]: 'delivered' | 'cancelled' | 'ongoing' | 'payment_failed' } = {
      'delivered': 'delivered',
      'completed': 'delivered',
      'payment_failed': 'payment_failed',
      'cancelled': 'cancelled',
      'rejected': 'cancelled',
      'pending': 'ongoing',
      'confirmed': 'ongoing',
      'preparing': 'ongoing',
      'ready': 'ongoing',
      'out_for_delivery': 'ongoing',
    };
    return statusMap[status.toLowerCase()] || 'ongoing';
  };

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

  const handleTrackOrder = (orderId: string) => {
    if (onTrackOrder) {
      onTrackOrder(orderId);
    }
  };

  const handleHelp = (orderId: string) => {
    if (onHelp) {
      onHelp(orderId);
    }
  };

  const handleOrderPress = (orderId: string) => {
    if (onOrderDetails) {
      onOrderDetails(orderId);
    }
  };

  const renderOrderCard = (order: any) => {
    const statusConfig = {
      delivered: {
        label: 'Delivered',
        color: '#00B14F',
        bgColor: 'rgba(0, 177, 79, 0.1)',
        icon: 'check-circle',
      },
      cancelled: {
        label: 'Cancelled',
        color: '#DC2626',
        bgColor: 'rgba(220, 38, 38, 0.1)',
        icon: 'cancel',
      },
      payment_failed: {
        label: 'Payment Failed',
        color: '#DC2626',
        bgColor: 'rgba(220, 38, 38, 0.1)',
        icon: 'payment',
      },
      ongoing: {
        label: 'On the way',
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.1)',
        icon: 'local-shipping',
      },
    };

    // Check for payment failed status - priority check
    let actualStatus = mapStatus(order.status);
    
    // Check payment_status field first - if payment failed, show payment failed regardless of order status
    if (order.payment_status?.toLowerCase() === 'failed' || 
        order.payment_status?.toLowerCase() === 'payment_failed' ||
        order.status?.toLowerCase() === 'payment_failed') {
      actualStatus = 'payment_failed';
    } else if (actualStatus === 'cancelled' && order.payment_method === 'online' && 
        order.cancellation_reason?.toLowerCase().includes('payment failed')) {
      actualStatus = 'payment_failed';
    } else if (order.payment_method === 'online' && 
               order.payment_status?.toLowerCase() === 'pending' && 
               (order.status?.toLowerCase() === 'pending' || order.status?.toLowerCase() === 'cancelled')) {
      // If payment is pending but order is cancelled/pending for online payment, it's likely a payment failure
      actualStatus = 'payment_failed';
    }

    const status = statusConfig[actualStatus] || statusConfig.ongoing;

    // Get location from delivery address
    const location = order.delivery_address?.city || 'Unknown';
    const totalAmount = order.summary?.total_amount || 0;

    // Disable opening order details for payment failed orders
    const isPaymentFailed = actualStatus === 'payment_failed';
    
    return (
      <TouchableOpacity
        style={[
          styles.orderCard,
          { paddingBottom: isPaymentFailed ? 0 : 20 }
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
              <Text style={styles.restaurantLocation}>{location}</Text>
            </View>
          </View>
          <View style={styles.orderMeta}>
            <Text style={styles.orderDate}>{formatDate(order.created_at || '')}</Text>
            <Text style={styles.orderAmount}>₹{totalAmount}</Text>
          </View>
        </View>

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
          <MaterialIcons name={status.icon as any} size={16} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
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
          {actualStatus === 'ongoing' ? (
            <>
              <TouchableOpacity
                style={styles.rateButton}
                onPress={() => handleHelp(order.id.toString())}
                activeOpacity={0.7}
              >
                <MaterialIcons name="help-outline" size={18} color="#001E1F" />
                <Text style={styles.rateButtonText}>Help</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reorderButton}
                onPress={() => handleTrackOrder(order.id.toString())}
                activeOpacity={0.8}
              >
                <MaterialIcons name="location-on" size={18} color="#FFFFFF" />
                <Text style={styles.reorderButtonText}>Track Order</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {actualStatus === 'payment_failed' ? (
                // For payment failed orders, don't show any buttons
                null
              ) : actualStatus === 'cancelled' ? (
                // For cancelled orders, show Help button
                <TouchableOpacity
                  style={styles.rateButton}
                  onPress={() => handleHelp(order.id.toString())}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="help-outline" size={18} color="#001E1F" />
                  <Text style={styles.rateButtonText}>Help</Text>
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
              {actualStatus !== 'payment_failed' && (
                <TouchableOpacity
                  style={styles.reorderButton}
                  onPress={() => handleReorder(order.id.toString())}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
                  <Text style={styles.reorderButtonText}>Reorder</Text>
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
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
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
              onPress={fetchOrders}
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

            {/* View More Button - Show only if there are more orders to load */}
            {orders.length < totalOrders && (
              <TouchableOpacity
                style={styles.viewMoreButton}
                onPress={handleViewMore}
                activeOpacity={0.7}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color="#00B14F" />
                ) : (
                  <Text style={styles.viewMoreText}>View more orders</Text>
                )}
              </TouchableOpacity>
            )}

            {/* App Version */}
            <Text style={styles.appVersion}>App Version 1.2</Text>
          </>
        )}
      </ScrollView>

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
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
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
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
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
  viewMoreButton: {
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  viewMoreText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: '#00B14F',
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
});
