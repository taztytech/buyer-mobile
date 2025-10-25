import React from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Alert, Modal, Image, ImageBackground, TextInput, ScrollView, FlatList, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { authService } from '@/services/auth.service';
import { homeService, BannerItem, CategoryItem, Restaurant } from '@/services/home.service';
import { addressService } from '@/services/address.service';
import { RestaurantCard } from '@/components/RestaurantCard';
import { Shimmer } from '@/components/Shimmer';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ViewCartBar } from '@/components/ViewCartBar';
import { useCart } from '@/context/CartContext';
import { useVegMode } from '@/context/VegModeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HomeScreenProps {
  onLogout?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToAddressSelection?: () => void;
  onNavigateToCategory?: (categoryName: string) => void;
  onNavigateToRestaurant?: (restaurantId: number, restaurantName: string) => void;
  onNavigateToSearch?: () => void;
  selectedLocation?: { name: string; address: string };
  onCategoriesLoaded?: (categories: CategoryItem[]) => void;
}

interface CarouselItem {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  imageUrl?: string;
}

// Fallback carousel data if API fails
const fallbackCarouselData: CarouselItem[] = [
  {
    id: '1',
    title: 'Craving Something Delicious?',
    description: 'Get your favorite meals delivered hot & fast—right to your doorstep.',
    buttonText: 'Order Now!',
  },
  {
    id: '2',
    title: 'Special Offers Today!',
    description: 'Get up to 50% off on selected restaurants near you.',
    buttonText: 'View Offers',
  },
  {
    id: '3',
    title: 'Fast & Fresh Delivery',
    description: 'Your food delivered in 30 minutes or less, guaranteed fresh.',
    buttonText: 'Order Now!',
  },
];

// Default location coordinates (Madurai)
const DEFAULT_LOCATION = {
  name: 'Madurai',
  address: 'Madurai, Tamil Nadu, India',
  latitude: 9.9252,
  longitude: 78.1198,
};

// Fallback category data if API fails or returns empty
const fallbackCategoryData: CategoryItem[] = [
  {
    id: 1,
    name: 'Biryani',
    description: 'Aromatic rice dish with spices',
    icon: require('@/assets/biriyani.png'),
  },
  {
    id: 2,
    name: 'South Indian',
    description: 'Traditional South Indian dishes',
    icon: require('@/assets/idlies.png'),
  },
  {
    id: 3,
    name: 'Pizza',
    description: 'Italian style pizzas',
    icon: require('@/assets/pizza.png'),
  },
  {
    id: 4,
    name: 'Burger',
    description: 'Delicious burgers',
    icon: require('@/assets/burger.png'),
  },
  {
    id: 5,
    name: 'Cakes',
    description: 'Sweet desserts',
    icon: require('@/assets/cake.png'),
  },
  {
    id: 'view-all',
    name: 'View All',
    description: 'See all categories',
    icon: require('@/assets/Group 1272628220.png'),
  },
];

