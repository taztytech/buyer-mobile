import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  BackHandler,
  RefreshControl,
  Dimensions,
  Animated,
  PanResponder,
  NativeModules,
  Platform,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@/shims/rn-vector-icons';
import { OrderRouteMapView } from '@/components/OrderRouteMapView';
import OrderDeliveredOverlay from '@/components/OrderDeliveredOverlay';
import { ordersService, OrderListItem } from '@/services/orders.service';
import { Shimmer } from '@/components/Shimmer';
import { useOrders } from '@/context/OrdersContext';
import { mapOrderStatusToUI, getFallbackTimelineForStatus } from '@/utils/orderStatusMapping';
import { authService } from '@/services/auth.service';
import { exotelService } from '@/services/exotel.service';
import { deliveryTrackingService } from '@/services/deliveryTracking.service';
import { useConfirmation } from '@/context/ConfirmationContext';
import { useAndroidPip } from '@/hooks/useAndroidPip';
import { APP_VERSION_NAME, APP_VERSION_CODE } from '@/config/appVersion.generated';
import {
  extractRestaurantCoordinate,
  extractCustomerCoordinate,
  extractAgentCoordinate,
  extractLatestAgentTrackingUpdate,
} from './orderTrackingLocationUtils';
import { resolveTrackingDisplayOrder, resolveAgentPhoneForExotel } from './trackingDisplayUtils';
import { computeShowStoreToAgentRoute } from './orderTrackingRouteVisibility';
import { config } from '@/constants/config';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const toRadians = (deg: number): number => (deg * Math.PI) / 180;
const routeDistanceMeters = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const earthRadius = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const q =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
  return earthRadius * c;
};

const decodeRoutePolyline = (encoded: string): Array<{ latitude: number; longitude: number }> => {
  const points: Array<{ latitude: number; longitude: number }> = [];
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

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
};

