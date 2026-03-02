import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ordersService } from '@/services/orders.service';
import { useOrders } from '@/context/OrdersContext';
import { mapOrderStatusToUI } from '@/utils/orderStatusMapping';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OrderTrackingScreenProps {
  onBack?: () => void;
  onCallPartner?: () => void;
  orderId?: string;
}

export const OrderTrackingScreen: React.FC<OrderTrackingScreenProps> = ({
  onBack,
  orderId,
}) => {
  const { state } = useOrders();
  const [orderData, setOrderData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastStatusRef = React.useRef<string | null>(null);
  const lastUpdatedAtRef = React.useRef<string | null>(null);

  // Fetch order details from API
  const fetchOrderDetails = useCallback(async () => {
    if (!orderId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await ordersService.getOrderById(Number(orderId));

      if (response.success && response.data) {
        setOrderData(response.data);
        // Initialize refs with fetched data so we detect future changes
        if (response.data.status) {
          lastStatusRef.current = response.data.status;
        }
        if (response.data.updated_at) {
          lastUpdatedAtRef.current = response.data.updated_at;
        }
      } else {
        setError(response.error || 'Failed to load order details');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load order details');
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  // Initial fetch when component mounts
  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId, fetchOrderDetails]);

  // Subscribe to FCM updates via OrdersContext
  // Refetch when status OR updated_at changes so tracking details refresh even when
  // status stays the same (e.g. "Agent Assigned" with new tracking/map updates).
  const contextOrder = orderId ? state.byId[orderId] : undefined;

  useEffect(() => {
    if (!orderId || !contextOrder || !orderData) return undefined;

    const currentContextStatus = contextOrder.status;
    const currentContextUpdatedAt = contextOrder.updated_at ?? null;
    const previousStatus = lastStatusRef.current;
    const previousUpdatedAt = lastUpdatedAtRef.current;

    const statusChanged = previousStatus !== currentContextStatus;
    const updatedAtChanged = previousUpdatedAt !== currentContextUpdatedAt;

    if (statusChanged || updatedAtChanged) {
      lastStatusRef.current = currentContextStatus;
      lastUpdatedAtRef.current = currentContextUpdatedAt;

      setOrderData((prevData: any) => {
        if (!prevData) {
          return contextOrder;
        }
        return {
          ...prevData,
          status: currentContextStatus,
          updated_at: currentContextUpdatedAt,
          ...(contextOrder.restaurant && { restaurant: contextOrder.restaurant }),
        };
      });

      const refetchTimer = setTimeout(() => {
        fetchOrderDetails();
      }, 500);

      return () => clearTimeout(refetchTimer);
    }

    return undefined;
  }, [orderId, contextOrder?.status, contextOrder?.updated_at, orderData, fetchOrderDetails]);

  // Get current status from orderData
  const currentStatus = orderData?.status || null;
  const statusConfig = mapOrderStatusToUI(currentStatus);
  
  // Get tracking array from orderData
  const trackingArray = orderData?.tracking || [];
  // Sort tracking by timestamp (newest first, then reverse for display - oldest first)
  const sortedTracking = [...trackingArray].sort((a: any, b: any) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  // Get status config for tracking item
  const getTrackingStatusConfig = (status: string) => {
    return mapOrderStatusToUI(status);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#E9E9E9" />

      {/* Background - Simple colored background instead of map */}
      <View style={styles.background} />

      {/* Back Button */}
      <SafeAreaView style={styles.backButtonContainer} edges={['top']}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#000000" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Bottom Sheet - Covers half the screen */}
      <View style={styles.bottomSheet}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00B14F" />
            <Text style={styles.loadingText}>Loading order status...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={48} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchOrderDetails}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : orderData ? (
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Current Status Display */}
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                <MaterialIcons 
                  name={statusConfig.iconName as any} 
                  size={24} 
                  color={statusConfig.color} 
                />
                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
              
              {/* Order Number */}
              {orderData.order_number && (
                <Text style={styles.orderNumber}>
                  Order #{orderData.order_number}
                </Text>
              )}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Tracking Timeline */}
            {sortedTracking.length > 0 ? (
              <View style={styles.trackingContainer}>
                <Text style={styles.trackingTitle}>Order Timeline</Text>
                <View style={styles.timeline}>
                  {sortedTracking.map((trackingItem: any, index: number) => {
                    const isLast = index === sortedTracking.length - 1;
                    const trackingStatusConfig = getTrackingStatusConfig(trackingItem.status);
                    const isActive = trackingItem.status === currentStatus;
                    
                    return (
                      <View key={trackingItem.id || index} style={styles.timelineItem}>
                        <View style={styles.timelineIconContainer}>
                          <View 
                            style={[
                              styles.timelineCircle,
                              isActive ? styles.timelineCircleActive : styles.timelineCircleInactive,
                              { backgroundColor: isActive ? trackingStatusConfig.color : '#BFBCBA' }
                            ]}
                          >
                            {isActive && trackingItem.status !== 'created' && (
                              <MaterialIcons name="check" size={10} color="#FFFFFF" />
                            )}
                          </View>
                          {!isLast && (
                            <View 
                              style={[
                                styles.timelineLine,
                                isActive ? styles.timelineLineActive : styles.timelineLineInactive
                              ]} 
                            />
                          )}
                        </View>
                        <View style={styles.timelineContent}>
                          <Text 
                            style={[
                              styles.timelineMessage,
                              isActive && styles.timelineMessageActive
                            ]}
                          >
                            {trackingItem.message || trackingStatusConfig.label}
                          </Text>
                          <Text style={styles.timelineTime}>
                            {formatTimestamp(trackingItem.timestamp)}
                          </Text>
                          {trackingItem.agent_name && (
                            <Text style={styles.timelineAgent}>
                              Agent: {trackingItem.agent_name}
                              {trackingItem.agent_phone && ` • ${trackingItem.agent_phone}`}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.noTrackingContainer}>
                <Text style={styles.noTrackingText}>No tracking information available</Text>
              </View>
            )}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E9E9E9',
  },
  background: {
    flex: 1,
    backgroundColor: '#E9E9E9',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 0,
    left: 20,
    zIndex: 10,
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
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5, // Half the screen height
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 40,
  },
  errorText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#00B14F',
    borderRadius: 8,
  },
  retryButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  statusContainer: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
    gap: 8,
  },
  statusText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
  },
  orderNumber: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 20,
  },
  restaurantInfo: {
    marginBottom: 16,
  },
  restaurantLabel: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.6)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  restaurantName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#001E1F',
    lineHeight: 24,
  },
  updatedContainer: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  updatedLabel: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.6)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  updatedTime: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#001E1F',
  },
  trackingContainer: {
    marginTop: 8,
  },
  trackingTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#001E1F',
    marginBottom: 16,
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  timelineIconContainer: {
    alignItems: 'center',
    paddingTop: 2,
  },
  timelineCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  timelineCircleActive: {
    borderColor: '#FFFFFF',
  },
  timelineCircleInactive: {
    borderColor: '#FFFFFF',
  },
  timelineLine: {
    width: 2,
    height: 40,
    marginTop: 4,
    marginBottom: -4,
  },
  timelineLineActive: {
    backgroundColor: '#00B14F',
  },
  timelineLineInactive: {
    backgroundColor: '#E5E5E5',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 0,
  },
  timelineMessage: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(0, 30, 31, 0.7)',
    marginBottom: 4,
  },
  timelineMessageActive: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#001E1F',
  },
  timelineTime: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.5)',
    marginBottom: 4,
  },
  timelineAgent: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.6)',
    marginTop: 2,
  },
  noTrackingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noTrackingText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    textAlign: 'center',
  },
});
