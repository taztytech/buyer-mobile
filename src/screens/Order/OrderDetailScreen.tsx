import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  BackHandler,
  RefreshControl,
  Dimensions,
  Animated,
  PanResponder,
  Pressable,
  AppState,
  NativeModules,
  Platform,
  TextInput,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { OrderRouteMapView } from '@/components/OrderRouteMapView';
import OrderDeliveredOverlay from '@/components/OrderDeliveredOverlay';
import { BackButton } from '@/components/BackButton';
import { OrderProgressBar } from '@/components/order/OrderProgressBar';
import { SponsoredAdSlot } from '@/components/order/SponsoredAdSlot';
import { RateTaztyCard } from '@/components/order/RateTaztyCard';
import { DeliveryPartnerCard } from '@/components/order/DeliveryPartnerCard';
import { NeedHelpCard } from '@/components/order/NeedHelpCard';
import { PayOnlineCard } from '@/components/order/PayOnlineCard';
import { CancelledHero } from '@/components/order/CancelledHero';
import { RefundCard } from '@/components/order/RefundCard';
import { OrderBillSheet } from '@/components/order/OrderBillSheet';
import { paymentService, PaymentErrorType } from '@/services/payment.service';
import { ordersService } from '@/services/orders.service';
import { authService } from '@/services/auth.service';
import { useOrders } from '@/context/OrdersContext';
import { mapOrderStatusToUI, getFallbackTimelineForStatus } from '@/utils/orderStatusMapping';
import { exotelService } from '@/services/exotel.service';
import { deliveryTrackingService } from '@/services/deliveryTracking.service';
import { useConfirmation } from '@/context/ConfirmationContext';
import { useAndroidPip } from '@/hooks/useAndroidPip';
import {
  extractRestaurantCoordinate,
  extractCustomerCoordinate,
  extractAgentCoordinate,
  extractLatestAgentTrackingUpdate,
} from './orderTrackingLocationUtils';
import { resolveTrackingDisplayOrder, resolveAgentPhoneForExotel } from './trackingDisplayUtils';
import { computeShowStoreToAgentRoute } from './orderTrackingRouteVisibility';
import { CancelReasonModal } from '@/components/CancelReasonModal';
import { appConfigService } from '@/services/app-config.service';
import { resolveCurrentLocation } from '@/services/currentLocation.service';

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
    // Rider is at the door: keep the live map running right up to delivery.
    'agent-nearby',
    'reached-delivery',
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

interface OrderDetailScreenProps {
  orderId?: string;
  visible?: boolean;
  onBack?: () => void;
  onThankDriver?: () => void;
  onRateOrder?: (orderId: string, orderData?: any) => void;
  onReorder?: () => void;
  onDownloadInvoice?: () => void;
  onTrackOrder?: () => void;
  onContactUs?: () => void;
  onHelp?: () => void;
  /** Open the live map straight away — set by TRACK ORDER on the notification. */
  autoOpenTracking?: boolean;
  /** Cleared once the map has been opened, so it happens only once. */
  onAutoTrackingHandled?: () => void;
  /** Opens the Tazty Wallet (from the refund line of a wallet refund). */
  onViewWallet?: () => void;
}

