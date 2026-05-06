import React, { useCallback } from 'react';
import { View, StyleSheet, Animated, Dimensions, BackHandler, Easing, Text, AppState, InteractionManager, Platform, Linking } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoginScreen } from '@/screens/Auth/LoginScreen';
import { OTPVerificationScreen } from '@/screens/Auth/OTPVerificationScreen';
import { WelcomeScreen } from '@/screens/Auth/WelcomeScreen';
import { HomeScreen } from '@/screens/Home/HomeScreen';
import { ProfileScreen } from '@/screens/Profile/ProfileScreen';
import { EditProfileScreen } from '@/screens/Profile/EditProfileScreen';
import { OrdersScreen, resetOrdersPersistence } from '@/screens/Order/OrdersScreen';
import { OrderDetailScreen } from '@/screens/Order/OrderDetailScreen';
import { RateOrderScreen } from '@/screens/Order/RateOrderScreen';
import { OrderTrackingScreen } from '@/screens/Order/OrderTrackingScreen';
import { SearchScreen } from '@/screens/Search/SearchScreen';
import { AddressSelectionScreen } from '@/screens/Location/AddressSelectionScreen';
import { LocationSelectionScreen } from '@/screens/Location/LocationSelectionScreen';
import { MyAddressesScreen } from '@/screens/Location/MyAddressesScreen';
import { addressService } from '@/services/address.service';
import { CategoryResultsScreen } from '@/screens/Category/CategoryResultsScreen';
import { RestaurantScreen } from '@/screens/Restaurant/RestaurantScreen';
import { RestaurantDetailsScreen } from '@/screens/Restaurant/RestaurantDetailsScreen';
import { OrderDetailsScreen } from '@/screens/Order/OrderDetailsScreen';
import { ExploreDishesScreen } from '@/screens/Favorites/ExploreDishesScreen';
import { PopularDishesScreen } from '@/screens/PopularDishes/PopularDishesScreen';
import { ContentPage } from '@/screens/Legal/ContentPage';
import { HelpScreen } from '@/screens/Help/HelpScreen';
import { ContactUsScreen } from '@/screens/Help/ContactUsScreen';
import { ChatScreen } from '@/screens/Help/ChatScreen';
import * as SplashScreen from '@/shims/rn-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authService } from '@/services/auth.service';
import { apiService } from '@/services/api.service';
import { storageService, GUEST_SELECTED_LOCATION_KEY } from '@/services/storage.service';
import { homeService } from '@/services/home.service';
import { CartProvider, useCart } from '@/context/CartContext';
import { VegModeProvider } from '@/context/VegModeContext';
import { ConfirmationProvider, useConfirmation } from '@/context/ConfirmationContext';
import { SnackbarProvider } from '@/context/SnackbarContext';
import { OrdersProvider, useOrders } from '@/context/OrdersContext';
import { ordersService, OrderListItem } from '@/services/orders.service';
import { SearchSuggestion } from '@/services/search.service';
import CustomSplashScreen from '@/components/CustomSplashScreen';
import { fcmNotificationService } from '@/services/fcmNotification.service';
import { NetworkStatusScreen } from '@/components/NetworkStatusScreen';
import { analyticsService, AnalyticsEvents, AnalyticsScreens, AnalyticsUserProperties } from '@/services/analytics.service';
import { inAppUpdateService } from '@/services/inAppUpdate.service';
import { crashlyticsService } from '@/services/crashlytics.service';
import { ForcedUpdateModal } from '@/components/ForcedUpdateModal';
import { APP_VERSION_NAME } from '@/config/appVersion.generated';
// import { initMeta } from '@/analytics/metaInit';
// import { trackCheckout, trackViewRestaurant } from '@/analytics/metaEvents';

// Cold start can report window width 0; overlay slides use translateX(SCREEN_WIDTH) for "off screen".
// If SCREEN_WIDTH is 0, every overlay sits at translateX 0 and full-screen white layers (e.g. help) hide the app.
const _initialWindowW = Dimensions.get('window').width;
const _initialScreenW = Dimensions.get('screen').width;
const SCREEN_WIDTH =
  _initialWindowW > 0 ? _initialWindowW : _initialScreenW > 0 ? _initialScreenW : 375;
// Let native splash auto-hide immediately - don't prevent it
// SplashScreen.preventAutoHideAsync();

// Inner component with cart and confirmation context access
type RestaurantAnalyticsMeta = {
  distanceKm?: number;
  isOpen?: boolean;
  itemCount?: number;
  targetItemId?: string;
  targetItemName?: string;
};

