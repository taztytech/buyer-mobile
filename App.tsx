import React, { useCallback } from 'react';
import { View, StyleSheet, Animated, Dimensions, BackHandler, Easing, Text } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { LoginScreen } from '@/screens/Auth/LoginScreen';
import { OTPVerificationScreen } from '@/screens/Auth/OTPVerificationScreen';
import { WelcomeScreen } from '@/screens/Auth/WelcomeScreen';
import { HomeScreen } from '@/screens/Home/HomeScreen';
import { ProfileScreen } from '@/screens/Profile/ProfileScreen';
import { EditProfileScreen } from '@/screens/Profile/EditProfileScreen';
import { OrdersScreen } from '@/screens/Order/OrdersScreen';
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
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '@/services/auth.service';
import { apiService } from '@/services/api.service';
import { storageService } from '@/services/storage.service';
import { homeService } from '@/services/home.service';
import { CartProvider, useCart } from '@/context/CartContext';
import { VegModeProvider } from '@/context/VegModeContext';
import { ConfirmationProvider, useConfirmation } from '@/context/ConfirmationContext';
import { ordersService, OrderListItem } from '@/services/orders.service';
import CustomSplashScreen from '@/components/CustomSplashScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Let native splash auto-hide immediately - don't prevent it
// SplashScreen.preventAutoHideAsync();

