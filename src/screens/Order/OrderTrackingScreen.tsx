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
import { isExpoGo } from '@/utils/platform.util';

// Conditionally import maps for standalone/dev-client builds only.
let MapView: any;
let Marker: any;
let Polyline: any;
if (!isExpoGo()) {
  try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    Polyline = maps.Polyline;
  } catch (e) {
    console.warn('react-native-maps not available in OrderTrackingScreen');
  }
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Coordinate {
  latitude: number;
  longitude: number;
}

const toNumber = (value: any): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const extractCoordinate = (source: any): Coordinate | null => {
  if (!source || typeof source !== 'object') return null;

  const latKeys = ['latitude', 'lat', 'agent_latitude', 'agent_lat', 'rider_latitude', 'rider_lat'];
  const lngKeys = ['longitude', 'lng', 'lon', 'agent_longitude', 'agent_lng', 'rider_longitude', 'rider_lng'];

  let lat: number | null = null;
  let lng: number | null = null;

  for (const key of latKeys) {
    lat = toNumber(source[key]);
    if (lat !== null) break;
  }
  for (const key of lngKeys) {
    lng = toNumber(source[key]);
    if (lng !== null) break;
  }

  if (lat === null || lng === null) return null;
  return { latitude: lat, longitude: lng };
};

const extractRestaurantCoordinate = (order: any): Coordinate | null => {
  if (!order) return null;
  return (
    extractCoordinate(order.restaurant?.location) ||
    extractCoordinate(order.restaurant?.locations?.[0]) ||
    extractCoordinate(order.restaurant) ||
    extractCoordinate(order)
  );
};

const extractCustomerCoordinate = (order: any): Coordinate | null => {
  if (!order) return null;
  return extractCoordinate(order.delivery_address) || extractCoordinate(order.customer) || null;
};