const toCoordinateList = (
  coordinates: unknown,
): Array<{ latitude: number; longitude: number }> => {
  if (!Array.isArray(coordinates)) return [];
  const points: Array<{ latitude: number; longitude: number }> = [];
  for (const point of coordinates) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const lon = Number(point[0]);
    const lat = Number(point[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    points.push({ latitude: lat, longitude: lon });
  }
  return points;
};

const getMapsApiKey = (): string => {
  const candidateKeys = [
    process.env.GOOGLE_MAPS_API_KEY,
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    process.env.PUBLIC_GOOGLE_MAPS_API_KEY,
    config.apiKey,
  ];
  for (const key of candidateKeys) {
    const normalized = String(key || '').trim();
    if (normalized.length > 0) return normalized;
  }
  return '';
};

const fetchRoadRouteCoordinates = async (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  mapsApiKey: string,
): Promise<Array<{ latitude: number; longitude: number }> | null> => {
  const fetchJsonWithTimeout = async (url: string, timeoutMs: number) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const payload = await response.json();
      return { response, payload };
    } finally {
      clearTimeout(timeout);
    }
  };

  const requests: Array<Promise<Array<{ latitude: number; longitude: number }>>> = [];

  if (mapsApiKey) {
    requests.push((async () => {
      const googleUrl =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${encodeURIComponent(`${origin.latitude},${origin.longitude}`)}` +
        `&destination=${encodeURIComponent(`${destination.latitude},${destination.longitude}`)}` +
        `&mode=driving&alternatives=false&key=${encodeURIComponent(mapsApiKey)}`;
      const { response, payload } = await fetchJsonWithTimeout(googleUrl, 3000);
      if (!(response.ok && payload?.status === 'OK')) throw new Error('google_route_unavailable');
      const encoded = payload?.routes?.[0]?.overview_polyline?.points;
      const decoded = typeof encoded === 'string' ? decodeRoutePolyline(encoded) : [];
      if (decoded.length < 2) throw new Error('google_route_empty');
      return decoded;
    })());
  }

  requests.push((async () => {
    const primaryUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}` +
      `?overview=full&geometries=geojson&alternatives=false&steps=false`;
    const { payload } = await fetchJsonWithTimeout(primaryUrl, 2600);
    const parsed = toCoordinateList(payload?.routes?.[0]?.geometry?.coordinates);
    if (parsed.length < 2) throw new Error('osrm_primary_empty');
    return parsed;
  })());

  requests.push((async () => {
    const backupUrl =
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/` +
      `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}` +
      `?overview=full&geometries=geojson&alternatives=false&steps=false`;
    const { payload } = await fetchJsonWithTimeout(backupUrl, 2600);
    const parsed = toCoordinateList(payload?.routes?.[0]?.geometry?.coordinates);
    if (parsed.length < 2) throw new Error('osrm_backup_empty');
    return parsed;
  })());

  try {
    return await Promise.any(requests);
  } catch {
    return null;
  }
};

const resolveDeliveryCode = (order: any): string | null => {
  if (!order) return null;

  const trackingArray = Array.isArray(order?.tracking) ? order.tracking : [];
  const latestTrackingCode = [...trackingArray].reverse().find((entry: any) => {
    if (entry?.delivery_code === null || entry?.delivery_code === undefined) return false;
    return String(entry.delivery_code).trim().length > 0;
  })?.delivery_code;

  if (latestTrackingCode !== null && latestTrackingCode !== undefined && String(latestTrackingCode).trim().length > 0) {
    return String(latestTrackingCode).trim();
  }

  const orderLevelCode = order?.delivery_code;
  if (orderLevelCode !== null && orderLevelCode !== undefined && String(orderLevelCode).trim().length > 0) {
    return String(orderLevelCode).trim();
  }

  return null;
};

const normalizeOrderStatus = (status: string | null | undefined): string => {
  return String(status || '')
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-');
};

const shouldFetchDeliveryTrackStatus = (status: string | null | undefined): boolean => {
  const normalizedStatus = normalizeOrderStatus(status);
  const eligibleStatuses = [
    'assigned',
    'agent-assigned',
    'rider-assigned',
    'agent-arrived-restaurant',
    'rider-accepted',
    'accepted',
    'picked',
    'picked-up',
    'ready-for-pickup',
    'ready-for-delivery',
    // Track order remains live through the “order ready” stage.
    'order-ready',
    // Backend uses "packed" for order-ready — keep tracking live.
    'packed',
    'out-for-delivery',
    'on-the-way',
    'en-route',
    'in-transit',
  ];
  const excludedStatuses = [
    'pending',
    'confirmed',
    'billed',
    'delivered',
    'completed',
    'cancelled',
    'canceled',
  ];
  return eligibleStatuses.includes(normalizedStatus) && !excludedStatuses.includes(normalizedStatus);
};

const extractTrackingIdFromUrl = (trackingUrl: unknown): string | null => {
  if (typeof trackingUrl !== 'string') return null;
  const trimmed = trackingUrl.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/track\/([^/?#]+)/i);
  return match?.[1] ? String(match[1]).trim() : null;
};

const resolveDeliveryTrackingId = (...sources: any[]): string | null => {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;

    const direct =
      source.tracking_id ??
      source.trackingId ??
      source.track_id ??
      source.trackId ??
      source?.track_status?.tracking_id ??
      source?.track_status?.trackingId;

    if (direct !== undefined && direct !== null) {
      const normalized = String(direct).trim();
      if (normalized) return normalized;
    }

    const fromTrackingUrl =
      extractTrackingIdFromUrl(source.tracking_url) ||
      extractTrackingIdFromUrl(source.trackingUrl) ||
      extractTrackingIdFromUrl(source?.track_status?.tracking_url) ||
      extractTrackingIdFromUrl(source?.track_status?.trackingUrl);
    if (fromTrackingUrl) return fromTrackingUrl;

    const fromTrackingArray = Array.isArray(source.tracking)
      ? source.tracking
          .map((entry: any) => extractTrackingIdFromUrl(entry?.tracking_url || entry?.trackingUrl))
          .find((value: string | null) => !!value)
      : null;
    if (fromTrackingArray) return fromTrackingArray;
  }
  return null;
};

// Module-level state to persist across component remounts (for scroll position and pagination)
let persistedOrders: OrderListItem[] = [];
let persistedScrollPosition: number = 0;
let persistedCurrentPage: number = 1;
let persistedTotalOrders: number = 0;
let hasPersistedData: boolean = false;

// Export function to reset persisted orders and scroll position
// This is called when navigating to profile page to clear the state
export function resetOrdersPersistence() {
  persistedOrders = [];
  persistedScrollPosition = 0;
  persistedCurrentPage = 1;
  persistedTotalOrders = 0;
  hasPersistedData = false;
  // Force a flag that can be checked on next mount
  // This ensures the reset is detected even if component doesn't fully remount
}

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
  onContactUs?: () => void; // Navigate to Contact Us page
  // Optional: orderId to highlight when navigating from notification
  highlightOrderId?: string | null;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  visible = false,
  onBack,
  onOrderDetails,
  onReorder: _onReorder, // Unused but kept for API compatibility
  onRateOrder,
  onTrackOrder: _onTrackOrder, // Unused but kept for API compatibility
  onHelp: _onHelp, // Unused but kept for API compatibility
  onViewMore: _onViewMore, // Unused but kept for API compatibility
  onContactUs,
  highlightOrderId,
}) => {
  // Use Orders Context for global state
  const { dispatch, getOrdersList, state } = useOrders();
  const { showConfirmation } = useConfirmation();

  // Get orders from context (live updates from FCM)
  const contextOrders = getOrdersList();

  // Local state for API pagination and loading
  // Initialize from persisted data if available, otherwise use defaults
  // Note: When reset is called, hasPersistedData is false, so state initializes empty
  const [localOrders, setLocalOrders] = useState<OrderListItem[]>(() => {
    if (hasPersistedData && persistedOrders.length > 0) {
      return persistedOrders;
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(() => !hasPersistedData);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(() => hasPersistedData ? persistedCurrentPage : 1);
  const [totalOrders, setTotalOrders] = useState(() => hasPersistedData ? persistedTotalOrders : 0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs to prevent API overload
  const isRequestInProgress = useRef(false);
  const lastRequestedPage = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const highlightedOrderRef = useRef<string | null>(null);
  // Only sync localOrders to context when data came from API fetch, not from persistence.
  // This prevents overwriting FCM updates when restoring from persisted data or on visibility.
  const ordersFromApiRef = useRef(false);

  // Refs for initial mount tracking and scroll restoration
  // Reset isInitialMount when hasPersistedData is false (reset was called)
  const isInitialMount = useRef(!hasPersistedData);
  const hasRestoredScroll = useRef(false);

  // Track previous visible state to detect when returning from another screen
  const prevVisibleRef = useRef(visible);
  const lastRefreshTimeRef = useRef<number>(0);
  // Merge context orders (with FCM updates) with local orders from API
  // Priority: Context orders (have latest FCM updates) > Local orders
  // Fallback: If context is empty but we have persisted localOrders, use localOrders
  // IMPORTANT: Include state.byId in dependencies to ensure FCM updates trigger re-render
  const orders = React.useMemo(() => {
    // If context is empty but we have localOrders, use localOrders directly
    // This handles the case where context was cleared but localOrders persisted
    if (contextOrders.length === 0 && localOrders.length > 0) {
      return localOrders;
    }

    const contextOrderMap = new Map(contextOrders.map(o => [o.id.toString(), o]));
    const merged = [...localOrders];

    // Update local orders with context updates (FCM updates)
    for (let i = 0; i < merged.length; i++) {
      const orderId = merged[i].id.toString();
      const contextOrder = contextOrderMap.get(orderId);
      if (contextOrder) {
        // Check if status changed via FCM
        if (merged[i].status !== contextOrder.status) {
          console.log('✅ OrdersScreen: FCM status update detected', {
            orderId,
            oldStatus: merged[i].status,
            newStatus: contextOrder.status,
          });
        }
        merged[i] = contextOrder; // Use context order (has latest FCM updates)
        contextOrderMap.delete(orderId); // Remove from map
      } else {
        // Also check state.byId directly for any updates we might have missed
        const directUpdate = state.byId[orderId];
        if (directUpdate && directUpdate.status !== merged[i].status) {
          console.log('✅ OrdersScreen: Direct FCM update from state.byId', {
            orderId,
            oldStatus: merged[i].status,
            newStatus: directUpdate.status,
          });
          merged[i] = directUpdate;
        }
      }
    }

    // Add any new context orders that aren't in local orders at the beginning (newest first)
    const newContextOrders: OrderListItem[] = [];
    contextOrderMap.forEach((order) => {
      newContextOrders.push(order);
    });

    // Sort new orders by id or created_at if possible to ensure newest is at top
    newContextOrders.sort((a, b) => {
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      return bTime - aTime;
    });

    return [...newContextOrders, ...merged];
  }, [localOrders, contextOrders, state.byId]);

  // Sync localOrders to context only when they came from an API fetch.
  // Avoids overwriting context (and losing FCM updates) when localOrders is from persistence or initial state.
  useEffect(() => {
    if (localOrders.length > 0 && ordersFromApiRef.current) {
      ordersFromApiRef.current = false;
      persistedOrders = localOrders;
      dispatch({
        type: 'BULK_SET_ORDERS',
        payload: localOrders,
      });
    } else if (localOrders.length > 0) {
      persistedOrders = localOrders;
    }
  }, [localOrders, dispatch]);

  // Handle screen visibility and reset state
  // This effect runs when visible changes or component mounts
  useEffect(() => {
    const wasVisible = prevVisibleRef.current;

    if (!visible) {
      prevVisibleRef.current = visible;
      return;
    }

    // Check if we're returning to this screen (was hidden, now visible)
    const isReturning = !wasVisible && visible;
    prevVisibleRef.current = visible;

    console.log('👁️ OrdersScreen visibility changed:', { wasVisible, visible, isReturning });

    // Check if reset was called (hasPersistedData is false)
    // hasPersistedData is module-level, so we check it directly each time visible changes
    if (!hasPersistedData) {
      // Reset was called (when navigating to profile) - clear state and fetch fresh data
      // Clear local state immediately
      if (localOrders.length > 0 || currentPage !== 1 || totalOrders !== 0) {
        setLocalOrders([]);
        setCurrentPage(1);
        setTotalOrders(0);
      }

      // Always fetch fresh data when reset (hasPersistedData is false)
      // Check if we need to fetch (no data and no request in progress)
      if (localOrders.length === 0 && !isRequestInProgress.current) {
        isInitialMount.current = false;
        // Use requestAnimationFrame to ensure component is fully mounted and ready
        const rafId = requestAnimationFrame(() => {
          if (!isRequestInProgress.current) {
            fetchOrders(1, true);
          }
        });
        return () => cancelAnimationFrame(rafId);
      }
      return undefined;
    } else if (hasPersistedData && persistedOrders.length > 0) {
      // Has persisted data - do NOT overwrite context here so FCM updates are preserved.
      // Only ensure localOrders is set for display; merge useMemo will combine context (FCM) + local.
      if (localOrders.length === 0 || localOrders.length !== persistedOrders.length) {
        setLocalOrders(persistedOrders);
      }
      hasRestoredScroll.current = false;
    }
    return undefined;
  }, [visible, dispatch, localOrders.length]);

  // Separate effect to restore scroll position after orders are rendered
  useEffect(() => {
    if (visible && hasPersistedData && !hasRestoredScroll.current && orders.length > 0 && persistedScrollPosition > 0) {
      // Wait for ScrollView to be fully rendered before restoring scroll
      const restoreTimer = setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            y: persistedScrollPosition,
            animated: false,
          });
          hasRestoredScroll.current = true; // Mark as restored
        }
      }, 200);

      return () => clearTimeout(restoreTimer);
    }
    return undefined;
  }, [visible, orders.length]);

  // Scroll to highlighted order when navigating from notification
  useEffect(() => {
    if (highlightOrderId && orders.length > 0 && scrollViewRef.current) {
      // Try to find by id first, then by order_number (in case navigation passed order_number)
      const orderIndex = orders.findIndex(
        o => o.id.toString() === highlightOrderId || o.order_number === highlightOrderId
      );
      if (orderIndex >= 0 && highlightedOrderRef.current !== highlightOrderId) {
        highlightedOrderRef.current = highlightOrderId;
        // Scroll to order after a short delay to ensure layout is complete
        setTimeout(() => {
          // Improve scroll calculation: if it's the first few items, scroll to top
          // Otherwise use a slightly more generous offset
          const scrollY = orderIndex === 0 ? 0 : Math.max(0, orderIndex * 240 - 50);
          scrollViewRef.current?.scrollTo({
            y: scrollY,
            animated: true,
          });
        }, 600);
      }
    }
  }, [highlightOrderId, orders]);

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
        // Clear persisted scroll position when resetting
        persistedScrollPosition = 0;
        hasRestoredScroll.current = false;
        // Clear persisted orders when resetting (fresh fetch)
        persistedOrders = [];
        hasPersistedData = false;
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
          ordersFromApiRef.current = true;
          setLocalOrders(ordersArray);
          persistedOrders = ordersArray;
        } else {
          ordersFromApiRef.current = true;
          // Append new orders to existing ones, filtering out duplicates
          setLocalOrders(prev => {
            const existingIds = new Set(prev.map((o: OrderListItem) => o.id));
            const newOrders = ordersArray.filter((order: any) => !existingIds.has(order.id));
            const updatedOrders = [...prev, ...newOrders];
            // Save to persisted storage
            persistedOrders = updatedOrders;
            return updatedOrders;
          });
        }
        setTotalOrders(total);
        persistedTotalOrders = total;
        setCurrentPage(page);
        persistedCurrentPage = page;
        hasPersistedData = true;

        // Update context with fetched orders
        dispatch({
          type: 'BULK_SET_ORDERS',
          payload: reset ? ordersArray : [...localOrders, ...ordersArray],
        });

        // Update last refresh time
        lastRefreshTimeRef.current = Date.now();
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

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    if (isRequestInProgress.current) return;
    setIsRefreshing(true);
    try {
      await fetchOrders(1, true);
    } finally {
      setIsRefreshing(false);
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
    // Save scroll position to module-level variable for restoration across remounts
    persistedScrollPosition = nativeEvent.contentOffset.y;

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

  const handleRateOrder = (orderId: string) => {
    if (onRateOrder) {
      // Find the order from the orders array
      const order = orders.find(o => o.id.toString() === orderId);
      onRateOrder(orderId, order);
    }
  };

  const [showTrackingWebView, setShowTrackingWebView] = useState(false);
  const [selectedOrderIdForTracking, setSelectedOrderIdForTracking] = useState<string | null>(null);
  const [trackingOrderData, setTrackingOrderData] = useState<any>(null);
  const [roadRouteCoordinates, setRoadRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }> | null>(null);
  const [storeToAgentRouteCoordinates, setStoreToAgentRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }> | null>(null);
  const [isLoadingTrackingData, setIsLoadingTrackingData] = useState(false);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [isClosingTracking, setIsClosingTracking] = useState(false);
  const [showDeliveredOverlay, setShowDeliveredOverlay] = useState(false);

  const trackingOrderDataRef = useRef<any>(null);
  const ordersByIdRef = useRef<Record<string, any>>({});
  trackingOrderDataRef.current = trackingOrderData;
  ordersByIdRef.current = state.byId;

  const { canUsePip, isInPipMode: hookIsInPipMode, enterPip } = useAndroidPip();
  const webViewLoadedRef = useRef<boolean>(false);
  const [trackingMapRefreshKey, setTrackingMapRefreshKey] = useState(0);
  const appStateRef = useRef(AppState.currentState);

  // isEnteringPip: set to true the instant the user presses the PiP button so
  // the header disappears BEFORE the Android animation starts.  This eliminates
  // the 1-2 frame white flash caused by the header still being visible while
  // Android is shrinking the window.
  //
  // Race-condition guard — pipNativeConfirmedRef:
  //   Only clear isEnteringPip when hookIsInPipMode *transitions* (changes
  //   value), detected via a ref.  The ref update does not cause re-renders, so
  //   the effect only fires on actual hookIsInPipMode changes, not on every
  //   render that happens to see hookIsInPipMode === false.
  const [isEnteringPip, setIsEnteringPip] = useState(false);
  const pipNativeConfirmedRef = useRef(false); // true after native PiP is active
  const prevIsInPipModeRef = useRef(false);
  const isInPipModeRef = useRef(false);
  const lastPipSyncRef = useRef<{ status?: string; updated_at?: string }>({});
  const [pipSyncKey, setPipSyncKey] = useState(0);

  // isInPipMode: true as soon as user presses button (isEnteringPip) OR native confirms
  const isInPipMode = showTrackingWebView && (hookIsInPipMode || isEnteringPip);

  useEffect(() => {
    isInPipModeRef.current = isInPipMode;
  }, [isInPipMode]);

  const forceTrackingWebViewResize = useCallback(() => {
    // Keep function name stable: PiP/status effects call this to force map refresh.
    setTrackingMapRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (hookIsInPipMode) {
      // Native confirmed PiP is active → record it, clear the optimistic flag
      pipNativeConfirmedRef.current = true;
      setIsEnteringPip(false);
    } else if (pipNativeConfirmedRef.current) {
      // PiP just exited (was confirmed, now gone) → full reset
      pipNativeConfirmedRef.current = false;
      setIsEnteringPip(false);
    }
    // If hookIsInPipMode = false AND pipNativeConfirmedRef = false:
    // normal non-PiP state — do NOT touch isEnteringPip here to avoid
    // clearing the optimistic flag before native confirms it.
  }, [hookIsInPipMode]);

  // When entering or exiting PiP, force the underlying tracking page to recalculate its layout
  // so the map uses the full available height for both the compact PiP window and normal screen.
  // When expanding from PiP, if order is delivered show the delivered overlay (status may have updated while in PiP).
  useEffect(() => {
    const wasInPip = prevIsInPipModeRef.current;
    if (wasInPip !== isInPipMode && showTrackingWebView) {
      forceTrackingWebViewResize();
      if (wasInPip && !isInPipMode) {
        const ctxOrder = selectedOrderIdForTracking ? state.byId[selectedOrderIdForTracking] : undefined;
        const displayOrder = resolveTrackingDisplayOrder(ctxOrder, trackingOrderData);
        const rawStatus = (displayOrder?.status || '').toString().toLowerCase().trim();
        const normalizedStatus = rawStatus.replace(/[_\s]+/g, '-');
        if (normalizedStatus === 'delivered' || normalizedStatus === 'completed') {
          setShowDeliveredOverlay(true);
        }
      }
    }
    prevIsInPipModeRef.current = isInPipMode;
  }, [isInPipMode, showTrackingWebView, forceTrackingWebViewResize, selectedOrderIdForTracking, state.byId, trackingOrderData?.status]);

  // When returning from background after PiP close or app resume, force the
  // tracking page to recalculate its layout so the map fills the full overlay
  // instead of keeping a stale PiP-sized snapshot over the header.
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground =
        appStateRef.current === 'background' || appStateRef.current === 'inactive';
      const isActive = nextState === 'active';

      appStateRef.current = nextState;

      if (wasBackground && isActive && showTrackingWebView) {
        forceTrackingWebViewResize();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [showTrackingWebView, forceTrackingWebViewResize]);

  const fallbackMapCoords = useMemo(() => {
    const latestContextOrder = selectedOrderIdForTracking ? state.byId[selectedOrderIdForTracking] : undefined;
    const displayOrder = resolveTrackingDisplayOrder(latestContextOrder, trackingOrderData);
    if (!displayOrder) return null;

    const restaurantCoordinate = extractRestaurantCoordinate(displayOrder);
    const customerCoordinate = extractCustomerCoordinate(displayOrder);
    if (!restaurantCoordinate || !customerCoordinate) return null;

    const agentCoordinateRaw = extractAgentCoordinate(displayOrder);
    const latestAgentLocationUpdate = extractLatestAgentTrackingUpdate(displayOrder);
    const agentCoordinate =
      agentCoordinateRaw ??
      (latestAgentLocationUpdate
        ? {
            latitude: latestAgentLocationUpdate.latitude,
            longitude: latestAgentLocationUpdate.longitude,
          }
        : null);

    const rawStatus = (displayOrder.status || '').toString().toLowerCase().trim();
    const normalizedStatus = rawStatus.replace(/[_\s]+/g, '-');
    const prePickupStatusSet = new Set([
      'assigned',
      'agent-assigned',
      'agent-arrived-restaurant',
      'accepted',
    ]);
    const postPickupStatusSet = new Set([
      'picked',
      'picked-up',
      'in-transit',
      'out-for-delivery',
      'on-the-way',
      'delivered',
      'completed',
    ]);
    const hasAgentAssignedSignal =
      !!agentCoordinate ||
      prePickupStatusSet.has(normalizedStatus) ||
      postPickupStatusSet.has(normalizedStatus);

    // Track-order route should always represent store -> customer path.
    // Rider location is shown separately by bike marker.
    const routeCoordinates = [restaurantCoordinate, customerCoordinate];

    const restaurantName = displayOrder.restaurant?.name?.trim() || 'Restaurant';
    const addr = displayOrder.delivery_address;
    const customerAddress = [addr?.address1, addr?.address2, addr?.address3, addr?.city]
      .filter(Boolean)
      .map((s: any) => String(s).trim())
      .join(', ') || 'Delivery location';

    return {
      restaurantCoordinate,
      customerCoordinate,
      agentCoordinate,
      latestAgentLocationUpdate,
      routeOriginCoordinate: restaurantCoordinate,
      routeTargetCoordinate: customerCoordinate,
      stageKey: normalizedStatus,
      routeCoordinates,
      mode: hasAgentAssignedSignal ? 'live' as const : 'ready' as const,
      showStoreToAgentRoute: computeShowStoreToAgentRoute(
        normalizedStatus,
        restaurantCoordinate,
        agentCoordinate,
      ),
      restaurantName,
      customerAddress,
    };
  }, [trackingOrderData, selectedOrderIdForTracking, state.byId]);

  // Inform native layer when auto-PiP via home button is allowed.
  // This keeps the lifecycle fully on the Android side and avoids React-side crashes.
  useEffect(() => {
    const pipModule = NativeModules.PipModule;
    if (Platform.OS !== 'android' || !pipModule || typeof pipModule.setAutoPipEnabled !== 'function') {
      return;
    }

    try {
      pipModule.setAutoPipEnabled(showTrackingWebView);
    } catch (e) {
      console.warn('[OrdersScreen] Failed to set autoPipEnabled:', e);
    }

    return () => {
      try {
        pipModule.setAutoPipEnabled(false);
      } catch {
        // ignore cleanup errors
      }
    };
  }, [showTrackingWebView]);

  // When showing the native route map (no tracking URL), allow PiP immediately.
  useEffect(() => {
    if (showTrackingWebView && fallbackMapCoords) {
      webViewLoadedRef.current = true;
    }
  }, [showTrackingWebView, fallbackMapCoords]);

  // Trigger native PiP from the button in the header.
  // Sets isEnteringPip immediately so the header hides before the Android
  // shrink animation starts, preventing the white-screen flash.
  // Guard: only allow PiP once the tracking WebView has fully loaded so
  // Android snapshots a rendered map instead of a blank white surface.
  const handleEnterPip = useCallback(() => {
    if (!showTrackingWebView) return;

    if (!webViewLoadedRef.current) {
      console.log('[OrdersScreen] Ignoring PiP tap until tracking WebView has loaded');
      return;
    }

    // Optimistically hide header — native event will confirm & clear this flag
    setIsEnteringPip(true);

    enterPip().catch(() => {
      // PiP failed (unsupported device, etc.) — revert the optimistic flag
      setIsEnteringPip(false);
    });
  }, [enterPip, showTrackingWebView]);

  // Back handler for tracking overlay is registered after the close handler is
  // defined, to avoid using it before declaration (see effect below).

  // Bottom sheet drag state
  const HALF_SCREEN = SCREEN_HEIGHT * 0.5;
  const DRAG_HANDLE_HEIGHT = 40; // Height of drag handle
  const TOP_SECTION_HEIGHT = 100; // Height to show restaurant info section (logo, name, status, address3)
  const CLOSED_HEIGHT = DRAG_HANDLE_HEIGHT + TOP_SECTION_HEIGHT; // Height when closed - shows drag handle + top section (140px total)
  const OPEN_HEIGHT = HALF_SCREEN;
  // Use height animation instead of translateY - CLOSED_HEIGHT = closed, OPEN_HEIGHT = open
  const bottomSheetHeight = useRef(new Animated.Value(OPEN_HEIGHT)).current; // Start open
  const dragStartHeight = useRef(OPEN_HEIGHT);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(true); // Start open
  const lastRouteFetchRef = useRef<{
    stage: string;
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
  } | null>(null);
  const lastStoreToAgentRouteFetchRef = useRef<{
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
  } | null>(null);

  const handleTrackOrder = async (orderId: string, orderStatus?: string) => {
    if (!orderId) return;
    // Reset closing state immediately if we re-track before cleanup finished
    setIsClosingTracking(false);
    setRoadRouteCoordinates(null);
    setStoreToAgentRouteCoordinates(null);
    lastRouteFetchRef.current = null;
    lastStoreToAgentRouteFetchRef.current = null;
    setSelectedOrderIdForTracking(orderId);

    // Optimistically seed tracking data from the existing orders list
    // so the tracking overlay and map can appear immediately, without waiting
    // for the full detail API response.
    const shallowOrder = orders.find(o => o.id?.toString() === orderId.toString());
    if (shallowOrder) {
      setTrackingOrderData((prev: any) => prev ?? shallowOrder);
    }

    const effectiveStatus =
      orderStatus ??
      shallowOrder?.status ??
      trackingOrderData?.status;

    // Show the tracking overlay right away for a faster first-time experience.
    setShowTrackingWebView(true);

    // For statuses from Agent Assigned until before Delivered, fetch rider live
    // location from delivery tracking API (/api/track/:id/status) using tracking_id.
    if (shouldFetchDeliveryTrackStatus(effectiveStatus)) {
      try {
        const latestOrderData = await fetchTrackingOrderData(orderId, true);
        const trackingIdentifier = resolveDeliveryTrackingId(
          latestOrderData,
          shallowOrder,
          trackingOrderData,
          state.byId[orderId],
        );

        if (!trackingIdentifier) {
          console.log('[DeliveryTracking] skipped: tracking_id unavailable', {
            orderId,
            effectiveStatus,
          });
        } else {
          const trackResponse = await deliveryTrackingService.getTrackStatus(trackingIdentifier);
          const trackData = trackResponse.data;
          if (trackResponse.success && trackData) {
            setTrackingOrderData((prev: any) => ({
              ...(prev || {}),
              rider: {
                ...(prev?.rider || {}),
                ...(trackData.rider || {}),
                current_location:
                  trackData?.rider?.current_location ||
                  prev?.rider?.current_location ||
                  null,
              },
              track_status: trackData,
            }));
          }
        }
      } catch (error) {
        console.warn('Track status API failed:', error);
      }
    } else {
      console.log('[DeliveryTracking] skipped by status gate', {
        orderId,
        orderStatus,
        effectiveStatus,
      });
    }

    // Still fetch full order details in the background; this refreshes bottom-sheet + map data.
    fetchTrackingOrderData(orderId, true);
  };

  // Fetch order details for tracking bottom sheet from API
  // This gets the FULL order data (not just status from FCM)
  // This is called initially and also when FCM updates arrive to get latest full data
  const fetchTrackingOrderData = useCallback(async (orderId: string, silent: boolean = false) => {
    if (!orderId) return null;

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
          const latestApiData: any = response.data;
          const mergedData = {
            ...latestApiData,
            rider: {
              ...(latestApiData?.rider || {}),
              current_location:
                latestApiData?.rider?.current_location ||
                prevData?.rider?.current_location ||
                prevData?.track_status?.rider?.current_location ||
                null,
            },
            track_status: latestApiData?.track_status || prevData?.track_status,
          };

          // Check if API response has newer data than what we have
          if (!prevData ||
            latestApiData.updated_at !== prevData.updated_at ||
            latestApiData.status !== prevData.status) {
            console.log('✅ Tracking: API response has updated data - Reloading bottom sheet', {
              orderId,
              oldStatus: prevData?.status,
              newStatus: latestApiData.status,
              oldUpdatedAt: prevData?.updated_at,
              newUpdatedAt: latestApiData.updated_at,
              source: 'API',
              willReload: true,
            });
            // Return new data - this triggers bottom sheet reload
            return mergedData;
          }

          // Even if status hasn't changed, update with latest API data to ensure we have full data
          console.log('📦 Tracking: API response received - Updating with latest full data', {
            orderId,
            status: latestApiData.status,
            source: 'API',
          });
          return mergedData;
        });

        if (!silent) {
          // For non-silent calls, ensure the overlay is visible.
          setShowTrackingWebView(true);
        }
        return response.data as any;
      }
    } catch (err: any) {
      console.error('Failed to fetch tracking order data:', err);
    } finally {
      if (!silent) {
        setIsLoadingTrackingData(false);
      }
    }
    return null;
  }, []);

  // Handle closing the tracking WebView modal and refresh orders
  const handleCloseTrackingWebView = useCallback(() => {
    // 1. Guard against redundant calls
    if (isClosingTracking) return;

    // 2. Mark as closing - this immediately unmounts tracking overlay from the tree
    setIsClosingTracking(true);
    setShowTrackingWebView(false);
    setSelectedOrderIdForTracking(null);
    setTrackingOrderData(null);
    setRoadRouteCoordinates(null);
    setStoreToAgentRouteCoordinates(null);
    lastRouteFetchRef.current = null;
    lastStoreToAgentRouteFetchRef.current = null;
    webViewLoadedRef.current = false;

    // Reset bottom sheet to open state when closing modal
    bottomSheetHeight.setValue(OPEN_HEIGHT);
    setIsBottomSheetOpen(true);

    // Refresh orders when navigating back to My Orders page
    console.log('🔄 Tracking: Closing modal, refreshing orders...');
    fetchOrders(1, true).catch((err) => {
      console.error('Failed to refresh orders after closing tracking:', err);
    });
    setIsClosingTracking(false);
  }, [isClosingTracking]);

  // Handle Android hardware back button while tracking overlay is open.
  useEffect(() => {
    if (!showTrackingWebView) return;

    const backAction = () => {
      if (!isInPipMode) {
        handleCloseTrackingWebView();
        webViewLoadedRef.current = false;
      }
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showTrackingWebView, isInPipMode, handleCloseTrackingWebView]);

  // PanResponder for bottom sheet drag - on drag handle and top section when closed
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false, // Let children have a chance, but we'll take it if they don't
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // More sensitive threshold
        return Math.abs(gestureState.dy) > 2;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        // Capture if it's a significant vertical move
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        // Stop any active animations to prevent fight between JS and Native
        bottomSheetHeight.stopAnimation();

        // Capture initial height and simplify state by flattening any existing offset
        const currentHeight = (bottomSheetHeight as any)._value + ((bottomSheetHeight as any)._offset || 0);
        dragStartHeight.current = currentHeight;
        bottomSheetHeight.flattenOffset();
        bottomSheetHeight.setValue(currentHeight);
      },
      onPanResponderMove: (_, gestureState) => {
        // Calculate new height based on delta from start height
        const nextHeight = dragStartHeight.current - gestureState.dy;

        // Clamp height between CLOSED and OPEN thresholds
        const clampedHeight = Math.max(CLOSED_HEIGHT, Math.min(OPEN_HEIGHT, nextHeight));
        bottomSheetHeight.setValue(clampedHeight);
      },
      onPanResponderRelease: () => {
        bottomSheetHeight.flattenOffset();
        const currentValue = (bottomSheetHeight as any)._value;
        const currentOffset = (bottomSheetHeight as any)._offset || 0;
        const totalHeight = currentValue + currentOffset;

        // Threshold: if height is more than halfway between closed and open, snap to open
        const threshold = (CLOSED_HEIGHT + OPEN_HEIGHT) / 2;

        let targetHeight: number;
        if (totalHeight > threshold) {
          // Snap to open (OPEN_HEIGHT)
          targetHeight = OPEN_HEIGHT;
          setIsBottomSheetOpen(true);
        } else {
          // Snap to closed (CLOSED_HEIGHT)
          targetHeight = CLOSED_HEIGHT;
          setIsBottomSheetOpen(false);
        }

        Animated.spring(bottomSheetHeight, {
          toValue: targetHeight,
          useNativeDriver: false, // Height animation doesn't support native driver
          tension: 100, // Increased for more responsiveness
          friction: 8, // Increased for smoother, less bouncy animation
        }).start();
      },
      onPanResponderTerminate: (_: any, _gestureState: any) => {
        // Handle termination (e.g., system dialog, modal swipe) by snapping back to valid state
        const totalHeight = (bottomSheetHeight as any)._value;
        const threshold = (CLOSED_HEIGHT + OPEN_HEIGHT) / 2;
        const targetHeight = totalHeight > threshold ? OPEN_HEIGHT : CLOSED_HEIGHT;
        setIsBottomSheetOpen(totalHeight > threshold);
        Animated.spring(bottomSheetHeight, {
          toValue: targetHeight,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  // Dedicated PanResponder for the notch itself - aggressive capture to stop iOS modal dismissal
  const notchPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true, // Winner for the notch area
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 2,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: panResponder.panHandlers.onResponderGrant as any,
      onPanResponderMove: panResponder.panHandlers.onResponderMove as any,
      onPanResponderRelease: panResponder.panHandlers.onResponderRelease as any,
      onPanResponderTerminate: panResponder.panHandlers.onResponderRelease as any,
    })
  ).current;

  // Subscribe to FCM updates for tracking order
  // Get the order directly from state.byId - this will update when FCM notifications arrive
  const trackingContextOrder = selectedOrderIdForTracking ? state.byId[selectedOrderIdForTracking] : undefined;

  const trackingDisplayOrder = useMemo(
    () => resolveTrackingDisplayOrder(trackingContextOrder, trackingOrderData),
    [trackingContextOrder, trackingOrderData],
  );

  // Get status and updated_at as separate values for reliable change detection
  const contextStatus = trackingContextOrder?.status;
  const contextUpdatedAt = trackingContextOrder?.updated_at;

  // LOG: Track order status watching - log current status values
  useEffect(() => {
    if (!selectedOrderIdForTracking) return;

    console.log('📊 TRACK ORDER STATUS WATCH:', {
      orderId: selectedOrderIdForTracking,
      fcmStatus: contextStatus || 'N/A',
      fcmUpdatedAt: contextUpdatedAt || 'N/A',
      apiStatus: trackingOrderData?.status || 'N/A',
      apiUpdatedAt: trackingOrderData?.updated_at || 'N/A',
      displayStatus: trackingDisplayOrder?.status || 'N/A',
      hasFCMData: !!trackingContextOrder,
      hasAPIData: !!trackingOrderData,
    });
  }, [selectedOrderIdForTracking, contextStatus, contextUpdatedAt, trackingOrderData?.status, trackingOrderData?.updated_at, trackingDisplayOrder?.status]);

  // WATCH BOTH: FCM updates AND API response data for the bottom sheet
  // 1. FCM LISTENER: Watches context order (state.byId) for real-time FCM updates
  // 2. API RESPONSE WATCHER: The initial API response is stored in trackingOrderData
  // When either FCM or API data changes, the UI automatically updates

  // FCM LISTENER + API WATCHER: Listen to FCM updates AND watch API response data
  // When FCM status update arrives:
  // 1. Immediately update UI with FCM status (fast, real-time) - triggers bottom sheet reload
  // 2. Then fetch full order data from API (complete data with all fields)
  // 3. When API response arrives, it updates trackingOrderData which triggers bottom sheet reload
  // This ensures we have both real-time updates AND complete order information
  // CRITICAL: Watch state.byId[orderId] status and updated_at directly to catch FCM updates immediately
  // Get the latest order from state.byId inside useEffect to ensure we always have the latest
  useEffect(() => {
    if (!selectedOrderIdForTracking) return;

    // Get the latest order from state.byId (this updates when FCM arrives)
    const latestContextOrder = state.byId[selectedOrderIdForTracking];

    // When in PiP, force Android to redraw the surface so the new status is visible immediately.
    // Android PiP does not automatically repaint React Native's surface on state changes —
    // it only redraws on touch/interaction. We call PipModule.invalidateView() repeatedly
    // for ~500 ms after the change to ensure the updated UI is painted.
    if (latestContextOrder && isInPipModeRef.current) {
      const last = lastPipSyncRef.current;
      if (last.status !== latestContextOrder.status || last.updated_at !== latestContextOrder.updated_at) {
        lastPipSyncRef.current = { status: latestContextOrder.status, updated_at: latestContextOrder.updated_at };
        setPipSyncKey((k) => k + 1);
        forceTrackingWebViewResize();

        // Nudge the surface sooner than the next 100 ms native loop tick.
        // Start at 100 ms so React has committed its changes to the native
        // view hierarchy before we request a redraw.
        const pipModule = NativeModules.PipModule;
        if (pipModule && typeof pipModule.invalidateView === 'function') {
          for (let i = 2; i <= 8; i++) {
            setTimeout(() => {
              try { pipModule.invalidateView(); } catch { /* ignore */ }
            }, i * 50);
          }
        }
      }
    }

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
          console.log('📊 TRACK ORDER STATUS CHANGE:', {
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
            order_number: latestContextOrder.order_number || prevData.order_number,
            restaurant: latestContextOrder.restaurant || prevData.restaurant,
            // FCM payloads are minimal — preserve rich fields from the previous API response
            // so agent details, delivery address, and ETA aren't wiped out on status updates.
            tracking: (latestContextOrder as any).tracking?.length ? (latestContextOrder as any).tracking : prevData.tracking,
            tracking_id:
              (latestContextOrder as any)?.tracking_id ??
              (latestContextOrder as any)?.trackingId ??
              (prevData as any)?.tracking_id ??
              (prevData as any)?.trackingId,
            tracking_url:
              (latestContextOrder as any)?.tracking_url ||
              (latestContextOrder as any)?.trackingUrl ||
              (prevData as any)?.tracking_url ||
              (prevData as any)?.trackingUrl,
            track_status:
              (latestContextOrder as any)?.track_status ||
              (latestContextOrder as any)?.trackStatus ||
              (prevData as any)?.track_status ||
              (prevData as any)?.trackStatus,
            delivery_address: (latestContextOrder as any).delivery_address || prevData.delivery_address,
            estimated_delivery_time: (latestContextOrder as any).estimated_delivery_time || prevData.estimated_delivery_time,
            rider: {
              ...(prevData?.rider || {}),
              ...((latestContextOrder as any)?.rider || {}),
              current_location:
                (latestContextOrder as any)?.rider?.current_location ||
                prevData?.rider?.current_location ||
                (latestContextOrder as any)?.track_status?.rider?.current_location ||
                prevData?.track_status?.rider?.current_location ||
                null,
            },
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
  }, [selectedOrderIdForTracking, contextStatus, contextUpdatedAt, state.byId, fetchTrackingOrderData, forceTrackingWebViewResize]);

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
    console.log('📊 TRACK ORDER API STATUS UPDATE:', {
      orderId: selectedOrderIdForTracking,
      apiStatus: apiStatus || 'N/A',
      apiUpdatedAt: apiUpdatedAt || 'N/A',
      fcmStatus: contextStatus || 'N/A',
      timestamp: new Date().toISOString(),
    });

    // The bottom sheet will automatically re-render when trackingOrderData changes
    // This useEffect ensures we're watching the API response data
    // The UI uses resolveTrackingDisplayOrder(context, API) so the badge stays in sync with polling.
  }, [selectedOrderIdForTracking, trackingOrderData?.status, trackingOrderData?.updated_at  ]);

  // When order reaches terminal status in PiP: show "Delivered" overlay for delivered/completed, or close for cancelled
  useEffect(() => {
    if (!showTrackingWebView || !isInPipMode) return;

    const displayOrder = trackingDisplayOrder;
    const rawStatus = (displayOrder?.status || '').toString().toLowerCase().trim();
    const normalizedStatus = rawStatus.replace(/[_\s]+/g, '-');

    const isDelivered =
      normalizedStatus === 'delivered' || normalizedStatus === 'completed';
    const isCancelled =
      normalizedStatus === 'cancelled' || normalizedStatus === 'canceled';

    let cleanup: (() => void) | undefined;

    if (isDelivered) {
      setShowDeliveredOverlay(true);

      // Show "Delivered" in the PiP status bar for 3 s, then terminate the PiP window.
      // If the user expands PiP back to full screen before the timer fires,
      // the OrderDeliveredOverlay mounts and plays its entrance animation.
      const autoCloseTimer = setTimeout(() => {
        const pipModule = NativeModules.PipModule;
        if (Platform.OS === 'android' && pipModule) {
          try { pipModule.setAutoPipEnabled(false); } catch { /* ignore */ }
          if (typeof pipModule.closePip === 'function') {
            try { pipModule.closePip(); } catch { /* ignore */ }
          }
        }
        handleCloseTrackingWebView();
      }, 3000);

      cleanup = () => clearTimeout(autoCloseTimer);
    } else if (isCancelled) {
      handleCloseTrackingWebView();
      webViewLoadedRef.current = false;
      const pipModule = NativeModules.PipModule;
      if (Platform.OS === 'android' && pipModule && typeof pipModule.setAutoPipEnabled === 'function') {
        try {
          pipModule.setAutoPipEnabled(false);
        } catch {
          // ignore
        }
      }
    }

    return cleanup;
  }, [
    showTrackingWebView,
    isInPipMode,
    trackingDisplayOrder?.status,
    handleCloseTrackingWebView,
  ]);

  // Periodic full-order refresh while tracking overlay is visible.
  // Helps keep route/polyline and rider updates fresh even without FCM pushes.
  useEffect(() => {
    if (!showTrackingWebView || !selectedOrderIdForTracking) return;

    const interval = setInterval(() => {
      fetchTrackingOrderData(selectedOrderIdForTracking, true).catch((err) => {
        console.warn('Tracking periodic refresh failed:', err);
      });

      const ctxSnap = ordersByIdRef.current[selectedOrderIdForTracking];
      const mergedSnap = resolveTrackingDisplayOrder(ctxSnap, trackingOrderDataRef.current);
      const liveStatus = mergedSnap?.status;
      if (shouldFetchDeliveryTrackStatus(liveStatus)) {
        const trackingIdentifier = resolveDeliveryTrackingId(
          mergedSnap,
          ctxSnap,
        );

        if (!trackingIdentifier) {
          console.log('[DeliveryTracking] periodic skipped: tracking_id unavailable', {
            orderId: selectedOrderIdForTracking,
            liveStatus,
          });
          return;
        }

        deliveryTrackingService.getTrackStatus(trackingIdentifier).then((trackResponse) => {
          const trackData = trackResponse.data;
          if (trackResponse.success && trackData) {
            setTrackingOrderData((prev: any) => ({
              ...(prev || {}),
              rider: {
                ...(prev?.rider || {}),
                ...(trackData.rider || {}),
                current_location:
                  trackData?.rider?.current_location ||
                  prev?.rider?.current_location ||
                  null,
              },
              track_status: trackData,
            }));
          }
        }).catch((error) => {
          console.warn('Tracking status refresh failed:', error);
        });
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [
    showTrackingWebView,
    selectedOrderIdForTracking,
    fetchTrackingOrderData,
    trackingOrderData?.status,
  ]);

  // Street-level route polyline (Google Directions) so map follows actual roads.
  // Refetch only on stage switch or meaningful origin/target deviation.
  useEffect(() => {
    if (!showTrackingWebView || !fallbackMapCoords) return;

    const mapsApiKey = getMapsApiKey();

    const origin = fallbackMapCoords.routeOriginCoordinate;
    const destination = fallbackMapCoords.routeTargetCoordinate;
    const stage = fallbackMapCoords.stageKey || 'unknown';
    const prev = lastRouteFetchRef.current;

    const shouldRefetch =
      !prev ||
      prev.stage !== stage ||
      routeDistanceMeters(prev.origin, origin) > 80 ||
      routeDistanceMeters(prev.destination, destination) > 60;

    if (!shouldRefetch) return;

    let cancelled = false;

    const fetchRoadRoute = async () => {
      const route = await fetchRoadRouteCoordinates(origin, destination, mapsApiKey);
      if (!cancelled && route && route.length > 1) {
        setRoadRouteCoordinates(route);
        lastRouteFetchRef.current = { stage, origin, destination };
        return;
      }
      if (!cancelled) setRoadRouteCoordinates(null);
    };

    fetchRoadRoute();
    return () => {
      cancelled = true;
    };
  }, [showTrackingWebView, fallbackMapCoords]);

  // Secondary street route: store -> rider (light grey) for user exploration.
  useEffect(() => {
    if (
      !showTrackingWebView ||
      !fallbackMapCoords?.showStoreToAgentRoute ||
      !fallbackMapCoords?.restaurantCoordinate ||
      !fallbackMapCoords?.agentCoordinate
    ) {
      setStoreToAgentRouteCoordinates(null);
      return;
    }

    const mapsApiKey = getMapsApiKey();

    const origin = fallbackMapCoords.restaurantCoordinate;
    const destination = fallbackMapCoords.agentCoordinate;
    const prev = lastStoreToAgentRouteFetchRef.current;
    const shouldRefetch =
      !prev ||
      routeDistanceMeters(prev.origin, origin) > 40 ||
      routeDistanceMeters(prev.destination, destination) > 25;

    if (!shouldRefetch) return;

    let cancelled = false;

    const fetchStoreToAgentRoute = async () => {
      const route = await fetchRoadRouteCoordinates(origin, destination, mapsApiKey);
      if (!cancelled && route && route.length > 1) {
        setStoreToAgentRouteCoordinates(route);
        lastStoreToAgentRouteFetchRef.current = { origin, destination };
        return;
      }
      if (!cancelled) setStoreToAgentRouteCoordinates(null);
    };

    fetchStoreToAgentRoute();
    return () => {
      cancelled = true;
    };
  }, [
    showTrackingWebView,
    fallbackMapCoords?.showStoreToAgentRoute,
    fallbackMapCoords?.restaurantCoordinate,
    fallbackMapCoords?.agentCoordinate,
  ]);

  const handleDeliveredOverlayDone = useCallback(() => {
    setShowDeliveredOverlay(false);
    handleCloseTrackingWebView();
    webViewLoadedRef.current = false;
    const pipModule = NativeModules.PipModule;
    if (Platform.OS === 'android' && pipModule && typeof pipModule.setAutoPipEnabled === 'function') {
      try {
        pipModule.setAutoPipEnabled(false);
      } catch {
        // ignore
      }
    }
  }, [handleCloseTrackingWebView]);

  // API RESPONSE WATCHER: Also watch the trackingOrderData itself for any changes
  // This ensures we catch updates from the initial API response or any subsequent API calls
  // The displayOrder will use the latest data from either FCM (trackingContextOrder) or API (trackingOrderData)


  const handleCallSupportFromCancelled = async () => {
    // Get support number from cache first, only call API if not found
    const supportDetails = await authService.getSupportDetails(false);
    const numberToCall = supportDetails.support_number;

    if (!numberToCall) return;
    const telUrl = `tel:${numberToCall.replace(/\s+/g, '')}`;
    Linking.openURL(telUrl).catch(() => { });

    // Navigate to Contact Us page instead of directly calling
    if (onContactUs) {
      onContactUs();
    }
  }

  // Handle Exotel call to delivery agent
  const handleCallDeliveryAgent = async (orderNumber: string, agentPhone: string) => {
    // Validate inputs
    if (!orderNumber || !agentPhone) {
      showConfirmation({
        title: 'Error',
        message: 'Order number or agent phone number is missing. Cannot initiate call.',
        confirmText: 'OK',
        cancelText: '',
        confirmButtonColor: '#00B14F',
        onConfirm: () => { },
      });
      return;
    }

    // Get user's phone number
    const currentUser = await authService.getCurrentUser();
    if (!currentUser || !currentUser.phoneNumber) {
      showConfirmation({
        title: 'Error',
        message: 'Unable to get your phone number. Please ensure you are logged in.',
        confirmText: 'OK',
        cancelText: '',
        confirmButtonColor: '#00B14F',
        onConfirm: () => { },
      });
      return;
    }

    // Clean phone numbers (remove spaces, dashes, etc.)
    const userPhone = currentUser.phoneNumber.replace(/\D/g, '');
    const agentPhoneClean = agentPhone.replace(/\D/g, '');
    if (!userPhone || !agentPhoneClean) {
      showConfirmation({
        title: 'Error',
        message: 'Invalid phone number format. Please check your phone number.',
        confirmText: 'OK',
        cancelText: '',
        confirmButtonColor: '#00B14F',
        onConfirm: () => { },
      });
      return;
    }

    try {
      setIsInitiatingCall(true);

      // Call Exotel API
      const response = await exotelService.initiateCall({
        order_id: orderNumber,
        from: userPhone,
        to: agentPhoneClean,
      });

      if (response.success) {
        showConfirmation({
          title: 'Call Initiated',
          message: 'Your call to the delivery agent is being connected. Please wait for the call.',
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#00B14F',
          onConfirm: () => { },
        });
      } else {
        showConfirmation({
          title: 'Call Failed',
          message: response.error || 'Failed to initiate call. Please try again later.',
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#DC2626',
          onConfirm: () => { },
        });
      }
    } catch (error: any) {
      showConfirmation({
        title: 'Error',
        message: error.message || 'An unexpected error occurred. Please try again.',
        confirmText: 'OK',
        cancelText: '',
        confirmButtonColor: '#DC2626',
        onConfirm: () => { },
      });
    } finally {
      setIsInitiatingCall(false);
    }
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
      (order.status?.toLowerCase() === 'pending' )
    ) {
      // If payment is pending but order is cancelled/pending, it's likely a payment failure
      statusToMap = 'payment_failed';
    }
    else if (
      order.status?.toLowerCase() === 'cancelled'
    ) {
      statusToMap = 'cancelled';
    }

    // Get status config from mapping utility
    const statusConfig = mapOrderStatusToUI(statusToMap);

    // Check if this order should be highlighted
    // Priority: If it matches by order_number, it's very likely the target from a notification
    // If highlightOrderId matches an id but we also have an order_number match elsewhere, 
    // we should be careful. But for UI state, we'll highlight any match.
    const isHighlighted = highlightOrderId ? (
      order.order_number === highlightOrderId || order.id.toString() === highlightOrderId
    ) : false;

    // Show order number from API response (e.g., "ORD-20251208-084")
    // The API returns "order_number" field, so we use it directly
    const orderNumber = order.order_number || (order as any).orderNumber || `ORD-${order.id}`;

    // Get total amount - check multiple possible locations in API response
    const totalAmount = order.summary?.total_amount || order.total_amount || (order as any).total || 0;

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
            {order.restaurant?.logo_url?.trim?.() ? (
              <Image
                source={{ uri: order.restaurant.logo_url.trim() }}
                style={styles.restaurantLogo}
                defaultSource={require('@/assets/dummy-restaurent.png')}
              />
            ) : (
              <View style={[styles.restaurantLogo, { backgroundColor: '#E5E5E5', justifyContent: 'center', alignItems: 'center' }]}>
                <MaterialIcons name="restaurant" size={20} color="#999" />
              </View>
            )}
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
                <Text style={styles.itemName}>{item.quantity || 1}x {item.item_name || item.name || 'Item'}</Text>
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
              {(() => {
                // Track Order is enabled for: packed, agent-assigned, agent-arrived-restaurant, picked, out-for-delivery, on-the-way, delivered
                // Disabled for: confirmed (order placed), billed (order accepted)
                const rawStatus = (order.status || '').toString().toLowerCase();
                const normalizedStatus = rawStatus.replace(/[_\s]+/g, '-');

                // Explicitly disabled statuses - tracking is NOT allowed for these
                const disabledStatuses = [
                  'confirmed',
                  'billed',
                  // From packed / agent-assigned onwards, tracking should be enabled
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

                // Define enabled statuses - tracking works from "packed" / "agent-assigned" status onward
                const enabledStatuses = [
                  'packed',
                  'assigned',
                  'agent-assigned',
                  'accepted',
                  'agent-arrived-restaurant',
                  'picked',
                  'picked-up',
                  'in-transit',
                  'out-for-delivery',
                  'on-the-way',
                  'delivered',
                  'completed'
                ];

                // Check if status is explicitly disabled first - force disable
                const isExplicitlyDisabled = disabledStatuses.includes(normalizedStatus);

                // Enable tracking only if status is in enabled list AND not explicitly disabled
                // Note: tracking_url override removed - status must be enabled
                const isTrackingEnabled = !isExplicitlyDisabled && enabledStatuses.includes(normalizedStatus);

                return (
                  <TouchableOpacity
                    style={[
                      styles.reorderButton,
                      !isTrackingEnabled && styles.disabledButton
                    ]}
                    onPress={() => handleTrackOrder(order.id.toString(), order.status)}
                    activeOpacity={!isTrackingEnabled ? 1 : 0.8}
                    disabled={!isTrackingEnabled}
                  >
                    <MaterialIcons
                      name="location-on"
                      size={18}
                      color={!isTrackingEnabled ? "#CCCCCC" : "#FFFFFF"}
                    />
                    <Text style={[
                      styles.reorderButtonText,
                      !isTrackingEnabled && styles.disabledButtonText
                    ]}>
                      Track Order
                    </Text>
                  </TouchableOpacity>
                );
              })()}
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
          <TextInput autoCorrect={false}
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
          alwaysBounceVertical={true}
          overScrollMode="never"
          scrollEventThrottle={100}
          onScroll={handleScroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#00B14F"
              colors={['#00B14F']}
            />
          }
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
            <Text style={styles.appVersion}>App version {APP_VERSION_NAME}_{APP_VERSION_CODE}</Text>
          </>
        )}
      </ScrollView>

      </SafeAreaView>

      {/* Tracking WebView Overlay - plain View for PiP support (not Modal) */}
      {showTrackingWebView && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#FFFFFF',
            zIndex: 1000,
            elevation: 10,
          }}
        >
          {!isInPipMode && !showDeliveredOverlay && (
            <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
              <View style={styles.webViewHeader}>
                <TouchableOpacity
                  onPress={() => {
                    handleCloseTrackingWebView();
                    webViewLoadedRef.current = false;
                  }}
                  style={styles.webViewBackButton}
                >
                  <MaterialIcons name="close" size={24} color="#001E1F" />
                </TouchableOpacity>
                <Text style={styles.webViewHeaderTitle}>Track Order</Text>
                {canUsePip && showTrackingWebView ? (
                  <TouchableOpacity
                    onPress={handleEnterPip}
                    style={styles.webViewBackButton}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="picture-in-picture-alt" size={22} color="#001E1F" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.webViewBackButton} />
                )}
              </View>
            </SafeAreaView>
          )}

          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            {fallbackMapCoords ? (
              <OrderRouteMapView
                restaurantCoordinate={fallbackMapCoords.restaurantCoordinate}
                customerCoordinate={fallbackMapCoords.customerCoordinate}
                agentLocationUpdate={
                  fallbackMapCoords.latestAgentLocationUpdate
                    ? {
                        lat: fallbackMapCoords.latestAgentLocationUpdate.latitude,
                        lng: fallbackMapCoords.latestAgentLocationUpdate.longitude,
                        timestamp: fallbackMapCoords.latestAgentLocationUpdate.timestamp,
                        heading: fallbackMapCoords.latestAgentLocationUpdate.heading,
                        speed: fallbackMapCoords.latestAgentLocationUpdate.speed,
                        accuracy: fallbackMapCoords.latestAgentLocationUpdate.accuracy,
                      }
                    : fallbackMapCoords.agentCoordinate
                      ? {
                          lat: fallbackMapCoords.agentCoordinate.latitude,
                          lng: fallbackMapCoords.agentCoordinate.longitude,
                          timestamp: Date.now(),
                        }
                    : null
                }
                routeCoordinates={
                  roadRouteCoordinates && roadRouteCoordinates.length > 1
                    ? roadRouteCoordinates
                    : fallbackMapCoords.mode === 'live'
                      ? undefined
                      : fallbackMapCoords.routeCoordinates
                }
                storeToAgentRouteCoordinates={storeToAgentRouteCoordinates}
                showStoreToAgentRoute={fallbackMapCoords.showStoreToAgentRoute}
                mode={fallbackMapCoords.mode}
                restaurantName={fallbackMapCoords.restaurantName}
                customerAddress={fallbackMapCoords.customerAddress}
                resizeTrigger={(isInPipMode ? 1000000 : 0) + trackingMapRefreshKey}
                style={styles.webView}
              />
            ) : (
              <View style={isInPipMode ? styles.webViewLoadingContainerPip : styles.webViewLoadingContainer}>
                <ActivityIndicator size="large" color="#00B14F" />
                <Text style={{ marginTop: 16, color: '#666', fontFamily: 'Poppins-Regular' }}>
                  Loading tracking map...
                </Text>
              </View>
            )}
          </View>

          {isInPipMode && trackingOrderData && (() => {
            const pipDisplayOrder = trackingDisplayOrder || trackingOrderData;
            const pipStatusConfig = mapOrderStatusToUI(pipDisplayOrder?.status);
            return (
              <View key={`pip-status-${pipSyncKey}`} style={styles.navigationWidget} pointerEvents="box-none">
                <View style={[styles.navigationInfoBar, { backgroundColor: pipStatusConfig.color }]}>
                  <View style={styles.navigationStatus}>
                    <Text
                      style={styles.navigationStatusText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {pipStatusConfig.label}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })()}

          {/* Delivered overlay — only rendered in normal mode so animations play correctly.
              In PiP the green status bar already shows "Delivered".
              When the user returns from PiP with showDeliveredOverlay=true the overlay
              mounts fresh and the entrance animation plays from the start. */}
          {showDeliveredOverlay && !isInPipMode && (
            <OrderDeliveredOverlay
              onDone={handleDeliveredOverlayDone}
              restaurantName={trackingOrderData?.restaurant?.name || trackingContextOrder?.restaurant?.name}
              orderNumber={trackingOrderData?.order_number || trackingContextOrder?.order_number}
              autoCloseMs={4500}
            />
          )}

          {!isInPipMode && (
          <Animated.View
            style={[
              styles.trackingBottomSheet,
              {
                height: bottomSheetHeight,
              }
            ]}
          >
            {/* Drag handle at top - always visible, controls open/close */}
            <View
              style={styles.trackingDragHandleContainer}
              {...notchPanResponder.panHandlers}
            >
              <View style={styles.trackingDragHandleBar} />
            </View>

            {/* Top Section: Always visible (restaurant info, status, address3) - draggable when closed */}
            {trackingOrderData && !isLoadingTrackingData && (() => {
              const orderForFullDetails = trackingDisplayOrder || trackingOrderData || trackingContextOrder;
              const displayOrder = trackingDisplayOrder || trackingOrderData || trackingContextOrder;
              const displayStatus = displayOrder?.status;
              const statusConfig = mapOrderStatusToUI(displayStatus);
              return (
                <View
                  style={styles.trackingTopSection}
                  {...panResponder.panHandlers}
                >
                  <View style={styles.trackingLeftContent}>
                    <View style={styles.trackingRestaurantRow}>
                      {(orderForFullDetails?.restaurant?.logo_url?.trim?.()) ? (
                        <Image
                          source={{ uri: orderForFullDetails.restaurant.logo_url.trim() }}
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
                          {orderForFullDetails?.restaurant?.name || 'Unknown Restaurant'}
                        </Text>
                        {orderForFullDetails?.delivery_address?.address3 ? (
                          <Text style={styles.trackingRestaurantAddress}>
                            {orderForFullDetails.delivery_address.address3}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  <View style={styles.trackingRightContent}>
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
                </View>
              );
            })()}

            {/* Scrollable content - only shown when open */}
            {isBottomSheetOpen && (
              <>
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
                    scrollEnabled={isBottomSheetOpen}
                    nestedScrollEnabled={true}
                    bounces={false}
                  >
                    {(() => {
                      const orderForFullDetails = trackingDisplayOrder || trackingOrderData || trackingContextOrder;
                      const displayOrder = trackingDisplayOrder || trackingOrderData || trackingContextOrder;
                      const displayStatus = displayOrder?.status;
                      const trackingArray = orderForFullDetails?.tracking ?? [];
                      let agentName: string | null = null;
                      for (let i = trackingArray.length - 1; i >= 0; i--) {
                        const trackingEntry = trackingArray[i];
                        if (trackingEntry?.agent_name) {
                          agentName = trackingEntry.agent_name;
                          break;
                        }
                      }
                      const sortedApiTracking = [...trackingArray].sort((a: any, b: any) =>
                        new Date(a.timestamp || a.created_at || 0).getTime() - new Date(b.timestamp || b.created_at || 0).getTime()
                      );
                      const timelineEntries = sortedApiTracking.length > 0 ? sortedApiTracking : getFallbackTimelineForStatus(displayStatus);
                      const deliveryCode = resolveDeliveryCode(trackingOrderData || orderForFullDetails);

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

                      const deliveryTime = formatDeliveryTime(orderForFullDetails?.estimated_delivery_time);
                      const statusConfig = mapOrderStatusToUI(displayStatus);
                      const isDelivered = (displayStatus || '').toLowerCase().trim() === 'delivered' ||
                                          (displayStatus || '').toLowerCase().trim() === 'completed';
                      const normalizedStatus = (displayStatus || '').toLowerCase().replace(/[_\s]+/g, '-');
                      const isAgentAssignedish =
                        normalizedStatus === 'agent-assigned' ||
                        normalizedStatus === 'agent-arrived-restaurant' ||
                        normalizedStatus === 'picked' ||
                        normalizedStatus === 'out-for-delivery' ||
                        normalizedStatus === 'on-the-way';

                      // If status says agent is involved but we don't yet have name from API,
                  // show status-appropriate label (same as timeline) instead of generic "on the way"
                  let agentDisplayName = agentName;
                  if (!agentDisplayName && isAgentAssignedish) {
                    agentDisplayName = statusConfig.label;
                  }
                  
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
                  
                  const getTimelineState = (index: number, totalItems: number) => {
                    if (isDelivered) return 'completed';
                    if (index < totalItems - 1) return 'completed';
                    return 'current';
                  };
                  
                  return (
                    <>
                      <View style={styles.trackingDivider} />
                      
                      {/* Agent Details - above estimated delivery time */}
                      <View style={styles.trackingAgentRowInScroll}>
                        <View style={styles.trackingAgentInfoContainer}>
                          <Text style={styles.trackingAgentNameInScroll}>
                            {agentDisplayName || 'No Delivery Agent Assigned'}
                          </Text>
                          {deliveryCode ? (
                            <View style={styles.trackingDeliveryCodeBadge}>
                              <Text style={styles.trackingDeliveryCodeText}>DELIVERY CODE: {deliveryCode}</Text>
                            </View>
                          ) : null}
                        </View>
                        {(orderForFullDetails?.order_number && (isAgentAssignedish || agentDisplayName)) ? (
                          <TouchableOpacity
                            style={styles.trackingCallButtonInScroll}
                            onPress={() => {
                              const orderNum = (orderForFullDetails || displayOrder)?.order_number;
                              const phone = resolveAgentPhoneForExotel(orderForFullDetails);
                              if (!orderNum) {
                                showConfirmation({
                                  title: 'Error',
                                  message: 'Order number is missing. Cannot initiate call.',
                                  confirmText: 'OK',
                                  cancelText: '',
                                  confirmButtonColor: '#00B14F',
                                  onConfirm: () => {},
                                });
                                return;
                              }
                              if (!phone) {
                                showConfirmation({
                                  title: 'Call unavailable',
                                  message: 'The delivery partner line is not available yet. Please try again in a moment.',
                                  confirmText: 'OK',
                                  cancelText: '',
                                  confirmButtonColor: '#00B14F',
                                  onConfirm: () => {},
                                });
                                return;
                              }
                              handleCallDeliveryAgent(String(orderNum), phone);
                            }}
                            disabled={isInitiatingCall}
                            activeOpacity={0.7}
                          >
                            {isInitiatingCall ? (
                              <ActivityIndicator size="small" color="#00B14F" />
                            ) : (
                              <MaterialIcons name="phone" size={18} color="#00B14F" />
                            )}
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      
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
                      
                      {/* Vertical Timeline - same structure for all statuses (API tracking or fallback) */}
                      <View style={styles.trackingTimelineVerticalContainer}>
                        {timelineEntries.map((trackingEntry: any, index: number) => {
                          const state = getTimelineState(index, timelineEntries.length);
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
                                {index < timelineEntries.length - 1 && (
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
                                  {trackingEntry.message || (trackingEntry.status ? mapOrderStatusToUI(trackingEntry.status).label : 'Status update')}
                                </Text>
                                {(trackingEntry.timestamp || trackingEntry.created_at) ? (
                                  <Text style={styles.trackingTimelineTimestamp}>
                                    {formatTimestamp(trackingEntry.timestamp || trackingEntry.created_at)}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                      
                      <View style={styles.trackingDivider} />
                      <View style={styles.trackingBottomSpacing} />
                    </>
                  );
                })()}
              </ScrollView>
            ) : null}
              </>
            )}
          </Animated.View>
          )}
        </View>
      )}
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
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-Medium',
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
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#001E1F',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: 'Poppins-Regular',
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
    fontFamily: 'Poppins-SemiBold',
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
    zIndex: 999,
    elevation: 10,
  },
  webViewBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webViewHeaderTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#001E1F',
    flex: 1,
    textAlign: 'center',
  },
  webView: {
    flex: 1,
  },
  webViewPipContainer: {
    flex: 1,
    backgroundColor: '#000000',
    width: '100%',
    height: '100%',
  },
  webViewWrapperPip: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  webViewPip: {
    flex: 1,
    backgroundColor: '#000000',
    width: '100%',
    height: '100%',
  },
  webViewLoadingContainerPip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  navigationWidget: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 6,
    pointerEvents: 'box-none',
  },
  navigationInfoBar: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
    minHeight: 32,
  },
  navigationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  navigationStatusText: {
    fontSize: 10,
    fontFamily: 'Poppins-SemiBold',
    color: '#FFFFFF',
    flexShrink: 1,
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
  webViewModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webViewModalContainerPip: {
    flex: 1,
    backgroundColor: '#000000',
    width: '100%',
    height: '100%',
  },
  trackingBottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    // Enhanced shadow for better visibility
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    zIndex: 1000,
    elevation: 20, // Android shadow and layering
  },
  trackingDragHandleContainer: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 999,
    elevation: 10,
  },
  trackingDragHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  trackingBottomSheetContent: {
    flex: 1,
    marginTop: 0,
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
    paddingTop: 16,
    paddingRight: 20,
    paddingLeft: 20,
    paddingBottom: 12,
    marginBottom: 6,
  },
  trackingLeftContent: {
    flex: 1,
    marginRight: 12,
  },
  trackingRightContent: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 8,
  },
  trackingRestaurantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
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
  },
  trackingRestaurantName: {
    fontFamily: 'Poppins-SemiBold',
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
  trackingAgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 46, // Align with restaurant name (logo width 36 + margin 10 = 46)
    marginBottom: 0,
  },
  trackingAgentName: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#000000',
  },
  trackingAgentRowInScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  trackingAgentInfoContainer: {
    flex: 1,
  },
  trackingAgentNameInScroll: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#000000',
  },
  trackingDeliveryCodeBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#00B14F',
  },
  trackingDeliveryCodeText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
    lineHeight: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  trackingCallButtonInScroll: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 177, 79, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00B14F',
    marginLeft: 12,
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
    fontFamily: 'Poppins-Medium',
    fontSize: 11,
    lineHeight: 16,
  },
  trackingTopAgentBadge: {
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 177, 79, 0.10)',
  },
  trackingTopAgentText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 11,
    lineHeight: 16,
    color: '#00B14F',
    marginLeft: 4,
    maxWidth: 140,
  },
  trackingTopAgentPhone: {
    fontFamily: 'Poppins',
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(0, 30, 31, 0.75)',
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
    marginTop: 8,
    marginBottom: 12,
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
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-Bold',
    fontSize: 17,
    lineHeight: 24,
    textTransform: 'capitalize',
    color: '#181C2E',
    flex: 1,
  },
  trackingPartnerPhoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackingPartnerPhone: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    color: '#888888',
    textAlign: 'right',
  },
  trackingCallButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 177, 79, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00B14F',
    marginTop: 0,
  },
  trackingBottomSpacing: {
    height: 32, // Two lines worth of space (16px per line)
  },
  trackingCompletedContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  trackingCompletedText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    color: '#00B14F',
    marginTop: 8,
  },
});