// Inner component with cart and confirmation context access
function AppContent() {
  const { addToCart, setRestaurantInfo, checkRestaurantConflict, clearCart, restaurantId: cartRestaurantId, restaurantName: cartRestaurantName } = useCart();
  const { showConfirmation } = useConfirmation();

  const [currentScreen, setCurrentScreen] = React.useState<'login' | 'otp' | 'welcome' | 'home' | 'profile' | 'editProfile' | 'orders' | 'orderDetail' | 'rateOrder' | 'orderTracking' | 'search' | 'myAddresses' | 'addressSelection' | 'locationSelection' | 'categoryResults' | 'restaurant' | 'restaurantDetails' | 'exploreDishes' | 'checkout' | 'privacyPolicy' | 'termsConditions' | 'help' | 'contactUs' | 'faq'>('login');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
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
  const [restaurantCameFrom, setRestaurantCameFrom] = React.useState<'home' | 'category' | 'search' | 'favorites' | 'orders'>('home');
  const [checkoutCameFrom, setCheckoutCameFrom] = React.useState<'restaurant' | 'home' | 'orders'>('restaurant');
  const [categoryCameFrom, setCategoryCameFrom] = React.useState<'home' | 'search' | 'favorites'>('home');
  const [selectedOrderId, setSelectedOrderId] = React.useState<string>('');
  const [selectedOrderData, setSelectedOrderData] = React.useState<any>(null);
  const [addressSelectionCameFrom, setAddressSelectionCameFrom] = React.useState<'home' | 'myAddresses' | 'registration'>('home');
  const [locationSelectionCameFrom, setLocationSelectionCameFrom] = React.useState<'home' | 'addressSelection' | 'myAddresses'>('home');
  const [orderTrackingCameFrom, setOrderTrackingCameFrom] = React.useState<'orders' | 'checkout' | 'orderDetail'>('orders');
  const [editingAddress, setEditingAddress] = React.useState<any>(null);
  const [helpOrderData, setHelpOrderData] = React.useState<OrderListItem | null>(null);
  const [isRegistrationFlow, setIsRegistrationFlow] = React.useState(false);
  const [initialLocationCoords, setInitialLocationCoords] = React.useState<{ latitude?: number; longitude?: number } | null>(null);
  const [legalCameFrom, setLegalCameFrom] = React.useState<'profile' | 'login' | 'otp'>('profile');
  const [addressRefreshTrigger, setAddressRefreshTrigger] = React.useState(0);
  const [pendingHomeRefresh, setPendingHomeRefresh] = React.useState(false);
  const [showNetworkBanner, setShowNetworkBanner] = React.useState(false);
  const [networkBannerType, setNetworkBannerType] = React.useState<'offline' | 'online'>('offline');
  const lastConnectionStatusRef = React.useRef<boolean | null>(null);
  const networkBannerTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const homeScreenSlide = React.useRef(new Animated.Value(0)).current;
  const profileScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const searchScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const privacyPolicyScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const termsConditionsScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const addressScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const locationScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const helpScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const contactUsScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const faqScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const restaurantScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const checkoutScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;

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
      // Set default font family for all Text components
      // This applies Poppins as the default font across the entire app
      if (!Text.defaultProps) {
        Text.defaultProps = {};
      }
      Text.defaultProps.style = { fontFamily: 'Poppins' };
    }
  }, [fontsLoaded]);

  // Network connectivity listener - runs while app is open
  React.useEffect(() => {
    const showOfflineBanner = () => {
      if (networkBannerTimeoutRef.current) {
        clearTimeout(networkBannerTimeoutRef.current);
        networkBannerTimeoutRef.current = null;
      }
      setNetworkBannerType('offline');
      setShowNetworkBanner(true);
    };

    const showOnlineBannerWithTimeout = () => {
      if (networkBannerTimeoutRef.current) {
        clearTimeout(networkBannerTimeoutRef.current);
      }
      setNetworkBannerType('online');
      setShowNetworkBanner(true);

      networkBannerTimeoutRef.current = setTimeout(() => {
        setShowNetworkBanner(false);
        networkBannerTimeoutRef.current = null;
      }, 3000);
    };

    let isFirstUpdate = true;

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = (state.isInternetReachable ?? state.isConnected) ?? false;
      const previous = lastConnectionStatusRef.current;

      lastConnectionStatusRef.current = connected;

      if (isFirstUpdate) {
        isFirstUpdate = false;

        // On app open: show status once based on current connectivity
        if (connected) {
          showOnlineBannerWithTimeout();
        } else {
          showOfflineBanner();
        }
        return;
      }

      // When connection drops while app is open
      if (!connected && previous !== false) {
        showOfflineBanner();
        return;
      }

      // When connection comes back after being offline
      if (connected && previous === false) {
        showOnlineBannerWithTimeout();
      }
    });

    return () => {
      unsubscribe();
      if (networkBannerTimeoutRef.current) {
        clearTimeout(networkBannerTimeoutRef.current);
        networkBannerTimeoutRef.current = null;
      }
    };
  }, []);

  // Check if user is already logged in on app startup
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        // Initialize API service with stored tokens
        await apiService.initialize();

        // Check if user is authenticated
        const isLoggedIn = await authService.isAuthenticated();

        if (isLoggedIn) {
          // User has valid session, navigate to home
          setCurrentScreen('home');
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
  }, []);

  // const [animationComplete, setAnimationComplete] = React.useState(false);

  // Handle Android back button
  React.useEffect(() => {
    const backAction = () => {
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
  };

  const handleOtpSuccess = (isExistingUser: boolean) => {
    if (isExistingUser) {
      // Existing user - go directly to home (skip address selection)
      setCurrentScreen('home');
      setIsRegistrationFlow(false);
    } else {
      // New user - show welcome screen for profile completion
      setCurrentScreen('welcome');
      setIsRegistrationFlow(true);
    }
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
      }
    } catch (error) {
      // Silent fail
    }

    // For new users, go directly to home
    // HomeScreen will check for addresses and redirect if needed
    setCurrentScreen('home');
    setIsRegistrationFlow(false);
  };

  const handleLogout = async () => {
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
      setSearchQuery(query);
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
      });
    }
  };

  const handleLocationConfirm = (location: any) => {
    // Update selected location
    setSelectedLocation({
      name: location.name || location.locationName,
      address: location.locationAddress || location.address,
      latitude: location.latitude || location.lat || 9.9352300,
      longitude: location.longitude || location.lng || 78.1304040,
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
        setCurrentScreen('home');
      } else {
        setCurrentScreen('restaurant');
      }
    });
  }, [checkoutScreenSlide, checkoutCameFrom]);

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

  // Handle order success from checkout - Track Order button
  const handleOrderSuccessFromCheckout = useCallback((orderId: number) => {
    if (orderId) {
      // Set order ID and tracking source immediately
      setSelectedOrderId(orderId.toString());
      setOrderTrackingCameFrom('checkout');
      
      // Set screen to orderTracking immediately to ensure correct screen is shown
      setCurrentScreen('orderTracking');
      
      // Close checkout screen with animation (it will be unmounted since currentScreen !== 'checkout')
      Animated.timing(checkoutScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [checkoutScreenSlide]);

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
    // Set screen immediately for smoother transition
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

    // Animate restaurant screen sliding out to the right
    Animated.timing(restaurantScreenSlide, {
      toValue: SCREEN_WIDTH,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
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
    setCurrentScreen('orders');
  };

  const handleBackFromOrders = () => {
    // Use requestAnimationFrame to ensure smooth transition and proper pointer events update
    requestAnimationFrame(() => {
      setCurrentScreen('profile');
    });
  };

  // Order Detail Navigation
  const handleNavigateToOrderDetail = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCurrentScreen('orderDetail');
  };

  const handleBackFromOrderDetail = () => {
    // Use requestAnimationFrame to ensure smooth transition
    requestAnimationFrame(() => {
      setCurrentScreen('orders');
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
        setLegalCameFrom('profile');
      });
    } else if (legalCameFrom === 'otp') {
      Animated.timing(privacyPolicyScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setCurrentScreen('otp');
        setLegalCameFrom('profile');
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
        setLegalCameFrom('profile');
      });
    } else if (legalCameFrom === 'otp') {
      Animated.timing(termsConditionsScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setCurrentScreen('otp');
        setLegalCameFrom('profile');
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

  // Contact Us Navigation
  const handleNavigateToContactUs = () => {
    setCurrentScreen('contactUs');

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
  };

  const handleBackFromContactUs = () => {
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

  // Search Navigation
  const handleNavigateToSearch = () => {
    setCurrentScreen('search');

    Animated.parallel([
      Animated.timing(homeScreenSlide, {
        toValue: -SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(searchScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBackFromSearch = () => {
    Animated.parallel([
      Animated.timing(homeScreenSlide, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(searchScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentScreen('home');
    });
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
          onConfirm: () => {},
        });
        return;
      }

      const orderData = orderResponse.data;
      const restaurantId = orderData.restaurant.id;
      const restaurantName = orderData.restaurant.name;
      const restaurantLogo = orderData.restaurant.logo_url;

      // Check if restaurant is currently open
      // Fetch restaurant details to get timing information
      const lat = selectedLocation?.latitude || 9.9352300;
      const lng = selectedLocation?.longitude || 78.1304040;

      const restaurantResponse = await apiService.get(
        `/api/buyer/restaurants/${restaurantId}?lat=${lat}&lng=${lng}`
      );

      if (restaurantResponse.success && restaurantResponse.data) {
        // Handle both nested data structure and direct data structure
        const restaurantData = (restaurantResponse.data && typeof restaurantResponse.data === 'object' && 'data' in restaurantResponse.data)
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

        // Check if restaurant location exists and calculate distance if not provided by API
        if (distance === 0 && restaurantData.locations?.[0]) {
          const restaurantLat = restaurantData.locations[0].latitude;
          const restaurantLng = restaurantData.locations[0].longitude;

          if (restaurantLat && restaurantLng) {
            // Calculate distance using Haversine formula
            const R = 6371; // Earth's radius in km
            const dLat = (restaurantLat - lat) * Math.PI / 180;
            const dLng = (restaurantLng - lng) * Math.PI / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat * Math.PI / 180) * Math.cos(restaurantLat * Math.PI / 180) *
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
            onConfirm: () => {},
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
              onConfirm: () => {},
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
        onConfirm: () => {},
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
        onConfirm: () => {},
      });
    }
  };

  // Hide native splash screen INSTANTLY
  React.useEffect(() => {
    // Hide immediately on mount
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <>
      <SafeAreaProvider>
        {showNetworkBanner && (
          <SafeAreaView
            style={[
              styles.networkStatusBanner,
              networkBannerType === 'offline'
                ? styles.networkStatusBannerOffline
                : styles.networkStatusBannerOnline,
            ]}
            edges={['top']}
          >
            <View style={styles.networkStatusBannerContent}>
              <Text style={styles.networkStatusBannerText}>
                {networkBannerType === 'offline' ? 'Could not connect to internet' : 'We are back'}
              </Text>
            </View>
          </SafeAreaView>
        )}
        {!isCheckingAuth && currentScreen === 'login' ? (
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onOpenTerms={() => handleNavigateToTermsConditions('login')}
          onOpenPrivacy={() => handleNavigateToPrivacyPolicy('login')}
        />
      ) : !isCheckingAuth && currentScreen === 'otp' ? (
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
              onContactUs={handleNavigateToContactUs}
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
                  latitude: address.latitude || 9.9352300,
                  longitude: address.longitude || 78.1304040,
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
              initialSearchQuery={searchQuery}
              editingAddress={editingAddress}
              initialLatitude={editingAddress?.latitude || initialLocationCoords?.latitude}
              initialLongitude={editingAddress?.longitude || initialLocationCoords?.longitude}
              onBack={handleBackFromLocationSelection}
              onLocationConfirm={handleLocationConfirm}
            />
          </Animated.View>

          {/* Conditionally render OrdersScreen only when needed */}
          {currentScreen === 'orders' && (
            <View style={styles.ordersOverlay}>
              <OrdersScreen
                visible={true}
                onBack={handleBackFromOrders}
                onOrderDetails={handleNavigateToOrderDetail}
                onReorder={handleReorder}
                onRateOrder={handleNavigateToRateOrder}
                onTrackOrder={handleNavigateToOrderTracking}
                onHelp={(order) => handleNavigateToHelp('orders', order)}
                onViewMore={() => {}}
              />
            </View>
          )}

          {/* Conditionally render OrderDetailScreen only when needed */}
          {currentScreen === 'orderDetail' && (
            <View style={styles.orderDetailOverlay}>
              <OrderDetailScreen
                key={selectedOrderId}
                orderId={selectedOrderId}
                visible={true}
                onBack={handleBackFromOrderDetail}
                onChatWithUs={() => {}}
                onThankDriver={() => {}}
                onRateOrder={handleNavigateToRateOrder}
                onReorder={() => handleReorder(selectedOrderId)}
                onTrackOrder={() => handleNavigateToOrderTracking(selectedOrderId, 'orderDetail')}
                onDownloadInvoice={() => {}}
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

          {/* Conditionally render SearchScreen only when needed */}
          {currentScreen === 'search' && (
            <Animated.View
              style={[
                styles.searchOverlay,
                {
                  transform: [{ translateX: searchScreenSlide }],
                },
              ]}
              pointerEvents="auto"
            >
              <SearchScreen
                onBack={handleBackFromSearch}
                selectedLocation={selectedLocation}
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

          {/* Always render Privacy Policy Screen, positioned off-screen initially */}
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

          {/* Always render Terms & Conditions Screen, positioned off-screen initially */}
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

          {/* Checkout Screen */}
          {currentScreen === 'checkout' && (
            <Animated.View
              style={[
                styles.checkoutOverlay,
                {
                  transform: [{ translateX: checkoutScreenSlide }],
                },
              ]}
              pointerEvents="auto"
            >
              <OrderDetailsScreen
                restaurantId={cartRestaurantId || selectedRestaurantId}
                restaurantName={cartRestaurantName || selectedRestaurantName}
                restaurantAddress={selectedRestaurantAddress}
                selectedLocation={selectedLocation}
                visible={currentScreen === 'checkout'}
                onBack={handleBackFromCheckout}
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
      </SafeAreaProvider>
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
            <AppContent />
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
    zIndex: 5,
    backgroundColor: '#F3F4F6',
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
    zIndex: 8,
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
  networkStatusBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 4,
    paddingVertical: 16,
  },
  networkStatusBannerContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  networkStatusBannerOffline: {
    backgroundColor: '#DC2626',
    fontSize: 16,
  },
  networkStatusBannerOnline: {
    backgroundColor: '#16A34A',
    fontSize: 16,
  },
  networkStatusBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