export const OrderDetailScreen: React.FC<OrderDetailScreenProps> = ({
  orderId,
  visible = false,
  onBack,
  onThankDriver,
  onRateOrder: _onRateOrder,
  onReorder: _onReorder,
  onDownloadInvoice: _onDownloadInvoice,
  
  onContactUs: _onContactUs,
  onHelp: _onHelp,
  autoOpenTracking = false,
  onAutoTrackingHandled,
  onViewWallet,
}) => {
  const { getOrderById, state, dispatch } = useOrders();
  const { showConfirmation } = useConfirmation();
  const [contextOrder, setContextOrder] = useState<any>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPhoneNumber, setUserPhoneNumber] = useState<string>('');
  const [showTrackingWebView, setShowTrackingWebView] = useState(false);
  const [selectedOrderIdForTracking, setSelectedOrderIdForTracking] = useState<string | null>(null);
  const [trackingOrderData, setTrackingOrderData] = useState<any>(null);
  const [isLoadingTrackingData, setIsLoadingTrackingData] = useState(false);
  // Admin-managed sponsored ads for the live order screen (placement=order_tracking)
  const [orderAds, setOrderAds] = useState<any[]>([]);
  // Full order & bill bottom sheet
  const [showBillSheet, setShowBillSheet] = useState(false);

  useEffect(() => {
    let mounted = true;
    ordersService
      .getOrderTrackingAds()
      .then((res) => {
        if (mounted && res.success && Array.isArray(res.data)) {
          setOrderAds(res.data);
        }
      })
      .catch(() => {
        // Ads are non-essential; a fetch failure must not affect the order UI.
      });
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * TRACK ORDER on the live order notification lands here and expects the map,
   * not another button to press. It opens once the order has actually loaded
   * and only while the order is still trackable, so a stale notification for a
   * delivered order cannot open an empty map.
   */
  useEffect(() => {
    if (!autoOpenTracking || !visible || !orderId) return;
    if (!orderData || showTrackingWebView) return;
    if (!shouldFetchDeliveryTrackStatus(orderData.status)) {
      onAutoTrackingHandled?.();
      return;
    }
    setSelectedOrderIdForTracking(orderId);
    setTrackingOrderData((prev: any) => prev ?? orderData);
    setShowTrackingWebView(true);
    onAutoTrackingHandled?.();
  }, [
    autoOpenTracking,
    visible,
    orderId,
    orderData,
    showTrackingWebView,
    onAutoTrackingHandled,
  ]);
  const lastFetchedStatusRef = useRef<string | null>(null);
  const [showTaxTooltip, setShowTaxTooltip] = useState(false);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [isClosingTracking, setIsClosingTracking] = useState(false);
  const [showDeliveredOverlay, setShowDeliveredOverlay] = useState(false);
  const [cancelSecondsLeft, setCancelSecondsLeft] = useState<number>(0);
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);
  const webViewLoadedRef = useRef<boolean>(false);
  const appStateRef = useRef(AppState.currentState);
  const [roadRouteCoordinates, setRoadRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }> | null>(null);
  // True once the server (fleet) supplies a road-route polyline, so the legacy
  // client-side Google Directions fetch (whose key has no routing API enabled)
  // stops trying and never overwrites the real route with a straight line.
  const serverPolylineActiveRef = useRef(false);
  const [storeToAgentRouteCoordinates, setStoreToAgentRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }> | null>(null);
  const [trackingMapRefreshKey, setTrackingMapRefreshKey] = useState(0);
  const lastRouteFetchRef = useRef<{
    stage: string;
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
  } | null>(null);
  const lastStoreToAgentRouteFetchRef = useRef<{
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
  } | null>(null);

  const cancelWindowSeconds = appConfigService.getCancelTimer();

  const canShowCancelForOrder = useMemo(() => {
    if (!orderData) return false;

    // Orders placed from an offer configured as non-cancellable must not offer
    // the button at all. The API refuses the request regardless, but showing a
    // control that always errors is worse than not showing it. Defaults to
    // true, so ordinary orders are unaffected if the field is absent.
    if ((orderData as any).cancellation_allowed === false) return false;

    const paymentMethod = String(orderData.payment_method || '').toLowerCase();
    if (paymentMethod !== 'cod') return false;

    const status = String(orderData.status || '').toLowerCase().trim();
    // Allow cancel only before the order moves forward from placement
    const cancelEligibleStatuses = ['pending', 'confirmed'];
    if (!cancelEligibleStatuses.includes(status)) return false;

    return true;
  }, [orderData]);

  useEffect(() => {
    if (!orderData || !canShowCancelForOrder) {
      setCancelSecondsLeft(0);
      return;
    }

    const createdAt = orderData.created_at ? new Date(orderData.created_at) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) {
      // If created_at is missing/invalid, don't show countdown-based cancel UI
      setCancelSecondsLeft(0);
      return;
    }

    const tick = () => {
      const elapsedSeconds = Math.floor((Date.now() - createdAt.getTime()) / 1000);
      const remaining = Math.max(0, cancelWindowSeconds - elapsedSeconds);
      setCancelSecondsLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [orderData, canShowCancelForOrder, cancelWindowSeconds]);

  const fallbackMapCoords = useMemo(() => {
    const latestContextOrder = selectedOrderIdForTracking ? state.byId[selectedOrderIdForTracking] : undefined;
    const displayOrder = resolveTrackingDisplayOrder(latestContextOrder, trackingOrderData || orderData);
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
    const normalizedStatus = String(displayOrder.status || '').toLowerCase().trim().replace(/[_\s]+/g, '-');
    const prePickupStatusSet = new Set(['assigned', 'agent-assigned', 'agent-arrived-restaurant', 'accepted']);
    const postPickupStatusSet = new Set([
      'picked',
      'picked-up',
      'in-transit',
      'out-for-delivery',
      'on-the-way',
      'agent-nearby',
      'reached-delivery',
      'delivered',
      'completed',
    ]);
    const hasAgentAssignedSignal =
      !!agentCoordinate || prePickupStatusSet.has(normalizedStatus) || postPickupStatusSet.has(normalizedStatus);
    const routeCoordinates = [restaurantCoordinate, customerCoordinate];
    const restaurantName =
      displayOrder.restaurant?.name?.trim() || 'Restaurant';
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
  }, [trackingOrderData, orderData, selectedOrderIdForTracking, state.byId]);

  const { canUsePip, isInPipMode: hookIsInPipMode, enterPip } = useAndroidPip();

  const [isEnteringPip, setIsEnteringPip] = useState(false);
  const pipNativeConfirmedRef = useRef(false);
  const prevIsInPipModeRef = useRef(false);
  const isInPipModeRef = useRef(false);
  const lastPipSyncRef = useRef<{ status?: string; updated_at?: string }>({});
  const [pipSyncKey, setPipSyncKey] = useState(0);

  const isInPipMode = showTrackingWebView && (hookIsInPipMode || isEnteringPip);

  useEffect(() => {
    isInPipModeRef.current = isInPipMode;
  }, [isInPipMode]);

  const forceTrackingWebViewResize = useCallback(() => {
    setTrackingMapRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (hookIsInPipMode) {
      pipNativeConfirmedRef.current = true;
      setIsEnteringPip(false);
    } else if (pipNativeConfirmedRef.current) {
      pipNativeConfirmedRef.current = false;
      setIsEnteringPip(false);
    }
  }, [hookIsInPipMode]);

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

  useEffect(() => {
    const pipModule = NativeModules.PipModule;
    if (Platform.OS !== 'android' || !pipModule || typeof pipModule.setAutoPipEnabled !== 'function') {
      return;
    }
    try {
      pipModule.setAutoPipEnabled(showTrackingWebView);
    } catch (e) {
      console.warn('[OrderDetailScreen] Failed to set autoPipEnabled:', e);
    }
    return () => {
      try {
        pipModule.setAutoPipEnabled(false);
      } catch {
        // ignore
      }
    };
  }, [showTrackingWebView]);

  // When showing the native route map (no tracking URL), allow PiP immediately.
  useEffect(() => {
    if (showTrackingWebView && fallbackMapCoords) {
      webViewLoadedRef.current = true;
    }
  }, [showTrackingWebView, fallbackMapCoords]);

  // Trigger native PiP from the header button.
  // Guard: only allow PiP once the tracking WebView has fully loaded so
  // Android snapshots a rendered map instead of a blank white surface.
  const handleEnterPip = useCallback(() => {
    if (!showTrackingWebView) return;

    if (!webViewLoadedRef.current) {
      console.log('[OrderDetailScreen] Ignoring PiP tap until tracking WebView has loaded');
      return;
    }

    setIsEnteringPip(true);
    enterPip().catch(() => {
      setIsEnteringPip(false);
    });
  }, [enterPip, showTrackingWebView]);

  const closeTrackingOverlay = useCallback(() => {
    setShowTrackingWebView(false);
    setSelectedOrderIdForTracking(null);
    setTrackingOrderData(null);
    setRoadRouteCoordinates(null);
    setStoreToAgentRouteCoordinates(null);
    lastRouteFetchRef.current = null;
    lastStoreToAgentRouteFetchRef.current = null;
    webViewLoadedRef.current = false;
    const pipModule = NativeModules.PipModule;
    if (Platform.OS === 'android' && pipModule && typeof pipModule.setAutoPipEnabled === 'function') {
      try {
        pipModule.setAutoPipEnabled(false);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleDeliveredOverlayDone = useCallback(() => {
    setShowDeliveredOverlay(false);
    closeTrackingOverlay();
  }, [closeTrackingOverlay]);

  useEffect(() => {
    if (!showTrackingWebView) return;
    const backAction = () => {
      if (!isInPipMode) {
        setShowDeliveredOverlay(false);
        closeTrackingOverlay();
      }
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showTrackingWebView, isInPipMode, closeTrackingOverlay]);

  // Native route-map rendering is handled by fallbackMapCoords and route fetchers.
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
        const data = response.data as any;
        setOrderData(data);
        // Push full order into context so list and FCM merges stay in sync
        if (data?.id != null) {
          dispatch({
            type: 'UPSERT_ORDER_FROM_FCM',
            payload: { ...data, id: data.id },
          });
        }
      } else {
        setError(response.error || 'Failed to load order details');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load order details');
    } finally {
      setIsLoading(false);
    }
  }, [orderId, dispatch]);

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

  // Ref-based guard for closing tracking to prevent redundant calls and race conditions
  const isClosingTrackingRef = useRef(false);

  const handleCloseTrackingWebView = useCallback(() => {
    // 1. Guard against redundant calls using both state and ref
    if (isClosingTracking || isClosingTrackingRef.current) {
      console.log('🛡️ Tracking: Close already in progress, ignoring call');
      return;
    }

    console.log('🛡️ Tracking: Initiating close sequence');

    // 2. Mark as closing - this will immediately unmount the WebView from the tree
    // We set the ref immediately to block any other close calls in the same frame
    isClosingTrackingRef.current = true;
    setIsClosingTracking(true);
    setShowTrackingWebView(false);
    webViewLoadedRef.current = false;
    setRoadRouteCoordinates(null);
    setStoreToAgentRouteCoordinates(null);
    lastRouteFetchRef.current = null;
    lastStoreToAgentRouteFetchRef.current = null;

    // 3. Perform final cleanup after the modal animation has definitely finished (~300-400ms on iOS)
    // We use a safe margin of 800ms.
    setTimeout(() => {
      console.log('🛡️ Tracking: Performing final cleanup after modal dismissal');

      // Clear data and reset bottom sheet state
      setSelectedOrderIdForTracking(null);
      setTrackingOrderData(null);

      // Reset bottom sheet to open state for next use
      bottomSheetHeight.flattenOffset();
      bottomSheetHeight.setValue(OPEN_HEIGHT);
      setIsBottomSheetOpen(true);

      // Refresh main order details silently to reflect any status changes that happened during tracking
      fetchOrderDetails();

      // Reset guards for next time
      setIsClosingTracking(false);
      isClosingTrackingRef.current = false;
    }, 800);
  }, [OPEN_HEIGHT, bottomSheetHeight, fetchOrderDetails, isClosingTracking]);

  // Sync with context whenever this order in state.byId changes (e.g. from FCM) so status/details refresh
  const contextOrderFromState = orderId ? state.byId[orderId] : undefined;
  useEffect(() => {
    if (!orderId) return;
    const orderFromContext = state.byId[orderId];
    if (orderFromContext) {
      setContextOrder(orderFromContext);
    } else {
      const order = getOrderById(orderId);
      setContextOrder(order ?? null);
    }
  }, [orderId, contextOrderFromState, getOrderById]);

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

  const handleCancelOrderPress = useCallback(() => {
    if (!orderData || !canShowCancelForOrder) return;
    const ordNum = orderData.order_number;
    if (!ordNum) {
      showConfirmation({
        title: 'Error',
        message: 'Order number is missing. Please try again.',
        confirmText: 'OK',
        onConfirm: () => {},
      });
      return;
    }
    setShowCancelReasonModal(true);
  }, [orderData, canShowCancelForOrder, showConfirmation]);

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

  const fetchDeliveryTrackStatus = useCallback(async (
    orderIdForTracking: string,
    orderStatus?: string | null,
    additionalSources: any[] = [],
  ) => {
    const effectiveStatus =
      orderStatus ??
      trackingOrderData?.status ??
      orderData?.status ??
      state.byId[orderIdForTracking]?.status;

    if (!shouldFetchDeliveryTrackStatus(effectiveStatus)) {
      return;
    }

    try {
      const latestApiData = await ordersService.getOrderById(Number(orderIdForTracking));
      const latestOrderData = latestApiData.success ? latestApiData.data : null;
      const trackingIdentifier = resolveDeliveryTrackingId(
        latestOrderData,
        trackingOrderData,
        orderData,
        state.byId[orderIdForTracking],
        ...additionalSources,
      );

      if (!trackingIdentifier) {
        return;
      }

      const trackResponse = await deliveryTrackingService.getTrackStatus(trackingIdentifier);
      const trackData = trackResponse.data;
      if (trackResponse.success && trackData) {
        setTrackingOrderData((prev: any) => ({
          ...(prev || {}),
          ...(latestOrderData || {}),
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
        // Server-computed road route (fleet Routes API) → draw the real path.
        const encodedRoute = (trackData as any)?.route_polyline;
        if (typeof encodedRoute === 'string' && encodedRoute.length > 0) {
          const decodedRoute = decodeRoutePolyline(encodedRoute);
          if (decodedRoute.length > 1) {
            serverPolylineActiveRef.current = true;
            setRoadRouteCoordinates(decodedRoute);
          }
        }
      }
    } catch (error) {
      console.warn('Track status API failed:', error);
    }
  }, [orderData, trackingOrderData, state.byId]);

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
      onPanResponderRelease: (_, _gestureState) => {
        const totalHeight = (bottomSheetHeight as any)._value;

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

    console.log('📊 TRACK ORDER STATUS WATCH (OrderDetail):', {
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
            order_number: latestContextOrder.order_number || prevData.order_number,
            restaurant: latestContextOrder.restaurant || prevData.restaurant,
            // FCM payloads are minimal — preserve rich fields from the previous API response
            // so agent details, delivery address, and ETA aren't wiped out on status updates.
            tracking: (latestContextOrder as any).tracking?.length ? (latestContextOrder as any).tracking : prevData.tracking,
            delivery_address: (latestContextOrder as any).delivery_address || prevData.delivery_address,
            estimated_delivery_time: (latestContextOrder as any).estimated_delivery_time || prevData.estimated_delivery_time,
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

  // Street-level route polyline (Google Directions) so map follows actual roads.
  // Refetch only on stage switch or meaningful origin/target deviation.
  useEffect(() => {
    if (!showTrackingWebView || !fallbackMapCoords) return;

    // The server (fleet) now supplies the road route; once it has, never let the
    // legacy client Directions call (its key has no routing API enabled) run or
    // reset the route to a straight line.
    if (serverPolylineActiveRef.current) return;

    const mapsApiKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
    if (!mapsApiKey) {
      setRoadRouteCoordinates(null);
      return;
    }

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
      try {
        const url =
          `https://maps.googleapis.com/maps/api/directions/json` +
          `?origin=${encodeURIComponent(`${origin.latitude},${origin.longitude}`)}` +
          `&destination=${encodeURIComponent(`${destination.latitude},${destination.longitude}`)}` +
          `&mode=driving&alternatives=false&key=${encodeURIComponent(mapsApiKey)}`;
        const response = await fetch(url);
        const payload = await response.json();
        const encoded = payload?.routes?.[0]?.overview_polyline?.points;
        if (!cancelled && typeof encoded === 'string' && encoded.length > 0) {
          const decoded = decodeRoutePolyline(encoded);
          if (decoded.length > 1) {
            setRoadRouteCoordinates(decoded);
            lastRouteFetchRef.current = { stage, origin, destination };
            return;
          }
        }
        if (!cancelled) setRoadRouteCoordinates(null);
      } catch {
        if (!cancelled) setRoadRouteCoordinates(null);
      }
    };

    fetchRoadRoute();
    return () => {
      cancelled = true;
    };
  }, [showTrackingWebView, fallbackMapCoords]);

  // Secondary street route: store -> rider (light grey) while rider is pre-pickup.
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

    const mapsApiKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
    if (!mapsApiKey) {
      setStoreToAgentRouteCoordinates(null);
      return;
    }

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
      try {
        const url =
          `https://maps.googleapis.com/maps/api/directions/json` +
          `?origin=${encodeURIComponent(`${origin.latitude},${origin.longitude}`)}` +
          `&destination=${encodeURIComponent(`${destination.latitude},${destination.longitude}`)}` +
          `&mode=driving&alternatives=false&key=${encodeURIComponent(mapsApiKey)}`;
        const response = await fetch(url);
        const payload = await response.json();
        const encoded = payload?.routes?.[0]?.overview_polyline?.points;
        if (!cancelled && typeof encoded === 'string' && encoded.length > 0) {
          const decoded = decodeRoutePolyline(encoded);
          if (decoded.length > 1) {
            setStoreToAgentRouteCoordinates(decoded);
            lastStoreToAgentRouteFetchRef.current = { origin, destination };
            return;
          }
        }
        if (!cancelled) setStoreToAgentRouteCoordinates(null);
      } catch {
        if (!cancelled) setStoreToAgentRouteCoordinates(null);
      }
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
        closeTrackingOverlay();
      }, 3000);

      cleanup = () => clearTimeout(autoCloseTimer);
    } else if (isCancelled) {
      closeTrackingOverlay();
    }

    return cleanup;
  }, [
    showTrackingWebView,
    isInPipMode,
    trackingDisplayOrder?.status,
    closeTrackingOverlay,
  ]);

  // Delivery tracking poller parity with My Orders: refresh rider location every 2.5s.
  useEffect(() => {
    if (!showTrackingWebView || !selectedOrderIdForTracking) return;

    const interval = setInterval(() => {
      const latestContextOrder = state.byId[selectedOrderIdForTracking];
      const mergedSnap = resolveTrackingDisplayOrder(latestContextOrder, trackingOrderData);
      const liveStatus = mergedSnap?.status || latestContextOrder?.status || trackingOrderData?.status;
      if (!shouldFetchDeliveryTrackStatus(liveStatus)) {
        return;
      }

      const trackingIdentifier = resolveDeliveryTrackingId(
        mergedSnap,
        latestContextOrder,
        trackingOrderData,
        orderData,
      );
      if (!trackingIdentifier) {
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
          // Server-computed road route (fleet Routes API) → draw the real path.
          const encodedRoute = (trackData as any)?.route_polyline;
          if (typeof encodedRoute === 'string' && encodedRoute.length > 0) {
            const decodedRoute = decodeRoutePolyline(encodedRoute);
            if (decodedRoute.length > 1) {
              serverPolylineActiveRef.current = true;
              setRoadRouteCoordinates(decodedRoute);
            }
          }
        }
      }).catch((error) => {
        console.warn('Tracking status refresh failed:', error);
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [
    showTrackingWebView,
    selectedOrderIdForTracking,
    trackingOrderData,
    orderData,
    state.byId,
  ]);

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

  // ── Blinkit-style header: status line + live, adaptive "Arriving in N min" ──
  // Ticks locally every 30s and counts down to the absolute
  // estimated_delivery_time. The backend re-pushes that timestamp as the rider
  // moves / hits traffic, so the target shifts and the countdown follows it
  // (extends on delay). A range string ("11-17 minutes") is shown as-is.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const s = (orderData?.status || '').toLowerCase();
    if (!orderData || s === 'delivered' || s === 'cancelled' || s === 'canceled' || s === 'rejected') {
      return;
    }
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, [orderData?.status]);

  const headerStatusLine = useMemo(() => {
    const s = (orderData?.status || '').toLowerCase();
    if (!s) return 'Order';
    if (s === 'delivered') return 'Order delivered';
    if (s === 'cancelled' || s === 'canceled' || s === 'rejected') return 'Order cancelled';
    if (['out-for-delivery', 'agent-nearby', 'picked'].includes(s)) return 'Out for delivery';
    if (['packed', 'agent-assigned', 'agent-arrived-restaurant'].includes(s)) return 'Order is being prepared';
    return 'Order is confirmed';
  }, [orderData?.status]);

  const headerArrivingLine = useMemo(() => {
    const s = (orderData?.status || '').toLowerCase();
    if (s === 'delivered') return 'Delivered';
    if (s === 'cancelled' || s === 'canceled' || s === 'rejected') return '';
    const eta = orderData?.estimated_delivery_time || orderData?.preorder_delivery_date;
    if (!eta) return 'Arriving soon';
    const raw = String(eta).trim();
    if (/^\d+\s*-\s*\d+\s*(mins?|minutes?)$/i.test(raw)) {
      return `Arriving in ${raw.replace(/mins?|minutes?/i, 'minutes')}`;
    }
    const t = Date.parse(raw);
    if (Number.isNaN(t)) return `Arriving in ${raw}`;
    const diffMin = Math.round((t - nowTick) / 60000);
    if (diffMin <= 0) return 'Arriving soon';
    if (diffMin === 1) return 'Arriving in 1 minute';
    return `Arriving in ${diffMin} minutes`;
  }, [orderData?.status, orderData?.estimated_delivery_time, orderData?.preorder_delivery_date, nowTick]);

  // Only surface the tip / share-location actions while the order is live.
  const isActiveOrder = useMemo(() => {
    const s = (orderData?.status || '').toLowerCase();
    return !!s && !['delivered', 'cancelled', 'canceled', 'rejected', 'payment_failed', 'failed'].includes(s);
  }, [orderData?.status]);

  // ── Post-order tip (Blinkit-style) ──
  const [tipBusy, setTipBusy] = useState(false);
  const [tipLocal, setTipLocal] = useState<number | null>(null);
  const [showTipCustom, setShowTipCustom] = useState(false);
  const [tipCustomText, setTipCustomText] = useState('');
  const currentTip =
    tipLocal !== null
      ? tipLocal
      : Number(orderData?.tip_amount ?? orderData?.summary?.tip_amount ?? 0) || 0;

  const applyTip = useCallback(
    async (amount: number) => {
      if (!orderId || tipBusy) return;
      const next = currentTip === amount ? 0 : Math.min(Math.max(amount, 0), 450);
      setTipBusy(true);
      setTipLocal(next); // optimistic
      const pm = String(orderData?.payment_method || '').toLowerCase();
      const source: 'wallet' | 'cod' | 'online' = pm === 'cod' ? 'cod' : 'wallet';
      const res = await ordersService.updateOrderTip(Number(orderId), next, source);
      setTipBusy(false);
      if (!res.success) {
        setTipLocal(null); // revert to server value
        showConfirmation({
          title: 'Could not add tip',
          message: res.error || 'Please try again in a moment.',
          confirmText: 'OK',
          onConfirm: () => {},
        });
      } else {
        fetchOrderDetails();
      }
    },
    [orderId, tipBusy, currentTip, orderData?.payment_method, showConfirmation, fetchOrderDetails],
  );

  // ── Share live location with the rider ──
  const [shareLocBusy, setShareLocBusy] = useState(false);
  const [shareLocDone, setShareLocDone] = useState(false);
  const handleShareLocation = useCallback(async () => {
    if (!orderId || shareLocBusy) return;
    setShareLocBusy(true);
    try {
      const loc = await resolveCurrentLocation(8000);
      if (!loc) {
        showConfirmation({
          title: 'Location unavailable',
          message: 'Enable location permission to share your live location with the delivery partner.',
          confirmText: 'OK',
          onConfirm: () => {},
        });
        return;
      }
      const res = await ordersService.shareCustomerLocation(Number(orderId), {
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      if (res.success) {
        setShareLocDone(true);
      } else {
        showConfirmation({
          title: 'Could not share location',
          message: res.error || 'Please try again in a moment.',
          confirmText: 'OK',
          onConfirm: () => {},
        });
      }
    } finally {
      setShareLocBusy(false);
    }
  }, [orderId, shareLocBusy, showConfirmation]);

  // Pay an active COD order online (real Razorpay flow). On success the order
  // is refreshed; its payment_status flips to 'paid', which hides this card.
  const [payingOnline, setPayingOnline] = useState(false);
  const handlePayOnline = useCallback(async () => {
    if (!orderId || payingOnline) return;
    setPayingOnline(true);
    try {
      const result = await paymentService.payExistingCodOrder(Number(orderId), {
        name: (orderData?.delivery_address?.name as string) || 'Customer',
        phone: userPhoneNumber || (orderData?.delivery_address?.phone_number as string) || '',
      });
      if (result.success) {
        showConfirmation({
          title: 'Payment successful',
          message: 'Your payment has been received. Thank you!',
          confirmText: 'OK',
          onConfirm: () => {},
        });
        await fetchOrderDetails();
      } else if (result.errorType !== PaymentErrorType.USER_CANCELLED) {
        showConfirmation({
          title: 'Payment not completed',
          message: result.error || 'Please try again in a moment.',
          confirmText: 'OK',
          onConfirm: () => {},
        });
      }
    } finally {
      setPayingOnline(false);
    }
  }, [orderId, payingOnline, userPhoneNumber, orderData, showConfirmation, fetchOrderDetails]);

  // Open the full-screen tracking overlay (also used by the inline map's
  // expand button). Mirrors the "Track Order" button's open logic.
  const openTrackingOverlay = useCallback(() => {
    if (!orderId || showTrackingWebView || isClosingTracking) return;
    const effectiveStatus = orderData?.status;
    setSelectedOrderIdForTracking(orderId);
    setTrackingOrderData((prev: any) => prev ?? orderData);
    setShowTrackingWebView(true);
    fetchDeliveryTrackStatus(orderId, effectiveStatus, [orderData]).catch(() => {
      fetchTrackingOrderData(orderId, true);
    });
    fetchTrackingOrderData(orderId, true);
  }, [orderId, showTrackingWebView, isClosingTracking, orderData]);

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
        delivery_fee_tax: 0,
        platform_fee_tax: 0,
        total_tax_amount: 0,
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
    const delivery_fee_tax = summary.delivery_fee_tax || 0;
    const platform_fee_tax = summary.platform_fee_tax || 0;
    const total_tax_amount = summary.total_tax_amount || 0;

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
      delivery_fee_tax,
      platform_fee_tax,
      total_tax_amount,
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
      'agent_nearby': {
        title: 'Your delivery partner is arriving. Please be reachable.',
        color: '#F59E0B'
      },
      'agent-nearby': {
        title: 'Your delivery partner is arriving. Please be reachable.',
        color: '#F59E0B'
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

  // Progress fraction + short label for the bike strip, derived from status.
  const orderProgress = useMemo(() => {
    const s = String(orderData?.status || '')
      .toLowerCase()
      .trim()
      .replace(/[_\s]+/g, '-');
    if (['delivered', 'completed'].includes(s)) return { fraction: 1, label: 'Delivered' };
    if (['agent-nearby', 'reached-delivery'].includes(s)) return { fraction: 0.85, label: 'Almost there' };
    if (['picked', 'picked-up', 'out-for-delivery', 'on-the-way', 'in-transit'].includes(s))
      return { fraction: 0.68, label: 'On the way' };
    if (['agent-assigned', 'assigned', 'agent-arrived-restaurant', 'accepted'].includes(s))
      return { fraction: 0.48, label: 'Partner assigned' };
    return { fraction: 0.28, label: 'Preparing' };
  }, [orderData?.status]);

  const isCancelled =
    String(orderData?.status || '').toLowerCase().trim() === 'cancelled';

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header — Blinkit-style: status line + live "Arriving in N minutes" */}
      <View style={styles.header}>
        <BackButton onPress={onBack} color="#FFFFFF" />
        <View style={styles.headerCenter} pointerEvents="none">
          <Text style={styles.headerStatusLine} numberOfLines={1}>
            {headerStatusLine}
          </Text>
          {headerArrivingLine ? (
            <Text style={styles.headerArrivingLine} numberOfLines={1}>
              {headerArrivingLine}
            </Text>
          ) : null}
        </View>
        {/* Spacer balances the back button so the title stays centered */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress strip with the riding bike — hidden for cancelled/failed orders */}
      {orderData &&
        !['cancelled', 'payment_failed'].includes(
          String(orderData.status || '').toLowerCase().trim().replace(/[_\s]+/g, '-')
        ) && (
          <OrderProgressBar
            progress={orderProgress.fraction}
            label={orderProgress.label}
          />
        )}

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
            onScrollBeginDrag={() => setShowTaxTooltip(false)}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#00B14F"
                colors={['#00B14F']}
              />
            }
          >
            {/* Inline live map — for active/trackable orders, the tracker lives
                on the page (expand opens the full-screen map). */}
            {fallbackMapCoords && isActiveOrder && (
              <View style={styles.inlineMapWrap}>
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
                      : fallbackMapCoords.routeCoordinates
                  }
                  storeToAgentRouteCoordinates={storeToAgentRouteCoordinates}
                  showStoreToAgentRoute={fallbackMapCoords.showStoreToAgentRoute}
                  mode={fallbackMapCoords.mode}
                  restaurantName={fallbackMapCoords.restaurantName}
                  customerAddress={fallbackMapCoords.customerAddress}
                  style={styles.inlineMap}
                />
                <TouchableOpacity
                  style={styles.mapExpandBtn}
                  onPress={openTrackingOverlay}
                  activeOpacity={0.85}
                  testID="order-map-expand"
                >
                  <MaterialIcons name="open-in-full" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mapShareBtn}
                  onPress={handleShareLocation}
                  disabled={shareLocBusy}
                  activeOpacity={0.85}
                  testID="order-map-share"
                >
                  <MaterialIcons
                    name={shareLocDone ? 'check-circle' : 'near-me'}
                    size={14}
                    color="#FFFFFF"
                  />
                  <Text style={styles.mapShareText}>
                    {shareLocDone ? 'Location shared' : 'Share my location'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Cancelled: hero + dynamic refund replace the delivery illustration */}
            {isCancelled && (
              <>
                <CancelledHero
                  cancelledAt={orderData.cancelled_at || orderData.updated_at}
                  reason={
                    orderData.cancel_reason?.reason ||
                    (typeof orderData.cancel_reason === 'string'
                      ? orderData.cancel_reason
                      : null)
                  }
                />
                <RefundCard refund={orderData.refund} />
                <View style={styles.cancelActionsRow}>
                  <TouchableOpacity
                    style={styles.cancelGhostBtn}
                    onPress={_onHelp}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.cancelGhostBtnText}>Need help</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelPrimaryBtn}
                    onPress={_onReorder}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
                    <Text style={styles.cancelPrimaryBtnText}>Reorder</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Delivery Status Card - Illustration + Banner */}
            {!isCancelled && (
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
            )}

            {/* Pay online — COD orders that are still unpaid and active */}
            {(() => {
              const method = String(orderData.payment_method || '').toLowerCase();
              const paid = String(orderData.payment_status || '').toLowerCase() === 'paid';
              const s = String(orderData.status || '').toLowerCase().trim().replace(/[_\s]+/g, '-');
              const active = !['cancelled', 'delivered', 'completed', 'created', 'payment-failed', 'payment_failed'].includes(s);
              if (method !== 'cod' || paid || !active) return null;
              const amount =
                orderData.summary?.total_amount || orderData.total_amount || 0;
              return (
                <PayOnlineCard
                  amount={Number(amount)}
                  paid={false}
                  loading={payingOnline}
                  onPay={handlePayOnline}
                />
              );
            })()}

            {/* Delivery partner + store distance (merged, Blinkit-style) */}
            {(() => {
              const s = String(orderData.status || '').toLowerCase().trim().replace(/[_\s]+/g, '-');
              if (['cancelled', 'payment_failed', 'payment-failed'].includes(s)) return null;
              const delivered = ['delivered', 'completed'].includes(s);
              if (!isActiveOrder && !delivered) return null;
              const partnerName =
                orderData.live_tracking?.agent_name ||
                (Array.isArray(orderData.tracking)
                  ? [...orderData.tracking].reverse().find((t: any) => t?.agent_name)?.agent_name
                  : null) ||
                null;
              const distanceKm =
                fallbackMapCoords?.restaurantCoordinate && fallbackMapCoords?.customerCoordinate
                  ? routeDistanceMeters(
                      fallbackMapCoords.restaurantCoordinate,
                      fallbackMapCoords.customerCoordinate,
                    ) / 1000
                  : null;
              return (
                <DeliveryPartnerCard
                  name={partnerName}
                  delivered={delivered}
                  restaurantName={orderData.restaurant?.name || 'Restaurant'}
                  distanceKm={distanceKm}
                  showCall={isActiveOrder && !!partnerName}
                  onCall={() => {
                    const phone = resolveAgentPhoneForExotel(orderData);
                    if (phone && orderData.order_number) {
                      handleCallDeliveryAgent(String(orderData.order_number), phone);
                    }
                  }}
                />
              );
            })()}

            {/* Tip the delivery partner — post-order (Blinkit-style) */}
            {isActiveOrder && (
              <View style={styles.card}>
                <View style={styles.actionHeaderRow}>
                  <View style={styles.actionIconWrap}>
                    <MaterialIcons name="volunteer-activism" size={20} color="#00B14F" />
                  </View>
                  <View style={styles.actionHeaderText}>
                    <Text style={styles.actionTitle}>Add a tip for your delivery partner</Text>
                    <Text style={styles.actionSubtitle}>A little kindness can make their day</Text>
                  </View>
                </View>
                <View style={styles.tipRow}>
                  {[20, 30, 50].map((amt) => {
                    const active = currentTip === amt;
                    return (
                      <TouchableOpacity
                        key={amt}
                        style={[styles.tipChip, active && styles.tipChipActive]}
                        onPress={() => applyTip(amt)}
                        disabled={tipBusy}
                        activeOpacity={0.85}
                        testID={`order-tip-${amt}`}
                      >
                        <Text style={[styles.tipChipText, active && styles.tipChipTextActive]}>
                          ₹{amt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.tipChip, showTipCustom && styles.tipChipActive]}
                    onPress={() => setShowTipCustom((v) => !v)}
                    disabled={tipBusy}
                    activeOpacity={0.85}
                    testID="order-tip-custom"
                  >
                    <Text style={[styles.tipChipText, showTipCustom && styles.tipChipTextActive]}>
                      Custom
                    </Text>
                  </TouchableOpacity>
                </View>
                {showTipCustom && (
                  <View style={styles.tipCustomRow}>
                    <Text style={styles.tipCustomPrefix}>₹</Text>
                    <TextInput
                      style={styles.tipCustomInput}
                      keyboardType="number-pad"
                      placeholder="Enter amount"
                      placeholderTextColor="#9AA0A6"
                      value={tipCustomText}
                      onChangeText={setTipCustomText}
                      maxLength={4}
                    />
                    <TouchableOpacity
                      style={styles.tipCustomBtn}
                      onPress={() => {
                        const v = parseInt(tipCustomText, 10);
                        if (v > 0) {
                          applyTip(Math.min(v, 450));
                          setShowTipCustom(false);
                          setTipCustomText('');
                        }
                      }}
                      disabled={tipBusy}
                    >
                      <Text style={styles.tipCustomBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {currentTip > 0 && (
                  <Text style={styles.tipAppliedText}>
                    You're tipping ₹{currentTip} — 100% goes to your delivery partner.
                  </Text>
                )}
              </View>
            )}

            {/* Share live location with the rider */}
            {isActiveOrder && (
              <View style={styles.card}>
                <View style={styles.actionHeaderRow}>
                  <View style={styles.actionIconWrap}>
                    <MaterialIcons name="my-location" size={20} color="#00B14F" />
                  </View>
                  <View style={styles.actionHeaderText}>
                    <Text style={styles.actionTitle}>Share your live location</Text>
                    <Text style={styles.actionSubtitle}>Help your delivery partner reach you faster</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.shareLocBtn, shareLocDone && styles.shareLocBtnDone]}
                  onPress={handleShareLocation}
                  disabled={shareLocBusy}
                  activeOpacity={0.85}
                  testID="order-share-location"
                >
                  {shareLocBusy ? (
                    <ActivityIndicator size="small" color="#00B14F" />
                  ) : (
                    <>
                      <MaterialIcons
                        name={shareLocDone ? 'check-circle' : 'near-me'}
                        size={18}
                        color={shareLocDone ? '#00B14F' : '#FFFFFF'}
                      />
                      <Text style={[styles.shareLocBtnText, shareLocDone && styles.shareLocBtnTextDone]}>
                        {shareLocDone ? 'Location shared' : 'Share current location'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

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
                      // After a partial acceptance the order costs less.
                      if (orderData.summary?.payable_amount != null) {
                        return Number(orderData.summary.payable_amount).toFixed(2);
                      }
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
                  <>
                  </>
                  // <TouchableOpacity
                  //   style={styles.rateButton}
                  //   onPress={() => onRateOrder && onRateOrder(orderId || '', orderData)}
                  //   activeOpacity={0.7}
                  // >
                  //   <MaterialIcons name="star-outline" size={20} color="#001E1F" />
                  //   <Text style={styles.rateButtonText}>Rate Order</Text>
                  // </TouchableOpacity>
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
                {orderData.status !== 'delivered' && <View style={styles.trackOrderContainer}>
                  {(() => {
                    // Track Order is enabled for: packed, agent-assigned, agent-arrived-restaurant, picked, out-for-delivery, on-the-way, delivered
                    // Disabled for: confirmed (order placed), billed (order accepted)
                    const rawStatus = (orderData?.status || '').toString().toLowerCase();
                    // Normalize: underscores/spaces to hyphen
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
                      'agent-assigned',
                      'agent_assigned',
                      'agent-arrived-restaurant',
                      'agent_arrived_restaurant',
                      'picked',
                      'out-for-delivery',
                      'out_for_delivery',
                      'on-the-way',
                      'on_the_way',
                      'agent-nearby',
                      'agent_nearby',
                      'reached-delivery',
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
                            if (!isTrackingEnabled || showTrackingWebView || isClosingTracking) return;
                            if (!orderId) return;

                            const effectiveStatus = orderData?.status;
                            setSelectedOrderIdForTracking(orderId);
                            setTrackingOrderData((prev: any) => prev ?? orderData);
                            setShowTrackingWebView(true);
                            fetchDeliveryTrackStatus(orderId, effectiveStatus, [orderData]).catch(() => {
                              fetchTrackingOrderData(orderId, true);
                            });
                            fetchTrackingOrderData(orderId, true);
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
                            Tracking unlocks after agent assigned.
                          </Text>
                        )}
                        {canShowCancelForOrder && (
                          <TouchableOpacity
                            style={[
                              styles.cancelButton,
                              cancelSecondsLeft <= 0 && styles.cancelButtonDisabled,
                            ]}
                            onPress={handleCancelOrderPress}
                            disabled={cancelSecondsLeft <= 0}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.cancelButtonText,
                                cancelSecondsLeft <= 0 && styles.cancelButtonTextDisabled,
                              ]}
                            >
                              Cancel Order{cancelSecondsLeft > 0 ? ` (${cancelSecondsLeft}s)` : ''}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    );
                  })()}
                </View>}
                {/* )} */}
              </View>
            </View>

            {/* Item Details Card */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Item Details</Text>
              <View style={styles.itemDetailsContainer}>
                {orderData.items.map((item: any, index: number) => {
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
                            <Text
                              style={[
                                styles.itemDetailName,
                                Number(item.cancelled_quantity || 0) >= Number(item.quantity) &&
                                  styles.itemUnavailableName,
                              ]}
                            >
                              {item.item_name} × {item.quantity}
                            </Text>
                          </View>
                          {/* The store could not supply some of this line */}
                          {Number(item.cancelled_quantity || 0) > 0 && (
                            <Text style={styles.itemUnavailableText} testID={`order-item-unavailable-${item.id}`}>
                              {Number(item.cancelled_quantity) >= Number(item.quantity)
                                ? 'Unavailable'
                                : `${item.cancelled_quantity} unavailable`}
                            </Text>
                          )}
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

            {/* View full order & bill → opens the bottom sheet */}
            <TouchableOpacity
              style={styles.viewBillBtn}
              onPress={() => setShowBillSheet(true)}
              activeOpacity={0.8}
              testID="order-view-full-bill"
            >
              <Text style={styles.viewBillText}>View full order &amp; bill</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#0A6B36" />
            </TouchableOpacity>

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
              {deliveryTimeValue && orderData.status !== 'delivered' && (
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
                          styles.billValue
                          // (bill.include_platform_fee || bill.platform_fee === 0) 
                          //   ? styles.billValue 
                          //   : styles.billValueStrikethrough
                        }>
                          ₹{bill.platform_fee.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Delivery Partner tip</Text>
                        <Text style={styles.billValue}>₹{bill.tip_amount.toFixed(2)}</Text>
                      </View>
                      {/* <View style={styles.billRow}>
                      <Text style={styles.billLabel}>GST and Charges</Text>
                      <Text style={styles.billValue}>₹{bill.tax_amount.toFixed(2)}</Text>
                    </View> */}
                      <View style={styles.billRow}>
                        <View style={styles.billLabelContainer}>
                          <Text style={styles.billLabel}>Tax And Charges</Text>
                          <View style={styles.infoIconWrapper}>
                            <TouchableOpacity
                              onPress={() => setShowTaxTooltip(!showTaxTooltip)}
                              activeOpacity={0.7}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <MaterialIcons name="info" size={16} color="rgba(0, 0, 0, 0.6)" />
                            </TouchableOpacity>
                            {showTaxTooltip && (
                              <View style={styles.taxTooltip}>
                                <View style={styles.taxTooltipContent}>
                                  <View style={styles.taxTooltipRow}>
                                    <Text style={styles.taxTooltipLabel}>Delivery Fee Tax</Text>
                                    <Text style={styles.taxTooltipValue}>
                                      ₹{bill.delivery_fee_tax.toFixed(2)}
                                    </Text>
                                  </View>
                                  <View style={styles.taxTooltipRow}>
                                    <Text style={styles.taxTooltipLabel}>Platform Fee Tax</Text>
                                    <Text style={styles.taxTooltipValue}>
                                      ₹{bill.platform_fee_tax.toFixed(2)}
                                    </Text>
                                  </View>
                                  <View style={styles.taxTooltipRow}>
                                    <Text style={styles.taxTooltipLabel}>Tax Amount</Text>
                                    <Text style={styles.taxTooltipValue}>
                                      ₹{bill.tax_amount.toFixed(2)}
                                    </Text>
                                  </View>
                                </View>
                                <View style={styles.taxTooltipArrow} />
                              </View>
                            )}
                          </View>
                        </View>
                        <Text style={styles.billValue}>₹{bill?.total_tax_amount?.toFixed(2)}</Text>
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
                      <Text
                        style={[
                          styles.totalLabel,
                          orderData.summary?.payable_amount != null && styles.totalStruck,
                        ]}
                      >
                        Total
                      </Text>
                      <Text
                        style={[
                          styles.totalValue,
                          orderData.summary?.payable_amount != null && styles.totalStruck,
                        ]}
                      >
                        ₹{bill.total_amount.toFixed(2)}
                      </Text>
                    </View>
                    {/* After the store accepted only some items */}
                    {orderData.summary?.payable_amount != null && (
                      <View style={styles.totalRow} testID="order-payable-row">
                        <Text style={styles.totalLabel}>New total</Text>
                        <Text style={styles.totalValue}>
                          ₹{Number(orderData.summary.payable_amount).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </>
                );
              })()}
            </View>

            {/* Refund line: where the money went (wallet or original payment) */}
            {!!orderData.refund && Number(orderData.refund.amount) > 0 && (() => {
              const refund = orderData.refund;
              const amount = `₹${Number(refund.amount).toFixed(2)}`;
              const toWallet = refund.destination === 'wallet';
              const pending = refund.status === 'pending';
              const held = refund.status === 'processing';
              const forItems = refund.refund_type === 'partial';
              const title = held
                ? `${amount} refund being processed`
                : toWallet
                ? `${amount} refunded to your Tazty Wallet`
                : pending
                  ? `${amount} refund on its way to your original payment method`
                  : `${amount} refunded to your original payment method`;
              const subtitle = held
                ? "For the items that were unavailable. We'll let you know as soon as it's done."
                : forItems && toWallet
                ? 'For the unavailable items. Available now in your wallet.'
                : toWallet
                ? 'Available now. Use it on your next Tazty order.'
                : pending
                  ? refund.speed === 'optimum'
                    ? 'It should reach you within minutes.'
                    : 'It usually takes 5–7 working days to reach you.'
                  : 'It may take a little while to show in your bank or UPI app.';
              return (
                <View style={[styles.card, styles.refundCard]} testID="order-refund-card">
                  <View style={styles.refundRow}>
                    <MaterialIcons
                      name={toWallet ? 'account-balance-wallet' : 'replay'}
                      size={22}
                      color="#00B14F"
                    />
                    <View style={styles.refundTextWrap}>
                      <Text style={styles.refundTitle}>{title}</Text>
                      <Text style={styles.refundSubtitle}>{subtitle}</Text>
                    </View>
                  </View>
                  {toWallet && !!onViewWallet && (
                    <TouchableOpacity
                      onPress={onViewWallet}
                      style={styles.refundLink}
                      testID="order-refund-view-wallet"
                    >
                      <Text style={styles.refundLinkText}>View wallet</Text>
                      <MaterialIcons name="chevron-right" size={18} color="#00B14F" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()}

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
              {/* Part (or all) of the order paid from the Tazty Wallet */}
              {Number(orderData.summary?.wallet_amount || 0) > 0 && (
                <Text style={styles.walletPaidText} testID="order-wallet-paid">
                  ₹{Number(orderData.summary.wallet_amount).toFixed(2)} paid from Tazty Wallet
                  {Number(orderData.summary.wallet_amount) < Number(orderData.summary?.total_amount || 0)
                    ? ` · ₹${(Number(orderData.summary.total_amount) - Number(orderData.summary.wallet_amount)).toFixed(2)} online`
                    : ''}
                </Text>
              )}
              {/* Cashback promised for this order, not yet in the wallet */}
              {Number(orderData.summary?.pending_cashback || 0) > 0 && (
                <Text style={styles.cashbackPendingText} testID="order-pending-cashback">
                  ₹{Number(orderData.summary.pending_cashback).toFixed(2)} cashback on the way -
                  it lands in your Tazty Wallet after delivery
                </Text>
              )}
            </View>

            {/* Need help? — support entry for this order */}
            <NeedHelpCard onPress={_onHelp} />

            {/* Sponsored slot — admin-managed order-tracking ads */}
            <SponsoredAdSlot ads={orderAds} />

            {/* Rate Tazty — pinned near the bottom */}
            <RateTaztyCard />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Full order & bill bottom sheet */}
      {orderData && (
        <OrderBillSheet
          visible={showBillSheet}
          onClose={() => setShowBillSheet(false)}
          orderData={orderData}
        />
      )}

      {/* Click outside overlay to close tooltip */}
      {showTaxTooltip && (
        <Pressable
          style={styles.tooltipOverlay}
          onPress={() => setShowTaxTooltip(false)}
        />
      )}

      {/* Tracking WebView Overlay - plain View for PiP (not Modal) */}
      {/* Rendered as a plain absolute View inside the activity window — NOT as a
          Modal / Dialog.  React Native Modals are separate Android Dialog windows
          that do not correctly track the activity's PiP window boundary during
          drag, which causes resize / layout glitches in PiP mode.
          Using an absolute View means it lives in the same view hierarchy as the
          activity and scales perfectly with the PiP window at all times.
          Back-button handling is done via BackHandler (see useEffect above). */}
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
          {/* Header — visible in normal mode only.
              Hiding it (not unmounting WebView) lets the WebView resize naturally
              without triggering a reload when entering / exiting PiP. */}
          {!isInPipMode && !showDeliveredOverlay && (
            <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
              <View style={styles.webViewHeader}>
                <TouchableOpacity
                  onPress={() => {
                    setShowDeliveredOverlay(false);
                    closeTrackingOverlay();
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
                <Text style={{ marginTop: 16, color: '#666', fontFamily: 'Poppins_400Regular' }}>
                  Loading tracking map...
                </Text>
              </View>
            )}
          </View>

          {/* PiP navigation widget — always shown in PiP; background reflects current status color */}
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

          {/* Bottom Sheet Overlay - Hide in PiP mode */}
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
              const statusConfigRaw = mapOrderStatusToUI(displayStatus);
              const statusConfig =
                statusConfigRaw ?? {
                  label: '',
                  color: '#666666',
                  bgColor: '#EEEEEE',
                  iconName: 'fiber-manual-record',
                };
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
                  // Prefer fresh API payload for delivery code; merged context can be stale.
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
                  
                  // Get status config
                  const statusConfig = mapOrderStatusToUI(displayStatus);

                  // Normalize status for helper conditions
                  const normalizedStatus = (displayStatus || '').toLowerCase().replace(/[_\s]+/g, '-');
                  const isAgentAssignedish =
                    normalizedStatus === 'agent-assigned' ||
                    normalizedStatus === 'agent-arrived-restaurant' ||
                    normalizedStatus === 'picked' ||
                    normalizedStatus === 'out-for-delivery' ||
                    normalizedStatus === 'on-the-way' ||
                    normalizedStatus === 'agent-nearby';

                  let agentDisplayName = agentName;
                  if (!agentDisplayName && isAgentAssignedish) {
                    agentDisplayName = statusConfig.label;
                  }
                  
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
                  
                  const getTimelineState = (index: number, totalItems: number) => {
                    if (isDelivered) return 'completed';
                    if (index < totalItems - 1) return 'completed';
                    return 'current';
                  };
                  
                  return (
                    <>
                      <View style={styles.trackingDivider} />
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
                                {/* Timestamp below message */}
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

      {/* Cancel Reason Modal - same flow as Help section */}
      <CancelReasonModal
        visible={showCancelReasonModal}
        orderNumber={orderData?.order_number || ''}
        cancelSecondsLeft={cancelSecondsLeft}
        onClose={() => setShowCancelReasonModal(false)}
        onSuccess={() => {
          setShowCancelReasonModal(false);
          fetchOrderDetails();
        }}
        onError={(message) => {
          showConfirmation({
            title: 'Error',
            message,
            confirmText: 'OK',
            onConfirm: () => {},
            onCancel: () => {},
          });
        }}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 88,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerStatusLine: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0.2,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  headerArrivingLine: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 19,
    letterSpacing: 0.2,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 2,
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    gap: 6,
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
  helpButtonText: {
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
  viewBillBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  viewBillText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 13.5,
    letterSpacing: 0.1,
    color: '#0A6B36',
  },
  cancelActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelGhostBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E3E7EB',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelGhostBtnText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#14181B',
  },
  cancelPrimaryBtn: {
    flex: 1,
    backgroundColor: '#00B14F',
    borderRadius: 13,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  cancelPrimaryBtnText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#FFFFFF',
  },
  inlineMapWrap: {
    height: 232,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1D2530',
    position: 'relative',
  },
  inlineMap: {
    flex: 1,
  },
  mapExpandBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,20,26,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapShareBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(15,20,26,0.82)',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  mapShareText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#FFFFFF',
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
  // ── Tip + Share-location cards ──
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 177, 79, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  actionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#001E1F',
    letterSpacing: 0.1,
    lineHeight: 21,
  },
  actionSubtitle: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 12.5,
    color: 'rgba(0, 30, 31, 0.55)',
    letterSpacing: 0.1,
    marginTop: 2,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  tipChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.4,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipChipActive: {
    borderColor: '#00B14F',
    backgroundColor: 'rgba(0, 177, 79, 0.08)',
  },
  tipChipText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#3A3A3A',
    letterSpacing: 0.2,
  },
  tipChipTextActive: {
    color: '#00B14F',
  },
  tipCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1.4,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 6,
    height: 46,
  },
  tipCustomPrefix: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#3A3A3A',
    marginRight: 4,
  },
  tipCustomInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 15,
    color: '#001E1F',
    paddingVertical: 0,
    letterSpacing: 0.2,
  },
  tipCustomBtn: {
    backgroundColor: '#00B14F',
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  tipCustomBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  tipAppliedText: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 12.5,
    color: '#00B14F',
    letterSpacing: 0.1,
    marginTop: 12,
  },
  shareLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00B14F',
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 14,
  },
  shareLocBtnDone: {
    backgroundColor: 'rgba(0, 177, 79, 0.10)',
    borderWidth: 1.4,
    borderColor: '#00B14F',
  },
  shareLocBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  shareLocBtnTextDone: {
    color: '#00B14F',
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
  walletPaidText: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#00B14F',
    marginTop: 8,
    marginLeft: 52,
  },
  cashbackPendingText: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#00B14F',
    marginTop: 6,
  },
  itemUnavailableName: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  itemUnavailableText: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#DC2626',
    marginTop: 2,
  },
  totalStruck: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  refundCard: {
    borderWidth: 1,
    borderColor: '#CDEFDC',
    backgroundColor: '#F3FFF8',
  },
  refundRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  refundTextWrap: {
    flex: 1,
  },
  refundTitle: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: 0,
    color: '#001E1F',
  },
  refundSubtitle: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#4B5563',
    marginTop: 2,
  },
  refundLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    marginLeft: 34,
  },
  refundLinkText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#00B14F',
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
    fontFamily: 'Poppins_600SemiBold',
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
    fontFamily: 'Poppins_600SemiBold',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  webViewLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  webViewLoadingText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    marginTop: 12,
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
  cancelButton: {
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonDisabled: {
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#DC2626',
  },
  cancelButtonTextDisabled: {
    color: '#9CA3AF',
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
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
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
    marginBottom: 12,
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
  trackingAgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 46, // Align with restaurant name (logo width 36 + margin 10 = 46)
    marginBottom: 0,
  },
  trackingAgentName: {
    fontFamily: 'Poppins_500Medium',
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
    fontFamily: 'Poppins_600SemiBold',
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
    fontFamily: 'Poppins_700Bold',
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
  billLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoIconWrapper: {
    position: 'relative',
  },
  tooltipOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  taxTooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    marginBottom: 8,
    marginLeft: -120,
    width: 240,
    zIndex: 1000,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  taxTooltipContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  taxTooltipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taxTooltipLabel: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  taxTooltipValue: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
  },
  taxTooltipArrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
});