// Fallback restaurant data if API fails or returns empty
const fallbackRestaurantData: Restaurant[] = [
  {
    id: 1,
    name: 'A2B',
    cuisine: 'South Indian, Traditional, Meals.',
    rating: 4.5,
    deliveryTime: '10 - 15 mins',
    location: 'Keelkattalai',
    distance: '0.5Kms',
    image: require('@/assets/biriyani.png'),
    isFavorite: false,
    isVeg: true,
  },
  {
    id: 2,
    name: 'Dinidigul Thalapakatti',
    cuisine: 'Burgers, Pizza, Chicken Wings Rolls & Wrap',
    rating: 4.5,
    deliveryTime: '10 - 15 mins',
    location: 'Pallavaram',
    distance: '1.2Kms',
    image: require('@/assets/burger.png'),
    isFavorite: false,
    isVeg: false,
  },
  {
    id: 3,
    name: 'Pizza Hut',
    cuisine: 'Italian, Pizza, Fast Food',
    rating: 4.2,
    deliveryTime: '15 - 20 mins',
    location: 'Chrompet',
    distance: '2.5Kms',
    image: require('@/assets/pizza.png'),
    isFavorite: false,
    isVeg: false,
  },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onLogout,
  onNavigateToProfile,
  onNavigateToAddressSelection,
  onNavigateToCategory,
  onNavigateToRestaurant,
  onNavigateToSearch,
  selectedLocation: externalSelectedLocation,
  onCategoriesLoaded
}) => {
  const { restaurantId, restaurantName, restaurantLogo, getTotalItems } = useCart();
  const { vegMode, setVegMode, isVegModeEnabled } = useVegMode();
  const insets = useSafeAreaInsets();
  const totalCartItems = getTotalItems();
  const [showLocationPopup, setShowLocationPopup] = React.useState(false);
  const [hasShownLocationModal, setHasShownLocationModal] = React.useState(false);
  const [showVegModePopup, setShowVegModePopup] = React.useState(false);
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [carouselData, setCarouselData] = React.useState<CarouselItem[]>([]);
  const [categoryData, setCategoryData] = React.useState<CategoryItem[]>([]);
  const [restaurantData, setRestaurantData] = React.useState<Restaurant[]>([]);
  const [isLoadingBanners, setIsLoadingBanners] = React.useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = React.useState(true);
  const [isLoadingRestaurants, setIsLoadingRestaurants] = React.useState(true);
  const [isLoadingLocation, setIsLoadingLocation] = React.useState(false);
  const isRequestingPermission = React.useRef(false);

  // Track image loading states
  const [loadedBannerImages, setLoadedBannerImages] = React.useState<Set<string>>(new Set());
  const [loadedCategoryImages, setLoadedCategoryImages] = React.useState<Set<string>>(new Set());
  const [loadedRestaurantImages, setLoadedRestaurantImages] = React.useState<Set<string>>(new Set());

  // Combined loading states (API + Images)
  const [showBannerShimmer, setShowBannerShimmer] = React.useState(true);
  const [showCategoryShimmer, setShowCategoryShimmer] = React.useState(true);
  const [showRestaurantShimmer, setShowRestaurantShimmer] = React.useState(true);
  const [tempVegSelection, setTempVegSelection] = React.useState<'pure' | 'all'>('pure');
  const [selectedLocation, setSelectedLocation] = React.useState(externalSelectedLocation || { name: DEFAULT_LOCATION.name, address: DEFAULT_LOCATION.address });
  const [isCategorySectionSticky, setIsCategorySectionSticky] = React.useState(false);
  const flatListRef = React.useRef<FlatList>(null);
  const [defaultAddressCoords, setDefaultAddressCoords] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [hasDefaultAddress, setHasDefaultAddress] = React.useState(false);
  const isInitialVegModeLoad = React.useRef(true);

  // Update local state when external selectedLocation changes
  React.useEffect(() => {
    if (externalSelectedLocation) {
      setSelectedLocation(externalSelectedLocation);
    }
  }, [externalSelectedLocation]);

  // Fetch default address on component mount
  React.useEffect(() => {
    const fetchDefaultAddress = async () => {
      try {
        const response = await addressService.getAddresses();

        if (response.success && response.data) {
          // Find the default address
          const defaultAddress = response.data.find(addr => addr.is_default);

          if (defaultAddress) {
            // User has a default address saved
            setHasDefaultAddress(true);
            setDefaultAddressCoords({
              latitude: defaultAddress.latitude,
              longitude: defaultAddress.longitude,
            });

            // Format address type (home -> Home, work -> Work, other -> Other)
            const formattedType = defaultAddress.type.charAt(0).toUpperCase() + defaultAddress.type.slice(1);

            // Update selected location display
            setSelectedLocation({
              name: formattedType,
              address: `${defaultAddress.address1}${defaultAddress.address2 ? ', ' + defaultAddress.address2 : ''}${defaultAddress.address3 ? ', ' + defaultAddress.address3 : ''}, ${defaultAddress.city}`,
            });

            // Fetch home data with default address coordinates
            await fetchHomeData(defaultAddress.latitude, defaultAddress.longitude);
          } else {
            // No default address, use fallback location
            setHasDefaultAddress(false);
            setSelectedLocation({
              name: DEFAULT_LOCATION.name,
              address: DEFAULT_LOCATION.address,
            });

            // Fetch home data with default Madurai coordinates
            await fetchHomeData();
          }
        } else {
          // API failed, use fallback location
          setHasDefaultAddress(false);
          setSelectedLocation({
            name: DEFAULT_LOCATION.name,
            address: DEFAULT_LOCATION.address,
          });

          // Fetch home data with default Madurai coordinates
          await fetchHomeData();
        }
      } catch (error) {
        // Error fetching addresses, use fallback location
        setHasDefaultAddress(false);
        setSelectedLocation({
          name: DEFAULT_LOCATION.name,
          address: DEFAULT_LOCATION.address,
        });

        // Fetch home data with default Madurai coordinates
        await fetchHomeData();
      } finally {
        setIsLoadingLocation(false);
      }
    };

    fetchDefaultAddress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Check if all banner images are loaded
  React.useEffect(() => {
    if (!isLoadingBanners && carouselData.length > 0) {
      // Check if all banner images with URLs are loaded (or if there are no images with URLs)
      const bannersWithImages = carouselData.filter(item => item.imageUrl);
      const allImagesLoaded = bannersWithImages.length === 0 ||
                              bannersWithImages.every(item => loadedBannerImages.has(item.id));

      if (allImagesLoaded) {
        setShowBannerShimmer(false);
      } else {
        // Fallback: Hide shimmer after 3 seconds even if images haven't loaded
        const timeout = setTimeout(() => {
          setShowBannerShimmer(false);
        }, 3000);
        return () => clearTimeout(timeout);
      }
    } else if (!isLoadingBanners && carouselData.length === 0) {
      // No data received, hide shimmer immediately
      setShowBannerShimmer(false);
    }
  }, [isLoadingBanners, carouselData, loadedBannerImages]);

  // Check if all category images are loaded
  React.useEffect(() => {
    if (!isLoadingCategories && categoryData.length > 0) {
      const allImagesLoaded = categoryData.every(item => loadedCategoryImages.has(item.id.toString()));

      if (allImagesLoaded) {
        setShowCategoryShimmer(false);
      } else {
        // Fallback: Hide shimmer after 3 seconds even if images haven't loaded
        const timeout = setTimeout(() => {
          setShowCategoryShimmer(false);
        }, 3000);
        return () => clearTimeout(timeout);
      }
    } else if (!isLoadingCategories && categoryData.length === 0) {
      // No data received, hide shimmer immediately
      setShowCategoryShimmer(false);
    }
  }, [isLoadingCategories, categoryData, loadedCategoryImages]);

  // Check if all restaurant images are loaded
  React.useEffect(() => {
    if (!isLoadingRestaurants && restaurantData.length > 0) {
      const allImagesLoaded = restaurantData.every(item => loadedRestaurantImages.has(item.id.toString()));

      if (allImagesLoaded) {
        setShowRestaurantShimmer(false);
      } else {
        // Fallback: Hide shimmer after 3 seconds even if images haven't loaded
        const timeout = setTimeout(() => {
          setShowRestaurantShimmer(false);
        }, 3000);
        return () => clearTimeout(timeout);
      }
    } else if (!isLoadingRestaurants && restaurantData.length === 0) {
      // No data received, hide shimmer immediately
      setShowRestaurantShimmer(false);
    }
  }, [isLoadingRestaurants, restaurantData, loadedRestaurantImages]);

  // Show location permission modal only if no default address exists
  React.useEffect(() => {
    // Only show if modal hasn't been shown yet this session AND user has no default address
    if (!hasShownLocationModal && !hasDefaultAddress && !isLoadingLocation) {
      setShowLocationPopup(true);
      setHasShownLocationModal(true);
    }
  }, [hasShownLocationModal, hasDefaultAddress, isLoadingLocation]);

  // Reload home data when veg mode changes
  React.useEffect(() => {
    // Skip initial load when vegMode is loaded from storage
    if (isInitialVegModeLoad.current) {
      isInitialVegModeLoad.current = false;
      return;
    }

    // Reload data with current coordinates when veg mode changes
    const coords = defaultAddressCoords || { latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude };
    fetchHomeData(coords.latitude, coords.longitude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vegMode]);

  const handleAllowLocation = async () => {
    // Prevent multiple simultaneous permission requests
    if (isRequestingPermission.current) {
      return;
    }

    try {
      isRequestingPermission.current = true;

      // Close the custom modal first
      setShowLocationPopup(false);

      // First check current permission status
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

      let finalStatus = existingStatus;

      // Request permission (will show Android system dialog)
      const { status } = await Location.requestForegroundPermissionsAsync();
      finalStatus = status;

      if (finalStatus === 'granted') {
        const location = await Location.getCurrentPositionAsync({});

        const userLatitude = location.coords.latitude;
        const userLongitude = location.coords.longitude;

        // Don't update the location display - keep showing default or saved address
        // Instead, use the coordinates to fetch nearby restaurants
        setIsLoadingLocation(false);

        // Reload home page data with user's actual location
        await fetchHomeData(userLatitude, userLongitude);
      } else {
        setHasShownLocationModal(true); // Mark as shown to prevent repeated popups
        Alert.alert(
          'Permission Denied',
          'Location permission is required to show nearby restaurants. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Location.requestForegroundPermissionsAsync() }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get location permission. Please try again.');
    } finally {
      isRequestingPermission.current = false;
    }
  };

  const handleDenyLocation = () => {
    setShowLocationPopup(false);
    setHasShownLocationModal(true); // Prevent modal from showing again

    // Set default location to Madurai
    setSelectedLocation({
      name: DEFAULT_LOCATION.name,
      address: DEFAULT_LOCATION.address,
    });

    // Show popup that settings can be done later
    Alert.alert(
      'Location Settings',
      'Default location set to Madurai. You can change this later from settings.',
      [{ text: 'OK' }]
    );
  };

  const handleLocationClick = () => {
    // Navigate to address selection when location selector is clicked
    if (onNavigateToAddressSelection) {
      onNavigateToAddressSelection();
    }
  };

  const handleVegModeToggle = () => {
    if (isVegModeEnabled) {
      // Turning OFF - directly disable without showing popup
      setVegMode('off');
    } else {
      // Turning ON - show popup to choose between 'pure' or 'all'
      setTempVegSelection('pure');
      setShowVegModePopup(true);
    }
  };

  const handleApplyVegMode = () => {
    setVegMode(tempVegSelection);
    setShowVegModePopup(false);
  };

  // Mark local (bundled) images as loaded immediately
  React.useEffect(() => {
    if (categoryData.length > 0) {
      const localImageIds = categoryData
        .filter(item => typeof item.icon !== 'string')
        .map(item => item.id.toString());

      if (localImageIds.length > 0) {
        setLoadedCategoryImages(prev => {
          const newSet = new Set(prev);
          localImageIds.forEach(id => newSet.add(id));
          return newSet;
        });
      }
    }

    if (restaurantData.length > 0) {
      const localImageIds = restaurantData
        .filter(item => typeof item.image !== 'string')
        .map(item => item.id.toString());

      if (localImageIds.length > 0) {
        setLoadedRestaurantImages(prev => {
          const newSet = new Set(prev);
          localImageIds.forEach(id => newSet.add(id));
          return newSet;
        });
      }
    }
  }, [categoryData, restaurantData]);

  // Fetch home data function - can be called multiple times
  const fetchHomeData = React.useCallback(async (latitude?: number, longitude?: number) => {
    try {
      setIsLoadingBanners(true);
      setIsLoadingCategories(true);
      setIsLoadingRestaurants(true);

      // Use provided coordinates or default Madurai location
      const lat = latitude ?? DEFAULT_LOCATION.latitude;
      const lng = longitude ?? DEFAULT_LOCATION.longitude;

      const response = await homeService.getHomeData(lat, lng, vegMode);

        if (response.success && response.data) {
          // The API returns data nested as: { data: { data: { promotional_banner: {...} } } }
          const actualData = response.data.data || response.data;
          const promotionalBanner = actualData.promotional_banner;
          const whatsOnYourMind = actualData.whats_on_your_mind;
          const nearbyRestaurants = actualData.nearby_restaurants;

          // Handle promotional banners
          if (promotionalBanner) {
            // Handle if it's a single object or array
            const bannerArray = Array.isArray(promotionalBanner) ? promotionalBanner : [promotionalBanner];

            // Transform API data to carousel format
            const transformedBanners: CarouselItem[] = bannerArray.map((banner: BannerItem, index: number) => ({
              id: banner.id || `banner-${index}`,
              title: banner.title || 'Special Offer',
              description: banner.subtitle || banner.description || 'Check out our latest deals!',
              buttonText: banner.cta_button || banner.button_text || 'Order Now!',
              imageUrl: banner.image_url || banner.banner_url,
            }));

            if (transformedBanners.length > 0) {
              setCarouselData(transformedBanners);
            } else {
              setCarouselData(fallbackCarouselData);
            }
          } else {
            setCarouselData(fallbackCarouselData);
          }

          // Handle categories - use fallback if empty or undefined
          if (whatsOnYourMind && Array.isArray(whatsOnYourMind) && whatsOnYourMind.length > 0) {
            // Add "View All" item at the end
            const categoriesWithViewAll = [
              ...whatsOnYourMind,
              {
                id: 'view-all',
                name: 'View All',
                description: 'See all categories',
                icon: require('@/assets/Group 1272628220.png'),
              }
            ];
            setCategoryData(categoriesWithViewAll);
            onCategoriesLoaded?.(categoriesWithViewAll);
          } else {
            setCategoryData(fallbackCategoryData);
            onCategoriesLoaded?.(fallbackCategoryData);
          }

          // Handle restaurants - use fallback if empty or undefined
          if (nearbyRestaurants && Array.isArray(nearbyRestaurants) && nearbyRestaurants.length > 0) {
            // Transform API data to match our Restaurant interface
            const transformedRestaurants = nearbyRestaurants.map((restaurant: any) => ({
              id: restaurant.id,
              name: restaurant.name,
              cuisine: restaurant.description || 'Restaurant',
              rating: restaurant.rating || 0,
              deliveryTime: restaurant.delivery_time || '25-30 mins',
              location: restaurant.location,
              distance: restaurant.distance ? `${restaurant.distance}Kms` : '0Kms',
              image: restaurant.logo_url || restaurant.image,
              isFavorite: restaurant.is_favorite || false,
              isVeg: restaurant.is_veg || restaurant.dietary_preference === 'veg' || false,
            }));

            setRestaurantData(transformedRestaurants);
          } else {
            setRestaurantData(fallbackRestaurantData);
          }
        } else {
          setCarouselData(fallbackCarouselData);
          setCategoryData(fallbackCategoryData);
          onCategoriesLoaded?.(fallbackCategoryData);
          setRestaurantData(fallbackRestaurantData);
        }
      } catch (error) {
        setCarouselData(fallbackCarouselData);
        setCategoryData(fallbackCategoryData);
        onCategoriesLoaded?.(fallbackCategoryData);
        setRestaurantData(fallbackRestaurantData);
      } finally {
        setIsLoadingBanners(false);
        setIsLoadingCategories(false);
        setIsLoadingRestaurants(false);
      }
  }, [vegMode]);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.logout();
              if (onLogout) {
                onLogout();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const onViewRef = React.useRef((viewableItems: any) => {
    if (viewableItems.viewableItems.length > 0) {
      setCurrentSlide(viewableItems.viewableItems[0].index || 0);
    }
  });

  const viewConfigRef = React.useRef({ viewAreaCoveragePercentThreshold: 50 });

  const renderCarouselItem = React.useCallback(({ item }: { item: CarouselItem }) => {
    return (
      <View style={styles.carouselSlide} testID={`carousel-slide-${item.id}`}>
        <View style={styles.adBanner} testID={`banner-${item.id}`}>
          {/* Blob with masked image */}
          {item.imageUrl ? (
            <View style={styles.blobContainer} testID={`blob-container-${item.id}`}>
              {/* Blob background with image masked inside */}
              <View style={styles.adImageBlob}>
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.adImageMasked}
                  resizeMode="cover"
                  testID={`banner-image-${item.id}`}
                  onLoad={() => {
                    setLoadedBannerImages(prev => new Set(prev).add(item.id));
                  }}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.adContent} testID={`banner-content-${item.id}`}>
            <Text style={styles.adTitle} testID={`banner-title-${item.id}`}>{item.title}</Text>
            <Text style={styles.adDescription} testID={`banner-description-${item.id}`}>{item.description}</Text>
            <TouchableOpacity style={styles.adButton} testID={`banner-button-${item.id}`}>
              <Text style={styles.adButtonText}>{item.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, []);

  const renderCategoryItem = React.useCallback(({ item }: { item: CategoryItem }) => {
    const imageSource = typeof item.icon === 'string' ? { uri: item.icon } : item.icon;
    const isViewAll = item.id === 'view-all' || item.name === 'View All';

    return (
      <TouchableOpacity
        style={styles.categoryItem}
        testID={`category-${item.id}`}
        onPress={() => {
          if (onNavigateToCategory) {
            onNavigateToCategory(item.name);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={[
          styles.categoryImageContainer,
          isViewAll && styles.viewAllImageContainer
        ]}>
          <Image
            source={imageSource}
            style={isViewAll ? styles.viewAllImage : styles.categoryImage}
            resizeMode="contain"
            testID={`category-image-${item.id}`}
            onLoad={() => {
              setLoadedCategoryImages(prev => new Set(prev).add(item.id.toString()));
            }}
            onError={(error) => {
              // Mark as loaded anyway to not block shimmer
              setLoadedCategoryImages(prev => new Set(prev).add(item.id.toString()));
            }}
          />
        </View>
        <Text style={styles.categoryName} testID={`category-name-${item.id}`}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  }, [onNavigateToCategory]);

  // Handle scroll to detect when category section becomes sticky
  const handleScroll = React.useCallback((event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    // Category section becomes sticky after header (212px) + carousel (~165px) + section title (~40px)
    // Total: approximately 400px
    const threshold = 400;
    setIsCategorySectionSticky(scrollY > threshold);
  }, []);

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.container}
          stickyHeaderIndices={[3]}
          testID="home-screen"
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >

      {/* Header with Background Image */}
      <ImageBackground
        source={require('@/assets/home_app_bar.png')}
        style={styles.headerBackground}
        imageStyle={styles.headerBackgroundImage}
        testID="header-background"
      >
        {/* Location Section */}
        <View style={styles.locationSection} testID="location-section">
          <TouchableOpacity
            style={styles.locationInfo}
            onPress={handleLocationClick}
            activeOpacity={0.7}
          >
            {isLoadingLocation ? (
              <>
                {/* City Name with Icon - Shimmer */}
                <View style={styles.cityRow}>
                  <MaterialIcons name="location-on" size={20} color="#FFFFFF" />
                  <Shimmer width={120} height={18} borderRadius={8} />
                  <MaterialIcons name="keyboard-arrow-down" size={16} color="#FFFFFF" />
                </View>
                {/* Address - Shimmer */}
                <Shimmer width={220} height={14} borderRadius={6} style={{ marginTop: 4 }} />
              </>
            ) : (
              <>
                {/* City Name with Icon */}
                <View style={styles.cityRow}>
                  <MaterialIcons name="location-on" size={20} color="#FFFFFF" />
                  <Text style={styles.cityName}>{selectedLocation.name}</Text>
                  <MaterialIcons name="keyboard-arrow-down" size={16} color="#FFFFFF" />
                </View>
                {/* Address */}
                <Text
                  style={styles.addressText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {selectedLocation.address}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Profile Avatar */}
          {isLoadingLocation ? (
            <View style={styles.profileButton}>
              <Shimmer width={50} height={50} borderRadius={25} />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.profileButton}
              onPress={onNavigateToProfile}
              testID="profile-button"
            >
              <View style={styles.profileAvatar}>
                <MaterialIcons name="person" size={22} color="#00B14F" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Search Bar and VEG Mode Toggle */}
        <View style={styles.searchSection}>
          {isLoadingLocation ? (
            <>
              {/* Search Bar Shimmer */}
              <View style={{ flex: 1 }}>
                <Shimmer width="100%" height={60} borderRadius={10} />
              </View>

              {/* VEG Mode Shimmer */}
              <Shimmer width={46} height={60} borderRadius={10} />
            </>
          ) : (
            <>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={onNavigateToSearch}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.2)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.searchBar}
                >
                  <MaterialIcons name="search" size={24} color="#FFFFFF" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search Restaurants & foods.."
                    placeholderTextColor="rgba(255, 255, 255, 0.7)"
                    cursorColor="#FFFFFF"
                    editable={false}
                    pointerEvents="none"
                  />
                </LinearGradient>
              </TouchableOpacity>

              {/* VEG Mode Toggle */}
              <TouchableOpacity
                style={styles.vegModeContainer}
                onPress={handleVegModeToggle}
                testID="veg-mode-toggle"
              >
                <Text style={styles.vegModeLabel}>VEG{'\n'}MODE</Text>
                <View style={[styles.vegToggle, isVegModeEnabled && styles.vegToggleActive]}>
                  <View style={[styles.vegToggleThumb, isVegModeEnabled && styles.vegToggleThumbActive]} />
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ImageBackground>

      {/* Ad Banner Carousel */}
      <View style={styles.carouselContainer}>
        {showBannerShimmer ? (
          <View style={styles.loadingContainer}>
            <Shimmer width="100%" height={149} borderRadius={20} backgroundColor="#00BEC8" />
          </View>
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={carouselData}
              renderItem={renderCarouselItem}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewRef.current}
              viewabilityConfig={viewConfigRef.current}
              decelerationRate="fast"
              snapToAlignment="center"
              snapToInterval={SCREEN_WIDTH}
            />

            {/* Pagination Indicators - only show if more than 1 banner */}
            {carouselData.length > 1 && (
              <View style={styles.paginationContainer}>
                {carouselData.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      currentSlide === index && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </View>

      {/* What's On Your Mind Section */}
      <View style={[
        styles.sectionTitleContainer,
        carouselData.length <= 1 && styles.sectionTitleContainerCompact
      ]}>
        <LinearGradient
          colors={['rgba(0, 0, 0, 0)', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionTitleLine}
        />
        <Text style={styles.sectionTitle}>What's On Your Mind?</Text>
        <LinearGradient
          colors={['#000000', 'rgba(0, 0, 0, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionTitleLine}
        />
      </View>

      {/* Category List */}
      <View style={[
        styles.categoryListContainer,
        isCategorySectionSticky && styles.categoryListContainerSticky
      ]}>
        {showCategoryShimmer ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryListContent}
          >
            {/* Render 6 shimmer category items */}
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <View key={item} style={styles.categoryItem}>
                {/* Image Shimmer */}
                <View style={styles.categoryImageContainer}>
                  <Shimmer width={74} height={59} borderRadius={12} backgroundColor="#E8E8E8" />
                </View>
                {/* Text Shimmer */}
                <Shimmer width={60} height={12} borderRadius={6} backgroundColor="#E8E8E8" />
              </View>
            ))}
          </ScrollView>
        ) : (
          <FlatList
            data={categoryData}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryListContent}
            testID="category-list"
          />
        )}
      </View>

      {/* Restaurants Near You Section */}
      <View style={styles.restaurantsSectionTitleContainer}>
        <LinearGradient
          colors={['rgba(0, 0, 0, 0)', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.restaurantsTitleLine}
        />
        <Text style={styles.restaurantsTitle}>Restaurants Near You</Text>
        <LinearGradient
          colors={['#000000', 'rgba(0, 0, 0, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.restaurantsTitleLine}
        />
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {showRestaurantShimmer ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {/* Render 5 shimmer filter buttons */}
            <Shimmer width={80} height={29} borderRadius={13} backgroundColor="#E8E8E8" />
            <Shimmer width={70} height={29} borderRadius={13} backgroundColor="#E8E8E8" />
            <Shimmer width={60} height={29} borderRadius={13} backgroundColor="#E8E8E8" />
            <Shimmer width={50} height={29} borderRadius={13} backgroundColor="#E8E8E8" />
            <Shimmer width={120} height={29} borderRadius={13} backgroundColor="#E8E8E8" />
          </ScrollView>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            <TouchableOpacity style={styles.filterButtonActive} testID="filter-filters">
              <MaterialIcons name="filter-list" size={16} color="#00B14F" />
              <Text style={styles.filterTextActive}>Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.filterButtonInactive} testID="filter-sort">
              <Text style={styles.filterTextInactive}>Sort By</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.filterButtonInactive} testID="filter-price">
              <Text style={styles.filterTextInactive}>Price</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.filterButtonInactive} testID="filter-veg">
              <Text style={styles.filterTextInactive}>Veg</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.filterButtonInactive} testID="filter-delivery">
              <Text style={styles.filterTextInactive}>10 Mins Delivery</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* Restaurant List */}
      <View style={[
        styles.restaurantListContainer,
        totalCartItems > 0 && {
          paddingBottom: 160 + Math.max(insets.bottom, 0)
        }
      ]}>
        {showRestaurantShimmer ? (
          <>
            {/* Shimmer for 2 restaurant cards */}
            {[1, 2].map((item) => (
              <View key={item} style={styles.restaurantCardWrapper}>
                <View style={styles.restaurantCardShimmer}>
                  {/* Left Side - Image Shimmer */}
                  <Shimmer width={130} height={160} borderRadius={16} backgroundColor="#E8E8E8" style={styles.restaurantImageShimmer} />

                  {/* Right Side - Details Shimmer */}
                  <View style={styles.restaurantDetailsShimmer}>
                    {/* Pure Veg Badge */}
                    <Shimmer width={80} height={18} borderRadius={4} backgroundColor="#E8E8E8" style={{ marginBottom: 4 }} />

                    {/* Restaurant Name */}
                    <Shimmer width="90%" height={20} borderRadius={4} backgroundColor="#E8E8E8" style={{ marginBottom: 4 }} />

                    {/* Rating and Delivery Time */}
                    <Shimmer width="70%" height={16} borderRadius={4} backgroundColor="#E8E8E8" style={{ marginBottom: 4 }} />

                    {/* Cuisine */}
                    <Shimmer width="85%" height={16} borderRadius={4} backgroundColor="#E8E8E8" style={{ marginBottom: 4 }} />

                    {/* Location and Distance */}
                    <Shimmer width="60%" height={14} borderRadius={4} backgroundColor="#E8E8E8" />
                  </View>
                </View>
              </View>
            ))}
          </>
        ) : (
          <>
            {restaurantData.map((restaurant) => (
              <View key={restaurant.id} style={styles.restaurantCardWrapper}>
                <RestaurantCard
                  restaurant={restaurant}
                  onPress={() => {
                    if (onNavigateToRestaurant) {
                      onNavigateToRestaurant(restaurant.id, restaurant.name);
                    }
                  }}
                  onImageLoad={() => {
                    setLoadedRestaurantImages(prev => new Set(prev).add(restaurant.id.toString()));
                  }}
                />
              </View>
            ))}
          </>
        )}
      </View>

      {/* Location Permission Modal */}
      <Modal
        visible={showLocationPopup}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowLocationPopup(false)}
      >
        <BlurView intensity={80} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Location Illustration */}
            <View style={styles.illustrationContainer}>
              <Image
                source={require('@/assets/location-illustration.png')}
                style={styles.locationIllustration}
                resizeMode="contain"
              />
            </View>

            {/* Title */}
            <Text style={styles.modalTitle}>Location Access</Text>

            {/* Description */}
            <Text style={styles.modalDescription}>
              Give the access to fetch accurate location that will ease to delivery
            </Text>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.allowButton}
                onPress={handleAllowLocation}
                activeOpacity={0.8}
              >
                <Text style={styles.allowButtonText}>Allow Access</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.notNowButton}
                onPress={handleDenyLocation}
                activeOpacity={0.8}
              >
                <Text style={styles.notNowButtonText}>Not Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* VEG Mode Selection Modal */}
      <Modal
        visible={showVegModePopup}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowVegModePopup(false)}
      >
        <TouchableOpacity
          style={styles.vegModalOverlay}
          activeOpacity={1}
          onPress={() => setShowVegModePopup(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.vegModalContent}>
              {/* Pure Veg Option - Only veg restaurants */}
              <TouchableOpacity
                style={styles.vegOption}
                onPress={() => setTempVegSelection('pure')}
                testID="veg-option-pure"
              >
                <View style={styles.radioButton}>
                  {tempVegSelection === 'pure' && <View style={styles.radioButtonSelected} />}
                </View>
                <Text style={styles.vegOptionText}>Pure Veg</Text>
              </TouchableOpacity>

              {/* All Option - All restaurants but only veg items */}
              <TouchableOpacity
                style={styles.vegOption}
                onPress={() => setTempVegSelection('all')}
                testID="veg-option-all"
              >
                <View style={styles.radioButton}>
                  {tempVegSelection === 'all' && <View style={styles.radioButtonSelected} />}
                </View>
                <Text style={styles.vegOptionText}>All (Veg Items)</Text>
              </TouchableOpacity>

              {/* Apply Button */}
              <TouchableOpacity
                style={styles.vegApplyButton}
                onPress={handleApplyVegMode}
                testID="veg-apply-button"
              >
                <Text style={styles.vegApplyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      </ScrollView>
      </SafeAreaView>

      {/* View Cart Bar - shows when cart has items */}
      <ViewCartBar
        onPress={() => {
          // Navigate to restaurant page
          if (restaurantId && onNavigateToRestaurant) {
            onNavigateToRestaurant(restaurantId, restaurantName);
          }
        }}
        onViewMenu={() => {
          if (restaurantId && onNavigateToRestaurant) {
            onNavigateToRestaurant(restaurantId, restaurantName);
          }
        }}
        restaurantLogo={restaurantLogo}
        deliveryLocation={selectedLocation.name}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header styles
  headerBackground: {
    width: '100%',
    height: 212,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 18,
  },
  headerBackgroundImage: {
    width: '120%',
    height: 212,
    left: 0,
  },
  // Location section
  locationSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    height: 50,
  },
  locationInfo: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: 0,
    gap: 2,
    width: 326,
    height: 44,
    flex: 1,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 0,
    gap: 4,
    width: 271,
    height: 24,
    marginLeft: -3,
  },
  cityName: {
    height: 24,
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    letterSpacing: 0,
    textAlignVertical: 'center',
    flexShrink: 1,
  },
  addressText: {
    maxWidth: 260,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  profileButton: {
    width: 50,
    height: 50,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7F7F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Search section
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 60,
    gap: 11,
  },
  searchBar: {
    flex: 1,
    height: 60,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    color: '#FFFFFF',
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  vegModeContainer: {
    width: 46,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  vegModeLabel: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: '#FFFFFF',
    fontWeight: '600',
    opacity: 0.85,
  },
  vegToggle: {
    width: 46,
    height: 21,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  vegToggleThumb: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#FFFFFF',
  },
  vegToggleActive: {
    backgroundColor: '#00B14F',
    alignItems: 'flex-end',
  },
  vegToggleThumbActive: {
    // No additional styles needed, alignment handled by parent
  },
  // Carousel Container
  carouselContainer: {
    marginTop: -44,
    marginBottom: 16,
    overflow: 'hidden',
  },
  loadingContainer: {
    width: '100%',
    height: 149,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  carouselSlide: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  // Ad Banner
  adBanner: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 14,
    width: '100%',
    height: 149,
    backgroundColor: '#00BEC8',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  adContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 11,
    position: 'relative',
    zIndex: 2,
  },
  blobContainer: {
    position: 'absolute',
    right: -15,
    bottom: -35,
    width: 180,
    height: 160,
  },
  adImageBlob: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FF6B6B',
    borderTopLeftRadius: 120,
    borderTopRightRadius: 55,
    borderBottomLeftRadius: 75,
    borderBottomRightRadius: 95,
    transform: [
      { rotate: '-18deg' },
      { scaleX: 1.2 },
      { scaleY: 0.88 },
      { skewX: '5deg' },
    ],
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adImageMasked: {
    width: '120%',
    height: '120%',
    transform: [{ rotate: '18deg' }],
  },
  adTitle: {
    width: 294,
    height: 29,
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 19,
    lineHeight: 28,
    color: '#FFFFFF',
  },
  adDescription: {
    width: 239,
    height: 42,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
  },
  adButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 15,
    minWidth: 103,
    height: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
  },
  adButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: '#000000',
    opacity: 0.85,
    textAlign: 'center',
  },
  // Pagination
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D9D9D9',
  },
  paginationDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00B14F',
  },
  // Section Title
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 15,
  },
  sectionTitleContainerCompact: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  sectionTitleLine: {
    width: 35,
    height: 1,
  },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 0,
    textAlign: 'center',
    color: '#000000',
  },
  // Category List
  categoryListContainer: {
    width: '100%',
    minHeight: 100,
    paddingLeft: 20,
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 4,
    paddingBottom: 12,
  },
  categoryListContainerSticky: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryListContent: {
    paddingRight: 20,
    alignItems: 'flex-start',
  },
  categoryItem: {
    width: 74,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  categoryImageContainer: {
    width: 74,
    height: 59,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  viewAllImageContainer: {
    justifyContent: 'flex-end',
    paddingBottom: 5,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    shadowColor: '#000000',
    shadowOffset: {
      width: -6,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  viewAllImage: {
    width: 45,
    height: 45,
    shadowColor: '#000000',
    shadowOffset: {
      width: -6,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  categoryName: {
    width: 74,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
    flexWrap: 'wrap',
  },
  // Restaurants Near You Section
  restaurantsSectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 15,
  },
  restaurantsTitleLine: {
    width: 35,
    height: 1,
  },
  restaurantsTitle: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 0,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  // Filter buttons
  filterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  filterScrollContent: {
    gap: 10,
  },
  filterButtonActive: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 4,
    height: 29,
    borderWidth: 1,
    borderColor: 'rgba(0, 128, 74, 0.25)',
    borderRadius: 13,
  },
  filterTextActive: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 0,
    color: '#00B14F',
  },
  filterButtonInactive: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 4,
    height: 29,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 13,
  },
  filterTextInactive: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 0,
    color: '#000000',
  },
  // Restaurant List
  restaurantListContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  restaurantListWithCart: {
    paddingBottom: 160, // Extra padding when cart modal is visible
  },
  restaurantCardWrapper: {
    marginBottom: 10,
  },
  restaurantCardShimmer: {
    flexDirection: 'row',
    width: '100%',
    height: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  restaurantImageShimmer: {
    borderRadius: 16,
  },
  restaurantDetailsShimmer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  message: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  illustrationContainer: {
    width: '100%',
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationIllustration: {
    width: '100%',
    height: '100%',
  },
  modalTitle: {
    fontFamily: 'Poppins',
    fontSize: 24,
    lineHeight: 32,
    color: '#000000',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '700',
  },
  modalDescription: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 22,
    color: '#9E9E9E',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 0,
  },
  modalButtons: {
    width: '100%',
    gap: 10,
  },
  allowButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#00B14F',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allowButtonText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  notNowButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notNowButtonText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    fontWeight: '600',
  },
  // VEG Mode Modal
  vegModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegModalContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    gap: 12,
    width: 192,
    minHeight: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  vegOption: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 20,
    width: '100%',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D9D9D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00B14F',
  },
  vegOptionText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 20,
    color: '#000000',
    opacity: 0.85,
  },
  vegApplyButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    backgroundColor: '#00B14F',
    borderRadius: 6,
  },
  vegApplyButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    opacity: 0.85,
  },
});
