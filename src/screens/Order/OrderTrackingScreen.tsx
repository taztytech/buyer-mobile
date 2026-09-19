import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { config } from '@/constants/config';
import { restaurantService } from '@/services/restaurant.service';
import { addressService } from '@/services/address.service';
import { WebView } from 'react-native-webview';

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

  const latKeys = [
    'latitude',
    'lat',
    'agent_latitude',
    'agent_lat',
    'rider_latitude',
    'rider_lat',
    'restaurant_latitude',
    'restaurant_lat',
    'delivery_latitude',
    'delivery_lat',
    'customer_latitude',
    'customer_lat',
    'location_latitude',
    'pickup_latitude',
    'drop_latitude',
  ];
  const lngKeys = [
    'longitude',
    'lng',
    'lon',
    'agent_longitude',
    'agent_lng',
    'rider_longitude',
    'rider_lng',
    'restaurant_longitude',
    'restaurant_lng',
    'delivery_longitude',
    'delivery_lng',
    'customer_longitude',
    'customer_lng',
    'location_longitude',
    'pickup_longitude',
    'drop_longitude',
  ];

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

  // Support GeoJSON-like format: { coordinates: [lng, lat] }
  if ((lat === null || lng === null) && Array.isArray(source.coordinates) && source.coordinates.length >= 2) {
    const coordLng = toNumber(source.coordinates[0]);
    const coordLat = toNumber(source.coordinates[1]);
    if (coordLat !== null && coordLng !== null) {
      lat = coordLat;
      lng = coordLng;
    }
  }

  if (lat === null || lng === null) return null;
  return { latitude: lat, longitude: lng };
};

const extractRestaurantCoordinate = (order: any): Coordinate | null => {
  if (!order) return null;
  return (
    extractCoordinate(order.pickup_address) ||
    extractCoordinate(order.restaurant?.location) ||
    extractCoordinate(order.restaurant?.locations?.[0]) ||
    extractCoordinate(order.restaurant?.address) ||
    extractCoordinate(order.restaurant) ||
    extractCoordinate(order)
  );
};

const extractCustomerCoordinate = (order: any): Coordinate | null => {
  if (!order) return null;
  return (
    extractCoordinate(order.delivery_address?.location) ||
    extractCoordinate(order.delivery_address) ||
    extractCoordinate(order.customer?.location) ||
    extractCoordinate(order.customer) ||
    extractCoordinate(order)
  );
};

const extractAgentCoordinate = (order: any): Coordinate | null => {
  if (!order) return null;
  const tracking = Array.isArray(order.tracking) ? [...order.tracking].reverse() : [];

  for (const item of tracking) {
    const coord = extractCoordinate(item);
    if (coord) return coord;
  }

  return (
    extractCoordinate(order.agent?.location) ||
    extractCoordinate(order.agent) ||
    extractCoordinate(order.delivery_partner?.location) ||
    extractCoordinate(order.delivery_partner) ||
    extractCoordinate(order.rider?.location) ||
    extractCoordinate(order.rider) ||
    null
  );
};