const extractAgentCoordinate = (order: any): Coordinate | null => {
  if (!order) return null;
  const tracking = Array.isArray(order.tracking) ? [...order.tracking].reverse() : [];

  for (const item of tracking) {
    const coord = extractCoordinate(item);
    if (coord) return coord;
  }

  return (
    extractCoordinate(order.agent) ||
    extractCoordinate(order.delivery_partner) ||
    extractCoordinate(order.rider) ||
    null
  );
};

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

  // Fetch order details from API
  const fetchOrderDetails = useCallback(async () => {
    if (!orderId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await ordersService.getOrderById(Number(orderId));

      if (response.success && response.data) {
        setOrderData(response.data);
        // Initialize status ref with fetched status
        if (response.data.status) {
          lastStatusRef.current = response.data.status;
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
  // This will automatically update when FCM sends status updates
  // Watch the specific order in state.byId to detect when it's updated via FCM
  const contextOrder = orderId ? state.byId[orderId] : undefined;
  
  useEffect(() => {
    if (!orderId || !contextOrder || !orderData) return undefined;

    // Check if status has actually changed
    const currentContextStatus = contextOrder.status;
    const currentContextUpdatedAt = contextOrder.updated_at;
    const previousStatus = lastStatusRef.current;
    
    // Update ref with current status
    if (previousStatus !== currentContextStatus) {
      lastStatusRef.current = currentContextStatus;
      
      // Update status immediately from context
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
      
      // Refetch order details to get updated tracking array
      // Use a small delay to avoid race conditions
      const refetchTimer = setTimeout(() => {
        fetchOrderDetails();
      }, 500);
      
      return () => clearTimeout(refetchTimer);
    }
    
    return undefined;
  }, [orderId, contextOrder?.status, contextOrder?.updated_at, orderData]);

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

  const restaurantCoordinate = extractRestaurantCoordinate(orderData);
  const customerCoordinate = extractCustomerCoordinate(orderData);
  const agentCoordinate = extractAgentCoordinate(orderData);

  const assignedStatusSet = new Set([
    'agent_assigned',
    'agent-assigned',
    'agent_arrived_restaurant',
    'agent-arrived-restaurant',
    'picked',
    'out_for_delivery',
    'out-for-delivery',
    'on_the_way',
    'on-the-way',
    'delivered',
  ]);

  const readyStatusSet = new Set([
    'packed',
    'ready',
    'order_ready',
    'order-ready',
  ]);

  const currentStatusKey = (currentStatus || '').toString().toLowerCase();
  const hasAgentAssignedSignal =
    assignedStatusSet.has(currentStatusKey) ||
    !!agentCoordinate ||
    sortedTracking.some((item: any) => !!item?.agent_name || !!item?.agent_phone);

  const showPreAssignmentRoute =
    readyStatusSet.has(currentStatusKey) &&
    !hasAgentAssignedSignal &&
    !!restaurantCoordinate &&
    !!customerCoordinate;

  const showLiveTracking =
    hasAgentAssignedSignal &&
    !!customerCoordinate &&
    !!agentCoordinate;

  const mapCoordinatesForViewport: Coordinate[] = [
    ...(restaurantCoordinate ? [restaurantCoordinate] : []),
    ...(customerCoordinate ? [customerCoordinate] : []),
    ...(showLiveTracking && agentCoordinate ? [agentCoordinate] : []),
  ];

  const mapRegion = (() => {
    const fallback = { latitude: 9.9352, longitude: 78.1304 };
    const center = customerCoordinate || restaurantCoordinate || agentCoordinate || fallback;
    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  })();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#E9E9E9" />

      {/* Map Area - Pre-assignment route preview and live tracking share this area */}
      <View style={styles.mapArea}>
        {MapView && mapCoordinatesForViewport.length >= 2 ? (
          <MapView
            style={styles.map}
            initialRegion={mapRegion}
          >
            {/* Restaurant and customer are always shown when available */}
            {restaurantCoordinate && (
              <Marker
                coordinate={restaurantCoordinate}
                title="Restaurant"
                pinColor="#00B14F"
              />
            )}
            {customerCoordinate && (
              <Marker
                coordinate={customerCoordinate}
                title="Delivery Location"
                pinColor="#2563EB"
              />
            )}

            {/* Pre-assignment route: restaurant to customer */}
            {showPreAssignmentRoute && restaurantCoordinate && customerCoordinate && (
              <Polyline
                coordinates={[restaurantCoordinate, customerCoordinate]}
                strokeColor="#00B14F"
                strokeWidth={4}
                lineDashPattern={[8, 8]}
              />
            )}

            {/* Live mode route and rider marker */}
            {showLiveTracking && agentCoordinate && customerCoordinate && (
              <>
                <Marker
                  coordinate={agentCoordinate}
                  title="Delivery Partner"
                  pinColor="#F97316"
                />
                <Polyline
                  coordinates={[agentCoordinate, customerCoordinate]}
                  strokeColor="#F97316"
                  strokeWidth={4}
                />
              </>
            )}
          </MapView>
        ) : (
          <View style={styles.mapFallback}>
            <MaterialIcons name="map" size={44} color="#00B14F" />
            <Text style={styles.mapFallbackTitle}>Tracking Map</Text>
            <Text style={styles.mapFallbackText}>
              {showLiveTracking
                ? 'Live tracking will be shown here as rider location updates arrive.'
                : 'Showing order progress. Route preview will appear once location data is available.'}
            </Text>
          </View>
        )}

        <View style={styles.mapStatusChip}>
          <Text style={styles.mapStatusChipText}>
            {showLiveTracking
              ? 'Live delivery tracking'
              : showPreAssignmentRoute
                ? 'Order ready: route preview'
                : 'Preparing tracking map'}
          </Text>
        </View>
      </View>

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
  mapArea: {
    flex: 1,
    backgroundColor: '#E9E9E9',
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
    backgroundColor: '#E8F8EE',
  },
  mapFallbackTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#001E1F',
  },
  mapFallbackText: {
    fontFamily: 'Poppins',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(0, 30, 31, 0.75)',
    textAlign: 'center',
  },
  mapStatusChip: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 92,
    alignItems: 'center',
  },
  mapStatusChipText: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#001E1F',
    overflow: 'hidden',
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
