import React from 'react';
import { View, StyleSheet, Animated, Dimensions, BackHandler } from 'react-native';
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
import { CategoryResultsScreen } from '@/screens/Category/CategoryResultsScreen';
import { RestaurantScreen } from '@/screens/Restaurant/RestaurantScreen';
import { ExploreDishesScreen } from '@/screens/Favorites/ExploreDishesScreen';
import { ContentPage } from '@/screens/Legal/ContentPage';
import { HelpScreen } from '@/screens/Help/HelpScreen';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authService } from '@/services/auth.service';
import { apiService } from '@/services/api.service';
import { storageService } from '@/services/storage.service';
import { CartProvider } from '@/context/CartContext';
import { VegModeProvider } from '@/context/VegModeContext';
import { ConfirmationProvider } from '@/context/ConfirmationContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [currentScreen, setCurrentScreen] = React.useState<'login' | 'otp' | 'welcome' | 'home' | 'profile' | 'editProfile' | 'orders' | 'orderDetail' | 'rateOrder' | 'orderTracking' | 'search' | 'myAddresses' | 'addressSelection' | 'locationSelection' | 'categoryResults' | 'restaurant' | 'exploreDishes' | 'privacyPolicy' | 'termsConditions' | 'help'>('login');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedLocation, setSelectedLocation] = React.useState({ name: 'Madurai', address: 'Madurai, Tamil Nadu, India' });
  const [selectedCategory, setSelectedCategory] = React.useState('Briyani');
  const [categoryData, setCategoryData] = React.useState<any[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = React.useState<number>(1);
  const [selectedRestaurantName, setSelectedRestaurantName] = React.useState('');
  const [restaurantCameFrom, setRestaurantCameFrom] = React.useState<'home' | 'category' | 'search' | 'favorites'>('home');
  const [categoryCameFrom, setCategoryCameFrom] = React.useState<'home' | 'search' | 'favorites'>('home');
  const [selectedOrderId, setSelectedOrderId] = React.useState<string>('');
  const [addressSelectionCameFrom, setAddressSelectionCameFrom] = React.useState<'home' | 'myAddresses'>('home');
  const [editingAddress, setEditingAddress] = React.useState<any>(null);

  const homeScreenSlide = React.useRef(new Animated.Value(0)).current;
  const profileScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const searchScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const privacyPolicyScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const termsConditionsScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const addressScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const locationScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const helpScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const restaurantScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const [fontsLoaded] = useFonts({
    'Poppins': Poppins_400Regular,
    'Poppins_400Regular': Poppins_400Regular,
    'Poppins_500Medium': Poppins_500Medium,
    'Poppins_600SemiBold': Poppins_600SemiBold,
    'Poppins_700Bold': Poppins_700Bold,
  });

  // Check if user is already logged in on app startup
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth check timeout')), 5000)
        );

        await Promise.race([
          (async () => {
            // Initialize API service with stored tokens
            await apiService.initialize();

            // Check if user is authenticated
            const isLoggedIn = await authService.isAuthenticated();

            if (isLoggedIn) {
              // Check if user has completed their profile
              const userData = await authService.getCurrentUser();

              // If user has both name and email, they've completed the welcome screen
              if (userData?.name && userData?.email) {
                setCurrentScreen('home');
              } else {
                // User is logged in but hasn't completed profile, show welcome screen
                setCurrentScreen('welcome');
              }
            }
          })(),
          timeoutPromise
        ]);
      } catch (error) {
        // Continue to login screen even if auth check fails
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  React.useEffect(() => {
    if (fontsLoaded && !isCheckingAuth) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isCheckingAuth]);

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
        case 'exploreDishes':
          handleBackFromExploreDishes();
          return true;
        case 'privacyPolicy':
          handleBackFromPrivacyPolicy();
          return true;
        case 'termsConditions':
          handleBackFromTermsConditions();
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
      // Existing user - go directly to home
      setCurrentScreen('home');
    } else {
      // New user - show welcome screen for profile completion
      setCurrentScreen('welcome');
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

    setCurrentScreen('home');
  };

  const handleLogout = async () => {
    // Reset all animated values to their initial state
    homeScreenSlide.setValue(0);
    profileScreenSlide.setValue(SCREEN_WIDTH);
    searchScreenSlide.setValue(SCREEN_WIDTH);
    privacyPolicyScreenSlide.setValue(SCREEN_WIDTH);
    termsConditionsScreenSlide.setValue(SCREEN_WIDTH);
    addressScreenSlide.setValue(SCREEN_WIDTH);
    locationScreenSlide.setValue(SCREEN_WIDTH);
    helpScreenSlide.setValue(SCREEN_WIDTH);

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
  const handleNavigateToLocationSelection = (query?: string) => {
    if (query) {
      setSearchQuery(query);
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

  const handleBackFromLocationSelection = () => {
    if (addressSelectionCameFrom === 'myAddresses') {
      setCurrentScreen('myAddresses');
      setAddressSelectionCameFrom('home');
      setSearchQuery('');
    } else {
      Animated.parallel([
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
      });
    }
  };

  const handleLocationConfirm = (location: any) => {
    // Update selected location
    setSelectedLocation({
      name: location.name || location.locationName,
      address: location.locationAddress || location.address,
    });

    // Check if coming from MyAddresses
    if (addressSelectionCameFrom === 'myAddresses') {
      // Navigate back to MyAddresses after saving
      Animated.timing(locationScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentScreen('myAddresses');
        setAddressSelectionCameFrom('home');
        setSearchQuery('');
      });
    } else {
      // Slide both address and location screens back to home
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
        setSearchQuery('');
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
      useNativeDriver: true,
    }).start();
  };

  // Back from Restaurant (dynamic based on where we came from)
  const handleBackFromRestaurant = () => {
    // Animate restaurant screen sliding out to the right
    Animated.timing(restaurantScreenSlide, {
      toValue: SCREEN_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      // After animation completes, navigate back
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
      } else {
        setCurrentScreen('categoryResults');
      }
    });
  };

  // Orders Navigation
  const handleNavigateToOrders = () => {
    setCurrentScreen('orders');
  };

  const handleBackFromOrders = () => {
    setCurrentScreen('profile');
  };

  // Order Detail Navigation
  const handleNavigateToOrderDetail = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCurrentScreen('orderDetail');
  };

  const handleBackFromOrderDetail = () => {
    setCurrentScreen('orders');
  };

  // My Addresses Navigation
  const handleNavigateToMyAddresses = () => {
    setCurrentScreen('myAddresses');
  };

  const handleBackFromMyAddresses = () => {
    // Reset location screen position
    locationScreenSlide.setValue(SCREEN_WIDTH);
    setEditingAddress(null);
    setCurrentScreen('profile');
  };

  const handleNavigateToAddressSelectionFromMyAddresses = () => {
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
    setAddressSelectionCameFrom('myAddresses');
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
  const handleNavigateToPrivacyPolicy = () => {
    setCurrentScreen('privacyPolicy');

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
  };

  const handleBackFromPrivacyPolicy = () => {
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
  };

  // Terms & Conditions Navigation
  const handleNavigateToTermsConditions = () => {
    setCurrentScreen('termsConditions');

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
  };

  const handleBackFromTermsConditions = () => {
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
  };

  // Help Navigation
  const handleNavigateToHelp = () => {
    setCurrentScreen('help');

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
  };

  const handleBackFromHelp = () => {
    Animated.parallel([
      Animated.timing(profileScreenSlide, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(helpScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentScreen('profile');
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
  const handleNavigateToRateOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCurrentScreen('rateOrder');
  };

  const handleBackFromRateOrder = () => {
    setCurrentScreen('orders');
  };

  // Order Tracking Navigation
  const handleNavigateToOrderTracking = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCurrentScreen('orderTracking');
  };

  const handleBackFromOrderTracking = () => {
    setCurrentScreen('orders');
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

  if (!fontsLoaded || isCheckingAuth) {
    return null;
  }

  return (
    <VegModeProvider>
      <CartProvider>
        <ConfirmationProvider>
          <SafeAreaProvider>
        {currentScreen === 'login' ? (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      ) : currentScreen === 'otp' ? (
        <OTPVerificationScreen
          phoneNumber={phoneNumber}
          onBack={handleBackToLogin}
          onSuccess={handleOtpSuccess}
        />
      ) : currentScreen === 'welcome' ? (
        <WelcomeScreen onContinue={handleWelcomeComplete} />
      ) : (
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
              onNavigateToSearch={handleNavigateToSearch}
              selectedLocation={selectedLocation}
              onCategoriesLoaded={setCategoryData}
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
              onChatWithUs={handleNavigateToHelp}
              onPrivacyPolicy={handleNavigateToPrivacyPolicy}
              onTermsConditions={handleNavigateToTermsConditions}
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
              onUseCurrentLocation={() => handleNavigateToLocationSelection()}
              onSearch={(query) => handleNavigateToLocationSelection(query)}
              onSelectAddress={(address) => {
                // Capitalize the type (home -> Home, work -> Work, other -> Other)
                const formattedType = address.type.charAt(0).toUpperCase() + address.type.slice(1);
                setSelectedLocation({
                  name: formattedType,
                  address: `${address.address}, ${address.city}`,
                });
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
              initialLatitude={editingAddress?.latitude}
              initialLongitude={editingAddress?.longitude}
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
                onReorder={(orderId) => {}}
                onRateOrder={handleNavigateToRateOrder}
                onTrackOrder={handleNavigateToOrderTracking}
                onHelp={(orderId) => {}}
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
                onRateOrder={() => {}}
                onReorder={() => {}}
                onDownloadInvoice={() => {}}
              />
            </View>
          )}

          {/* Conditionally render RateOrderScreen only when needed */}
          {currentScreen === 'rateOrder' && (
            <View style={styles.rateOrderOverlay}>
              <RateOrderScreen
                onBack={handleBackFromRateOrder}
                onSubmit={(data) => {
                  handleBackFromRateOrder();
                }}
              />
            </View>
          )}

          {/* Conditionally render OrderTrackingScreen only when needed */}
          {currentScreen === 'orderTracking' && (
            <View style={styles.orderTrackingOverlay}>
              <OrderTrackingScreen
                onBack={handleBackFromOrderTracking}
                onCallPartner={() => {}}
              />
            </View>
          )}

          {/* Always render SearchScreen, positioned off-screen initially */}
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
              onSelectResult={(result) => {
                handleBackFromSearch();
              }}
              onSelectItem={(itemId, itemName) => {
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
                setCurrentScreen('restaurant');

                // Close search screen and open restaurant screen with animation
                Animated.parallel([
                  Animated.timing(searchScreenSlide, {
                    toValue: SCREEN_WIDTH,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                  Animated.timing(restaurantScreenSlide, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                  }),
                ]).start();
              }}
            />
          </Animated.View>

          {/* Conditionally render MyAddressesScreen only when needed */}
          {currentScreen === 'myAddresses' && (
            <View style={styles.myAddressesOverlay}>
              <MyAddressesScreen
                visible={true}
                onBack={handleBackFromMyAddresses}
                onAddNew={handleNavigateToAddressSelectionFromMyAddresses}
                onEditAddress={handleEditAddressFromMyAddresses}
              />
            </View>
          )}

          {/* Conditionally render ExploreDishesScreen only when needed */}
          {currentScreen === 'exploreDishes' && (
            <View style={styles.exploreDishesOverlay}>
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
              onBack={handleBackFromTermsConditions}
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
            pointerEvents={currentScreen === 'help' ? 'auto' : 'none'}
          >
            <HelpScreen
              onBack={handleBackFromHelp}
            />
          </Animated.View>

          {/* Conditionally render EditProfileScreen only when needed */}
          {currentScreen === 'editProfile' && (
            <View style={styles.editProfileOverlay}>
              <EditProfileScreen
                onBack={handleBackFromEditProfile}
                onSave={(data) => {
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
            {(currentScreen === 'restaurant' || restaurantScreenSlide._value !== SCREEN_WIDTH) && (
              <RestaurantScreen
                restaurantId={selectedRestaurantId}
                restaurantName={selectedRestaurantName}
                onBack={handleBackFromRestaurant}
              />
            )}
          </Animated.View>
        </View>
      )}
        </SafeAreaProvider>
        </ConfirmationProvider>
      </CartProvider>
    </VegModeProvider>
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
    zIndex: 7,
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
  helpOverlay: {
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
});
