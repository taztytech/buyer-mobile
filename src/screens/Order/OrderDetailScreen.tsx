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
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import TrackingWebView from '@/components/TrackingWebView';
import { OrderRouteMapView } from '@/components/OrderRouteMapView';
import OrderDeliveredOverlay from '@/components/OrderDeliveredOverlay';
import { ordersService } from '@/services/orders.service';
import { authService } from '@/services/auth.service';
import { useOrders } from '@/context/OrdersContext';
import { mapOrderStatusToUI, getFallbackTimelineForStatus } from '@/utils/orderStatusMapping';
import { exotelService } from '@/services/exotel.service';
import { useConfirmation } from '@/context/ConfirmationContext';
import { useAndroidPip } from '@/hooks/useAndroidPip';
import { extractRestaurantCoordinate, extractCustomerCoordinate } from './orderTrackingLocationUtils';

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
  const lastFetchedStatusRef = useRef<string | null>(null);
  const [showTaxTooltip, setShowTaxTooltip] = useState(false);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [isClosingTracking, setIsClosingTracking] = useState(false);
  const [showDeliveredOverlay, setShowDeliveredOverlay] = useState(false);
  const webViewLoadedRef = useRef<boolean>(false);
  const webViewRef = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);

  const effectiveTrackingUrl = useMemo(
    () => {
      if (!showTrackingWebView) return null;
      const data = trackingOrderData || orderData;
      if (!data) return null;
      if (data.tracking_url) return String(data.tracking_url);
      const history = data.tracking;
      if (Array.isArray(history) && history.length > 0) {
        const lastWithUrl = [...history].reverse().find((e: any) => e?.tracking_url);
        if (lastWithUrl?.tracking_url) return String(lastWithUrl.tracking_url);
      }
      return null;
    },
    [showTrackingWebView, trackingOrderData, orderData],
  );

  const fallbackMapCoords = useMemo(() => {
    const sourceOrder = trackingOrderData || orderData;
    if (!sourceOrder) return null;

    const hasTrackingUrl =
      !!sourceOrder.tracking_url ||
      (Array.isArray(sourceOrder.tracking) &&
        sourceOrder.tracking.some((entry: any) => !!entry?.tracking_url));
    if (hasTrackingUrl) return null;

    const restaurantCoordinate = extractRestaurantCoordinate(sourceOrder);
    const customerCoordinate = extractCustomerCoordinate(sourceOrder);

    if (!restaurantCoordinate || !customerCoordinate) return null;

    const restaurantName =
      sourceOrder.restaurant?.name?.trim() || 'Restaurant';
    const addr = sourceOrder.delivery_address;
    const customerAddress = [addr?.address1, addr?.address2, addr?.address3, addr?.city]
      .filter(Boolean)
      .map((s: any) => String(s).trim())
      .join(', ') || 'Delivery location';

    return { restaurantCoordinate, customerCoordinate, restaurantName, customerAddress };
  }, [trackingOrderData, orderData]);

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
    if (!webViewRef.current || typeof webViewRef.current.injectJavaScript !== 'function') {
      return;
    }
    try {
      webViewRef.current.injectJavaScript(`
        (function() {
          try {
            if (typeof window.__taztyFixTrackingLayout === 'function') {
              window.__taztyFixTrackingLayout();
            } else {
              var evt = new Event('resize');
              window.dispatchEvent(evt);
            }
          } catch (e) {}
        })();
        true;
      `);
    } catch (e) {
      console.warn('[OrderDetailScreen] Failed to inject resize script into tracking WebView', e);
    }
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
        const displayOrder = ctxOrder || trackingOrderData;
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

  // (Tracking URL derivation is handled by effectiveTrackingUrl above.)
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

  // When order reaches terminal status in PiP: show "Delivered" overlay for delivered/completed, or close for cancelled
  useEffect(() => {
    if (!showTrackingWebView || !isInPipMode) return;

    const displayOrder = trackingContextOrder || trackingOrderData;
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
    trackingContextOrder?.status,
    trackingOrderData?.status,
    closeTrackingOverlay,
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
    console.log('displayOrder userPhone', userPhone, 'displayOrder agentPhoneClean', agentPhoneClean);
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
        <View style={styles.headerButtons}>
          {_onHelp && (
            <TouchableOpacity
              style={styles.helpButton}
              onPress={_onHelp}
              activeOpacity={0.7}
            >
              <MaterialIcons name="help-outline" size={20} color="#FFFFFF" />
              <Text style={styles.helpButtonText}>Help</Text>
            </TouchableOpacity>
          )}
          {/* <TouchableOpacity
            style={styles.chatButton}
            onPress={handleCallSupport}
            activeOpacity={0.7}
          >
            <MaterialIcons name="phone" size={20} color="#FFFFFF" />
            <Text style={styles.chatButtonText}>Support</Text>
          </TouchableOpacity> */}
        </View>
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

                            setSelectedOrderIdForTracking(orderId);
                            setTrackingOrderData((prev: any) => prev ?? orderData);
                            setShowTrackingWebView(true);
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
            backgroundColor: '#000000',
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

          {/* ── Single WebView (memoized) ─────────────────────────────────────────
              TrackingWebView is wrapped in React.memo with stable prop references.
              It will NOT re-render when isInPipMode, bottom-sheet, or any other
              parent state changes — eliminating the lag on PiP ↔ normal transitions.
              effectiveTrackingUrl is a useMemo at component level; it only changes
              when the order's tracking URL actually changes.
          ──────────────────────────────────────────────────────────────────── */}
          <View style={{ flex: 1, backgroundColor: '#000000' }}>
            {effectiveTrackingUrl ? (
              <TrackingWebView
                trackingUrl={effectiveTrackingUrl}
                webViewRef={webViewRef}
                webViewLoadedRef={webViewLoadedRef}
              />
            ) : fallbackMapCoords ? (
              <OrderRouteMapView
                restaurantCoordinate={fallbackMapCoords.restaurantCoordinate}
                customerCoordinate={fallbackMapCoords.customerCoordinate}
                restaurantName={fallbackMapCoords.restaurantName}
                customerAddress={fallbackMapCoords.customerAddress}
                resizeTrigger={isInPipMode}
                style={styles.webView}
              />
            ) : (
              <View style={isInPipMode ? styles.webViewLoadingContainerPip : styles.webViewLoadingContainer}>
                <ActivityIndicator size="large" color="#00B14F" />
                <Text style={{ marginTop: 16, color: isInPipMode ? '#FFFFFF' : '#666', fontFamily: 'Poppins_400Regular' }}>
                  Loading tracking map...
                </Text>
              </View>
            )}
          </View>

          {/* PiP navigation widget — always shown in PiP; background reflects current status color */}
          {isInPipMode && trackingOrderData && (() => {
            const pipDisplayOrder = trackingContextOrder || trackingOrderData;
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
              const orderForFullDetails = trackingOrderData || trackingContextOrder;
              const displayOrder = trackingContextOrder || trackingOrderData;
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
                  const orderForFullDetails = trackingOrderData || trackingContextOrder;
                  const displayOrder = trackingContextOrder || trackingOrderData;
                  const displayStatus = displayOrder?.status;
                  const trackingArray = orderForFullDetails?.tracking ?? [];
                  let agentName: string | null = null;
                  let agentPhone: string | null = null;
                  for (let i = trackingArray.length - 1; i >= 0; i--) {
                    const trackingEntry = trackingArray[i];
                    if (trackingEntry) {
                      if (trackingEntry.agent_name) {
                        agentName = trackingEntry.agent_name;
                        agentPhone = trackingEntry.agent_phone || null;
                        break;
                      }
                      if (trackingEntry.agent_phone && !agentName) {
                        agentName = null;
                        agentPhone = trackingEntry.agent_phone;
                      }
                    }
                  }
                  const sortedApiTracking = [...trackingArray].sort((a: any, b: any) =>
                    new Date(a.timestamp || a.created_at || 0).getTime() - new Date(b.timestamp || b.created_at || 0).getTime()
                  );
                  const timelineEntries = sortedApiTracking.length > 0 ? sortedApiTracking : getFallbackTimelineForStatus(displayStatus);
                  
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
                    normalizedStatus === 'on-the-way';

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
                          {agentDisplayName && agentName && (
                            <View style={styles.trackingAgentTag}>
                              <Text style={styles.trackingAgentTagText}>Delivery Partner</Text>
                            </View>
                          )}
                        </View>
                        {agentPhone && (
                          <TouchableOpacity
                            style={styles.trackingCallButtonInScroll}
                            onPress={() => handleCallDeliveryAgent((orderForFullDetails || displayOrder)?.order_number, agentPhone)}
                            disabled={isInitiatingCall}
                            activeOpacity={0.7}
                          >
                            {isInitiatingCall ? (
                              <ActivityIndicator size="small" color="#00B14F" />
                            ) : (
                              <MaterialIcons name="phone" size={18} color="#00B14F" />
                            )}
                          </TouchableOpacity>
                        )}
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
    backgroundColor: '#000000',
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
  trackingAgentTag: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 177, 79, 0.08)',
  },
  trackingAgentTagText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    lineHeight: 16,
    color: '#00B14F',
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




