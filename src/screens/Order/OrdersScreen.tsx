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
  RefreshControl,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { ordersService, OrderListItem } from '@/services/orders.service';
import { Shimmer } from '@/components/Shimmer';
import { useOrders } from '@/context/OrdersContext';
import { mapOrderStatusToUI } from '@/utils/orderStatusMapping';
import { authService } from '@/services/auth.service';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  // Optional: orderId to highlight when navigating from notification
  highlightOrderId?: string | null;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  visible = false,
  onBack,
  onOrderDetails,
  onReorder: _onReorder, // Unused but kept for API compatibility
  onRateOrder,
  onTrackOrder,
  onHelp: _onHelp, // Unused but kept for API compatibility
  onViewMore: _onViewMore, // Unused but kept for API compatibility
  highlightOrderId,
}) => {
  // Use Orders Context for global state
  const { dispatch, getOrdersList, state } = useOrders();
  
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
    
    // Add any new context orders that aren't in local orders
    contextOrderMap.forEach((order) => {
      merged.push(order);
    });
    
    return merged;
  }, [contextOrders, localOrders, state.byId]);

  // Sync localOrders to context store after state updates
  useEffect(() => {
    if (localOrders.length > 0) {
      // Save to persisted storage
      persistedOrders = localOrders;
      // Update context
      dispatch({
        type: 'BULK_SET_ORDERS',
        payload: localOrders,
      });
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
      // Has persisted data - restore it
      // Always restore context from persisted orders when screen becomes visible
      dispatch({
        type: 'BULK_SET_ORDERS',
        payload: persistedOrders,
      });
      
      // Only update localOrders if it's empty or doesn't match persisted data
      if (localOrders.length === 0 || localOrders.length !== persistedOrders.length) {
        setLocalOrders(persistedOrders);
      }
      // Reset the restore flag when screen becomes visible with persisted data
      hasRestoredScroll.current = false;
      
      // Always try to refresh when screen becomes visible (if enough time has passed)
      // This ensures we get the latest data even if isReturning detection fails
      if (!isRequestInProgress.current) {
        const now = Date.now();
        const timeSinceLastRefresh = now - (lastRefreshTimeRef.current || 0);
        const MIN_REFRESH_INTERVAL = 1000; // 1 second
        
        // Refresh if enough time has passed (regardless of isReturning)
        if (timeSinceLastRefresh >= MIN_REFRESH_INTERVAL) {
          const refreshOrders = async () => {
            try {
              console.log('🔄 OrdersScreen: Auto-refreshing on visibility...');
              isRequestInProgress.current = true;
              lastRequestedPage.current = 0;
              
              const response = await ordersService.getOrders(5, 1);
              
              if (response.success && response.data) {
                const responseData = response.data as any;
                
                const ordersArray =
                  responseData.data ||
                  responseData.orders ||
                  (Array.isArray(responseData) ? responseData : []);

                const total =
                  responseData.total ||
                  responseData.meta?.total ||
                  responseData.data?.total ||
                  responseData.pagination?.total ||
                  responseData.metadata?.total ||
                  ordersArray.length;
                
                console.log('🔄 OrdersScreen: Auto-refresh successful, orders count:', ordersArray.length);
                
                // Update persisted data
                persistedOrders = ordersArray;
                persistedCurrentPage = 1;
                persistedTotalOrders = total;
                hasPersistedData = true;
                
                // Update local state with new array reference to trigger re-render
                setLocalOrders([...ordersArray]);
                setCurrentPage(1);
                setTotalOrders(total);
                
                // Update context
                dispatch({
                  type: 'BULK_SET_ORDERS',
                  payload: ordersArray,
                });
                
                lastRefreshTimeRef.current = now;
              }
            } catch (error) {
              console.warn('🔄 OrdersScreen: Auto-refresh failed:', error);
            } finally {
              isRequestInProgress.current = false;
            }
          };
          
          // Delay refresh slightly
          const refreshTimer = setTimeout(() => {
            refreshOrders();
          }, 500);
          
          return () => clearTimeout(refreshTimer);
        }
      }
      
      // If returning from another screen (e.g., Order Details, Rate Order), refresh orders to get new ones
      // Only refresh if it's been at least 1 second since last refresh to avoid excessive API calls
      if (isReturning && !isRequestInProgress.current) {
        const now = Date.now();
        const timeSinceLastRefresh = now - (lastRefreshTimeRef.current || 0);
        const MIN_REFRESH_INTERVAL = 1000; // 1 second (reduced for faster updates after rating)
        
        console.log('🔄 OrdersScreen: Returning detected, time since last refresh:', timeSinceLastRefresh);
        
        if (timeSinceLastRefresh >= MIN_REFRESH_INTERVAL) {
          // Refresh first page in background to get any new orders
          // Don't show loading state - just silently update
          const refreshOrders = async () => {
            try {
              console.log('🔄 OrdersScreen: Starting refresh...');
              isRequestInProgress.current = true;
              lastRequestedPage.current = 0; // Reset to allow fetching page 1
              
              const response = await ordersService.getOrders(5, 1);
              
              if (response.success && response.data) {
                // Handle different response structures (same as fetchOrders)
                const responseData = response.data as any;
                
                const ordersArray =
                  responseData.data ||
                  responseData.orders ||
                  (Array.isArray(responseData) ? responseData : []);

                const total =
                  responseData.total ||
                  responseData.meta?.total ||
                  responseData.data?.total ||
                  responseData.pagination?.total ||
                  responseData.metadata?.total ||
                  ordersArray.length;
                
                console.log('🔄 OrdersScreen: Refresh successful, orders count:', ordersArray.length);
                
                // Update persisted data
                persistedOrders = ordersArray;
                persistedCurrentPage = 1;
                persistedTotalOrders = total;
                hasPersistedData = true;
                
                // Update local state - this will trigger re-render
                setLocalOrders([...ordersArray]); // Use spread to ensure new array reference
                setCurrentPage(1);
                setTotalOrders(total);
                
                // Update context with fresh orders
                dispatch({
                  type: 'BULK_SET_ORDERS',
                  payload: ordersArray,
                });
                
                lastRefreshTimeRef.current = now;
              } else {
                console.warn('🔄 OrdersScreen: Refresh failed:', response.error);
              }
            } catch (error) {
              console.warn('🔄 OrdersScreen: Failed to refresh orders on return:', error);
            } finally {
              isRequestInProgress.current = false;
            }
          };
          
          // Delay refresh slightly to ensure smooth transition
          const refreshTimer = setTimeout(() => {
            refreshOrders();
          }, 300);
          
          return () => clearTimeout(refreshTimer);
        } else {
          console.log('🔄 OrdersScreen: Refresh skipped, too soon since last refresh');
        }
      }
    }
    return undefined;
  }, [visible, dispatch, localOrders.length, currentPage, totalOrders]);

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
          scrollViewRef.current?.scrollTo({
            y: orderIndex * 250, // Approximate height per card
            animated: true,
          });
        }, 500);
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
          setLocalOrders(ordersArray);
          persistedOrders = ordersArray;
        } else {
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
  const [selectedTrackingUrl, setSelectedTrackingUrl] = useState<string | null>(null);
  const [selectedOrderIdForTracking, setSelectedOrderIdForTracking] = useState<string | null>(null);
  const [trackingOrderData, setTrackingOrderData] = useState<any>(null);
  const [isLoadingTrackingData, setIsLoadingTrackingData] = useState(false);
  
  // Bottom sheet drag state
  const HALF_SCREEN = SCREEN_HEIGHT * 0.5;
  const DRAG_HANDLE_HEIGHT = 40; // Height of drag handle
  const TOP_SECTION_HEIGHT = 100; // Height to show restaurant info section (logo, name, status, address3)
  const CLOSED_HEIGHT = DRAG_HANDLE_HEIGHT + TOP_SECTION_HEIGHT; // Height when closed - shows drag handle + top section (140px total)
  const OPEN_HEIGHT = HALF_SCREEN;
  // Use height animation instead of translateY - CLOSED_HEIGHT = closed, OPEN_HEIGHT = open
  const bottomSheetHeight = useRef(new Animated.Value(OPEN_HEIGHT)).current; // Start open
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(true); // Start open

  const handleTrackOrder = (orderId: string, order?: OrderListItem) => {
    // Check if order has tracking_url
    const trackingUrl = (order as any)?.tracking_url || null;
    
    if (trackingUrl && trackingUrl !== null) {
      // Open WebView with tracking URL
      setSelectedTrackingUrl(trackingUrl);
      setSelectedOrderIdForTracking(orderId);
      setShowTrackingWebView(true);
      // Fetch order details for bottom sheet
      fetchTrackingOrderData(orderId);
    } else if (onTrackOrder) {
      // Fallback to parent handler if no tracking URL
      onTrackOrder(orderId);
    }
  };

  // Fetch order details for tracking bottom sheet from API
  // This gets the FULL order data (not just status from FCM)
  // This is called initially and also when FCM updates arrive to get latest full data
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

  // Handle closing the tracking WebView modal and refresh orders
  const handleCloseTrackingWebView = useCallback(() => {
    setShowTrackingWebView(false);
    setSelectedOrderIdForTracking(null);
    setTrackingOrderData(null);
    setSelectedTrackingUrl(null);
    
    // Reset bottom sheet to open state when closing modal
    bottomSheetHeight.setValue(OPEN_HEIGHT);
    setIsBottomSheetOpen(true);
    
    // Refresh orders when navigating back to My Orders page
    console.log('🔄 Tracking: Closing modal, refreshing orders...');
    fetchOrders(1, true).catch((err) => {
      console.error('Failed to refresh orders after closing tracking:', err);
    });
  }, []);
  
  // PanResponder for bottom sheet drag - on drag handle and top section when closed
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical drags
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        // Set offset to current value
        bottomSheetHeight.setOffset((bottomSheetHeight as any)._value);
        bottomSheetHeight.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const currentOffset = (bottomSheetHeight as any)._offset || 0;
        // When dragging down (positive dy), reduce height (negative change)
        // When dragging up (negative dy), increase height (positive change)
        const heightChange = -gestureState.dy;
        const newHeight = currentOffset + heightChange;
        
        // Restrict movement: can't go below CLOSED_HEIGHT or above OPEN_HEIGHT
        const minHeight = CLOSED_HEIGHT;
        const maxHeight = OPEN_HEIGHT;
        const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
        bottomSheetHeight.setValue(clampedHeight - currentOffset);
      },
      onPanResponderRelease: (_, gestureState) => {
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
    })
  ).current;

  // Subscribe to FCM updates for tracking order
  // Get the order directly from state.byId - this will update when FCM notifications arrive
  const trackingContextOrder = selectedOrderIdForTracking ? state.byId[selectedOrderIdForTracking] : undefined;
  
  // Get status and updated_at as separate values for reliable change detection
  const contextStatus = trackingContextOrder?.status;
  const contextUpdatedAt = trackingContextOrder?.updated_at;
  
  // Create a serialized key from status and updated_at to detect changes
  const contextStatusKey = `${contextStatus}-${contextUpdatedAt}`;
  
  // LOG: Track order status watching - log current status values
  useEffect(() => {
    if (!selectedOrderIdForTracking) return;
    
    console.log('📊 TRACK ORDER STATUS WATCH:', {
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
    console.log('📊 TRACK ORDER API STATUS UPDATE:', {
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
  
  // API RESPONSE WATCHER: Also watch the trackingOrderData itself for any changes
  // This ensures we catch updates from the initial API response or any subsequent API calls
  // The displayOrder will use the latest data from either FCM (trackingContextOrder) or API (trackingOrderData)


  const handleCallSupportFromCancelled = async () => {
    // Get support number from cache first, only call API if not found
    const supportDetails = await authService.getSupportDetails(false);
    const numberToCall = supportDetails.support_number;
    
    if (!numberToCall) return;
    const telUrl = `tel:${numberToCall.replace(/\s+/g, '')}`;
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
    // Check if this order should be highlighted (by id or order_number)
    const isHighlighted = highlightOrderId === order.id.toString() || highlightOrderId === order.order_number;

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
                // Track Order is enabled ONLY for: picked, out-for-delivery, on-the-way, delivered
                // Disabled for: confirmed (order placed), billed (order accepted), packed (order ready), agent-assigned
                const rawStatus = (order.status || '').toString().toLowerCase();
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
                // Note: tracking_url override removed - status must be enabled
                const isTrackingEnabled = !isExplicitlyDisabled && enabledStatuses.includes(normalizedStatus);
                
                return (
                  <TouchableOpacity
                    style={[
                      styles.reorderButton,
                      !isTrackingEnabled && styles.disabledButton
                    ]}
                    onPress={() => handleTrackOrder(order.id.toString(), order)}
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
        onRequestClose={() => {
          handleCloseTrackingWebView();
        }}
      >
        <View style={styles.webViewModalContainer}>
          <SafeAreaView style={styles.webViewContainer} edges={['top']}>
            <View style={styles.webViewHeader}>
              <TouchableOpacity
                onPress={() => {
                  handleCloseTrackingWebView();
                }}
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
              {...(isBottomSheetOpen ? panResponder.panHandlers : {})}
            >
              <View style={styles.trackingDragHandleBar} />
            </View>
            
            {/* Top Section: Always visible (restaurant info, status, address3) - draggable when closed */}
            {trackingOrderData && !isLoadingTrackingData && (() => {
              const displayOrder = trackingContextOrder || trackingOrderData;
              const displayStatus = displayOrder?.status;
              const statusConfig = mapOrderStatusToUI(displayStatus);
              
              return (
                <View 
                  style={styles.trackingTopSection}
                  {...(!isBottomSheetOpen ? panResponder.panHandlers : {})}
                >
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
                scrollEnabled={true}
                nestedScrollEnabled={true}
                bounces={false}
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
                      {/* Items List - Commented out per requirements */}
                      {/* {displayOrder.items && displayOrder.items.length > 0 && (
                        <View style={styles.trackingItemsContainer}>
                          {displayOrder.items.map((item: any, index: number) => (
                            <Text key={index} style={styles.trackingItemText}>
                              {item.quantity || 1}× {item.item_name || 'Item'}
                            </Text>
                          ))}
                        </View>
                      )} */}
                      
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
              </>
            )}
            
          </Animated.View>
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
  webViewModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    elevation: 15, // Android shadow
  },
  trackingDragHandleContainer: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 10,
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
    paddingBottom: 16,
    marginBottom: 6,
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