const decodePolyline = (encoded: string): Coordinate[] => {
  const points: Coordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
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
  const mapRef = useRef<any>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastStatusRef = React.useRef<string | null>(null);
  const lastUpdatedAtRef = React.useRef<string | null>(null);
  const [preAssignmentRouteCoordinates, setPreAssignmentRouteCoordinates] = useState<Coordinate[]>([]);
  const [fallbackRestaurantCoordinate, setFallbackRestaurantCoordinate] = useState<Coordinate | null>(null);
  const [fallbackCustomerCoordinate, setFallbackCustomerCoordinate] = useState<Coordinate | null>(null);

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

  const extractedRestaurantCoordinate = extractRestaurantCoordinate(orderData);
  const extractedCustomerCoordinate = extractCustomerCoordinate(orderData);
  const restaurantCoordinate = extractedRestaurantCoordinate || fallbackRestaurantCoordinate;
  const customerCoordinate = extractedCustomerCoordinate || fallbackCustomerCoordinate;
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
    'agent_nearby',
    'agent-nearby',
    'reached_delivery',
    'reached-delivery',
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

  const mapCoordinatesForViewport: Coordinate[] = useMemo(
    () => [
      ...(restaurantCoordinate ? [restaurantCoordinate] : []),
      ...(customerCoordinate ? [customerCoordinate] : []),
      ...(showLiveTracking && agentCoordinate ? [agentCoordinate] : []),
    ],
    [
      restaurantCoordinate?.latitude,
      restaurantCoordinate?.longitude,
      customerCoordinate?.latitude,
      customerCoordinate?.longitude,
      showLiveTracking,
      agentCoordinate?.latitude,
      agentCoordinate?.longitude,
    ],
  );

  const webFallbackHtml = useMemo(() => {
    if (mapCoordinatesForViewport.length < 2) return null;

    const routeCoordinates =
      showPreAssignmentRoute && preAssignmentRouteCoordinates.length > 1
        ? preAssignmentRouteCoordinates
        : showLiveTracking && agentCoordinate && customerCoordinate
          ? [agentCoordinate, customerCoordinate]
          : restaurantCoordinate && customerCoordinate
            ? [restaurantCoordinate, customerCoordinate]
            : mapCoordinatesForViewport;

    const routeColor = showLiveTracking ? '#F97316' : '#00B14F';
    const routePath = routeCoordinates.map((coord) => `[${coord.latitude}, ${coord.longitude}]`).join(',');
    const restaurantPoint = restaurantCoordinate
      ? `[${restaurantCoordinate.latitude}, ${restaurantCoordinate.longitude}]`
      : null;
    const customerPoint = customerCoordinate
      ? `[${customerCoordinate.latitude}, ${customerCoordinate.longitude}]`
      : null;
    const agentPoint = showLiveTracking && agentCoordinate
      ? `[${agentCoordinate.latitude}, ${agentCoordinate.longitude}]`
      : null;
    const boundsPoints = mapCoordinatesForViewport
      .map((coord) => `[${coord.latitude}, ${coord.longitude}]`)
      .join(',');

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e9e9e9; }
      .leaflet-control-container { display: none; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const map = L.map('map', { zoomControl: false, attributionControl: false, dragging: true, scrollWheelZoom: false, doubleClickZoom: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      const makeIcon = (symbol, bgColor) => L.divIcon({
        className: 'custom-map-icon',
        html: '<div style="width:30px;height:30px;border-radius:15px;background:' + bgColor + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.25);">' + symbol + '</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      ${restaurantPoint ? `L.marker(${restaurantPoint}, { icon: makeIcon('&#127869;', '#DC2626') }).addTo(map);` : ''}
      ${customerPoint ? `L.marker(${customerPoint}, { icon: makeIcon('&#128100;', '#FFFFFF') }).addTo(map);` : ''}
      ${agentPoint ? `L.marker(${agentPoint}, { icon: makeIcon('&#128757;', '#F97316') }).addTo(map);` : ''}

      const routeLine = L.polyline([${routePath}], { color: '${routeColor}', weight: 4, opacity: 0.9 }).addTo(map);
      const bounds = L.latLngBounds([${boundsPoints}]);
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.25), { animate: false });
      } else {
        map.setView(routeLine.getBounds().getCenter(), 13);
      }
    </script>
  </body>
</html>`;
  }, [
    mapCoordinatesForViewport,
    showPreAssignmentRoute,
    preAssignmentRouteCoordinates,
    showLiveTracking,
    agentCoordinate,
    customerCoordinate,
    restaurantCoordinate,
  ]);

  useEffect(() => {
    let isCancelled = false;

    const loadFallbackCoordinates = async () => {
      if (!orderData) {
        setFallbackRestaurantCoordinate(null);
        setFallbackCustomerCoordinate(null);
        return;
      }

      // Customer fallback from saved addresses if order payload has no lat/lng.
      if (!extractedCustomerCoordinate) {
        try {
          const addressesResponse = await addressService.getAddresses();
          if (!isCancelled && addressesResponse.success && Array.isArray(addressesResponse.data) && addressesResponse.data.length > 0) {
            const deliveryAddressId = Number(orderData?.delivery_address?.id || orderData?.delivery_address_id);
            const matchedAddress = Number.isFinite(deliveryAddressId) && deliveryAddressId > 0
              ? addressesResponse.data.find((addr) => addr.id === deliveryAddressId)
              : addressesResponse.data.find((addr) => addr.is_default) || addressesResponse.data[0];

            if (matchedAddress?.latitude && matchedAddress?.longitude) {
              setFallbackCustomerCoordinate({
                latitude: Number(matchedAddress.latitude),
                longitude: Number(matchedAddress.longitude),
              });
            }
          }
        } catch {
          // Keep fallback null if address lookup fails.
        }
      } else {
        setFallbackCustomerCoordinate(null);
      }

      // Restaurant fallback from restaurant details if payload has no lat/lng.
      if (!extractedRestaurantCoordinate) {
        const restaurantId = Number(orderData?.restaurant?.id || orderData?.restaurant_id);
        if (Number.isFinite(restaurantId) && restaurantId > 0) {
          try {
            const anchor = extractedCustomerCoordinate || fallbackCustomerCoordinate || { latitude: 9.9352, longitude: 78.1304 };
            const restaurantResponse = await restaurantService.getRestaurantDetails(restaurantId, {
              lat: anchor.latitude,
              lng: anchor.longitude,
              include_items: false,
            });
            if (!isCancelled && restaurantResponse.success && restaurantResponse.data?.locations?.length) {
              const firstLocation = restaurantResponse.data.locations[0];
              if (firstLocation?.lat && firstLocation?.lng) {
                setFallbackRestaurantCoordinate({
                  latitude: Number(firstLocation.lat),
                  longitude: Number(firstLocation.lng),
                });
              }
            }
          } catch {
            // Keep fallback null if restaurant lookup fails.
          }
        }
      } else {
        setFallbackRestaurantCoordinate(null);
      }
    };

    loadFallbackCoordinates();

    return () => {
      isCancelled = true;
    };
  }, [orderData, extractedRestaurantCoordinate?.latitude, extractedRestaurantCoordinate?.longitude, extractedCustomerCoordinate?.latitude, extractedCustomerCoordinate?.longitude]);

  useEffect(() => {
    let isCancelled = false;

    const loadRoadRouteForReadyState = async () => {
      if (!showPreAssignmentRoute || !restaurantCoordinate || !customerCoordinate) {
        setPreAssignmentRouteCoordinates([]);
        return;
      }

      // Show immediate fallback route to avoid empty state while route API resolves.
      setPreAssignmentRouteCoordinates([restaurantCoordinate, customerCoordinate]);

      const mapsApiKey =
        (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || config.apiKey || '').trim();
      if (!mapsApiKey) {
        return;
      }

      try {
        const origin = `${restaurantCoordinate.latitude},${restaurantCoordinate.longitude}`;
        const destination = `${customerCoordinate.latitude},${customerCoordinate.longitude}`;
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving&key=${encodeURIComponent(mapsApiKey)}`;
        const response = await fetch(url);
        const payload = await response.json();

        const polyline = payload?.routes?.[0]?.overview_polyline?.points;
        if (!isCancelled && typeof polyline === 'string' && polyline.length > 0) {
          const decoded = decodePolyline(polyline);
          if (decoded.length > 1) {
            setPreAssignmentRouteCoordinates(decoded);
          }
        }
      } catch {
        // Keep fallback straight line route if directions fetch fails.
      }
    };

    loadRoadRouteForReadyState();

    return () => {
      isCancelled = true;
    };
  }, [showPreAssignmentRoute, restaurantCoordinate?.latitude, restaurantCoordinate?.longitude, customerCoordinate?.latitude, customerCoordinate?.longitude]);

  useEffect(() => {
    if (!mapRef.current || mapCoordinatesForViewport.length < 2) return;

    const targetCoordinates =
      showLiveTracking && agentCoordinate && customerCoordinate
        ? [
            ...(restaurantCoordinate ? [restaurantCoordinate] : []),
            agentCoordinate,
            customerCoordinate,
          ]
        : restaurantCoordinate && customerCoordinate
          ? [restaurantCoordinate, customerCoordinate]
          : mapCoordinatesForViewport;

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(targetCoordinates, {
        edgePadding: {
          top: 120,
          right: 60,
          bottom: Math.round(SCREEN_HEIGHT * 0.55),
          left: 60,
        },
        animated: true,
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [
    showLiveTracking,
    mapCoordinatesForViewport,
    restaurantCoordinate?.latitude,
    restaurantCoordinate?.longitude,
    customerCoordinate?.latitude,
    customerCoordinate?.longitude,
    agentCoordinate?.latitude,
    agentCoordinate?.longitude,
  ]);

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
            ref={mapRef}
            style={styles.map}
            initialRegion={mapRegion}
          >
            {/* Restaurant and customer are always shown when available */}
            {restaurantCoordinate && (
              <Marker
                coordinate={restaurantCoordinate}
                title="Restaurant"
              >
                <View style={styles.storeMarker}>
                  <MaterialIcons name="restaurant" size={16} color="#FFFFFF" />
                </View>
              </Marker>
            )}
            {customerCoordinate && (
              <Marker
                coordinate={customerCoordinate}
                title="Delivery Location"
              >
                <View style={styles.customerMarker}>
                  <MaterialIcons name="person" size={16} color="#FFFFFF" />
                </View>
              </Marker>
            )}

            {/* Pre-assignment route: restaurant to customer */}
            {showPreAssignmentRoute && restaurantCoordinate && customerCoordinate && (
              <Polyline
                coordinates={
                  preAssignmentRouteCoordinates.length > 1
                    ? preAssignmentRouteCoordinates
                    : [restaurantCoordinate, customerCoordinate]
                }
                strokeColor="#00B14F"
                strokeWidth={4}
                lineDashPattern={preAssignmentRouteCoordinates.length > 2 ? undefined : [8, 8]}
              />
            )}

            {/* Live mode route and rider marker */}
            {showLiveTracking && agentCoordinate && customerCoordinate && (
              <>
                <Marker
                  coordinate={agentCoordinate}
                  title="Delivery Partner"
                >
                  <View style={styles.agentMarker}>
                    <MaterialIcons name="two-wheeler" size={16} color="#FFFFFF" />
                  </View>
                </Marker>
                <Polyline
                  coordinates={[agentCoordinate, customerCoordinate]}
                  strokeColor="#F97316"
                  strokeWidth={4}
                />
              </>
            )}
          </MapView>
        ) : webFallbackHtml ? (
          <WebView
            originWhitelist={['*']}
            source={{ html: webFallbackHtml }}
            style={styles.map}
            startInLoadingState={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mixedContentMode="always"
          />
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

      </View>

      {/* Header */}
      <SafeAreaView style={styles.headerContainer} edges={['top']}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <MaterialIcons name="chevron-left" size={24} color="#000000" />
          </TouchableOpacity>
          <View style={styles.headerTitlePlaceholder} />
          <View style={styles.headerSpacer} />
        </View>
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
  storeMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  customerMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  agentMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
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
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerContent: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#001E1F',
  },
  headerTitlePlaceholder: {
    flex: 1,
  },
  headerSpacer: {
    width: 40,
    height: 40,
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