function AppContent({ onNotificationNavigateToOrders }: { onNotificationNavigateToOrders?: () => void }) {
  const {
    addToCart,
    setRestaurantInfo,
    checkRestaurantConflict,
    clearCart,
    reloadCart,
    getTotalItems,
    getTotalPrice,
    cartSummary,
    restaurantId: cartRestaurantId,
    restaurantName: cartRestaurantName,
  } = useCart();
  const { showConfirmation } = useConfirmation();

  // Default to login so we never flash location overlays before auth resolves; logged-in startup sets home/orders explicitly.
  const [currentScreen, setCurrentScreenState] = React.useState<'login' | 'otp' | 'welcome' | 'home' | 'profile' | 'editProfile' | 'orders' | 'orderDetail' | 'rateOrder' | 'orderTracking' | 'search' | 'myAddresses' | 'addressSelection' | 'locationSelection' | 'categoryResults' | 'restaurant' | 'restaurantDetails' | 'exploreDishes' | 'popularDishes' | 'checkout' | 'privacyPolicy' | 'termsConditions' | 'help' | 'contactUs' | 'faq' | 'orderHelp' | 'chat'>('login');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<SearchSuggestion[]>([]);
  const [locationSearchQuery, setLocationSearchQuery] = React.useState('');
  const [forcedUpdateRequired, setForcedUpdateRequired] = React.useState(false);
  const [forcedUpdateMessage, setForcedUpdateMessage] = React.useState<string | undefined>(undefined);
  const [selectedLocation, setSelectedLocation] = React.useState<{
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
    type?: 'home' | 'work' | 'other';
  } | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = React.useState('Briyani');
  const [selectedPopularCollectionId, setSelectedPopularCollectionId] = React.useState<number | undefined>(undefined);
  const [categoryData, setCategoryData] = React.useState<any[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = React.useState<number>(1);
  const [selectedRestaurantName, setSelectedRestaurantName] = React.useState('');
  const [selectedRestaurantAddress, setSelectedRestaurantAddress] = React.useState<string>('');
  const [targetRestaurantItemId, setTargetRestaurantItemId] = React.useState<string | undefined>(undefined);
  const [targetRestaurantItemName, setTargetRestaurantItemName] = React.useState<string | undefined>(undefined);
  const [restaurantCameFrom, setRestaurantCameFrom] = React.useState<'home' | 'category' | 'search' | 'favorites' | 'orders' | 'checkout'>('home');
  const [checkoutCameFrom, setCheckoutCameFrom] = React.useState<'restaurant' | 'home' | 'orders'>('restaurant');
  const [hasCheckoutMounted, setHasCheckoutMounted] = React.useState(false);
  const [hasSearchMounted, setHasSearchMounted] = React.useState(false);
  const [categoryCameFrom, setCategoryCameFrom] = React.useState<'home' | 'search' | 'favorites'>('home');
  const [selectedOrderId, setSelectedOrderId] = React.useState<string>('');
  const [selectedOrderData, setSelectedOrderData] = React.useState<any>(null);
  const [highlightOrderId, setHighlightOrderId] = React.useState<string | null>(null);
  const [addressSelectionCameFrom, setAddressSelectionCameFrom] = React.useState<'home' | 'myAddresses' | 'registration'>('home');
  const [locationSelectionCameFrom, setLocationSelectionCameFrom] = React.useState<'home' | 'addressSelection' | 'myAddresses'>('home');
  const [orderTrackingCameFrom, setOrderTrackingCameFrom] = React.useState<'orders' | 'checkout' | 'orderDetail'>('orders');
  const [ordersCameFrom, setOrdersCameFrom] = React.useState<'profile' | 'orderDetail' | 'notification'>('profile');
  const [orderDetailCameFrom, setOrderDetailCameFrom] = React.useState<'orders' | 'checkout'>('orders');
  const [editingAddress, setEditingAddress] = React.useState<any>(null);
  const [helpOrderData, setHelpOrderData] = React.useState<OrderListItem | null>(null);
  const [_isRegistrationFlow, setIsRegistrationFlow] = React.useState(false);
  const [initialLocationCoords, setInitialLocationCoords] = React.useState<{ latitude?: number; longitude?: number } | null>(null);
  const [legalCameFrom, setLegalCameFrom] = React.useState<'profile' | 'login' | 'otp'>('profile');
  const [addressRefreshTrigger, setAddressRefreshTrigger] = React.useState(0);
  const [pendingHomeRefresh, setPendingHomeRefresh] = React.useState(false);
  const [isNetworkOnline, setIsNetworkOnline] = React.useState(true);
  const lastConnectionStatusRef = React.useRef<boolean | null>(null);
  const screenTransitionStartRef = React.useRef<number>(Date.now());
  const startupNotificationNavigationRef = React.useRef(false);
  const sessionStartTimeRef = React.useRef<number | null>(null);
  const isAuthenticatedRef = React.useRef(false);
  const pendingDeepLinkUrlRef = React.useRef<string | null>(null);
  const currentScreenRef = React.useRef(currentScreen);

  /** Only update via this helper — do not mirror `currentScreen` every render (concurrent renders could briefly restore a stale route ref). */
  const navigateToScreen = React.useCallback((next: typeof currentScreen) => {
    currentScreenRef.current = next;
    setCurrentScreenState(next);
  }, []);
  const isRestaurantBackTransitioningRef = React.useRef(false);
  const isHandlingAndroidBackRef = React.useRef(false);
  const lastAndroidBackPressAtRef = React.useRef(0);

  const normalizeOrderStatus = React.useCallback((status: unknown): string => {
    return String(status || '')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');
  }, []);

  const extractOrdersArray = React.useCallback((payload: unknown): any[] => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    const candidate = payload as Record<string, any>;
    const containers = [
      candidate.orders,
      candidate.data?.orders,
      candidate.items,
      candidate.results,
      candidate.list,
    ];
    for (const container of containers) {
      if (Array.isArray(container)) {
        return container;
      }
    }
    return [];
  }, []);

  const toFixedStringOrNull = React.useCallback((value: unknown): string | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value.toFixed(6);
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed.toFixed(6);
    }
    return null;
  }, []);

  const buildProfileUserProperties = React.useCallback((profile: any) => {
    const city = String(
      profile?.city ||
      profile?.address?.city ||
      profile?.default_address?.city ||
      '',
    ).toLowerCase();
    const pincode = String(
      profile?.pincode ||
      profile?.zip_code ||
      profile?.postal_code ||
      profile?.address?.pincode ||
      profile?.default_address?.pincode ||
      '',
    );
    const areaName = String(
      profile?.area_name ||
      profile?.area ||
      profile?.locality ||
      profile?.address?.area_name ||
      profile?.default_address?.area_name ||
      '',
    ).toLowerCase();

    const latitude = toFixedStringOrNull(
      profile?.latitude ??
      profile?.lat ??
      profile?.address?.latitude ??
      profile?.address?.lat ??
      profile?.default_address?.latitude ??
      profile?.default_address?.lat,
    );
    const longitude = toFixedStringOrNull(
      profile?.longitude ??
      profile?.lng ??
      profile?.long ??
      profile?.address?.longitude ??
      profile?.address?.lng ??
      profile?.default_address?.longitude ??
      profile?.default_address?.lng,
    );

    return {
      city: city || null,
      pincode: pincode || null,
      areaName: areaName || null,
      latitude,
      longitude,
    };
  }, [toFixedStringOrNull]);

  const mergeProfileWithSelectedLocation = React.useCallback((
    profileProps: {
      city: string | null;
      pincode: string | null;
      areaName: string | null;
      latitude: string | null;
      longitude: string | null;
    },
    location: any,
  ) => {
    const fallbackCity = String(location?.city || '').toLowerCase() || null;
    const fallbackPincode = String(location?.pincode || '') || null;
    const fallbackAreaName = String(
      location?.address3 ||
      location?.area_name ||
      location?.locality ||
      location?.name ||
      '',
    ).toLowerCase() || null;
    const fallbackLatitude = toFixedStringOrNull(location?.latitude ?? location?.lat);
    const fallbackLongitude = toFixedStringOrNull(location?.longitude ?? location?.lng);

    return {
      city: profileProps.city || fallbackCity,
      pincode: profileProps.pincode || fallbackPincode,
      areaName: profileProps.areaName || fallbackAreaName,
      latitude: profileProps.latitude || fallbackLatitude,
      longitude: profileProps.longitude || fallbackLongitude,
    };
  }, [toFixedStringOrNull]);

  const hydrateCurrentUserForAnalytics = React.useCallback(async () => {
    let user = await authService.getCurrentUser();
    if (user?.id) {
      return user;
    }

    try {
      const profileResponse = await authService.getProfile();
      if (profileResponse.success) {
        user = await authService.getCurrentUser();
      }
    } catch (error) {
      console.warn('[Analytics] Failed to hydrate current user before setting properties:', error);
    }

    return user;
  }, []);

  const resolveUserTypeWithOrderHistory = React.useCallback(async (currentUser: any): Promise<'new' | 'returning'> => {
    const persistedUserType = currentUser?.user_type === 'returning' ? 'returning' : 'new';
    if (persistedUserType === 'returning') {
      return 'returning';
    }

    try {
      const deliveredOnlyResponse = await ordersService.getOrders(30, 1, 'delivered');
      if (deliveredOnlyResponse.success) {
        const deliveredOrders = extractOrdersArray(deliveredOnlyResponse.data);
        if (deliveredOrders.length > 0) {
          return 'returning';
        }
      }

      const fallbackResponse = await ordersService.getOrders(30, 1);
      if (fallbackResponse.success) {
        const allOrders = extractOrdersArray(fallbackResponse.data);
        const hasDelivered = allOrders.some((order: any) => {
          const normalizedStatus = normalizeOrderStatus(order?.status || order?.order_status);
          return normalizedStatus === 'delivered' || normalizedStatus === 'completed';
        });
        if (hasDelivered) {
          return 'returning';
        }
      }
    } catch (error) {
      console.warn('[Analytics] Failed to resolve user_type from order history:', error);
    }

    return persistedUserType;
  }, [extractOrdersArray, normalizeOrderStatus]);

  const loadPersistedGuestLocation = React.useCallback(async () => {
    try {
      const savedLocationStr = await AsyncStorage.getItem(GUEST_SELECTED_LOCATION_KEY);
      if (!savedLocationStr) return null;
      const parsed = JSON.parse(savedLocationStr);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.name || !parsed.address) return null;
      const savedType = parsed.type as string | undefined;
      const validType = savedType && ['home', 'work', 'other'].includes(savedType) ? savedType as 'home' | 'work' | 'other' : undefined;
      return {
        name: String(parsed.name),
        address: String(parsed.address),
        latitude: typeof parsed.latitude === 'number' ? parsed.latitude : undefined,
        longitude: typeof parsed.longitude === 'number' ? parsed.longitude : undefined,
        type: validType,
      };
    } catch {
      return null;
    }
  }, []);

  const saveGuestLocation = React.useCallback(async (location: {
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
    type?: 'home' | 'work' | 'other';
    city?: string;
    pincode?: string;
    address1?: string;
    address2?: string;
    address3?: string;
    state?: string;
    /** When true, location is already on the account (e.g. after logout); skip POST on next login. */
    guestLocationSynced?: boolean;
  }) => {
    try {
      await AsyncStorage.setItem(GUEST_SELECTED_LOCATION_KEY, JSON.stringify(location));
    } catch {
      // Non-critical: guest location persistence failure should not block UX.
    }
  }, []);

  const homeScreenSlide = React.useRef(new Animated.Value(0)).current;
  const profileScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const searchScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const privacyPolicyScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const termsConditionsScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const addressScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const locationScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const ordersScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const orderDetailScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const helpScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const contactUsScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const faqScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const restaurantScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const checkoutScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  // Chat screen state
  const [chatHelpOptionId] = React.useState<string>('');
  const [chatHelpOptionTitle] = React.useState<string>('');

  const handleDeepLinkNavigation = React.useCallback((incomingUrl: string): boolean => {
    try {
      const normalizedUrl = (incomingUrl || '').trim();
      const match = normalizedUrl.match(/^https?:\/\/([^/]+)(\/[^?#]*)?/i);
      if (!match) {
        return false;
      }

      const host = (match[1] || '').toLowerCase();
      const path = (match[2] || '/').toLowerCase();
      const isOwnedHost = host === 'in.tazty.buyer' || host === 'www.in.tazty.buyer';
      const isRazorpayRouter = host === 'pg-router.dev.razorpay.in';

      if (!isOwnedHost && !isRazorpayRouter) {
        return false;
      }

      // Razorpay router links are part of payment return flows.
      // Keep user on checkout if possible; otherwise route to home/login safely.
      if (isRazorpayRouter) {
        if (isAuthenticatedRef.current) {
          if (currentScreen !== 'checkout') {
            navigateToScreen('home');
          }
        } else {
          navigateToScreen('login');
        }
        return true;
      }

      if (!isAuthenticatedRef.current) {
        navigateToScreen('login');
        return true;
      }

      const isOrderPath =
        path.includes('/orders') ||
        path.includes('/my-orders') ||
        path.includes('/order');

      if (isOrderPath) {
        setOrdersCameFrom('notification');
        navigateToScreen('orders');
        return true;
      }

      // Default route for other supported app links.
      navigateToScreen('home');
      return true;
    } catch (error) {
      console.warn('⚠️ Failed to parse deep link URL:', incomingUrl, error);
      return false;
    }
  }, [currentScreen]);

  // Keep only global text padding; do not force fontFamily here.
  // Forcing a global fontFamily can override icon fonts (e.g. MaterialIcons)
  // and cause missing glyphs.
  React.useEffect(() => {
    if (!(Text as any).defaultProps) {
      (Text as any).defaultProps = {};
    }
    (Text as any).defaultProps.style = {
      ...(Text as any).defaultProps.style,
      paddingRight: 2,
    };
  }, []);

  // Network connectivity listener - runs while app is open
  // Optimized: Only updates state when connection status actually changes
  // Fix: Get initial state immediately from first listener callback to avoid showing offline screen incorrectly
  React.useEffect(() => {
    let isFirstUpdate = true;
    let hasReceivedInitialState = false;

    // Set up listener for network state changes
    // The listener fires immediately with current state, so we use that for initial state
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = (state.isInternetReachable ?? state.isConnected) ?? false;
      const previous = lastConnectionStatusRef.current;

      // On first update, always set the state (this is the initial state)
      if (isFirstUpdate) {
        isFirstUpdate = false;
        hasReceivedInitialState = true;
        lastConnectionStatusRef.current = connected;
        setIsNetworkOnline(connected);
        console.log('[App] Initial network state:', connected ? 'online' : 'offline');
        return;
      }

      // Skip update if status hasn't changed (prevents unnecessary re-renders)
      if (previous === connected) {
        return;
      }

      lastConnectionStatusRef.current = connected;
      // Only update state when connection status actually changes
      setIsNetworkOnline(connected);
    });

    // Fallback: If listener doesn't fire within 500ms, default to online
    // This prevents showing offline screen incorrectly for new users
    const fallbackTimer = setTimeout(() => {
      if (!hasReceivedInitialState) {
        console.warn('[App] Network listener did not fire within timeout, defaulting to online');
        lastConnectionStatusRef.current = true;
        setIsNetworkOnline(true);
      }
    }, 500);

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  // Get orders dispatch from context
  const { dispatch: ordersDispatch, getOrderByOrderNumber } = useOrders();

  // Track screen views
  React.useEffect(() => {
    if (isCheckingAuth) return;

    const screenNameMap: Record<typeof currentScreen, string> = {
      login: AnalyticsScreens.LOGIN,
      otp: AnalyticsScreens.OTP_VERIFICATION,
      welcome: AnalyticsScreens.WELCOME,
      home: AnalyticsScreens.HOME,
      profile: AnalyticsScreens.PROFILE,
      editProfile: AnalyticsScreens.EDIT_PROFILE,
      orders: AnalyticsScreens.ORDERS,
      orderDetail: AnalyticsScreens.ORDER_DETAIL,
      rateOrder: AnalyticsScreens.RATE_ORDER,
      orderTracking: AnalyticsScreens.ORDER_TRACKING,
      search: AnalyticsScreens.SEARCH,
      myAddresses: AnalyticsScreens.MY_ADDRESSES,
      addressSelection: AnalyticsScreens.ADDRESS_SELECTION,
      locationSelection: AnalyticsScreens.LOCATION_SELECTION,
      categoryResults: AnalyticsScreens.CATEGORY_RESULTS,
      restaurant: AnalyticsScreens.RESTAURANT,
      restaurantDetails: AnalyticsScreens.RESTAURANT_DETAILS,
      exploreDishes: AnalyticsScreens.EXPLORE_DISHES,
      popularDishes: 'Popular Dishes',
      checkout: AnalyticsScreens.CHECKOUT,
      privacyPolicy: AnalyticsScreens.PRIVACY_POLICY,
      termsConditions: AnalyticsScreens.TERMS_CONDITIONS,
      help: AnalyticsScreens.HELP,
      contactUs: AnalyticsScreens.CONTACT_US,
      faq: AnalyticsScreens.FAQ,
      orderHelp: 'Order Help',
      chat: 'Chat',
    };

    const screenName = screenNameMap[currentScreen];
    if (screenName) {
      analyticsService.logScreenView(screenName);
    }
    if (currentScreen === 'login') {
      analyticsService.logEvent(AnalyticsEvents.LOGIN_VIEW, { method: 'otp' });
    }
  }, [currentScreen, isCheckingAuth]);

  React.useEffect(() => {
    const criticalScreenAttributeMap: Partial<Record<typeof currentScreen, string>> = {
      checkout: 'checkout',
      orderTracking: 'order_status',
      orderDetail: 'order_status',
      orders: 'order_status',
    };
    const crashScreen = criticalScreenAttributeMap[currentScreen];
    if (crashScreen) {
      crashlyticsService.setAttribute('current_screen', crashScreen);
    }
  }, [currentScreen]);

  // Set up FCM handlers for order notifications
  React.useEffect(() => {
    // Set orders dispatch in FCM service
    fcmNotificationService.setOrdersDispatch(ordersDispatch);

    // Set order lookup function for FCM handler (to find orders by order_number)
    const { setOrderLookupFunction } = require('@/services/orderNotificationHandler');
    setOrderLookupFunction(getOrderByOrderNumber);

    // Set navigation callback to handle notification taps
    // Route all notification taps to My Orders.
    fcmNotificationService.setNavigationCallback(({ orderId }) => {
      startupNotificationNavigationRef.current = true;
      console.log('📱 FCM: Notification tapped, navigating to My Orders:', orderId);
      onNotificationNavigateToOrders?.();
      // Force fresh fetch when arriving from notification tap.
      resetOrdersPersistence();

      // Force-close all overlays so notification navigation wins from any screen.
      homeScreenSlide.setValue(0);
      ordersScreenSlide.setValue(0);
      profileScreenSlide.setValue(SCREEN_WIDTH);
      searchScreenSlide.setValue(SCREEN_WIDTH);
      privacyPolicyScreenSlide.setValue(SCREEN_WIDTH);
      termsConditionsScreenSlide.setValue(SCREEN_WIDTH);
      addressScreenSlide.setValue(SCREEN_WIDTH);
      locationScreenSlide.setValue(SCREEN_WIDTH);
      orderDetailScreenSlide.setValue(SCREEN_WIDTH);
      helpScreenSlide.setValue(SCREEN_WIDTH);
      contactUsScreenSlide.setValue(SCREEN_WIDTH);
      faqScreenSlide.setValue(SCREEN_WIDTH);
      restaurantScreenSlide.setValue(SCREEN_WIDTH);
      checkoutScreenSlide.setValue(SCREEN_WIDTH);
      setEditingAddress(null);
      setSelectedOrderData(null);

      // Keep existing back behavior: Orders -> Profile for notification entry.
      setOrdersCameFrom('notification');
      setHighlightOrderId(orderId || null);
      navigateToScreen('orders');

      // Clear highlight after 3 seconds (enough time for scroll animation)
      setTimeout(() => {
        setHighlightOrderId(null);
      }, 3000);
    });

    // Cleanup callbacks on unmount
    return () => {
      fcmNotificationService.setNavigationCallback(null);
      fcmNotificationService.setOrdersDispatch(null);
    };
  }, [ordersDispatch, getOrderByOrderNumber, onNotificationNavigateToOrders]);

  // Handle app state changes to check for notifications when app becomes active
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Check if app was opened from notification when it becomes active
        fcmNotificationService.checkInitialNotification().catch((error) => {
          console.warn('⚠️  Failed to check initial notification:', error);
        });

        // Check for app updates when app becomes active (but not on checkout)
        if (currentScreen !== 'checkout') {
          inAppUpdateService.checkForUpdate({ currentScreen }).catch((error) => {
            console.error('In-app update check error:', error);
          });
        }

        // Track app foreground
        analyticsService.logEvent(AnalyticsEvents.APP_STATE, { state: 'foreground' });
      } else if (nextAppState === 'background') {
        // Track app background
        analyticsService.logEvent(AnalyticsEvents.APP_STATE, { state: 'background' });
        if (isAuthenticatedRef.current) {
          const durationSec = sessionStartTimeRef.current
            ? Math.max(0, Math.round((Date.now() - sessionStartTimeRef.current) / 1000))
            : 0;
          analyticsService.logEvent(AnalyticsEvents.SESSION_END, {
            reason: 'background',
            duration_sec: durationSec,
          });
        }
      }
    });

    // Also check immediately when component mounts
    fcmNotificationService.checkInitialNotification().catch((error) => {
      console.warn('⚠️  Failed to check initial notification on mount:', error);
    });

    return () => {
      subscription.remove();
    };
  }, [currentScreen]);

  React.useEffect(() => {
    const queueDeepLink = (url: string) => {
      pendingDeepLinkUrlRef.current = url;
      if (!isCheckingAuth) {
        const pendingUrl = pendingDeepLinkUrlRef.current;
        pendingDeepLinkUrlRef.current = null;
        if (pendingUrl) {
          handleDeepLinkNavigation(pendingUrl);
        }
      }
    };

    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) {
          queueDeepLink(initialUrl);
        }
      })
      .catch((error) => {
        console.warn('⚠️ Failed to read initial deep link URL:', error);
      });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url) {
        queueDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [handleDeepLinkNavigation, isCheckingAuth]);

  React.useEffect(() => {
    if (!isCheckingAuth && pendingDeepLinkUrlRef.current) {
      const pendingUrl = pendingDeepLinkUrlRef.current;
      pendingDeepLinkUrlRef.current = null;
      handleDeepLinkNavigation(pendingUrl);
    }
  }, [handleDeepLinkNavigation, isCheckingAuth]);

  React.useEffect(() => {
    const startedAt = Date.now();
    screenTransitionStartRef.current = startedAt;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      const loadTimeMs = Date.now() - startedAt;
      if (loadTimeMs > 2500) {
        analyticsService.logEvent(AnalyticsEvents.SCREEN_LOAD_SLOW, {
          screen_name: currentScreen,
          load_time_ms: loadTimeMs,
        });
      }
    });

    return () => {
      interactionTask.cancel();
    };
  }, [currentScreen]);

  // Check if user is already logged in on app startup
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        // Initialize API service with stored tokens
        await apiService.initialize();

        // Set callback for user deletion detection
        // This will be called when API detects user is deleted from database
        apiService.setUserDeletedCallback(async () => {
          console.warn('[App] User deletion detected, forcing logout...');
          const wasRegisteredUser = isAuthenticatedRef.current;
          try {
            // Force logout without API call (user is already deleted)
            await authService.forceLogout();

            // Reset analytics user data
            await analyticsService.resetAnalyticsData();
            await crashlyticsService.setUserId(null);
            isAuthenticatedRef.current = false;
            sessionStartTimeRef.current = null;

            // Clear address cache
            addressService.clearCache();

            // Clear cart
            clearCart();

            // Reset all animated values
            homeScreenSlide.setValue(0);
            profileScreenSlide.setValue(SCREEN_WIDTH);
            searchScreenSlide.setValue(SCREEN_WIDTH);
            privacyPolicyScreenSlide.setValue(SCREEN_WIDTH);
            termsConditionsScreenSlide.setValue(SCREEN_WIDTH);
            addressScreenSlide.setValue(SCREEN_WIDTH);
            locationScreenSlide.setValue(SCREEN_WIDTH);
            helpScreenSlide.setValue(SCREEN_WIDTH);

            // Navigate based on auth state (must use snapshot — ref is cleared above):
            // - Logged-in users: go to login
            // - Guests / expired sessions: continue in guest location setup flow
            if (wasRegisteredUser) {
              navigateToScreen('login');
              setPhoneNumber('');
            } else {
              await authService.guestLogin().catch(() => { });
              setAddressSelectionCameFrom('home');
              setLocationSelectionCameFrom('home');
              setSearchQuery('');
              setInitialLocationCoords(null);
              const persisted = await loadPersistedGuestLocation();
              if (persisted) {
                setSelectedLocation(persisted);
                navigateToScreen('home');
                homeScreenSlide.setValue(0);
              } else {
                navigateToScreen('addressSelection');
                addressScreenSlide.setValue(0);
              }
            }
          } catch (error) {
            console.error('[App] Error handling user deletion:', error);
            // Fallback to guest location setup if user is not authenticated
            if (wasRegisteredUser) {
              navigateToScreen('login');
            } else {
              await authService.guestLogin().catch(() => { });
              setAddressSelectionCameFrom('home');
              setLocationSelectionCameFrom('home');
              setSearchQuery('');
              setInitialLocationCoords(null);
              const persisted = await loadPersistedGuestLocation();
              if (persisted) {
                setSelectedLocation(persisted);
                navigateToScreen('home');
                homeScreenSlide.setValue(0);
              } else {
                navigateToScreen('addressSelection');
                addressScreenSlide.setValue(0);
              }
            }
          }
        });

        // Set callback for guest login retry on 401 (guest mode + identity_token)
        apiService.setGuestLoginRetryCallback(async () => {
          const result = await authService.guestLogin({ forceRefresh: true });
          return result.success === true;
        });

        // Set callback for session expiration
        // This will be called when refresh token is invalid/expired and session is cleared
        apiService.setSessionExpiredCallback(async () => {
          console.warn('[App] Session expired, navigating to login...');
          const wasRegisteredUser = isAuthenticatedRef.current;
          try {
            // Force logout to clear all data
            await authService.forceLogout();

            // Reset analytics user data
            await analyticsService.resetAnalyticsData();
            await crashlyticsService.setUserId(null);
            isAuthenticatedRef.current = false;
            sessionStartTimeRef.current = null;

            // Clear address cache
            addressService.clearCache();

            // Clear cart
            clearCart();

            // Reset all animated values
            homeScreenSlide.setValue(0);
            profileScreenSlide.setValue(SCREEN_WIDTH);
            searchScreenSlide.setValue(SCREEN_WIDTH);
            privacyPolicyScreenSlide.setValue(SCREEN_WIDTH);
            termsConditionsScreenSlide.setValue(SCREEN_WIDTH);
            addressScreenSlide.setValue(SCREEN_WIDTH);
            locationScreenSlide.setValue(SCREEN_WIDTH);
            helpScreenSlide.setValue(SCREEN_WIDTH);

            // Navigate based on auth state (must use snapshot — ref is cleared above):
            // - Logged-in users: go to login
            // - Guests / expired sessions: continue in guest location setup flow
            if (wasRegisteredUser) {
              navigateToScreen('login');
              setPhoneNumber('');
            } else {
              await authService.guestLogin().catch(() => { });
              setAddressSelectionCameFrom('home');
              setLocationSelectionCameFrom('home');
              setSearchQuery('');
              setInitialLocationCoords(null);
              const persisted = await loadPersistedGuestLocation();
              if (persisted) {
                setSelectedLocation(persisted);
                navigateToScreen('home');
                homeScreenSlide.setValue(0);
              } else {
                navigateToScreen('addressSelection');
                addressScreenSlide.setValue(0);
              }
            }
          } catch (error) {
            console.error('[App] Error handling session expiration:', error);
            // Fallback to guest location setup if user is not authenticated
            if (wasRegisteredUser) {
              navigateToScreen('login');
            } else {
              await authService.guestLogin().catch(() => { });
              setAddressSelectionCameFrom('home');
              setLocationSelectionCameFrom('home');
              setSearchQuery('');
              setInitialLocationCoords(null);
              const persisted = await loadPersistedGuestLocation();
              if (persisted) {
                setSelectedLocation(persisted);
                navigateToScreen('home');
                homeScreenSlide.setValue(0);
              } else {
                navigateToScreen('addressSelection');
                addressScreenSlide.setValue(0);
              }
            }
          }
        });

        // Initialize Crashlytics
        await crashlyticsService.initialize();
        await crashlyticsService.setGlobalContext({
          app_version: APP_VERSION_NAME,
          platform: Platform.OS,
        });

        // Initialize Analytics
        await analyticsService.initialize();
        await analyticsService.logEvent(AnalyticsEvents.APP_OPEN);

        // Initialize FCM notifications
        fcmNotificationService.initialize().catch((error) => {
          console.error('FCM initialization error:', error);
          crashlyticsService.recordError(error, { source: 'fcm_initialize' });
        });

        // Check for app updates after a short delay (to ensure app is ready)
        // Only check if not on checkout screen
        setTimeout(() => {
          if (currentScreen !== 'checkout') {
            inAppUpdateService.checkForUpdate({ currentScreen }).catch((error) => {
              console.error('In-app update check error:', error);
            });
          }
        }, 2000);

        // Check if user is authenticated
        const isLoggedIn = await authService.isAuthenticated();

        if (isLoggedIn) {
          // Get current user and set analytics / crashlytics user ID
          const currentUser = await hydrateCurrentUserForAnalytics();
          const resolvedUserType = await resolveUserTypeWithOrderHistory(currentUser);
          const profileProps = mergeProfileWithSelectedLocation(
            buildProfileUserProperties(currentUser),
            selectedLocation,
          );
          if (resolvedUserType === 'returning' && currentUser && currentUser.user_type !== 'returning') {
            await storageService.saveUser({
              ...(currentUser as any),
              user_type: 'returning',
            });
          }
          if (currentUser?.id) {
            const idString = currentUser.id.toString();
            await analyticsService.setUserId(idString);
            await crashlyticsService.setUserId(idString);
            await analyticsService.setUserProperties({
              [AnalyticsUserProperties.USER_ID]: idString,
              [AnalyticsUserProperties.USER_TYPE]: resolvedUserType,
              [AnalyticsUserProperties.CITY]: profileProps.city,
              [AnalyticsUserProperties.PINCODE]: profileProps.pincode,
              [AnalyticsUserProperties.AREA_NAME]: profileProps.areaName,
              [AnalyticsUserProperties.LATITUDE]: profileProps.latitude,
              [AnalyticsUserProperties.LONGITUDE]: profileProps.longitude,
            });
          }
          await crashlyticsService.setGlobalContext({
            app_version: APP_VERSION_NAME,
            login_state: 'logged_in',
            user_type: resolvedUserType,
          });
          await analyticsService.setUserProperties({
            [AnalyticsUserProperties.LOGIN_STATE]: 'logged_in',
            [AnalyticsUserProperties.USER_TYPE]: resolvedUserType,
            [AnalyticsUserProperties.USER_ID]: currentUser?.id ? currentUser.id.toString() : null,
            [AnalyticsUserProperties.CITY]: profileProps.city,
            [AnalyticsUserProperties.PINCODE]: profileProps.pincode,
            [AnalyticsUserProperties.AREA_NAME]: profileProps.areaName,
            [AnalyticsUserProperties.LATITUDE]: profileProps.latitude,
            [AnalyticsUserProperties.LONGITUDE]: profileProps.longitude,
          });
          isAuthenticatedRef.current = true;
          if (!sessionStartTimeRef.current) {
            sessionStartTimeRef.current = Date.now();
          }

          // If app opened from an FCM tap during cold start, preserve orders navigation.
          if (!startupNotificationNavigationRef.current) {
            navigateToScreen('home');
          }
        } else {
          // Not logged in: show login screen. Guest procedure starts only when user taps Skip.
          isAuthenticatedRef.current = false;
          sessionStartTimeRef.current = null;
          setAddressSelectionCameFrom('home');
          setLocationSelectionCameFrom('home');
          setSearchQuery('');
          setInitialLocationCoords(null);

          // Load persisted location for when user skips (needed for home screen after guest login)
          const persistedGuestLocation = await loadPersistedGuestLocation();
          if (persistedGuestLocation) {
            setSelectedLocation(persistedGuestLocation);
          }
          navigateToScreen('login');
        }
      } catch (error) {
        // If auth check fails, default to login screen (guest can Skip to start guest procedure)
        isAuthenticatedRef.current = false;
        sessionStartTimeRef.current = null;
        setAddressSelectionCameFrom('home');
        setLocationSelectionCameFrom('home');
        setSearchQuery('');
        setInitialLocationCoords(null);
        const persistedGuestLocation = await loadPersistedGuestLocation();
        if (persistedGuestLocation) {
          setSelectedLocation(persistedGuestLocation);
        }
        navigateToScreen('login');
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    // Cleanup FCM listeners and update service on unmount
    return () => {
      fcmNotificationService.cleanup();
      inAppUpdateService.cleanup();
    };
  }, []);


  // const [animationComplete, setAnimationComplete] = React.useState(false);

  const handleBackNavigation = React.useCallback((screen: typeof currentScreenRef.current) => {
    // Block navigation when forced update is required, but ONLY on non-auth screens
    // Allow back button to work normally on login, welcome, and OTP screens
    const authScreens: Array<typeof currentScreen> = ['login', 'welcome', 'otp'];
    const isOnAuthScreen = authScreens.includes(screen);

    if (forcedUpdateRequired && !isOnAuthScreen) {
      return true;
    }

    switch (screen) {
      case 'home':
        // Keep Android hardware back behavior unchanged on home.
        if (Platform.OS === 'android') {
          BackHandler.exitApp();
          return true;
        }
        return false;
      case 'profile':
        handleBackToHome();
        return true;
      case 'editProfile':
        handleBackFromEditProfile();
        return true;
      case 'orders':
        handleBackFromOrders();
        return true;
      case 'orderDetail':
        handleBackFromOrderDetail();
        return true;
      case 'chat':
        handleBackFromChat();
        return true;
      case 'orderHelp':
        handleBackFromChat();
        return true;
      case 'rateOrder':
        handleBackFromRateOrder();
        return true;
      case 'orderTracking':
        handleBackFromOrderTracking();
        return true;
      case 'search':
        handleBackFromSearch();
        return true;
      case 'myAddresses':
        handleBackFromMyAddresses();
        return true;
      case 'addressSelection':
        handleBackFromAddressSelection();
        return true;
      case 'locationSelection':
        handleBackFromLocationSelection();
        return true;
      case 'categoryResults':
        handleBackFromCategoryResults();
        return true;
      case 'restaurant':
        handleBackFromRestaurant();
        return true;
      case 'restaurantDetails':
        handleBackFromRestaurantDetails();
        return true;
      case 'checkout':
        handleBackFromCheckout();
        return true;
      case 'exploreDishes':
        handleBackFromExploreDishes();
        return true;
      case 'popularDishes':
        handleBackFromPopularDishes();
        return true;
      case 'privacyPolicy':
        handleBackFromPrivacyPolicy();
        return true;
      case 'termsConditions':
        handleBackFromTermsConditions();
        return true;
      case 'faq':
        handleBackFromFaq();
        return true;
      case 'contactUs':
        handleBackFromContactUs();
        return true;
      case 'help':
        if (isHelpClosing) {
          return true;
        }
        handleBackFromHelp();
        return true;
      case 'login':
        // Do not treat hardware back as Skip — only the Skip control starts guest flow.
        if (Platform.OS === 'android') {
          BackHandler.exitApp();
        }
        return true;
      case 'otp':
        handleBackToLogin();
        return true;
      case 'welcome':
        navigateToScreen('otp');
        return true;
      default:
        return false;
    }
  }, [
    forcedUpdateRequired,
    handleBackToHome,
    handleBackFromEditProfile,
    handleBackFromOrders,
    handleBackFromOrderDetail,
    handleBackFromChat,
    handleBackFromRateOrder,
    handleBackFromOrderTracking,
    handleBackFromSearch,
    handleBackFromMyAddresses,
    handleBackFromAddressSelection,
    handleBackFromLocationSelection,
    handleBackFromCategoryResults,
    handleBackFromRestaurant,
    handleBackFromRestaurantDetails,
    handleBackFromCheckout,
    handleBackFromExploreDishes,
    handleBackFromPopularDishes,
    handleBackFromPrivacyPolicy,
    handleBackFromTermsConditions,
    handleBackFromFaq,
    handleBackFromContactUs,
    handleBackFromHelp,
    handleBackToLogin,
  ]);

  // Handle Android back button
  React.useEffect(() => {
    const backAction = () => {
      // Always read latest route — avoids handling back with a stale screen before this effect re-runs
      // (e.g. user on Login UI but listener still thinks previous screen was locationSelection).
      const screen = currentScreenRef.current;
      if (Platform.OS !== 'android') {
        return handleBackNavigation(screen);
      }

      const now = Date.now();
      const MIN_BACK_GAP_MS = 280;

      if (isHandlingAndroidBackRef.current) {
        return true;
      }
      if (now - lastAndroidBackPressAtRef.current < MIN_BACK_GAP_MS) {
        return true;
      }

      lastAndroidBackPressAtRef.current = now;
      isHandlingAndroidBackRef.current = true;

      const handled = handleBackNavigation(screen);
      if (!handled) {
        isHandlingAndroidBackRef.current = false;
        return false;
      }

      setTimeout(() => {
        isHandlingAndroidBackRef.current = false;
      }, MIN_BACK_GAP_MS);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [handleBackNavigation]);

  const swipeStartXRef = React.useRef<number | null>(null);
  const isIosSwipeBackEnabled = Platform.OS === 'ios' && !isCheckingAuth && currentScreen !== 'home';

  const handleLoginSuccess = (phone: string) => {
    setPhoneNumber(phone);
    navigateToScreen('otp');
  };

  // Ensure notification permission after login
  const ensureNotificationPermission = React.useCallback(async () => {
    try {
      // Always request permission after login (will show popup if not granted)
      // This ensures users are prompted for notifications after successful login
      console.log('📱 Requesting notification permission after login...');
      const granted = await fcmNotificationService.requestPermission();
      if (granted) {
        console.log('✅ Notification permission granted');
        // Get token after permission is granted
        await fcmNotificationService.getToken();
      } else {
        console.warn('⚠️ Notification permission denied by user');
      }
    } catch (error) {
      console.warn('⚠️ Notification permission check failed:', error);
    }
  }, []);

  const handleOtpSuccess = async (isExistingUser: boolean) => {
    // Treat as existing user unless explicitly false (handles undefined from API)
    if (isExistingUser !== false) {
      // Existing user - go directly to home (skip address selection)
      // Set analytics user ID
      const currentUser = await hydrateCurrentUserForAnalytics();
      const resolvedUserType: 'new' | 'returning' = 'returning';
      const profileProps = mergeProfileWithSelectedLocation(
        buildProfileUserProperties(currentUser),
        selectedLocation,
      );
      if (resolvedUserType === 'returning' && currentUser && currentUser.user_type !== 'returning') {
        await storageService.saveUser({
          ...(currentUser as any),
          user_type: 'returning',
        });
      }
      if (currentUser?.id) {
        await analyticsService.setUserId(currentUser.id.toString());
        await crashlyticsService.setUserId(currentUser.id.toString());
      }

      await analyticsService.logEvent(AnalyticsEvents.OTP_VERIFIED, { method: 'sms' });
      await analyticsService.logEvent(AnalyticsEvents.LOGIN_SUCCESS, { method: 'otp' });
      await analyticsService.logEvent(AnalyticsEvents.USER_SESSION_START, { trigger: 'login' });
      sessionStartTimeRef.current = Date.now();
      isAuthenticatedRef.current = true;
      await analyticsService.setUserProperties({
        [AnalyticsUserProperties.LOGIN_STATE]: 'logged_in',
        [AnalyticsUserProperties.USER_ID]: currentUser?.id ? currentUser.id.toString() : null,
        [AnalyticsUserProperties.USER_TYPE]: resolvedUserType,
        [AnalyticsUserProperties.CITY]: profileProps.city,
        [AnalyticsUserProperties.PINCODE]: profileProps.pincode,
        [AnalyticsUserProperties.AREA_NAME]: profileProps.areaName,
        [AnalyticsUserProperties.LATITUDE]: profileProps.latitude,
        [AnalyticsUserProperties.LONGITUDE]: profileProps.longitude,
      });
      await crashlyticsService.setGlobalContext({
        app_version: APP_VERSION_NAME,
        login_state: 'logged_in',
        user_type: resolvedUserType,
      });

      // Reset all slides so home is visible (no overlay blocking)
      homeScreenSlide.setValue(0);
      profileScreenSlide.setValue(SCREEN_WIDTH);
      searchScreenSlide.setValue(SCREEN_WIDTH);
      addressScreenSlide.setValue(SCREEN_WIDTH);
      locationScreenSlide.setValue(SCREEN_WIDTH);
      ordersScreenSlide.setValue(SCREEN_WIDTH);
      orderDetailScreenSlide.setValue(SCREEN_WIDTH);
      restaurantScreenSlide.setValue(SCREEN_WIDTH);
      checkoutScreenSlide.setValue(SCREEN_WIDTH);
      helpScreenSlide.setValue(SCREEN_WIDTH);
      contactUsScreenSlide.setValue(SCREEN_WIDTH);
      faqScreenSlide.setValue(SCREEN_WIDTH);
      privacyPolicyScreenSlide.setValue(SCREEN_WIDTH);
      termsConditionsScreenSlide.setValue(SCREEN_WIDTH);

      navigateToScreen('home');
      setIsRegistrationFlow(false);
      reloadCart().catch(() => { });
      ensureNotificationPermission();
    } else {
      // New user - show welcome screen for profile completion
      await analyticsService.logEvent(AnalyticsEvents.OTP_VERIFIED, { method: 'sms' });
      navigateToScreen('welcome');
      setIsRegistrationFlow(true);
      ensureNotificationPermission();
    }
    setPhoneNumber('');
  };

  const handleWelcomeComplete = async (name: string, email: string) => {
    // Save user profile data to storage
    try {
      const currentUser = await hydrateCurrentUserForAnalytics();
      if (currentUser) {
        // Update user data with name and email
        const updatedUser = {
          ...currentUser,
          name,
          email,
          user_type: 'new' as const,
        };
        await storageService.saveUser(updatedUser);

        // Set analytics user ID and properties
        await analyticsService.setUserId(currentUser.id.toString());
        await crashlyticsService.setUserId(currentUser.id.toString());
        await analyticsService.setUserProperties({
          [AnalyticsUserProperties.USER_ID]: currentUser.id.toString(),
          [AnalyticsUserProperties.LOGIN_STATE]: 'logged_in',
          [AnalyticsUserProperties.USER_TYPE]: 'new',
        });
        await crashlyticsService.setGlobalContext({
          app_version: APP_VERSION_NAME,
          login_state: 'logged_in',
          user_type: 'new',
        });
      }
    } catch (error) {
      // Silent fail
    }

    // Log signup success
    await analyticsService.logEvent(AnalyticsEvents.LOGIN_SUCCESS, { method: 'otp' });
    await analyticsService.logEvent(AnalyticsEvents.USER_SESSION_START, { trigger: 'login' });
    sessionStartTimeRef.current = Date.now();
    isAuthenticatedRef.current = true;

    // Go to hotel list (home) after profile completion - reset all slides
    setAddressSelectionCameFrom('home');
    setLocationSelectionCameFrom('home');
    setSearchQuery('');
    setInitialLocationCoords(null);

    homeScreenSlide.setValue(0);
    profileScreenSlide.setValue(SCREEN_WIDTH);
    searchScreenSlide.setValue(SCREEN_WIDTH);
    addressScreenSlide.setValue(SCREEN_WIDTH);
    locationScreenSlide.setValue(SCREEN_WIDTH);
    ordersScreenSlide.setValue(SCREEN_WIDTH);
    orderDetailScreenSlide.setValue(SCREEN_WIDTH);
    restaurantScreenSlide.setValue(SCREEN_WIDTH);
    checkoutScreenSlide.setValue(SCREEN_WIDTH);
    helpScreenSlide.setValue(SCREEN_WIDTH);
    contactUsScreenSlide.setValue(SCREEN_WIDTH);
    faqScreenSlide.setValue(SCREEN_WIDTH);
    privacyPolicyScreenSlide.setValue(SCREEN_WIDTH);
    termsConditionsScreenSlide.setValue(SCREEN_WIDTH);

    navigateToScreen('home');
    setIsRegistrationFlow(false);

    // Ensure cart (if any) is synced for this user
    reloadCart().catch(() => { });
  };

  const handleLogout = async () => {
    const durationSec = sessionStartTimeRef.current
      ? Math.max(0, Math.round((Date.now() - sessionStartTimeRef.current) / 1000))
      : 0;

    // Log logout event
    await analyticsService.logEvent(AnalyticsEvents.LOGOUT);
    await analyticsService.logEvent(AnalyticsEvents.SESSION_END, {
      reason: 'logout',
      duration_sec: durationSec,
    });
    await analyticsService.logEvent(AnalyticsEvents.USER_SESSION_END, { trigger: 'logout' });

    // Reset analytics user data
    await analyticsService.reset();
    await analyticsService.setUserProperties({
      [AnalyticsUserProperties.USER_ID]: null,
      [AnalyticsUserProperties.USER_TYPE]: 'guest',
    });
    await crashlyticsService.setUserId(null);
    await crashlyticsService.setGlobalContext({
      login_state: 'guest',
    });

    // Clear authentication tokens and user data
    await authService.logout();

    // Clear address cache to prevent showing previous account's addresses
    addressService.clearCache();

    // Keep current delivery location (persist for guest browse + avoid duplicate address POST on re-login)
    if (
      typeof selectedLocation?.latitude === 'number' &&
      typeof selectedLocation?.longitude === 'number'
    ) {
      await saveGuestLocation({
        name: selectedLocation.name,
        address: selectedLocation.address,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        type: selectedLocation.type,
        guestLocationSynced: true,
      });
    }

    // Reset all animated values to their initial state
    homeScreenSlide.setValue(0);
    profileScreenSlide.setValue(SCREEN_WIDTH);
    searchScreenSlide.setValue(SCREEN_WIDTH);
    privacyPolicyScreenSlide.setValue(SCREEN_WIDTH);
    termsConditionsScreenSlide.setValue(SCREEN_WIDTH);
    addressScreenSlide.setValue(SCREEN_WIDTH);
    locationScreenSlide.setValue(SCREEN_WIDTH);
    helpScreenSlide.setValue(SCREEN_WIDTH);

    // Clear cart
    clearCart();

    // Go to login (user can log in again or Skip to continue as guest)
    setAddressSelectionCameFrom('home');
    setLocationSelectionCameFrom('home');
    setInitialLocationCoords(null);
    setPhoneNumber('');
    isAuthenticatedRef.current = false;
    sessionStartTimeRef.current = null;

    // Load persisted guest location for when user taps Skip on login
    const persistedGuestLocation = await loadPersistedGuestLocation();
    if (persistedGuestLocation) {
      setSelectedLocation(persistedGuestLocation);
    } else {
      setSelectedLocation(undefined);
    }
    navigateToScreen('login');
  };

  const handleBackToLogin = () => {
    navigateToScreen('login');
  };

  const handleBackFromLogin = async () => {
    // Skip: start guest procedure (guest login, analytics) then navigate
    try {
      await authService.guestLogin().catch((err) => {
        console.warn('[App] Guest login failed on Skip:', err?.message);
      });
      await crashlyticsService.setUserId(null);
      await crashlyticsService.setGlobalContext({
        app_version: APP_VERSION_NAME,
        login_state: 'guest',
      });
      await analyticsService.setUserProperties({
        [AnalyticsUserProperties.LOGIN_STATE]: 'guest',
        [AnalyticsUserProperties.USER_ID]: null,
        [AnalyticsUserProperties.USER_TYPE]: 'guest',
      });
    } catch (error) {
      // Never block skip navigation because of analytics/telemetry failures.
      console.warn('[App] Skip guest telemetry failed:', error);
    }

    // Reset all overlays so home (hotel list) is visible
    homeScreenSlide.setValue(0);
    profileScreenSlide.setValue(SCREEN_WIDTH);
    searchScreenSlide.setValue(SCREEN_WIDTH);
    addressScreenSlide.setValue(SCREEN_WIDTH);
    locationScreenSlide.setValue(SCREEN_WIDTH);
    ordersScreenSlide.setValue(SCREEN_WIDTH);
    orderDetailScreenSlide.setValue(SCREEN_WIDTH);
    restaurantScreenSlide.setValue(SCREEN_WIDTH);
    checkoutScreenSlide.setValue(SCREEN_WIDTH);
    helpScreenSlide.setValue(SCREEN_WIDTH);
    contactUsScreenSlide.setValue(SCREEN_WIDTH);
    faqScreenSlide.setValue(SCREEN_WIDTH);
    privacyPolicyScreenSlide.setValue(SCREEN_WIDTH);
    termsConditionsScreenSlide.setValue(SCREEN_WIDTH);

    // Go to hotel list if we have location, else address selection
    let persistedGuestLocation: Awaited<ReturnType<typeof loadPersistedGuestLocation>> = null;
    try {
      persistedGuestLocation = await loadPersistedGuestLocation();
    } catch (error) {
      console.warn('[App] Failed to load persisted guest location on Skip:', error);
    }
    if (persistedGuestLocation) {
      setSelectedLocation(persistedGuestLocation);
      navigateToScreen('home');
    } else {
      setSelectedLocation(undefined);
      setAddressSelectionCameFrom('registration');
      navigateToScreen('addressSelection');
      Animated.parallel([
        Animated.timing(homeScreenSlide, {
          toValue: -SCREEN_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(addressScreenSlide, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const transitionGuestToLogin = React.useCallback(() => {
    navigateToScreen('login');
    setAddressSelectionCameFrom('home');
    addressScreenSlide.setValue(SCREEN_WIDTH);
  }, []);

  const handleNavigateToProfile = () => {
    // Guests: redirect to login page with smooth transition
    if (!isAuthenticatedRef.current) {
      transitionGuestToLogin();
      return;
    }

    // Reset persisted orders and scroll position when navigating to profile
    resetOrdersPersistence();

    if (ordersDispatch) {
      ordersDispatch({ type: 'CLEAR_ORDERS' });
    }

    navigateToScreen('profile');

    Animated.parallel([
      Animated.timing(homeScreenSlide, {
        toValue: -SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(profileScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBackToHome = () => {
    // Slide both screens back
    Animated.parallel([
      Animated.timing(homeScreenSlide, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(profileScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigateToScreen('home');
    });
  };

  // Address Selection Navigation
  const handleNavigateToAddressSelection = () => {
    navigateToScreen('addressSelection');

    Animated.parallel([
      Animated.timing(homeScreenSlide, {
        toValue: -SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(addressScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBackFromAddressSelection = () => {
    if (addressSelectionCameFrom === 'registration') {
      transitionGuestToLogin();
      setAddressSelectionCameFrom('home');
      return;
    }
    // Guest without location: go back to login with smooth transition
    if (!isAuthenticatedRef.current && !selectedLocation) {
      transitionGuestToLogin();
      return;
    }
    if (addressSelectionCameFrom === 'myAddresses') {
      navigateToScreen('myAddresses');
      setAddressSelectionCameFrom('home');
    } else {
      Animated.parallel([
        Animated.timing(homeScreenSlide, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(addressScreenSlide, {
          toValue: SCREEN_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigateToScreen('home');
      });
    }
  };

  // Location Selection Navigation
  const handleNavigateToLocationSelection = (query?: string, latitude?: number, longitude?: number) => {
    if (query) {
      setLocationSearchQuery(query);
    } else {
      // Clear location search query when navigating without a query
      setLocationSearchQuery('');
    }
    // Store initial location coordinates if provided (from "Add address" button)
    if (latitude !== undefined && longitude !== undefined) {
      setInitialLocationCoords({ latitude, longitude });
    } else {
      setInitialLocationCoords(null);
    }
    // Track where we're coming from based on current screen
    if (currentScreenRef.current === 'addressSelection') {
      setLocationSelectionCameFrom('addressSelection');
    } else {
      // Coming from home or myAddresses
      if (addressSelectionCameFrom === 'myAddresses') {
        setLocationSelectionCameFrom('myAddresses');
      } else {
        setLocationSelectionCameFrom('home');
        setAddressSelectionCameFrom('home');
      }
    }
    navigateToScreen('locationSelection');

    Animated.parallel([
      Animated.timing(addressScreenSlide, {
        toValue: -SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(locationScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Navigate to location selection from home (for address check redirect)
  const handleNavigateToLocationSelectionFromHome = () => {
    setAddressSelectionCameFrom('home');
    setLocationSelectionCameFrom('home');
    navigateToScreen('locationSelection');

    Animated.timing(locationScreenSlide, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleBackFromLocationSelection = () => {
    // Clear editing address when going back
    setEditingAddress(null);

    if (locationSelectionCameFrom === 'myAddresses') {
      // Animate location screen out and navigate back to myAddresses
      Animated.timing(locationScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        navigateToScreen('myAddresses');
        setAddressSelectionCameFrom('home');
        setLocationSelectionCameFrom('home');
        setSearchQuery('');
        setInitialLocationCoords(null);
      });
    } else if (locationSelectionCameFrom === 'addressSelection') {
      // Coming from address selection - go back to address selection
      // Ensure home screen is visible and address screen is shown
      Animated.parallel([
        Animated.timing(homeScreenSlide, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(addressScreenSlide, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(locationScreenSlide, {
          toValue: SCREEN_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigateToScreen('addressSelection');
        setSearchQuery('');
        setLocationSelectionCameFrom('home');
      });
    } else {
      // Coming from home - go back to home
      // Ensure home screen is visible (slide to 0 if it was moved)
      Animated.parallel([
        Animated.timing(homeScreenSlide, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(locationScreenSlide, {
          toValue: SCREEN_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigateToScreen('home');
        setAddressSelectionCameFrom('home');
        setLocationSelectionCameFrom('home');
        setSearchQuery('');
        // Trigger refresh when returning from location selection to home
        // This ensures home data is fetched if user added an address
        setAddressRefreshTrigger(prev => prev + 1);
      });
    }
  };

  const handleLocationConfirm = (location: any) => {
    const locationType = location.type as 'home' | 'work' | 'other' | undefined;
    const validType = locationType && ['home', 'work', 'other'].includes(locationType) ? locationType : 'other';
    const confirmedLocation: Record<string, unknown> = {
      name: location.name || location.locationName,
      address: location.locationAddress || location.address,
      // Do NOT silently fall back to hardcoded Madurai coordinates.
      // Only use coordinates that were explicitly selected/confirmed.
      latitude: location.latitude ?? location.lat,
      longitude: location.longitude ?? location.lng,
      type: validType,
    };
    if (location.city != null && String(location.city).trim() !== '') {
      confirmedLocation.city = location.city;
    }
    if (location.pincode != null && String(location.pincode).trim() !== '') {
      confirmedLocation.pincode = String(location.pincode).trim();
    }
    if (location.address1) confirmedLocation.address1 = location.address1;
    if (location.address2) confirmedLocation.address2 = location.address2;
    if (location.address3) confirmedLocation.address3 = location.address3;
    if (location.state) confirmedLocation.state = location.state;

    // Update selected location
    setSelectedLocation({
      name: confirmedLocation.name as string,
      address: confirmedLocation.address as string,
      latitude: confirmedLocation.latitude as number | undefined,
      longitude: confirmedLocation.longitude as number | undefined,
      type: validType,
    });
    if (!isAuthenticatedRef.current) {
      saveGuestLocation({
        name: confirmedLocation.name as string,
        address: confirmedLocation.address as string,
        latitude: confirmedLocation.latitude as number | undefined,
        longitude: confirmedLocation.longitude as number | undefined,
        type: validType,
        guestLocationSynced: false,
        ...(typeof confirmedLocation.city === 'string' ? { city: confirmedLocation.city } : {}),
        ...(typeof confirmedLocation.pincode === 'string' ? { pincode: confirmedLocation.pincode } : {}),
        ...(typeof confirmedLocation.address1 === 'string' ? { address1: confirmedLocation.address1 } : {}),
        ...(typeof confirmedLocation.address2 === 'string' ? { address2: confirmedLocation.address2 } : {}),
        ...(typeof confirmedLocation.address3 === 'string' ? { address3: confirmedLocation.address3 } : {}),
        ...(typeof confirmedLocation.state === 'string' ? { state: confirmedLocation.state } : {}),
      });
    }
    const resolvedCity = String(location.city || '').toLowerCase();
    const resolvedPincode = String(location.pincode || '');
    const resolvedAreaName = String(location.name || location.locationName || '').toLowerCase();
    const resolvedLatitudeRaw = location.latitude ?? location.lat;
    const resolvedLongitudeRaw = location.longitude ?? location.lng;
    const resolvedLatitude = typeof resolvedLatitudeRaw === 'number' ? resolvedLatitudeRaw.toFixed(6) : null;
    const resolvedLongitude = typeof resolvedLongitudeRaw === 'number' ? resolvedLongitudeRaw.toFixed(6) : null;
    analyticsService.setUserProperties({
      [AnalyticsUserProperties.CITY]: resolvedCity || null,
      [AnalyticsUserProperties.PINCODE]: resolvedPincode || null,
      [AnalyticsUserProperties.AREA_NAME]: resolvedAreaName || null,
      [AnalyticsUserProperties.LATITUDE]: resolvedLatitude,
      [AnalyticsUserProperties.LONGITUDE]: resolvedLongitude,
    });
    crashlyticsService.setGlobalContext({
      city: resolvedCity || undefined,
      pincode: resolvedPincode || undefined,
    });
    analyticsService.logEvent(AnalyticsEvents.LOCATION_SELECTED_MANUAL, {
      city: resolvedCity || undefined,
      pincode: resolvedPincode || undefined,
      area_name: resolvedAreaName || undefined,
    });

    // Trigger homepage refresh when address changes
    handleAddressChange();

    // Check if we're editing an address (from myAddresses) or check navigation source
    const isEditingFromMyAddresses = editingAddress && locationSelectionCameFrom === 'myAddresses';

    if (isEditingFromMyAddresses || addressSelectionCameFrom === 'myAddresses') {
      // Navigate back to MyAddresses after saving
      // Clear editing address and reset navigation state
      setEditingAddress(null);
      Animated.timing(locationScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        navigateToScreen('myAddresses');
        setAddressSelectionCameFrom('home');
        setLocationSelectionCameFrom('home');
        setSearchQuery('');
        setInitialLocationCoords(null);
      });
    } else if (addressSelectionCameFrom === 'home') {
      // Coming from home - navigate back to home
      // Ensure home screen is visible (slide to 0 if it was moved)
      Animated.parallel([
        Animated.timing(homeScreenSlide, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(locationScreenSlide, {
          toValue: SCREEN_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigateToScreen('home');
        setAddressSelectionCameFrom('home');
        setSearchQuery('');
      });
    } else {
      // Coming from address selection - slide both screens back to home
      Animated.parallel([
        Animated.timing(homeScreenSlide, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(addressScreenSlide, {
          toValue: SCREEN_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(locationScreenSlide, {
          toValue: SCREEN_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigateToScreen('home');
        setAddressSelectionCameFrom('home');
        setLocationSelectionCameFrom('home');
        setEditingAddress(null);
        setSearchQuery('');
        setInitialLocationCoords(null);
      });
    }
  };

  // Category Results Navigation
  const handleNavigateToCategoryResults = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setCategoryCameFrom('home');
    navigateToScreen('categoryResults');
  };

  const handleBackFromCategoryResults = () => {
    if (categoryCameFrom === 'search') {
      navigateToScreen('search');
      // Re-open search screen with animation
      Animated.timing(searchScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (categoryCameFrom === 'favorites') {
      navigateToScreen('exploreDishes');
    } else {
      navigateToScreen('home');
    }
  };

  // Restaurant Navigation from Category
  const handleNavigateToRestaurantFromCategory = (
    restaurantId: number,
    restaurantName: string,
    meta?: RestaurantAnalyticsMeta
  ) => {
    setSelectedRestaurantId(restaurantId);
    setSelectedRestaurantName(restaurantName);
    setTargetRestaurantItemId(meta?.targetItemId);
    setTargetRestaurantItemName(meta?.targetItemName);
    // Favorites → dish category list → restaurant: back returns to My Favorites (not Profile / category list).
    setRestaurantCameFrom(categoryCameFrom === 'favorites' ? 'favorites' : 'category');
    navigateToScreen('restaurant');
    analyticsService.logEvent(AnalyticsEvents.RESTAURANT_VIEWED, {
      restaurant_id: restaurantId,
      restaurant_name: restaurantName || undefined,
      source: categoryCameFrom === 'favorites' ? 'favorites' : 'category',
      distance_km: Number.isFinite(meta?.distanceKm as number) ? meta?.distanceKm : 0,
      is_open: typeof meta?.isOpen === 'boolean' ? meta.isOpen : true,
      screen_name: AnalyticsScreens.RESTAURANT,
    });

    // Animate restaurant screen sliding in from right
    Animated.timing(restaurantScreenSlide, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // Restaurant Navigation from Home
  const handleNavigateToRestaurantFromHome = (
    restaurantId: number,
    restaurantName: string,
    meta?: RestaurantAnalyticsMeta
  ) => {
    setSelectedRestaurantId(restaurantId);
    setSelectedRestaurantName(restaurantName);
    setTargetRestaurantItemId(meta?.targetItemId);
    setTargetRestaurantItemName(meta?.targetItemName);
    setRestaurantCameFrom('home');
    navigateToScreen('restaurant');

    // Track restaurant view
    analyticsService.logEvent(AnalyticsEvents.RESTAURANT_VIEWED, {
      restaurant_id: restaurantId,
      restaurant_name: restaurantName || undefined,
      source: 'home',
      distance_km: Number.isFinite(meta?.distanceKm as number) ? meta?.distanceKm : 0,
      is_open: typeof meta?.isOpen === 'boolean' ? meta.isOpen : true,
      screen_name: AnalyticsScreens.RESTAURANT,
    });

    // Animate restaurant screen sliding in from right
    Animated.timing(restaurantScreenSlide, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // Checkout Navigation
  const handleNavigateToCheckout = useCallback((restaurantId: number, restaurantName: string, restaurantAddress?: string, from: 'home' | 'restaurant' = 'home') => {
    const checkoutDeliveryFee = Number(cartSummary?.delivery_fee ?? 0);
    setSelectedRestaurantId(restaurantId);
    setSelectedRestaurantName(restaurantName);
    setSelectedRestaurantAddress(restaurantAddress || '');
    setCheckoutCameFrom(from);
    setHasCheckoutMounted(true);

    // Reset animation to off-screen position first
    checkoutScreenSlide.setValue(SCREEN_WIDTH);

    // Set screen to checkout
    navigateToScreen('checkout');
    analyticsService.logEvent(AnalyticsEvents.CART_VIEWED, {
      cart_value: getTotalPrice(),
      item_count: getTotalItems(),
      restaurant_id: restaurantId,
      restaurant_name: restaurantName || undefined,
      screen_name: AnalyticsScreens.CHECKOUT,
    });
    analyticsService.logEvent(AnalyticsEvents.CHECKOUT_STARTED, {
      cart_value: getTotalPrice(),
      delivery_fee: Number.isFinite(checkoutDeliveryFee) ? checkoutDeliveryFee : 0,
      item_count: getTotalItems(),
      currency: 'INR',
      restaurant_id: restaurantId,
      restaurant_name: restaurantName || undefined,
      source: from,
      screen_name: AnalyticsScreens.CHECKOUT,
    });

    // Animate checkout screen sliding in from right (next frame)
    requestAnimationFrame(() => {
      Animated.timing(checkoutScreenSlide, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [cartSummary?.delivery_fee, checkoutScreenSlide, getTotalItems, getTotalPrice]);

  // Back from Checkout
  const handleBackFromCheckout = useCallback(() => {
    // Slide out checkout screen
    Animated.timing(checkoutScreenSlide, {
      toValue: SCREEN_WIDTH,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      // Navigate based on where we came from
      if (checkoutCameFrom === 'home') {
        homeScreenSlide.setValue(0);
        navigateToScreen('home');
      } else if (checkoutCameFrom === 'restaurant') {
        // Ensure restaurant layer is visible before switching to it
        restaurantScreenSlide.setValue(0);
        navigateToScreen('restaurant');
      } else {
        ordersScreenSlide.setValue(0);
        navigateToScreen('orders');
      }
    });
  }, [checkoutScreenSlide, checkoutCameFrom, homeScreenSlide, restaurantScreenSlide, ordersScreenSlide]);

  // Handle Add More Items from Checkout - navigate to restaurant menu and preserve checkout back path
  const handleAddMoreItemsFromCheckout = useCallback(() => {
    const targetRestaurantId = cartRestaurantId || selectedRestaurantId;
    const targetRestaurantName = cartRestaurantName || selectedRestaurantName;

    if (!targetRestaurantId || !targetRestaurantName) {
      // If no restaurant info, just go back
      handleBackFromCheckout();
      return;
    }

    // Set restaurant info
    setSelectedRestaurantId(targetRestaurantId);
    setSelectedRestaurantName(targetRestaurantName);
    // Preserve checkout as the return destination for back navigation
    setRestaurantCameFrom('checkout');

    // Stop any in-flight animations before starting a new transition.
    checkoutScreenSlide.stopAnimation();
    restaurantScreenSlide.stopAnimation();

    // Reset restaurant screen to off-screen position first
    restaurantScreenSlide.setValue(SCREEN_WIDTH);
    // Set target screen before animation to avoid callback race conditions
    // when users quickly tap back after "Add More Items".
    navigateToScreen('restaurant');

    // Slide out checkout screen and navigate to restaurant
    Animated.parallel([
      Animated.timing(checkoutScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(restaurantScreenSlide, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [checkoutScreenSlide, restaurantScreenSlide, cartRestaurantId, cartRestaurantName, selectedRestaurantId, selectedRestaurantName, handleBackFromCheckout]);

  // Handle place order from checkout
  const handlePlaceOrderFromCheckout = useCallback(() => {
    // Navigate to order success/tracking
    Animated.timing(checkoutScreenSlide, {
      toValue: SCREEN_WIDTH,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [checkoutScreenSlide]);

  // Handle order success from checkout - View Order Details button
  const handleOrderSuccessFromCheckout = useCallback((orderId: number) => {
    // Validate orderId
    if (!orderId || isNaN(orderId)) {
      console.error('Invalid orderId received:', orderId);
      return;
    }

    // Ensure restaurant screen is properly hidden and reset state
    restaurantScreenSlide.setValue(SCREEN_WIDTH);
    // Reset restaurant selection to prevent any unwanted rendering
    setSelectedRestaurantId(1);
    setSelectedRestaurantName('');
    setSelectedRestaurantAddress('');

    // Set order ID immediately to ensure it's available
    setSelectedOrderId(orderId.toString());
    // Reset order detail screen position to show it
    orderDetailScreenSlide.setValue(0);

    // Close checkout screen with animation first, then navigate to order detail
    setOrderDetailCameFrom('checkout');
    Animated.timing(checkoutScreenSlide, {
      toValue: SCREEN_WIDTH,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      // After checkout screen closes, navigate to order detail
      // Use requestAnimationFrame to ensure state updates are processed
      requestAnimationFrame(() => {
        navigateToScreen('orderDetail');
      });
    });
  }, [checkoutScreenSlide, restaurantScreenSlide, orderDetailScreenSlide]);

  // Handle order cancel from checkout - OK button after payment failure
  const handleOrderCancelFromCheckout = useCallback(() => {
    // Close checkout and navigate back based on where we came from
    Animated.timing(checkoutScreenSlide, {
      toValue: SCREEN_WIDTH,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      // Navigate back to restaurant screen if we came from there, otherwise go to home
      if (checkoutCameFrom === 'restaurant') {
        navigateToScreen('restaurant');
        // Force restaurant screen to reload by briefly hiding and showing
        // This ensures the menu loads properly
        setTimeout(() => {
          // The restaurant screen's useEffect will trigger when visible becomes true
        }, 100);
      } else {
        navigateToScreen('home');
      }
    });
  }, [checkoutScreenSlide, checkoutCameFrom]);

  // Back from Restaurant (dynamic based on where we came from)
  const handleBackFromRestaurant = () => {
    if (isRestaurantBackTransitioningRef.current) {
      return;
    }
    isRestaurantBackTransitioningRef.current = true;

    // For checkout return flow, switch instantly to avoid showing intermediate screens.
    if (restaurantCameFrom === 'checkout') {
      // Prevent in-flight animations from overriding values after back is pressed.
      restaurantScreenSlide.stopAnimation();
      checkoutScreenSlide.stopAnimation();
      restaurantScreenSlide.setValue(SCREEN_WIDTH);
      checkoutScreenSlide.setValue(0);
      // After returning from "Add More Items", next back from checkout should go home.
      setCheckoutCameFrom('home');
      navigateToScreen('checkout');
      setTimeout(() => {
        isRestaurantBackTransitioningRef.current = false;
      }, 220);
      return;
    }

    restaurantScreenSlide.stopAnimation();

    // Animate restaurant screen sliding out to the right
    Animated.timing(restaurantScreenSlide, {
      toValue: SCREEN_WIDTH,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      // Set screen after animation completes to prevent double loading
      if (restaurantCameFrom === 'home') {
        navigateToScreen('home');
      } else if (restaurantCameFrom === 'category') {
        navigateToScreen('categoryResults');
      } else if (restaurantCameFrom === 'search') {
        navigateToScreen('search');
        // Re-open search screen with animation
        Animated.timing(searchScreenSlide, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else if (restaurantCameFrom === 'favorites') {
        navigateToScreen('exploreDishes');
      } else if (restaurantCameFrom === 'orders') {
        navigateToScreen('orders');
      } else {
        navigateToScreen('categoryResults');
      }
      isRestaurantBackTransitioningRef.current = false;
    });
  };

  // Navigate to Restaurant Details
  const handleNavigateToRestaurantDetails = () => {
    try {
      navigateToScreen('restaurantDetails');
    } catch (error) {
      // Error navigating to restaurant details
    }
  };

  // Back from Restaurant Details
  const handleBackFromRestaurantDetails = () => {
    navigateToScreen('restaurant');
  };

  // Orders Navigation
  const handleNavigateToOrders = () => {
    setOrdersCameFrom('profile'); // Track that we're coming from profile
    navigateToScreen('orders');
    // Reset orders screen position to show it
    ordersScreenSlide.setValue(0);
    analyticsService.logEvent(AnalyticsEvents.RESTAURANT_LIST_VIEWED, { source: 'orders' });
  };

  const handleBackFromOrders = () => {
    // Animate orders screen out
    Animated.timing(ordersScreenSlide, {
      toValue: SCREEN_WIDTH,
      duration: 200,  // Small duration for smooth transition
      useNativeDriver: true,
    }).start(() => {
      // If we came from orderDetail (which came from checkout), go to home.
      // If we came from notification tap, go to home (continue app usage).
      // Otherwise, go to profile (normal flow from profile screen).
      if (ordersCameFrom === 'orderDetail') {
        // Batch all screen position resets together before state update
        orderDetailScreenSlide.setValue(SCREEN_WIDTH);
        ordersScreenSlide.setValue(SCREEN_WIDTH);
        profileScreenSlide.setValue(SCREEN_WIDTH);
        restaurantScreenSlide.setValue(SCREEN_WIDTH);
        checkoutScreenSlide.setValue(SCREEN_WIDTH);
        homeScreenSlide.setValue(0);

        // Update state after all positions are set
        navigateToScreen('home');
        setOrdersCameFrom('profile'); // Reset for next time
      } else if (ordersCameFrom === 'notification') {
        navigateToScreen('home');
        setOrdersCameFrom('profile'); // Reset for next time
      } else {
        navigateToScreen('profile');
      }
    });
  };

  // Order Detail Navigation
  const handleNavigateToOrderDetail = (orderId: string) => {
    setOrderDetailCameFrom('orders');
    setSelectedOrderId(orderId);
    navigateToScreen('orderDetail');
    // Reset order detail screen position to show it
    orderDetailScreenSlide.setValue(0);
  };

  const handleBackFromOrderDetail = () => {
    // Track that we're going to orders from orderDetail
    // If we came from checkout (orderDetail was accessed via handleOrderSuccessFromCheckout),
    // we need to track this so orders can go back to home
    if (orderDetailCameFrom === 'checkout') {
      setOrdersCameFrom('orderDetail');
    } else {
      setOrdersCameFrom('profile');
    }

    // Avoid relying on zero-duration animation callback on Android.
    // Directly update slide values and screen state for deterministic back navigation.
    orderDetailScreenSlide.stopAnimation();
    orderDetailScreenSlide.setValue(SCREEN_WIDTH);
    ordersScreenSlide.setValue(0);
    navigateToScreen('orders');
  };

  // My Addresses Navigation
  const handleNavigateToMyAddresses = () => {
    navigateToScreen('myAddresses');
  };

  const handleBackFromMyAddresses = () => {
    // Reset location screen position and clear all related state
    locationScreenSlide.setValue(SCREEN_WIDTH);
    setEditingAddress(null);
    setLocationSelectionCameFrom('home');
    setAddressSelectionCameFrom('home');
    setSearchQuery('');
    setInitialLocationCoords(null);
    navigateToScreen('profile');
  };

  // Handle address changes (trigger HomeScreen refresh)
  const handleAddressChange = () => {
    if (currentScreen === 'home') {
      setAddressRefreshTrigger(prev => prev + 1);
      return;
    }

    setPendingHomeRefresh(true);
  };

  React.useEffect(() => {
    if (currentScreen === 'home' && pendingHomeRefresh) {
      setAddressRefreshTrigger(prev => prev + 1);
      setPendingHomeRefresh(false);
    }
  }, [currentScreen, pendingHomeRefresh]);

  const handleNavigateToAddressSelectionFromMyAddresses = () => {
    // Set correct navigation source for location selection
    setLocationSelectionCameFrom('myAddresses');
    setAddressSelectionCameFrom('myAddresses');
    setEditingAddress(null); // Clear any editing address
    navigateToScreen('locationSelection');

    // Animate the location screen in
    Animated.timing(locationScreenSlide, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleEditAddressFromMyAddresses = (address: any) => {
    // Set the correct navigation source
    setLocationSelectionCameFrom('myAddresses');
    setEditingAddress(address); // Store the address being edited
    navigateToScreen('locationSelection');

    // Animate the location screen in
    Animated.timing(locationScreenSlide, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Explore Dishes (Favorites) Navigation
  const handleNavigateToExploreDishes = () => {
    navigateToScreen('exploreDishes');
  };

  const handleBackFromExploreDishes = () => {
    navigateToScreen('profile');
  };

  const handleNavigateToPopularDishes = (collectionId?: number) => {
    setSelectedPopularCollectionId(collectionId);
    navigateToScreen('popularDishes');
  };

  const handleBackFromPopularDishes = () => {
    setSelectedPopularCollectionId(undefined);
    navigateToScreen('home');
  };

  // Privacy Policy Navigation
  const handleNavigateToPrivacyPolicy = (from: 'profile' | 'login' | 'otp' = 'profile') => {
    setLegalCameFrom(from);
    navigateToScreen('privacyPolicy');

    if (from === 'profile') {
      Animated.parallel([
        Animated.timing(profileScreenSlide, {
          toValue: -SCREEN_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(privacyPolicyScreenSlide, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Coming from login or otp: only animate the privacy policy screen
      privacyPolicyScreenSlide.setValue(SCREEN_WIDTH);
      Animated.timing(privacyPolicyScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleBackFromPrivacyPolicy = () => {
    if (legalCameFrom === 'login') {
      Animated.timing(privacyPolicyScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        navigateToScreen('login');
      });
    } else if (legalCameFrom === 'otp') {
      Animated.timing(privacyPolicyScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        navigateToScreen('otp');
      });
    } else {
      Animated.parallel([
        Animated.timing(profileScreenSlide, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(privacyPolicyScreenSlide, {
          toValue: SCREEN_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigateToScreen('profile');
      });
    }
  };

  // Terms & Conditions Navigation
  const handleNavigateToTermsConditions = (from: 'profile' | 'login' | 'otp' = 'profile') => {
    setLegalCameFrom(from);
    navigateToScreen('termsConditions');

    if (from === 'profile') {
      Animated.parallel([
        Animated.timing(profileScreenSlide, {
          toValue: -SCREEN_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(termsConditionsScreenSlide, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Coming from login or otp: only animate the terms & conditions screen
      termsConditionsScreenSlide.setValue(SCREEN_WIDTH);
      Animated.timing(termsConditionsScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleBackFromTermsConditions = () => {
    if (legalCameFrom === 'login') {
      Animated.timing(termsConditionsScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        navigateToScreen('login');
      });
    } else if (legalCameFrom === 'otp') {
      Animated.timing(termsConditionsScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        navigateToScreen('otp');
      });
    } else {
      Animated.parallel([
        Animated.timing(profileScreenSlide, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(termsConditionsScreenSlide, {
          toValue: SCREEN_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigateToScreen('profile');
      });
    }
  };

  // FAQ Navigation
  const handleNavigateToFaq = () => {
    navigateToScreen('faq');
    setLegalCameFrom('profile');

    Animated.parallel([
      Animated.timing(profileScreenSlide, {
        toValue: -SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(faqScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBackFromFaq = () => {
    if (legalCameFrom === 'login') {
      Animated.timing(faqScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        navigateToScreen('login');
        setLegalCameFrom('profile');
      });
    } else {
      Animated.parallel([
        Animated.timing(profileScreenSlide, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(faqScreenSlide, {
          toValue: SCREEN_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigateToScreen('profile');
      });
    }
  };

  // Help Navigation
  const [helpCameFrom, setHelpCameFrom] = React.useState<'profile' | 'orders'>('profile');
  const [isHelpClosing, setIsHelpClosing] = React.useState(false);
  const [chatCameFrom, setChatCameFrom] = React.useState<'help' | 'orderDetail' | null>(null);

  // Contact Us Navigation
  const [contactUsCameFrom, setContactUsCameFrom] = React.useState<'profile' | 'orders' | 'orderDetail'>('profile');

  const handleNavigateToContactUs = (from: 'profile' | 'orders' | 'orderDetail' = 'profile') => {
    setContactUsCameFrom(from);
    navigateToScreen('contactUs');

    if (from === 'profile') {
      Animated.parallel([
        Animated.timing(profileScreenSlide, {
          toValue: -SCREEN_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(contactUsScreenSlide, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // From orders or orderDetail screen - no animation, instant transition
      contactUsScreenSlide.setValue(0);
    }
  };

  const handleBackFromContactUs = () => {
    if (contactUsCameFrom === 'profile') {
      Animated.parallel([
        Animated.timing(profileScreenSlide, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(contactUsScreenSlide, {
          toValue: SCREEN_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigateToScreen('profile');
      });
    } else if (contactUsCameFrom === 'orderDetail') {
      // Back to order detail screen - instant, no animation
      contactUsScreenSlide.setValue(SCREEN_WIDTH);
      orderDetailScreenSlide.setValue(0);
      navigateToScreen('orderDetail');
    } else {
      // Back to orders screen - instant, no animation
      contactUsScreenSlide.setValue(SCREEN_WIDTH);
      ordersScreenSlide.setValue(0);
      navigateToScreen('orders');
    }
  };

  const handleNavigateToHelp = (from: 'profile' | 'orders' = 'profile', order?: OrderListItem) => {
    setHelpCameFrom(from);
    setHelpOrderData(order ?? null);
    navigateToScreen('help');

    setIsHelpClosing(false);

    if (from === 'profile') {
      Animated.parallel([
        Animated.timing(profileScreenSlide, {
          toValue: -SCREEN_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(helpScreenSlide, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      helpScreenSlide.setValue(SCREEN_WIDTH);
      Animated.timing(helpScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const closeHelpScreen = (
    targetScreen: typeof currentScreen,
    afterStateCallback?: () => void,
    deferTargetScreenUntilAnimationEnd: boolean = false
  ) => {
    if (isHelpClosing) {
      return;
    }
    if (!deferTargetScreenUntilAnimationEnd && currentScreen !== targetScreen) {
      navigateToScreen(targetScreen);
    }
    setIsHelpClosing(true);
    const animations = [
      Animated.timing(helpScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
    ];

    if (helpCameFrom === 'profile') {
      animations.push(
        Animated.timing(profileScreenSlide, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        })
      );
    }

    Animated.parallel(animations).start(() => {
      if (deferTargetScreenUntilAnimationEnd && currentScreenRef.current !== targetScreen) {
        navigateToScreen(targetScreen);
      }
      setIsHelpClosing(false);
      setHelpOrderData(null);
      afterStateCallback?.();
    });
  };

  const handleBackFromHelp = () => {
    // Android safety: normalize potentially stale OrderDetail state before returning to Orders.
    // This prevents a hidden OrderDetail overlay/back-path from reactivating after Help closes.
    if (helpCameFrom === 'orders') {
      orderDetailScreenSlide.stopAnimation();
      orderDetailScreenSlide.setValue(SCREEN_WIDTH);
      setOrderDetailCameFrom('orders');
      setSelectedOrderId('');
      setSelectedOrderData(null);
      setChatCameFrom(null);
    }

    // Always defer screen switch until Help close animation completes.
    // This avoids transient route mismatch during Android back dispatch.
    closeHelpScreen(helpCameFrom, undefined, true);
  };

  const handleHelpViewOrder = (orderId: string) => {
    if (!orderId) {
      return;
    }
    closeHelpScreen('orderDetail', () => {
      setSelectedOrderId(orderId);
    });
  };

  // Edit Profile Navigation
  const handleNavigateToEditProfile = () => {
    navigateToScreen('editProfile');
  };

  const handleBackFromEditProfile = () => {
    navigateToScreen('profile');
  };

  // Rate Order Navigation
  const handleNavigateToRateOrder = (orderId: string, orderData?: any) => {
    setSelectedOrderId(orderId);
    setSelectedOrderData(orderData);
    navigateToScreen('rateOrder');
  };

  const handleBackFromRateOrder = () => {
    resetOrdersPersistence(); // Auto refresh the orders page after rating
    navigateToScreen('orders');
    setSelectedOrderData(null);
  };

  // Order Tracking Navigation
  const handleNavigateToOrderTracking = (orderId: string, cameFrom?: 'orders' | 'checkout' | 'orderDetail') => {
    setSelectedOrderId(orderId);
    setOrderTrackingCameFrom(cameFrom || 'orders');
    navigateToScreen('orderTracking');
  };

  const handleBackFromOrderTracking = () => {
    if (orderTrackingCameFrom === 'checkout') {
      // If came from payment success, go back to home
      // Ensure restaurant screen is properly hidden and reset state
      restaurantScreenSlide.setValue(SCREEN_WIDTH);
      // Reset restaurant selection to prevent any unwanted rendering
      setSelectedRestaurantId(1);
      setSelectedRestaurantName('');
      setSelectedRestaurantAddress('');
      // Set screen to home immediately - this ensures RestaurantScreen is not visible
      // RestaurantScreen only shows when currentScreen === 'restaurant'
      navigateToScreen('home');
      setOrderTrackingCameFrom('orders'); // Reset for next time
    } else if (orderTrackingCameFrom === 'orderDetail') {
      // If came from order detail, go back to order detail
      navigateToScreen('orderDetail');
    } else {
      // If came from orders, go back to orders
      navigateToScreen('orders');
    }
  };

  // Chat Navigation
  const handleNavigateToOrderHelp = () => {
    setChatCameFrom('orderDetail');
    navigateToScreen('chat');
  };

  const handleBackFromChat = () => {
    // Navigate back based on where we came from
    if (chatCameFrom === 'orderDetail') {
      navigateToScreen('orderDetail');
      setChatCameFrom(null);
    } else if (chatCameFrom === 'help') {
      navigateToScreen('help');
      setChatCameFrom(null);
    } else {
      // Fallback: if chatCameFrom is not set, try to determine from context
      // Priority: orderDetail (if we have selectedOrderId) > help > orders
      if (selectedOrderId) {
        // If we have a selected order, likely came from orderDetail
        navigateToScreen('orderDetail');
      } else if (helpCameFrom === 'orders' || helpCameFrom === 'profile') {
        // If help screen was accessed, go back to help
        navigateToScreen('help');
      } else {
        // Ultimate fallback: go to orders screen (safe default)
        navigateToScreen('orders');
      }
      setChatCameFrom(null);
    }
  };

  // Search Navigation
  const handleNavigateToSearch = () => {
    setHasSearchMounted(true);
    searchScreenSlide.stopAnimation();
    searchScreenSlide.setValue(SCREEN_WIDTH);
    navigateToScreen('search');

    // Track search start
    analyticsService.logEvent(AnalyticsEvents.SEARCH, { source: 'home_search' });

    // Keep home fixed and slide search over it to avoid exposing base white layer.
    Animated.timing(searchScreenSlide, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleBackFromSearch = () => {
    searchScreenSlide.stopAnimation();
    Animated.timing(searchScreenSlide, {
      toValue: SCREEN_WIDTH,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      homeScreenSlide.setValue(0);
      navigateToScreen('home');
    });
  };

  // Clear search state
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  // Reorder functionality
  const handleReorder = async (orderId: string) => {
    try {
      // Fetch order details
      const orderResponse = await ordersService.getOrderById(Number(orderId));

      if (!orderResponse.success || !orderResponse.data) {
        showConfirmation({
          title: 'Error',
          message: typeof orderResponse.error === 'string' ? orderResponse.error : 'Failed to fetch order details',
          confirmText: 'OK',
          cancelText: 'Close',
          onConfirm: () => { },
        });
        return;
      }

      const orderData = orderResponse.data;
      const restaurantId = orderData.restaurant.id;
      const restaurantName = orderData.restaurant.name;
      const restaurantLogo = orderData.restaurant.logo_url;

      // Check if restaurant is currently open
      // Fetch restaurant details to get timing information.
      // IMPORTANT: Do not silently fall back to hardcoded coordinates here.
      // If we don't have a confirmed user/location coordinate, we skip distance-based checks.
      const hasUserCoords =
        typeof selectedLocation?.latitude === 'number' &&
        typeof selectedLocation?.longitude === 'number';

      const restaurantResponse = hasUserCoords
        ? await apiService.get(
          `/api/buyer/restaurants/${restaurantId}?lat=${selectedLocation!.latitude}&lng=${selectedLocation!.longitude}`
        )
        : await apiService.get(`/api/buyer/restaurants/${restaurantId}`);

      if (restaurantResponse.success && restaurantResponse.data) {
        // Handle both nested data structure and direct data structure
        const restaurantData = (restaurantResponse.data && typeof restaurantResponse.data === 'object' && restaurantResponse.data !== null && 'data' in restaurantResponse.data)
          ? (restaurantResponse.data as { data: any }).data
          : restaurantResponse.data;

        // Check if restaurant is within 10km radius
        // The API returns distance_km when lat/lng are provided
        const distanceKm = restaurantData.distance_km || restaurantData.distance;

        // Parse distance if it's a string like "5.2 km"
        let distance = 0;
        if (typeof distanceKm === 'string') {
          const match = distanceKm.match(/(\d+\.?\d*)/);
          distance = match ? parseFloat(match[1]) : 0;
        } else if (typeof distanceKm === 'number') {
          distance = distanceKm;
        }

        // Check if restaurant location exists and calculate distance if not provided by API.
        // Only perform this calculation when we have a confirmed user coordinate.
        if (
          distance === 0 &&
          restaurantData.locations?.[0] &&
          typeof selectedLocation?.latitude === 'number' &&
          typeof selectedLocation?.longitude === 'number'
        ) {
          const restaurantLat = restaurantData.locations[0].latitude;
          const restaurantLng = restaurantData.locations[0].longitude;

          if (restaurantLat && restaurantLng) {
            // Calculate distance using Haversine formula
            const R = 6371; // Earth's radius in km
            const dLat = (restaurantLat - selectedLocation.latitude) * Math.PI / 180;
            const dLng = (restaurantLng - selectedLocation.longitude) * Math.PI / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(selectedLocation.latitude * Math.PI / 180) * Math.cos(restaurantLat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distance = R * c;
          }
        }

        // Check if restaurant is within 10km radius
        if (distance > 10) {
          showConfirmation({
            title: 'Restaurant Out of Range',
            message: `${restaurantName} is ${distance.toFixed(1)} km away from your selected address. We only deliver within 10 km radius. Please select a different delivery address.`,
            confirmText: 'OK',
            cancelText: 'Close',
            confirmButtonColor: '#DC2626',
            onConfirm: () => { },
          });
          return;
        }

        // Check if restaurant is open
        if (restaurantData.timings) {
          const isOpen = homeService.isRestaurantOpen(restaurantData.timings);

          if (!isOpen) {
            // Restaurant is closed
            const openingMessage = homeService.getRestaurantOpeningMessage(restaurantData.timings);
            showConfirmation({
              title: 'Restaurant Closed',
              message: openingMessage
                ? `${restaurantName} is currently closed. ${openingMessage}`
                : `${restaurantName} is currently closed. You can place an order when the restaurant is open.`,
              confirmText: 'OK',
              cancelText: 'Close',
              confirmButtonColor: '#DC2626',
              onConfirm: () => { },
            });
            return;
          }
        }
      }

      // Check for restaurant conflict
      const hasConflict = checkRestaurantConflict(restaurantId);

      if (hasConflict) {
        // Show confirmation to clear cart
        showConfirmation({
          title: 'Replace cart items?',
          message: `Your cart contains items from a different restaurant. Do you want to clear your cart and add items from ${restaurantName}?`,
          confirmText: 'Yes, Replace',
          cancelText: 'Cancel',
          confirmButtonColor: '#00B14F',
          onConfirm: async () => {
            // Clear cart and proceed
            clearCart();
            await addOrderItemsToCart(orderData, restaurantId, restaurantName, restaurantLogo);
          },
        });
      } else {
        // No conflict, directly add items
        await addOrderItemsToCart(orderData, restaurantId, restaurantName, restaurantLogo);
      }
    } catch (error: any) {
      showConfirmation({
        title: 'Error',
        message: typeof error?.message === 'string' ? error.message : 'Failed to reorder',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => { },
      });
    }
  };

  // Helper function to add order items to cart
  const addOrderItemsToCart = async (orderData: any, restaurantId: number, restaurantName: string, restaurantLogo: string) => {
    try {
      // Set restaurant info
      setRestaurantInfo(restaurantId, restaurantName, restaurantLogo);

      // Add each item to cart
      for (const item of orderData.items) {
        // Calculate unit price from total_price and quantity
        const unitPrice = item.total_price / item.quantity;

        const cartItem = {
          id: item.item_id.toString(),
          name: item.item_name,
          price: unitPrice,
          quantity: item.quantity,
          isVeg: item.is_veg || false,
          image: item.image_url,
          isCustomizable: false,
        };

        addToCart(cartItem);
      }

      // Show success message
      showConfirmation({
        title: 'Items Added!',
        message: `${orderData.items.length} item${orderData.items.length > 1 ? 's' : ''} added to your cart from ${restaurantName}`,
        confirmText: 'View Cart',
        cancelText: '', // Remove Continue button
        confirmButtonColor: '#00B14F',
        onConfirm: () => {
          // Navigate to restaurant screen to view cart
          setSelectedRestaurantId(restaurantId);
          setSelectedRestaurantName(restaurantName);
          // Remember that we came from orders/orderDetail screen
          setRestaurantCameFrom(currentScreen === 'orders' || currentScreen === 'orderDetail' ? 'orders' : 'home');
          navigateToScreen('restaurant');

          Animated.timing(restaurantScreenSlide, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        },
        onCancel: () => {
          // No action needed
        },
      });
    } catch (error: any) {
      showConfirmation({
        title: 'Error',
        message: typeof error?.message === 'string' ? error.message : 'Failed to add items to cart',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => { },
      });
    }
  };

  // Hide native splash screen INSTANTLY
  React.useEffect(() => {
    // Hide immediately on mount
    SplashScreen.hideAsync().catch(() => { });
  }, []);

  // Handler for forced update from API
  const handleForcedUpdateRequired = React.useCallback((message?: string) => {
    setForcedUpdateRequired(true);
    setForcedUpdateMessage(message);
  }, []);

  const shouldShowForcedUpdate = React.useMemo(() => {
    if (!forcedUpdateRequired) {
      return false;
    }

    // Don't show while checking auth
    if (isCheckingAuth) {
      return false;
    }

    // Don't show on auth screens (login, welcome, OTP)
    const authScreens: Array<typeof currentScreen> = ['login', 'welcome', 'otp'];
    if (authScreens.includes(currentScreen)) {
      return false;
    }

    // Show on all other screens
    return true;
  }, [forcedUpdateRequired, isCheckingAuth, currentScreen]);

  return (
    <>
      <>
        {/* Show Network Status Screen when offline on any screen */}
        {!isCheckingAuth && !isNetworkOnline ? (
          <NetworkStatusScreen selectedLocation={selectedLocation} />
        ) : !isCheckingAuth && (currentScreen === 'login' || (['termsConditions', 'privacyPolicy'].includes(currentScreen) && legalCameFrom === 'login')) ? (
          <LoginScreen
            initialPhoneNumber={phoneNumber}
            onLoginSuccess={handleLoginSuccess}
            onBack={handleBackFromLogin}
            onOpenTerms={() => handleNavigateToTermsConditions('login')}
            onOpenPrivacy={() => handleNavigateToPrivacyPolicy('login')}
          />
        ) : !isCheckingAuth && (currentScreen === 'otp' || (['termsConditions', 'privacyPolicy'].includes(currentScreen) && legalCameFrom === 'otp')) ? (
          <OTPVerificationScreen
            phoneNumber={phoneNumber}
            onBack={handleBackToLogin}
            onSuccess={handleOtpSuccess}
            onOpenTerms={() => handleNavigateToTermsConditions('otp')}
            onOpenPrivacy={() => handleNavigateToPrivacyPolicy('otp')}
          />
        ) : !isCheckingAuth && currentScreen === 'welcome' ? (
          <WelcomeScreen onContinue={handleWelcomeComplete} />
        ) : !isCheckingAuth ? (
          <View style={styles.container}>
            {/* Keep HomeScreen mounted to preserve state */}
            <Animated.View
              style={[
                styles.homeScreenContainer,
                {
                  transform: [{ translateX: homeScreenSlide }],
                },
              ]}
            >
              <HomeScreen
                onLogout={handleLogout}
                onNavigateToProfile={handleNavigateToProfile}
                onNavigateToAddressSelection={handleNavigateToAddressSelection}
                onNavigateToCategory={handleNavigateToCategoryResults}
                onNavigateToPopularDishes={handleNavigateToPopularDishes}
                onNavigateToRestaurant={handleNavigateToRestaurantFromHome}
                onNavigateToCheckout={handleNavigateToCheckout}
                onNavigateToSearch={handleNavigateToSearch}
                onNavigateToLocationSelection={handleNavigateToLocationSelectionFromHome}
                selectedLocation={selectedLocation}
                onCategoriesLoaded={setCategoryData}
                isFocused={currentScreen === 'home'}
                addressRefreshTrigger={addressRefreshTrigger}
                onForcedUpdateRequired={handleForcedUpdateRequired}
                isGuest={!isAuthenticatedRef.current}
                onNavigateToLogin={transitionGuestToLogin}
              />
            </Animated.View>

            {/* Always render ProfileScreen, positioned off-screen initially */}
            <Animated.View
              style={[
                styles.profileOverlay,
                {
                  transform: [{ translateX: profileScreenSlide }],
                },
              ]}
              pointerEvents={currentScreen === 'profile' || currentScreen === 'editProfile' ? 'auto' : 'none'}
            >
              <ProfileScreen
                visible={currentScreen === 'profile'}
                onBack={handleBackToHome}
                onLogout={handleLogout}
                onEditProfile={handleNavigateToEditProfile}
                onMyOrders={handleNavigateToOrders}
                onMyAddresses={handleNavigateToMyAddresses}
                onFavorites={handleNavigateToExploreDishes}
                onContactUs={() => handleNavigateToContactUs('profile')}
                onPrivacyPolicy={handleNavigateToPrivacyPolicy}
                onTermsConditions={handleNavigateToTermsConditions}
                onFaq={handleNavigateToFaq}
              />
            </Animated.View>

            {/* Always render AddressSelectionScreen, positioned off-screen initially */}
            <Animated.View
              style={[
                styles.addressOverlay,
                {
                  transform: [{ translateX: addressScreenSlide }],
                },
              ]}
              pointerEvents={currentScreen === 'addressSelection' || currentScreen === 'locationSelection' ? 'auto' : 'none'}
            >
              <AddressSelectionScreen
                visible={currentScreen === 'addressSelection'}
                isGuest={!isAuthenticatedRef.current}
                onBack={handleBackFromAddressSelection}
                onUseCurrentLocation={(latitude, longitude) => handleNavigateToLocationSelection(undefined, latitude, longitude)}
                onSearch={(query) => handleNavigateToLocationSelection(query)}
                onSelectAddress={(address) => {
                  // Capitalize the type (home -> Home, work -> Work, other -> Other)
                  const formattedType = address.type.charAt(0).toUpperCase() + address.type.slice(1);
                  const location = {
                    name: formattedType,
                    address: `${address.address}, ${address.city}`,
                    latitude: address.latitude,
                    longitude: address.longitude,
                    type: address.type,
                  };
                  setSelectedLocation(location);
                  // Persist guest selection to AsyncStorage for next app open
                  if (!isAuthenticatedRef.current) {
                    saveGuestLocation({ ...location, guestLocationSynced: false }).catch(() => { });
                  }
                  handleAddressChange();
                  handleBackFromAddressSelection();
                }}
              />
            </Animated.View>

            {/* Always render LocationSelectionScreen, positioned off-screen initially */}
            <Animated.View
              style={[
                styles.locationOverlay,
                {
                  transform: [{ translateX: locationScreenSlide }],
                },
              ]}
              pointerEvents={currentScreen === 'locationSelection' ? 'auto' : 'none'}
            >
              <LocationSelectionScreen
                visible={currentScreen === 'locationSelection'}
                initialSearchQuery={locationSearchQuery}
                editingAddress={editingAddress}
                initialLatitude={editingAddress?.latitude || initialLocationCoords?.latitude}
                initialLongitude={editingAddress?.longitude || initialLocationCoords?.longitude}
                isGuest={!isAuthenticatedRef.current}
                onBack={handleBackFromLocationSelection}
                onLocationConfirm={handleLocationConfirm}
              />
            </Animated.View>

            {/* Always render OrdersScreen, positioned off-screen initially */}
            <Animated.View
              style={[
                styles.ordersOverlay,
                {
                  transform: [{ translateX: ordersScreenSlide }],
                },
              ]}
              pointerEvents={currentScreen === 'orders' ? 'auto' : 'none'}
            >
              <OrdersScreen
                visible={currentScreen === 'orders'}
                onBack={handleBackFromOrders}
                onOrderDetails={handleNavigateToOrderDetail}
                onReorder={handleReorder}
                onRateOrder={handleNavigateToRateOrder}
                highlightOrderId={highlightOrderId}
                onTrackOrder={handleNavigateToOrderTracking}
                onHelp={(order) => handleNavigateToHelp('orders', order)}
                onContactUs={() => handleNavigateToContactUs('orders')}
                onViewMore={() => { }}
              />
            </Animated.View>

            {/* Always render OrderDetailScreen, positioned off-screen initially */}
            <Animated.View
              style={[
                styles.orderDetailOverlay,
                {
                  transform: [{ translateX: orderDetailScreenSlide }],
                },
              ]}
              pointerEvents={currentScreen === 'orderDetail' ? 'auto' : 'none'}
            >
              <OrderDetailScreen
                key={selectedOrderId}
                orderId={selectedOrderId}
                visible={currentScreen === 'orderDetail'}
                onBack={handleBackFromOrderDetail}
                onThankDriver={() => { }}
                onRateOrder={handleNavigateToRateOrder}
                onReorder={() => handleReorder(selectedOrderId)}
                onTrackOrder={() => handleNavigateToOrderTracking(selectedOrderId, 'orderDetail')}
                onDownloadInvoice={() => { }}
                onContactUs={() => handleNavigateToContactUs('orderDetail')}
                onHelp={handleNavigateToOrderHelp}
              />
            </Animated.View>

            {/* Conditionally render ChatScreen */}
            {currentScreen === 'chat' && (
              <View style={styles.chatOverlay}>
                <ChatScreen
                  visible={true}
                  onBack={handleBackFromChat}
                  helpOptionId={chatHelpOptionId}
                  helpOptionTitle={chatHelpOptionTitle}
                  orderId={selectedOrderId}
                />
              </View>
            )}

            {/* Conditionally render RateOrderScreen only when needed */}
            {currentScreen === 'rateOrder' && (
              <View style={styles.rateOrderOverlay}>
                <RateOrderScreen
                  orderId={parseInt(selectedOrderId)}
                  orderItems={selectedOrderData?.items || []}
                  onBack={handleBackFromRateOrder}
                  onSubmit={() => {
                    handleBackFromRateOrder();
                  }}
                />
              </View>
            )}

            {/* Conditionally render OrderTrackingScreen only when needed */}
            {currentScreen === 'orderTracking' && (
              <View style={styles.orderTrackingOverlay}>
                <OrderTrackingScreen
                  orderId={selectedOrderId}
                  onBack={handleBackFromOrderTracking}
                  onCallPartner={() => { }}
                />
              </View>
            )}

            {/* Keep SearchScreen mounted after first open to prevent mount-time flicker */}
            {hasSearchMounted && (
              <Animated.View
                style={[
                  styles.searchOverlay,
                  {
                    transform: [{ translateX: searchScreenSlide }],
                  },
                ]}
                pointerEvents={currentScreen === 'search' ? 'auto' : 'none'}
              >
                <SearchScreen
                  onBack={handleBackFromSearch}
                  selectedLocation={selectedLocation}
                  searchQuery={searchQuery}
                  searchResults={searchResults}
                  onSearchQueryChange={setSearchQuery}
                  onSearchResultsChange={setSearchResults}
                  onClearSearch={handleClearSearch}
                  onSelectResult={(_result) => {
                    handleBackFromSearch();
                  }}
                  onSelectItem={(_itemId, itemName) => {
                    // Navigate to category results screen to show restaurants with this dish
                    setSelectedCategory(itemName);
                    setCategoryCameFrom('search');
                    navigateToScreen('categoryResults');

                    // Close search screen with animation
                    Animated.timing(searchScreenSlide, {
                      toValue: SCREEN_WIDTH,
                      duration: 200,
                      useNativeDriver: true,
                    }).start();
                  }}
                  onSelectRestaurant={(restaurantId, restaurantName) => {
                    setSelectedRestaurantId(restaurantId);
                    setSelectedRestaurantName(restaurantName);
                    setRestaurantCameFrom('search');

                    // Ensure restaurant screen starts off-screen before animating
                    restaurantScreenSlide.setValue(SCREEN_WIDTH);

                    // Set screen to restaurant
                    navigateToScreen('restaurant');

                    // Small delay to ensure screen is mounted before animation
                    requestAnimationFrame(() => {
                      // Close search screen and open restaurant screen with animation
                      Animated.parallel([
                        Animated.timing(searchScreenSlide, {
                          toValue: SCREEN_WIDTH,
                          duration: 200,
                          easing: Easing.out(Easing.ease),
                          useNativeDriver: true,
                        }),
                        Animated.timing(restaurantScreenSlide, {
                          toValue: 0,
                          duration: 300,
                          easing: Easing.out(Easing.ease),
                          useNativeDriver: true,
                        }),
                      ]).start();
                    });
                  }}
                />
              </Animated.View>
            )}

            {/* Conditionally render MyAddressesScreen only when needed */}
            {currentScreen === 'myAddresses' && (
              <View style={styles.myAddressesOverlay}>
                <MyAddressesScreen
                  visible={true}
                  onBack={handleBackFromMyAddresses}
                  onAddNew={handleNavigateToAddressSelectionFromMyAddresses}
                  onEditAddress={handleEditAddressFromMyAddresses}
                  onAddressChange={handleAddressChange}
                />
              </View>
            )}

            {/* Conditionally render ExploreDishesScreen only when needed */}
            {currentScreen === 'exploreDishes' && (
              <View style={styles.exploreDishesOverlay} pointerEvents="auto">
                <ExploreDishesScreen
                  visible={true}
                  onBack={handleBackFromExploreDishes}
                  onSelectItem={(item) => {
                    // Navigate to category results screen to show restaurants with this dish
                    setSelectedCategory(item.name);
                    setCategoryCameFrom('favorites');
                    navigateToScreen('categoryResults');
                  }}
                  onSelectRestaurant={(restaurantId, restaurantName) => {
                    setSelectedRestaurantId(Number(restaurantId));
                    setSelectedRestaurantName(restaurantName);
                    setRestaurantCameFrom('favorites');
                    navigateToScreen('restaurant');

                    // Animate restaurant screen sliding in from right
                    Animated.timing(restaurantScreenSlide, {
                      toValue: 0,
                      duration: 250,
                      easing: Easing.out(Easing.cubic),
                      useNativeDriver: true,
                    }).start();
                  }}
                />
              </View>
            )}

            {currentScreen === 'popularDishes' && (
              <View style={styles.exploreDishesOverlay} pointerEvents="auto">
                <PopularDishesScreen
                  onBack={handleBackFromPopularDishes}
                  onNavigateToRestaurant={handleNavigateToRestaurantFromHome}
                  onNavigateToCheckout={handleNavigateToCheckout}
                  selectedLocation={selectedLocation}
                  selectedCollectionId={selectedPopularCollectionId}
                  isGuest={!isAuthenticatedRef.current}
                  onNavigateToLogin={transitionGuestToLogin}
                />
              </View>
            )}



            {/* FAQ Screen, positioned off-screen initially */}
            <Animated.View
              style={[
                styles.faqOverlay,
                {
                  transform: [{ translateX: faqScreenSlide }],
                },
              ]}
              pointerEvents={currentScreen === 'faq' ? 'auto' : 'none'}
            >
              <ContentPage
                title="FAQ"
                url="https://tazty.in/faqs"
                onBack={handleBackFromFaq}
              />
            </Animated.View>

            {/* Always render Help Screen, positioned off-screen initially */}
            <Animated.View
              style={[
                styles.helpOverlay,
                {
                  transform: [{ translateX: helpScreenSlide }],
                },
              ]}
              pointerEvents={currentScreen === 'help' && !isHelpClosing ? 'auto' : 'none'}
            >
              <HelpScreen
                visible={currentScreen === 'help'}
                onBack={handleBackFromHelp}
                onViewOrder={handleHelpViewOrder}
                initialOrder={helpOrderData || undefined}
              />
            </Animated.View>

            {/* Contact Us Screen, positioned off-screen initially */}
            <Animated.View
              style={[
                styles.contactUsOverlay,
                {
                  transform: [{ translateX: contactUsScreenSlide }],
                },
              ]}
              pointerEvents={currentScreen === 'contactUs' ? 'auto' : 'none'}
            >
              <ContactUsScreen
                visible={currentScreen === 'contactUs'}
                onBack={handleBackFromContactUs}
              />
            </Animated.View>

            {/* Conditionally render EditProfileScreen only when needed */}
            {currentScreen === 'editProfile' && (
              <View style={styles.editProfileOverlay}>
                <EditProfileScreen
                  onBack={handleBackFromEditProfile}
                  onSave={(_data) => {
                    handleBackFromEditProfile();
                  }}
                />
              </View>
            )}

            {/* Conditionally render CategoryResultsScreen only when needed */}
            {currentScreen === 'categoryResults' && (
              <View style={styles.categoryOverlay}>
                <CategoryResultsScreen
                  categoryName={selectedCategory}
                  categories={categoryData}
                  onBack={handleBackFromCategoryResults}
                  onNavigateToRestaurant={handleNavigateToRestaurantFromCategory}
                  selectedLocation={selectedLocation}
                  isGuest={!isAuthenticatedRef.current}
                  onNavigateToLogin={transitionGuestToLogin}
                />
              </View>
            )}

            {/* Always render RestaurantScreen, positioned off-screen initially */}
            <Animated.View
              style={[
                styles.restaurantOverlay,
                {
                  transform: [{ translateX: restaurantScreenSlide }],
                },
              ]}
              pointerEvents={currentScreen === 'restaurant' ? 'auto' : 'none'}
            >
              <RestaurantScreen
                visible={currentScreen === 'restaurant'}
                restaurantId={selectedRestaurantId}
                restaurantName={selectedRestaurantName}
                targetItemId={targetRestaurantItemId}
                targetItemName={targetRestaurantItemName}
                onBack={handleBackFromRestaurant}
                onNavigateToCheckout={handleNavigateToCheckout}
                onNavigateToDetails={handleNavigateToRestaurantDetails}
                isGuest={!isAuthenticatedRef.current}
                onNavigateToLogin={transitionGuestToLogin}
                onNavigateToOrders={(orderId) => {
                  // Close restaurant screen and navigate to orders
                  Animated.timing(restaurantScreenSlide, {
                    toValue: SCREEN_WIDTH,
                    duration: 200,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                  }).start(() => {
                    if (orderId) {
                      setSelectedOrderId(orderId.toString());
                    }
                    navigateToScreen('orders');
                  });
                }}
                onNavigateToHome={() => {
                  // Close restaurant screen and go back to appropriate screen
                  if (restaurantCameFrom === 'orders') {
                    // If came from orders (reorder flow), go back to orders screen
                    navigateToScreen('orders');
                  } else if (restaurantCameFrom === 'home') {
                    navigateToScreen('home');
                  } else if (restaurantCameFrom === 'category') {
                    navigateToScreen('home');
                  } else if (restaurantCameFrom === 'search') {
                    navigateToScreen('home');
                  } else if (restaurantCameFrom === 'favorites') {
                    navigateToScreen('home');
                  } else {
                    navigateToScreen('home');
                  }

                  // Animate restaurant screen sliding out to the right
                  Animated.timing(restaurantScreenSlide, {
                    toValue: SCREEN_WIDTH,
                    duration: 200,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                  }).start();
                }}
              />
            </Animated.View>

            {/* Checkout Screen (kept mounted after first open to avoid white flash on return) */}
            {hasCheckoutMounted && (
              <Animated.View
                style={[
                  styles.checkoutOverlay,
                  {
                    transform: [{ translateX: checkoutScreenSlide }],
                  },
                ]}
                pointerEvents={currentScreen === 'checkout' ? 'auto' : 'none'}
              >
                <OrderDetailsScreen
                  restaurantId={cartRestaurantId || selectedRestaurantId}
                  restaurantName={cartRestaurantName || selectedRestaurantName}
                  restaurantAddress={selectedRestaurantAddress}
                  selectedLocation={selectedLocation}
                  visible={currentScreen === 'checkout'}
                  onBack={handleBackFromCheckout}
                  onAddMoreItems={handleAddMoreItemsFromCheckout}
                  onPlaceOrder={handlePlaceOrderFromCheckout}
                  onOrderSuccess={handleOrderSuccessFromCheckout}
                  onOrderCancel={handleOrderCancelFromCheckout}
                  onAddressChange={handleAddressChange}
                />
              </Animated.View>
            )}

            {/* Restaurant Details Screen */}
            {currentScreen === 'restaurantDetails' && (
              <View style={styles.restaurantDetailsOverlay}>
                <RestaurantDetailsScreen
                  restaurantId={selectedRestaurantId}
                  restaurantName={selectedRestaurantName}
                  latitude={selectedLocation?.latitude || 9.9252}
                  longitude={selectedLocation?.longitude || 78.1198}
                  onBack={handleBackFromRestaurantDetails}
                  isGuest={!isAuthenticatedRef.current}
                  onNavigateToLogin={transitionGuestToLogin}
                />
              </View>
            )}
          </View>
        ) : null}

        {/* Render Legal Overlays outside so they can float over Login/OTP/Welcome/App */}
        {!isCheckingAuth && (
          <>
            <Animated.View
              style={[
                styles.privacyPolicyOverlay,
                {
                  transform: [{ translateX: privacyPolicyScreenSlide }],
                },
              ]}
              pointerEvents={currentScreen === 'privacyPolicy' ? 'auto' : 'none'}
            >
              <ContentPage
                title="Privacy Policy"
                url="https://tazty.in/privacy"
                onBack={handleBackFromPrivacyPolicy}
              />
            </Animated.View>

            <Animated.View
              style={[
                styles.termsConditionsOverlay,
                {
                  transform: [{ translateX: termsConditionsScreenSlide }],
                },
              ]}
              pointerEvents={currentScreen === 'termsConditions' ? 'auto' : 'none'}
            >
              <ContentPage
                title="Terms & Conditions"
                url="https://tazty.in/terms"
                onBack={handleBackFromTermsConditions}
              />
            </Animated.View>
          </>
        )}

        {/* Forced Update Modal - Blocks all app usage when flag is true */}
        {/* Show on all screens except login, welcome, and OTP verification */}
        {/* Works when app is opened from notification or any other scenario */}
        <ForcedUpdateModal
          visible={shouldShowForcedUpdate}
          title="Update Available"
          message={forcedUpdateMessage || "A new version of the app is available. Please update to continue using the app."}
          updateButtonText="Update Now"
        />
        {isIosSwipeBackEnabled && (
          <View
            style={styles.iosEdgeSwipeArea}
            onStartShouldSetResponder={() => true}
            onResponderGrant={(evt) => {
              swipeStartXRef.current = evt.nativeEvent.pageX;
            }}
            onResponderRelease={(evt) => {
              const startX = swipeStartXRef.current;
              swipeStartXRef.current = null;
              if (startX == null) {
                return;
              }
              const dx = evt.nativeEvent.pageX - startX;
              if (dx > 56) {
                handleBackNavigation(currentScreenRef.current);
              }
            }}
          />
        )}
      </>
    </>
  );
}

// Wrapper App component with providers
export default function App() {
  const [showCustomSplash, setShowCustomSplash] = React.useState(true);

  return (
    <>
      {showCustomSplash && (
        <CustomSplashScreen
          onFinish={() => {
            setShowCustomSplash(false);
          }}
        />
      )}
      <VegModeProvider>
        <CartProvider>
          <ConfirmationProvider>
            <SafeAreaProvider>
              <SnackbarProvider>
                <OrdersProvider>
                  <AppContent
                    onNotificationNavigateToOrders={() => {
                      setShowCustomSplash(false);
                    }}
                  />
                </OrdersProvider>
              </SnackbarProvider>
            </SafeAreaProvider>
          </ConfirmationProvider>
        </CartProvider>
      </VegModeProvider>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  homeScreenContainer: {
    flex: 1,
  },
  profileOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    backgroundColor: '#F3FFFA',
  },
  addressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    backgroundColor: '#F5F5F5',
  },
  locationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    backgroundColor: '#FFFFFF',
  },
  ordersOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    backgroundColor: '#F3F4F6',
  },
  orderDetailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 8,
    backgroundColor: '#F3F4F6',
  },
  orderHelpOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9,
    backgroundColor: '#F5F5F5',
  },
  chatOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: '#FFFFFF',
  },
  rateOrderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 6,
    backgroundColor: '#F5F5F5',
  },
  orderTrackingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: '#E9E9E9',
  },
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 8,
    backgroundColor: '#FFFFFF',
  },
  myAddressesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    backgroundColor: '#F5F5F5',
  },
  exploreDishesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    backgroundColor: '#FFFFFF',
  },
  privacyPolicyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 6,
    backgroundColor: '#FFFFFF',
  },
  termsConditionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 7,
    backgroundColor: '#FFFFFF',
  },
  faqOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 7,
    backgroundColor: '#FFFFFF',
  },
  helpOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 8,
    backgroundColor: '#FFFFFF',
  },
  contactUsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9,
    backgroundColor: '#FFFFFF',
  },
  editProfileOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    backgroundColor: '#F5F5F5',
  },
  categoryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 6,
    backgroundColor: '#FFFFFF',
  },
  restaurantOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    zIndex: 7,
    backgroundColor: '#FFFFFF',
  },
  restaurantDetailsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 8,
    backgroundColor: '#F5F5F5',
  },
  checkoutOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    zIndex: 9,
    backgroundColor: '#FFFFFF',
  },
  testFCMOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 8,
    backgroundColor: '#F5F5F5',
  },
  iosEdgeSwipeArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 20,
    zIndex: 999,
    backgroundColor: 'transparent',
  },
});
