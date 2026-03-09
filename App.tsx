import React, { useCallback } from 'react';
import { View, StyleSheet, Animated, Dimensions, BackHandler, Easing, Text, AppState } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
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
import { ContentPage } from '@/screens/Legal/ContentPage';
import { HelpScreen } from '@/screens/Help/HelpScreen';
import { ContactUsScreen } from '@/screens/Help/ContactUsScreen';
import { ChatScreen } from '@/screens/Help/ChatScreen';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authService } from '@/services/auth.service';
import { apiService } from '@/services/api.service';
import { storageService } from '@/services/storage.service';
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
import { analyticsService, AnalyticsEvents, AnalyticsScreens } from '@/services/analytics.service';
import { inAppUpdateService } from '@/services/inAppUpdate.service';
import { crashlyticsService } from '@/services/crashlytics.service';
import { ForcedUpdateModal } from '@/components/ForcedUpdateModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Let native splash auto-hide immediately - don't prevent it
// SplashScreen.preventAutoHideAsync();

// Inner component with cart and confirmation context access
function AppContent({ onNotificationNavigateToOrders }: { onNotificationNavigateToOrders?: () => void }) {
  const {
    addToCart,
    setRestaurantInfo,
    checkRestaurantConflict,
    clearCart,
    reloadCart,
    restaurantId: cartRestaurantId,
    restaurantName: cartRestaurantName,
  } = useCart();
  const { showConfirmation } = useConfirmation();

  const [currentScreen, setCurrentScreen] = React.useState<'login' | 'otp' | 'welcome' | 'home' | 'profile' | 'editProfile' | 'orders' | 'orderDetail' | 'rateOrder' | 'orderTracking' | 'search' | 'myAddresses' | 'addressSelection' | 'locationSelection' | 'categoryResults' | 'restaurant' | 'restaurantDetails' | 'exploreDishes' | 'checkout' | 'privacyPolicy' | 'termsConditions' | 'help' | 'contactUs' | 'faq' | 'orderHelp' | 'chat'>('login');
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
  } | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = React.useState('Briyani');
  const [categoryData, setCategoryData] = React.useState<any[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = React.useState<number>(1);
  const [selectedRestaurantName, setSelectedRestaurantName] = React.useState('');
  const [selectedRestaurantAddress, setSelectedRestaurantAddress] = React.useState<string>('');
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
  const [ordersCameFrom, setOrdersCameFrom] = React.useState<'profile' | 'orderDetail'>('profile');
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
  const startupNotificationNavigationRef = React.useRef(false);

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

  const [fontsLoaded] = useFonts({
    'Poppins': Poppins_400Regular,
    'Poppins_400Regular': Poppins_400Regular,
    'Poppins_500Medium': Poppins_500Medium,
    'Poppins_600SemiBold': Poppins_600SemiBold,
    'Poppins_700Bold': Poppins_700Bold,
  });

  // Set Poppins as default font for all Text components
  React.useEffect(() => {
    if (fontsLoaded) {
      if (!(Text as any).defaultProps) {
        (Text as any).defaultProps = {};
      }
      (Text as any).defaultProps.style = {
        ...(Text as any).defaultProps.style,
        fontFamily: 'Poppins',
        paddingRight: 2, // Prevent horizontal clipping of custom fonts on iOS
      };
    }
  }, [fontsLoaded]);

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
  }, [currentScreen, isCheckingAuth]);

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
      setOrdersCameFrom('profile');
      setHighlightOrderId(orderId || null);
      setCurrentScreen('orders');

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
        analyticsService.logEvent(AnalyticsEvents.APP_FOREGROUND);
      } else if (nextAppState === 'background') {
        // Track app background
        analyticsService.logEvent(AnalyticsEvents.APP_BACKGROUND);
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
          try {
            // Force logout without API call (user is already deleted)
            await authService.forceLogout();

            // Reset analytics user data
            await analyticsService.resetAnalyticsData();

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

            // Navigate to login screen
            setCurrentScreen('login');
            setPhoneNumber('');
          } catch (error) {
            console.error('[App] Error handling user deletion:', error);
            // Still navigate to login even if cleanup fails
            setCurrentScreen('login');
          }
        });

        // Set callback for session expiration
        // This will be called when refresh token is invalid/expired and session is cleared
        apiService.setSessionExpiredCallback(async () => {
          console.warn('[App] Session expired, navigating to login...');
          try {
            // Force logout to clear all data
            await authService.forceLogout();

            // Reset analytics user data
            await analyticsService.resetAnalyticsData();

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

            // Navigate to login screen
            setCurrentScreen('login');
            setPhoneNumber('');
          } catch (error) {
            console.error('[App] Error handling session expiration:', error);
            // Still navigate to login even if cleanup fails
            setCurrentScreen('login');
          }
        });

        // Initialize Crashlytics
        await crashlyticsService.initialize();

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
          const currentUser = await authService.getCurrentUser();
          if (currentUser?.id) {
            const idString = currentUser.id.toString();
            await analyticsService.setUserId(idString);
            await crashlyticsService.setUserId(idString);
          }

          // If app was opened by tapping an FCM notification, keep the
          // notification target screen (orders/track) and avoid overriding it.
          if (!startupNotificationNavigationRef.current) {
            setCurrentScreen('home');
          }
        } else {
          // No valid session, go to login
          setCurrentScreen('login');
        }
      } catch (error) {
        // If auth check fails, go to login screen
        setCurrentScreen('login');
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

  // Handle Android back button
  React.useEffect(() => {
    const backAction = () => {
      // Block navigation when forced update is required, but ONLY on non-auth screens
      // Allow back button to work normally on login, welcome, and OTP screens
      const authScreens: Array<typeof currentScreen> = ['login', 'welcome', 'otp'];
      const isOnAuthScreen = authScreens.includes(currentScreen);

      if (forcedUpdateRequired && !isOnAuthScreen) {
        return true; // Prevent back button from doing anything on non-auth screens
      }

      // Handle back button based on current screen
      switch (currentScreen) {
        case 'home':
          // On home screen, exit app
          BackHandler.exitApp();
          return true;
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
          // OrderHelp is no longer used, redirect to chat back handler
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
          handleBackFromHelp();
          return true;
        case 'otp':
          handleBackToLogin();
          return true;
        case 'welcome':
          // On welcome screen, go back to OTP
          setCurrentScreen('otp');
          return true;
        default:
          return false;
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [currentScreen]);

  const handleLoginSuccess = (phone: string) => {
    setPhoneNumber(phone);
    setCurrentScreen('otp');
    analyticsService.logEvent(AnalyticsEvents.LOGIN_START, { phone_number: phone });
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
    if (isExistingUser) {
      // Existing user - go directly to home (skip address selection)
      // Set analytics user ID
      const currentUser = await authService.getCurrentUser();
      if (currentUser?.id) {
        await analyticsService.setUserId(currentUser.id.toString());
      }

      await analyticsService.logEvent(AnalyticsEvents.LOGIN_SUCCESS, {
        is_existing_user: true,
      });

      setCurrentScreen('home');
      setIsRegistrationFlow(false);
      reloadCart().catch(() => { });
      ensureNotificationPermission();
    } else {
      // New user - show welcome screen for profile completion
      await analyticsService.logEvent(AnalyticsEvents.SIGNUP_START);
      setCurrentScreen('welcome');
      setIsRegistrationFlow(true);
      ensureNotificationPermission();
    }
    setPhoneNumber('');
  };

  const handleWelcomeComplete = async (name: string, email: string) => {
    // Save user profile data to storage
    try {
      const currentUser = await authService.getCurrentUser();
      if (currentUser) {
        // Update user data with name and email
        const updatedUser = {
          ...currentUser,
          name,
          email,
        };
        await storageService.saveUser(updatedUser);

        // Set analytics user ID and properties
        await analyticsService.setUserId(currentUser.id.toString());
        await analyticsService.setUserProperties({
          user_name: name,
          user_email: email,
        });
      }
    } catch (error) {
      // Silent fail
    }

    // Log signup success
    await analyticsService.logEvent(AnalyticsEvents.SIGNUP_SUCCESS, {
      has_name: !!name,
      has_email: !!email,
    });

    // For brand-new users, go directly to location selection to avoid
    // rendering Home briefly (which can cause a visible green flash).
    setAddressSelectionCameFrom('home');
    setLocationSelectionCameFrom('home');
    setSearchQuery('');
    setInitialLocationCoords(null);
    setCurrentScreen('locationSelection');
    locationScreenSlide.setValue(0);
    setIsRegistrationFlow(false);

    // Ensure cart (if any) is synced for this user
    reloadCart().catch(() => { });
  };

  const handleLogout = async () => {
    // Log logout event
    await analyticsService.logEvent(AnalyticsEvents.LOGOUT);

    // Reset analytics user data
    await analyticsService.resetAnalyticsData();

    // Clear authentication tokens and user data
    await authService.logout();

    // Clear address cache to prevent showing previous account's addresses
    addressService.clearCache();

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

    // Reset state
    setCurrentScreen('login');
    setPhoneNumber('');
  };

  const handleBackToLogin = () => {
    setCurrentScreen('login');
  };

  const handleNavigateToProfile = () => {
    // Reset persisted orders and scroll position when navigating to profile
    // This ensures a fresh state when user returns to orders screen
    resetOrdersPersistence();

    // Clear orders context to ensure fresh data on next visit
    if (ordersDispatch) {
      ordersDispatch({ type: 'CLEAR_ORDERS' });
    }

    setCurrentScreen('profile');

    // Slide both screens simultaneously
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
      setCurrentScreen('home');
    });
  };

  // Address Selection Navigation
  const handleNavigateToAddressSelection = () => {
    setCurrentScreen('addressSelection');

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
    if (addressSelectionCameFrom === 'myAddresses') {
      setCurrentScreen('myAddresses');
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
        setCurrentScreen('home');
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
    if (currentScreen === 'addressSelection') {
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
    setCurrentScreen('locationSelection');

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
    setCurrentScreen('locationSelection');

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
        setCurrentScreen('myAddresses');
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
        setCurrentScreen('addressSelection');
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
        setCurrentScreen('home');
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
    // Update selected location
    setSelectedLocation({
      name: location.name || location.locationName,
      address: location.locationAddress || location.address,
      // Do NOT silently fall back to hardcoded Madurai coordinates.
      // Only use coordinates that were explicitly selected/confirmed.
      latitude: location.latitude ?? location.lat,
      longitude: location.longitude ?? location.lng,
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
        setCurrentScreen('myAddresses');
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
        setCurrentScreen('home');
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
        setCurrentScreen('home');
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
    setCurrentScreen('categoryResults');
  };

  const handleBackFromCategoryResults = () => {
    if (categoryCameFrom === 'search') {
      setCurrentScreen('search');
      // Re-open search screen with animation
      Animated.timing(searchScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (categoryCameFrom === 'favorites') {
      setCurrentScreen('exploreDishes');
    } else {
      setCurrentScreen('home');
    }
  };

  // Restaurant Navigation from Category
  const handleNavigateToRestaurantFromCategory = (restaurantId: number, restaurantName: string) => {
    setSelectedRestaurantId(restaurantId);
    setSelectedRestaurantName(restaurantName);
    setRestaurantCameFrom('category');
    setCurrentScreen('restaurant');

    // Animate restaurant screen sliding in from right
    Animated.timing(restaurantScreenSlide, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // Restaurant Navigation from Home
  const handleNavigateToRestaurantFromHome = (restaurantId: number, restaurantName: string) => {
    setSelectedRestaurantId(restaurantId);
    setSelectedRestaurantName(restaurantName);
    setRestaurantCameFrom('home');
    setCurrentScreen('restaurant');

    // Track restaurant view
    analyticsService.logEvent(AnalyticsEvents.RESTAURANT_VIEW, {
      restaurant_id: restaurantId,
      restaurant_name: restaurantName,
      source: 'home',
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
    setSelectedRestaurantId(restaurantId);
    setSelectedRestaurantName(restaurantName);
    setSelectedRestaurantAddress(restaurantAddress || '');
    setCheckoutCameFrom(from);
    setHasCheckoutMounted(true);

    // Reset animation to off-screen position first
    checkoutScreenSlide.setValue(SCREEN_WIDTH);

    // Set screen to checkout
    setCurrentScreen('checkout');

    // Animate checkout screen sliding in from right (next frame)
    requestAnimationFrame(() => {
      Animated.timing(checkoutScreenSlide, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [checkoutScreenSlide]);

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
        setCurrentScreen('home');
      } else if (checkoutCameFrom === 'restaurant') {
        // Ensure restaurant layer is visible before switching to it
        restaurantScreenSlide.setValue(0);
        setCurrentScreen('restaurant');
      } else {
        ordersScreenSlide.setValue(0);
        setCurrentScreen('orders');
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
    setCurrentScreen('restaurant');

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
        setCurrentScreen('orderDetail');
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
        setCurrentScreen('restaurant');
        // Force restaurant screen to reload by briefly hiding and showing
        // This ensures the menu loads properly
        setTimeout(() => {
          // The restaurant screen's useEffect will trigger when visible becomes true
        }, 100);
      } else {
        setCurrentScreen('home');
      }
    });
  }, [checkoutScreenSlide, checkoutCameFrom]);

  // Back from Restaurant (dynamic based on where we came from)
  const handleBackFromRestaurant = () => {
    // For checkout return flow, switch instantly to avoid showing intermediate screens.
    if (restaurantCameFrom === 'checkout') {
      // Prevent in-flight animations from overriding values after back is pressed.
      restaurantScreenSlide.stopAnimation();
      checkoutScreenSlide.stopAnimation();
      restaurantScreenSlide.setValue(SCREEN_WIDTH);
      checkoutScreenSlide.setValue(0);
      // After returning from "Add More Items", next back from checkout should go home.
      setCheckoutCameFrom('home');
      setCurrentScreen('checkout');
      return;
    }

    // Animate restaurant screen sliding out to the right
    Animated.timing(restaurantScreenSlide, {
      toValue: SCREEN_WIDTH,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      // Set screen after animation completes to prevent double loading
      if (restaurantCameFrom === 'home') {
        setCurrentScreen('home');
      } else if (restaurantCameFrom === 'category') {
        setCurrentScreen('categoryResults');
      } else if (restaurantCameFrom === 'search') {
        setCurrentScreen('search');
        // Re-open search screen with animation
        Animated.timing(searchScreenSlide, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else if (restaurantCameFrom === 'favorites') {
        setCurrentScreen('exploreDishes');
      } else if (restaurantCameFrom === 'orders') {
        setCurrentScreen('orders');
      } else {
        setCurrentScreen('categoryResults');
      }
    });
  };

  // Navigate to Restaurant Details
  const handleNavigateToRestaurantDetails = () => {
    try {
      setCurrentScreen('restaurantDetails');
    } catch (error) {
      // Error navigating to restaurant details
    }
  };

  // Back from Restaurant Details
  const handleBackFromRestaurantDetails = () => {
    setCurrentScreen('restaurant');
  };

  // Orders Navigation
  const handleNavigateToOrders = () => {
    setOrdersCameFrom('profile'); // Track that we're coming from profile
    setCurrentScreen('orders');
    // Reset orders screen position to show it
    ordersScreenSlide.setValue(0);
    analyticsService.logEvent(AnalyticsEvents.ORDER_VIEW);
  };

  const handleBackFromOrders = () => {
    // Animate orders screen out
    Animated.timing(ordersScreenSlide, {
      toValue: SCREEN_WIDTH,
      duration: 200,  // Small duration for smooth transition
      useNativeDriver: true,
    }).start(() => {
      // If we came from orderDetail (which came from checkout), go to home
      // Otherwise, go to profile (normal flow from profile screen)
      if (ordersCameFrom === 'orderDetail') {
        // Batch all screen position resets together before state update
        orderDetailScreenSlide.setValue(SCREEN_WIDTH);
        ordersScreenSlide.setValue(SCREEN_WIDTH);
        profileScreenSlide.setValue(SCREEN_WIDTH);
        restaurantScreenSlide.setValue(SCREEN_WIDTH);
        checkoutScreenSlide.setValue(SCREEN_WIDTH);
        homeScreenSlide.setValue(0);

        // Update state after all positions are set
        setCurrentScreen('home');
        setOrdersCameFrom('profile'); // Reset for next time
      } else {
        setCurrentScreen('profile');
      }
    });
  };

  // Order Detail Navigation
  const handleNavigateToOrderDetail = (orderId: string) => {
    setOrderDetailCameFrom('orders');
    setSelectedOrderId(orderId);
    setCurrentScreen('orderDetail');
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

    // Animate order detail screen out
    Animated.timing(orderDetailScreenSlide, {
      toValue: SCREEN_WIDTH,
      duration: 0,  // Instant
      useNativeDriver: true,
    }).start(() => {
      setCurrentScreen('orders');
      ordersScreenSlide.setValue(0);
    });
  };

  // My Addresses Navigation
  const handleNavigateToMyAddresses = () => {
    setCurrentScreen('myAddresses');
  };

  const handleBackFromMyAddresses = () => {
    // Reset location screen position and clear all related state
    locationScreenSlide.setValue(SCREEN_WIDTH);
    setEditingAddress(null);
    setLocationSelectionCameFrom('home');
    setAddressSelectionCameFrom('home');
    setSearchQuery('');
    setInitialLocationCoords(null);
    setCurrentScreen('profile');
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
    setCurrentScreen('locationSelection');

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
    setCurrentScreen('locationSelection');

    // Animate the location screen in
    Animated.timing(locationScreenSlide, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Explore Dishes (Favorites) Navigation
  const handleNavigateToExploreDishes = () => {
    setCurrentScreen('exploreDishes');
  };

  const handleBackFromExploreDishes = () => {
    setCurrentScreen('profile');
  };

  // Privacy Policy Navigation
  const handleNavigateToPrivacyPolicy = (from: 'profile' | 'login' | 'otp' = 'profile') => {
    setLegalCameFrom(from);
    setCurrentScreen('privacyPolicy');

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
        setCurrentScreen('login');
      });
    } else if (legalCameFrom === 'otp') {
      Animated.timing(privacyPolicyScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setCurrentScreen('otp');
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
        setCurrentScreen('profile');
      });
    }
  };

  // Terms & Conditions Navigation
  const handleNavigateToTermsConditions = (from: 'profile' | 'login' | 'otp' = 'profile') => {
    setLegalCameFrom(from);
    setCurrentScreen('termsConditions');

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
        setCurrentScreen('login');
      });
    } else if (legalCameFrom === 'otp') {
      Animated.timing(termsConditionsScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setCurrentScreen('otp');
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
        setCurrentScreen('profile');
      });
    }
  };

  // FAQ Navigation
  const handleNavigateToFaq = () => {
    setCurrentScreen('faq');
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
        setCurrentScreen('login');
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
        setCurrentScreen('profile');
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
    setCurrentScreen('contactUs');

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
        setCurrentScreen('profile');
      });
    } else if (contactUsCameFrom === 'orderDetail') {
      // Back to order detail screen - instant, no animation
      contactUsScreenSlide.setValue(SCREEN_WIDTH);
      orderDetailScreenSlide.setValue(0);
      setCurrentScreen('orderDetail');
    } else {
      // Back to orders screen - instant, no animation
      contactUsScreenSlide.setValue(SCREEN_WIDTH);
      ordersScreenSlide.setValue(0);
      setCurrentScreen('orders');
    }
  };

  const handleNavigateToHelp = (from: 'profile' | 'orders' = 'profile', order?: OrderListItem) => {
    setHelpCameFrom(from);
    setHelpOrderData(order ?? null);
    setCurrentScreen('help');

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
    afterStateCallback?: () => void
  ) => {
    if (currentScreen !== targetScreen) {
      setCurrentScreen(targetScreen);
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
      setIsHelpClosing(false);
      setHelpOrderData(null);
      afterStateCallback?.();
    });
  };

  const handleBackFromHelp = () => {
    closeHelpScreen(helpCameFrom);
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
    setCurrentScreen('editProfile');
  };

  const handleBackFromEditProfile = () => {
    setCurrentScreen('profile');
  };

  // Rate Order Navigation
  const handleNavigateToRateOrder = (orderId: string, orderData?: any) => {
    setSelectedOrderId(orderId);
    setSelectedOrderData(orderData);
    setCurrentScreen('rateOrder');
  };

  const handleBackFromRateOrder = () => {
    setCurrentScreen('orders');
    setSelectedOrderData(null);
  };

  // Order Tracking Navigation
  const handleNavigateToOrderTracking = (orderId: string, cameFrom?: 'orders' | 'checkout' | 'orderDetail') => {
    setSelectedOrderId(orderId);
    setOrderTrackingCameFrom(cameFrom || 'orders');
    setCurrentScreen('orderTracking');
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
      setCurrentScreen('home');
      setOrderTrackingCameFrom('orders'); // Reset for next time
    } else if (orderTrackingCameFrom === 'orderDetail') {
      // If came from order detail, go back to order detail
      setCurrentScreen('orderDetail');
    } else {
      // If came from orders, go back to orders
      setCurrentScreen('orders');
    }
  };

  // Chat Navigation
  const handleNavigateToOrderHelp = () => {
    setChatCameFrom('orderDetail');
    setCurrentScreen('chat');
  };

  const handleBackFromChat = () => {
    // Navigate back based on where we came from
    if (chatCameFrom === 'orderDetail') {
      setCurrentScreen('orderDetail');
      setChatCameFrom(null);
    } else if (chatCameFrom === 'help') {
      setCurrentScreen('help');
      setChatCameFrom(null);
    } else {
      // Fallback: if chatCameFrom is not set, try to determine from context
      // Priority: orderDetail (if we have selectedOrderId) > help > orders
      if (selectedOrderId) {
        // If we have a selected order, likely came from orderDetail
        setCurrentScreen('orderDetail');
      } else if (helpCameFrom === 'orders' || helpCameFrom === 'profile') {
        // If help screen was accessed, go back to help
        setCurrentScreen('help');
      } else {
        // Ultimate fallback: go to orders screen (safe default)
        setCurrentScreen('orders');
      }
      setChatCameFrom(null);
    }
  };

  // Search Navigation
  const handleNavigateToSearch = () => {
    setHasSearchMounted(true);
    searchScreenSlide.stopAnimation();
    searchScreenSlide.setValue(SCREEN_WIDTH);
    setCurrentScreen('search');

    // Track search start
    analyticsService.logEvent(AnalyticsEvents.SEARCH_START);

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
      setCurrentScreen('home');
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
          setCurrentScreen('restaurant');

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
              onNavigateToRestaurant={handleNavigateToRestaurantFromHome}
              onNavigateToCheckout={handleNavigateToCheckout}
              onNavigateToSearch={handleNavigateToSearch}
              onNavigateToLocationSelection={handleNavigateToLocationSelectionFromHome}
              selectedLocation={selectedLocation}
              onCategoriesLoaded={setCategoryData}
              isFocused={currentScreen === 'home'}
              addressRefreshTrigger={addressRefreshTrigger}
              onForcedUpdateRequired={handleForcedUpdateRequired}
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
              onBack={handleBackFromAddressSelection}
              onUseCurrentLocation={(latitude, longitude) => handleNavigateToLocationSelection(undefined, latitude, longitude)}
              onSearch={(query) => handleNavigateToLocationSelection(query)}
              onSelectAddress={(address) => {
                // Capitalize the type (home -> Home, work -> Work, other -> Other)
                const formattedType = address.type.charAt(0).toUpperCase() + address.type.slice(1);
                setSelectedLocation({
                  name: formattedType,
                  address: `${address.address}, ${address.city}`,
                  // Do NOT silently fall back to hardcoded Madurai coordinates.
                  // If an address has no coordinates yet, keep them undefined until user sets them.
                  latitude: address.latitude,
                  longitude: address.longitude,
                });
                // Trigger homepage refresh when address changes
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
              initialSearchQuery={locationSearchQuery}
              editingAddress={editingAddress}
              initialLatitude={editingAddress?.latitude || initialLocationCoords?.latitude}
              initialLongitude={editingAddress?.longitude || initialLocationCoords?.longitude}
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
              onViewMore={() => {}}
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
              onThankDriver={() => {}}
              onRateOrder={handleNavigateToRateOrder}
              onReorder={() => handleReorder(selectedOrderId)}
              onTrackOrder={() => handleNavigateToOrderTracking(selectedOrderId, 'orderDetail')}
              onDownloadInvoice={() => {}}
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
                onCallPartner={() => {}}
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
                    setCurrentScreen('categoryResults');

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
                    setCurrentScreen('restaurant');

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
                    setCurrentScreen('categoryResults');
                  }}
                  onSelectRestaurant={(restaurantId, restaurantName) => {
                    setSelectedRestaurantId(Number(restaurantId));
                    setSelectedRestaurantName(restaurantName);
                    setRestaurantCameFrom('favorites');
                    setCurrentScreen('restaurant');

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
                onBack={handleBackFromRestaurant}
                onNavigateToCheckout={handleNavigateToCheckout}
                onNavigateToDetails={handleNavigateToRestaurantDetails}
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
                    setCurrentScreen('orders');
                  });
                }}
                onNavigateToHome={() => {
                  // Close restaurant screen and go back to appropriate screen
                  if (restaurantCameFrom === 'orders') {
                    // If came from orders (reorder flow), go back to orders screen
                    setCurrentScreen('orders');
                  } else if (restaurantCameFrom === 'home') {
                    setCurrentScreen('home');
                  } else if (restaurantCameFrom === 'category') {
                    setCurrentScreen('home');
                  } else if (restaurantCameFrom === 'search') {
                    setCurrentScreen('home');
                  } else if (restaurantCameFrom === 'favorites') {
                    setCurrentScreen('home');
                  } else {
                    setCurrentScreen('home');
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
});
