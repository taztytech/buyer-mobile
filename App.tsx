import React from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { LoginScreen } from '@/screens/Auth/LoginScreen';
import { OTPVerificationScreen } from '@/screens/Auth/OTPVerificationScreen';
import { HomeScreen } from '@/screens/Home/HomeScreen';
import { ProfileScreen } from '@/screens/Profile/ProfileScreen';
import { OrdersScreen } from '@/screens/Order/OrdersScreen';
import { OrderDetailScreen } from '@/screens/Order/OrderDetailScreen';
import { AddressSelectionScreen } from '@/screens/Location/AddressSelectionScreen';
import { LocationSelectionScreen } from '@/screens/Location/LocationSelectionScreen';
import { MyAddressesScreen } from '@/screens/Location/MyAddressesScreen';
import { CategoryResultsScreen } from '@/screens/Category/CategoryResultsScreen';
import { RestaurantScreen } from '@/screens/Restaurant/RestaurantScreen';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authService } from '@/services/auth.service';
import { apiService } from '@/services/api.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [currentScreen, setCurrentScreen] = React.useState<'login' | 'otp' | 'home' | 'profile' | 'orders' | 'orderDetail' | 'myAddresses' | 'addressSelection' | 'locationSelection' | 'categoryResults' | 'restaurant'>('login');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedLocation, setSelectedLocation] = React.useState({ name: 'Chennai', address: 'Vigneshwar Nagar, Nanganallur, Tamilnadu,...' });
  const [selectedCategory, setSelectedCategory] = React.useState('Briyani');
  const [selectedRestaurantId, setSelectedRestaurantId] = React.useState<number>(1);
  const [selectedRestaurantName, setSelectedRestaurantName] = React.useState('');
  const [restaurantCameFrom, setRestaurantCameFrom] = React.useState<'home' | 'category'>('home');
  const [selectedOrderId, setSelectedOrderId] = React.useState<string>('');

  const homeScreenSlide = React.useRef(new Animated.Value(0)).current;
  const profileScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const ordersScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const orderDetailScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const myAddressesScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const addressScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const locationScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const categoryScreenSlide = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;

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
              setCurrentScreen('home');
            }
          })(),
          timeoutPromise
        ]);
      } catch (error) {
        console.error('Error checking auth:', error);
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

  const handleLoginSuccess = (phone: string) => {
    setPhoneNumber(phone);
    setCurrentScreen('otp');
  };

  const handleOtpSuccess = () => {
    setCurrentScreen('home');
  };

  const handleLogout = () => {
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
  };

  const handleLocationConfirm = (location: any) => {
    // Update selected location
    setSelectedLocation({
      name: location.name || location.locationName,
      address: location.locationAddress || location.address,
    });

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
  };

  // Category Results Navigation
  const handleNavigateToCategoryResults = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setCurrentScreen('categoryResults');

    Animated.parallel([
      Animated.timing(homeScreenSlide, {
        toValue: -SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(categoryScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBackFromCategoryResults = () => {
    Animated.parallel([
      Animated.timing(homeScreenSlide, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(categoryScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentScreen('home');
    });
  };

  // Restaurant Navigation from Category
  const handleNavigateToRestaurantFromCategory = (restaurantId: number, restaurantName: string) => {
    console.log('[App.tsx] handleNavigateToRestaurantFromCategory called with ID:', restaurantId, 'Name:', restaurantName);
    setSelectedRestaurantId(restaurantId);
    setSelectedRestaurantName(restaurantName);
    setRestaurantCameFrom('category');
    setCurrentScreen('restaurant');
  };

  // Restaurant Navigation from Home
  const handleNavigateToRestaurantFromHome = (restaurantId: number, restaurantName: string) => {
    console.log('[App.tsx] handleNavigateToRestaurantFromHome called with ID:', restaurantId, 'Name:', restaurantName);
    setSelectedRestaurantId(restaurantId);
    setSelectedRestaurantName(restaurantName);
    setRestaurantCameFrom('home');
    setCurrentScreen('restaurant');
    console.log('[App.tsx] State updated, currentScreen:', 'restaurant', 'restaurantId:', restaurantId);
  };

  // Back from Restaurant (dynamic based on where we came from)
  const handleBackFromRestaurant = () => {
    if (restaurantCameFrom === 'home') {
      setCurrentScreen('home');
    } else {
      setCurrentScreen('categoryResults');
    }
  };

  // Orders Navigation
  const handleNavigateToOrders = () => {
    setCurrentScreen('orders');

    Animated.parallel([
      Animated.timing(profileScreenSlide, {
        toValue: -SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(ordersScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBackFromOrders = () => {
    Animated.parallel([
      Animated.timing(profileScreenSlide, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(ordersScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentScreen('profile');
    });
  };

  // Order Detail Navigation
  const handleNavigateToOrderDetail = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCurrentScreen('orderDetail');

    Animated.parallel([
      Animated.timing(ordersScreenSlide, {
        toValue: -SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(orderDetailScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBackFromOrderDetail = () => {
    Animated.parallel([
      Animated.timing(ordersScreenSlide, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(orderDetailScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentScreen('orders');
    });
  };

  // My Addresses Navigation
  const handleNavigateToMyAddresses = () => {
    setCurrentScreen('myAddresses');

    Animated.parallel([
      Animated.timing(profileScreenSlide, {
        toValue: -SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(myAddressesScreenSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBackFromMyAddresses = () => {
    Animated.parallel([
      Animated.timing(profileScreenSlide, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(myAddressesScreenSlide, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentScreen('profile');
    });
  };

  if (!fontsLoaded || isCheckingAuth) {
    return null;
  }

  return (
    <SafeAreaProvider>
      {currentScreen === 'login' ? (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      ) : currentScreen === 'otp' ? (
        <OTPVerificationScreen
          phoneNumber={phoneNumber}
          onBack={handleBackToLogin}
          onSuccess={handleOtpSuccess}
        />
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
              selectedLocation={selectedLocation}
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
            pointerEvents={currentScreen === 'profile' ? 'auto' : 'none'}
          >
            <ProfileScreen
              onBack={handleBackToHome}
              onLogout={handleLogout}
              onEditProfile={() => console.log('Edit Profile')}
              onMyOrders={handleNavigateToOrders}
              onMyAddresses={handleNavigateToMyAddresses}
              onFavorites={() => console.log('Favorites')}
              onChatWithUs={() => console.log('Chat With Us')}
              onPrivacyPolicy={() => console.log('Privacy Policy')}
              onTermsConditions={() => console.log('Terms & Conditions')}
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
              onBack={handleBackFromAddressSelection}
              onUseCurrentLocation={() => handleNavigateToLocationSelection()}
              onSearch={(query) => handleNavigateToLocationSelection(query)}
              onSelectAddress={(address) => {
                setSelectedLocation({
                  name: address.type,
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
            pointerEvents={currentScreen === 'orders' || currentScreen === 'orderDetail' ? 'auto' : 'none'}
          >
            <OrdersScreen
              onBack={handleBackFromOrders}
              onOrderDetails={handleNavigateToOrderDetail}
              onReorder={(orderId) => console.log('Reorder:', orderId)}
              onRateOrder={(orderId) => console.log('Rate Order:', orderId)}
              onViewMore={() => console.log('View More Orders')}
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
              orderId={selectedOrderId}
              onBack={handleBackFromOrderDetail}
              onChatWithUs={() => console.log('Chat with us')}
              onThankDriver={() => console.log('Thank Driver')}
              onRateOrder={() => console.log('Rate Order')}
              onReorder={() => console.log('Reorder')}
              onDownloadInvoice={() => console.log('Download Invoice')}
            />
          </Animated.View>

          {/* Always render MyAddressesScreen, positioned off-screen initially */}
          <Animated.View
            style={[
              styles.myAddressesOverlay,
              {
                transform: [{ translateX: myAddressesScreenSlide }],
              },
            ]}
            pointerEvents={currentScreen === 'myAddresses' ? 'auto' : 'none'}
          >
            <MyAddressesScreen
              onBack={handleBackFromMyAddresses}
              onAddNew={() => console.log('Add New Address')}
              onEdit={(addressId) => console.log('Edit Address:', addressId)}
              onDelete={(addressId) => console.log('Delete Address:', addressId)}
            />
          </Animated.View>

          {/* Always render CategoryResultsScreen, positioned off-screen initially */}
          <Animated.View
            style={[
              styles.categoryOverlay,
              {
                transform: [{ translateX: categoryScreenSlide }],
              },
            ]}
            pointerEvents={currentScreen === 'categoryResults' || currentScreen === 'restaurant' ? 'auto' : 'none'}
          >
            <CategoryResultsScreen
              categoryName={selectedCategory}
              onBack={handleBackFromCategoryResults}
              onNavigateToRestaurant={handleNavigateToRestaurantFromCategory}
            />
          </Animated.View>

          {/* Conditionally render RestaurantScreen only when needed */}
          {currentScreen === 'restaurant' && (
            <View style={styles.restaurantOverlay}>
              <RestaurantScreen
                restaurantId={selectedRestaurantId}
                restaurantName={selectedRestaurantName}
                onBack={handleBackFromRestaurant}
              />
            </View>
          )}
        </View>
      )}
    </SafeAreaProvider>
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
  myAddressesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
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
    zIndex: 7,
    backgroundColor: '#FFFFFF',
  },
});
