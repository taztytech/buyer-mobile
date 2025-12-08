import React from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Modal, Image, ImageBackground, ScrollView, FlatList, Dimensions, Keyboard, Platform, ActivityIndicator, Animated, RefreshControl, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { authService } from '@/services/auth.service';
import { homeService, BannerItem, CategoryItem, Restaurant } from '@/services/home.service';
import { addressService } from '@/services/address.service';
import { RestaurantCard } from '@/components/RestaurantCard';
import { Shimmer } from '@/components/Shimmer';
import { AppFooter } from '@/components/AppFooter';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { ViewCartBar } from '@/components/ViewCartBar';
import { CategoryModal } from '@/components/CategoryModal';
import { useCart } from '@/context/CartContext';
import { useVegMode } from '@/context/VegModeContext';
import { useConfirmation } from '@/context/ConfirmationContext';
import { restaurantService } from '@/services/restaurant.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 40; // Fixed banner width with 20px padding on each side

interface HomeScreenProps {
  onLogout?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToAddressSelection?: () => void;
  onNavigateToCategory?: (categoryName: string) => void;
  onNavigateToRestaurant?: (restaurantId: number, restaurantName: string) => void;
  onNavigateToCheckout?: (restaurantId: number, restaurantName: string, restaurantAddress?: string, from?: 'home' | 'restaurant') => void;
  onNavigateToSearch?: () => void;
  onNavigateToLocationSelection?: () => void;
  selectedLocation?: { name: string; address: string; latitude?: number; longitude?: number };
  onCategoriesLoaded?: (categories: CategoryItem[]) => void;
  isFocused?: boolean;
  addressRefreshTrigger?: number; // Trigger to refresh addresses when changed
}

interface CarouselItem {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  imageUrl?: string;
  sequence?: number;
  promotionType?: 'restaurant_id' | 'category_id' | 'url';
  promotionLink?: string;
  backgroundColor?: string;
}


// Utility to normalize veg food types returned by API (handles values like "pure-veg")
const isVegFoodType = (foodType?: string, isVegFlag?: boolean): boolean => {
  if (isVegFlag) {
    return true;
  }

  if (!foodType) {
    return false;
  }

  const normalized = foodType.trim().toLowerCase();
  return normalized === 'veg' || normalized === 'pure-veg' || normalized === 'pure veg' || normalized === 'pureveg';
};

// Default location coordinates (Madurai)
const DEFAULT_LOCATION = {
  name: 'Madurai',
  address: 'Madurai, Tamil Nadu, India',
  latitude: 9.9252,
  longitude: 78.1198,
};



export const HomeScreen: React.FC<HomeScreenProps> = ({
  onLogout,
  onNavigateToProfile,
  onNavigateToAddressSelection,
  onNavigateToCategory,
  onNavigateToRestaurant,
  onNavigateToCheckout,
  onNavigateToSearch,
  onNavigateToLocationSelection,
  selectedLocation: externalSelectedLocation,
  onCategoriesLoaded,
  addressRefreshTrigger,
  isFocused = true,
}) => {
  const { restaurantId, restaurantName, restaurantLogo, getTotalItems } = useCart();
  const { vegMode, setVegMode, isVegModeEnabled } = useVegMode();
  const { showConfirmation } = useConfirmation();
  const insets = useSafeAreaInsets();
  const totalCartItems = getTotalItems();
  const [showLocationPopup, setShowLocationPopup] = React.useState(false);
  const [hasShownLocationModal, setHasShownLocationModal] = React.useState(false);
  const [showVegModePopup, setShowVegModePopup] = React.useState(false);
  const vegModalSlideAnim = React.useRef(new Animated.Value(500)).current;
  const vegModalOpacityAnim = React.useRef(new Animated.Value(1)).current;
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [carouselData, setCarouselData] = React.useState<CarouselItem[]>([]);
  const [categoryData, setCategoryData] = React.useState<CategoryItem[]>([]);
  const [restaurantData, setRestaurantData] = React.useState<Restaurant[]>([]);
  const [isLoadingBanners, setIsLoadingBanners] = React.useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = React.useState(true);
  const [isLoadingRestaurants, setIsLoadingRestaurants] = React.useState(true);
  const [isLoadingLocation, setIsLoadingLocation] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [hasNetworkError, setHasNetworkError] = React.useState(false);
  const [noRestaurantsFound, setNoRestaurantsFound] = React.useState(false);
  const isRequestingPermission = React.useRef(false);

  // Track image loading states
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_loadedBannerImages, setLoadedBannerImages] = React.useState<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_loadedCategoryImages, setLoadedCategoryImages] = React.useState<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_loadedRestaurantImages, setLoadedRestaurantImages] = React.useState<Set<string>>(new Set());

  // Combined loading states (API + Images)
  const [showBannerShimmer, setShowBannerShimmer] = React.useState(true);
  const [showCategoryShimmer, setShowCategoryShimmer] = React.useState(true);
  const [showRestaurantShimmer, setShowRestaurantShimmer] = React.useState(true);
  const [tempVegSelection, setTempVegSelection] = React.useState<'pure' | 'all'>('pure');
  const [selectedLocation, setSelectedLocation] = React.useState(externalSelectedLocation || { name: DEFAULT_LOCATION.name, address: DEFAULT_LOCATION.address });

  // Debug: Log whenever selectedLocation changes
  React.useEffect(() => {
    // selectedLocation tracking
  }, [selectedLocation]);
  const [isCategorySectionSticky, setIsCategorySectionSticky] = React.useState(false);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);
  const flatListRef = React.useRef<FlatList>(null);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const scrollPositionRef = React.useRef(0);
  const autoSlideTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [defaultAddressCoords, setDefaultAddressCoords] = React.useState<{ latitude: number; longitude: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_hasDefaultAddress, setHasDefaultAddress] = React.useState(false);
  const isInitialVegModeLoad = React.useRef(true);
  const hasRedirectedToLocationMap = React.useRef(false); // Prevent multiple redirects
  const lastFetchedCoords = React.useRef<{ latitude: number; longitude: number } | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = React.useState(1);
  const [hasMoreRestaurants, setHasMoreRestaurants] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  // Refresh trigger - increments to force data reload
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_refreshTrigger, _setRefreshTrigger] = React.useState(0);

  // Location serviceability state
  const [isLocationServiceable, setIsLocationServiceable] = React.useState(true);

  /**
   * Ensure the restaurant associated with the current cart is open
   * before allowing user to navigate to checkout from the Home screen.
   * Falls back to allowing navigation if the status cannot be determined.
   */
  const ensureCartRestaurantOpen = React.useCallback(async (): Promise<boolean> => {
    // If there is no restaurant in cart, nothing to validate
    if (!restaurantId) {
      return true;
    }

    try {
      // Use the best available coordinates for restaurant details lookup
      const lat =
        externalSelectedLocation?.latitude ||
        defaultAddressCoords?.latitude ||
        DEFAULT_LOCATION.latitude;
      const lng =
        externalSelectedLocation?.longitude ||
        defaultAddressCoords?.longitude ||
        DEFAULT_LOCATION.longitude;

      const response = await restaurantService.getRestaurantDetails(restaurantId, {
        lat,
        lng,
        include_items: false,
      });

      if (!response.success || !response.data) {
        // If we can't determine status, don't hard-block the user.
        return true;
      }

      const timings = response.data.timings;
      const isOpen = timings ? homeService.isRestaurantOpen(timings) : true;

      if (!isOpen) {
        showConfirmation({
          title: 'Restaurant is currently closed',
          message: 'This restaurant is closed right now. You can place the order when it reopens.',
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#00B14F',
          onConfirm: () => {},
        });
        return false;
      }

      return true;
    } catch {
      // On any unexpected error, allow navigation and rely on backend validation.
      return true;
    }
  }, [restaurantId, externalSelectedLocation, defaultAddressCoords, showConfirmation]);

  // Dismiss keyboard when component mounts (only once)
  React.useEffect(() => {
    Keyboard.dismiss();
  }, []);

  // Trigger data reload when screen becomes focused
  // DISABLED: Causes jerk/jump when returning from other screens
  // Will implement a better refresh approach later
  // React.useEffect(() => {
  //   if (isFocused) {
  //     // Increment refresh trigger to force data reload
  //     setRefreshTrigger(prev => prev + 1);
  //   }
  // }, [isFocused]);

  // Log API endpoint URL on mount
  React.useEffect(() => {
    // API endpoint configuration check
  }, []);

  // Update local state when external selectedLocation changes
  React.useEffect(() => {
    if (externalSelectedLocation) {
      setSelectedLocation(externalSelectedLocation);
      // User selected a different address, fetch restaurants for the new location
      // Clear data first to prevent showing stale cached data
      if (externalSelectedLocation.latitude && externalSelectedLocation.longitude) {
        setRestaurantData([]);
        setCarouselData([]);
        setCategoryData([]);
        fetchHomeData(externalSelectedLocation.latitude, externalSelectedLocation.longitude);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSelectedLocation]);

  // Extract address fetching logic into a reusable function
  const fetchDefaultAddress = React.useCallback(
    async (options?: { overrideSelectedLocation?: boolean }) => {
    try {
      // Clear cache to ensure we get fresh data
      addressService.clearCache();
      const response = await addressService.getAddresses();

      if (response.success && response.data) {
        // Reset redirect flag if user has addresses now (allows redirect again if they delete all addresses later)
        if (response.data.length > 0) {
          hasRedirectedToLocationMap.current = false;
        }

        // Check if user has no addresses - redirect to location map screen (only on homepage)
        // Only redirect if we haven't already redirected in this session
        if (response.data.length === 0 && isFocused && !hasRedirectedToLocationMap.current) {
          hasRedirectedToLocationMap.current = true;
          // Redirect to location map screen
          if (onNavigateToLocationSelection) {
            onNavigateToLocationSelection();
            return; // Exit early, don't fetch home data
          }
        }

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
          // - Normally, we respect an explicitly chosen externalSelectedLocation
          // - But after address changes (delete/edit), we may want to override it
          if (!externalSelectedLocation || options?.overrideSelectedLocation) {
            const newLocation = {
              name: formattedType,
              address: `${defaultAddress.address1}${defaultAddress.address2 ? ', ' + defaultAddress.address2 : ''}${defaultAddress.address3 ? ', ' + defaultAddress.address3 : ''}, ${defaultAddress.city}`,
            };
            setSelectedLocation(newLocation);
          }

          // Fetch home data with default address coordinates
          // Clear data first to prevent showing stale cached data
          setRestaurantData([]);
          setCarouselData([]);
          setCategoryData([]);
          await fetchHomeData(defaultAddress.latitude, defaultAddress.longitude);
        } else {
          // No default address, use fallback location
          setHasDefaultAddress(false);
          setSelectedLocation({
            name: DEFAULT_LOCATION.name,
            address: DEFAULT_LOCATION.address,
          });

          // Fetch home data with default Madurai coordinates
          setRestaurantData([]);
          setCarouselData([]);
          setCategoryData([]);
          await fetchHomeData(undefined, undefined);
        }
      } else {
        // API failed, use fallback location
        setHasDefaultAddress(false);
        setSelectedLocation({
          name: DEFAULT_LOCATION.name,
          address: DEFAULT_LOCATION.address,
        });

        // Fetch home data with default Madurai coordinates
        setRestaurantData([]);
        setCarouselData([]);
        setCategoryData([]);
        await fetchHomeData(undefined, undefined);
      }
    } catch (error) {
      // Error fetching addresses, use fallback location
      setHasDefaultAddress(false);
      setSelectedLocation({
        name: DEFAULT_LOCATION.name,
        address: DEFAULT_LOCATION.address,
      });

      // Fetch home data with default Madurai coordinates
      setRestaurantData([]);
      setCarouselData([]);
      setCategoryData([]);
      await fetchHomeData(undefined, undefined);
    } finally {
      setIsLoadingLocation(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSelectedLocation, isFocused, onNavigateToLocationSelection]);

  // Fetch default address on component mount (ONLY ONCE)
  React.useEffect(() => {
    fetchDefaultAddress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Refresh addresses when addressRefreshTrigger changes (e.g., address deleted/edited)
  React.useEffect(() => {
    if (addressRefreshTrigger && addressRefreshTrigger > 0) {
      // Force override of selectedLocation so the home top bar reflects the
      // latest default address after changes in MyAddresses
      fetchDefaultAddress({ overrideSelectedLocation: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressRefreshTrigger]);

  // Reload home data when screen becomes focused (but don't reset address)
  // DISABLED: Not needed since auto-refresh on focus is disabled
  // React.useEffect(() => {
  //   if (isFocused && refreshTrigger > 0) {
  //     // Don't show shimmers - silently refresh data in background
  //     // This prevents layout shift and scroll position jump
  //     // Old content remains visible until new data loads

  //     // Reload data with current selected location coordinates
  //     const lat = externalSelectedLocation?.latitude || defaultAddressCoords?.latitude || DEFAULT_LOCATION.latitude;
  //     const lng = externalSelectedLocation?.longitude || defaultAddressCoords?.longitude || DEFAULT_LOCATION.longitude;

  //     fetchHomeData(lat, lng);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [refreshTrigger]);


  // Hide banner shimmer immediately when API data loads
  React.useEffect(() => {
    if (!isLoadingBanners) {
      setShowBannerShimmer(false);
    }
  }, [isLoadingBanners]);

  // Hide shimmer as soon as API data is loaded
  React.useEffect(() => {
    if (!isLoadingCategories) {
      // Hide shimmer immediately when API data loading is complete
      setShowCategoryShimmer(false);
    }
  }, [isLoadingCategories]);

  // Hide restaurant shimmer immediately when API data loads
  React.useEffect(() => {
    if (!isLoadingRestaurants) {
      setShowRestaurantShimmer(false);
    }
  }, [isLoadingRestaurants]);

  // Check location permission and handle accordingly
  // COMMENTED OUT: Custom location permission modal disabled
  // React.useEffect(() => {
  //   const checkLocationPermission = async () => {
  //     // Skip if screen is not focused (HomeScreen is always mounted but not always visible)
  //     if (!isFocused) {
  //       return;
  //     }

  //     // Skip if already checked this session or if user has a default address
  //     if (hasShownLocationModal || hasDefaultAddress || isLoadingLocation) {
  //       return;
  //     }

  //     try {
  //       // Check if permission is already granted
  //       const { status } = await Location.getForegroundPermissionsAsync();

  //       if (status === 'granted') {
  //         // Permission already granted, get location silently without showing modal
  //         setHasShownLocationModal(true);
  //         const location = await Location.getCurrentPositionAsync({});
  //         const userLatitude = location.coords.latitude;
  //         const userLongitude = location.coords.longitude;

  //         // Fetch restaurants with user's location
  //         await fetchHomeData(userLatitude, userLongitude);
  //       } else {
  //         // Permission not granted, show custom modal first
  //         setShowLocationPopup(true);
  //         setHasShownLocationModal(true);
  //       }
  //     } catch (error) {
  //       // If error checking permission, show the modal
  //       setShowLocationPopup(true);
  //       setHasShownLocationModal(true);
  //     }
  //   };

  //   checkLocationPermission();
  // }, [isFocused, hasShownLocationModal, hasDefaultAddress, isLoadingLocation]);

  // Reload home data when veg mode changes
  React.useEffect(() => {
    // Skip initial load when vegMode is loaded from storage
    if (isInitialVegModeLoad.current) {
      isInitialVegModeLoad.current = false;
      return;
    }

    // Reload data with current coordinates when veg mode changes
    const coords = defaultAddressCoords || { latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude };
    setRestaurantData([]);
    setCarouselData([]);
    setCategoryData([]);
    fetchHomeData(coords.latitude, coords.longitude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vegMode]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        setRestaurantData([]);
        setCarouselData([]);
        setCategoryData([]);
        await fetchHomeData(userLatitude, userLongitude);
      } else {
        setHasShownLocationModal(true); // Mark as shown to prevent repeated popups
        showConfirmation({
          title: 'Permission Denied',
          message: 'Location permission is required to show nearby restaurants. Please enable it in your device settings.',
          confirmText: 'Open Settings',
          cancelText: 'Cancel',
          onConfirm: () => Location.requestForegroundPermissionsAsync(),
        });
      }
    } catch (error) {
      showConfirmation({
        title: 'Error',
        message: 'Failed to get location permission. Please try again.',
        confirmText: 'OK',
        cancelText: 'Cancel',
        onConfirm: () => {},
      });
    } finally {
      isRequestingPermission.current = false;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDenyLocation = () => {
    setShowLocationPopup(false);
    setHasShownLocationModal(true); // Prevent modal from showing again

    // Set default location to Madurai
    setSelectedLocation({
      name: DEFAULT_LOCATION.name,
      address: DEFAULT_LOCATION.address,
    });

    // Show popup that settings can be done later
    showConfirmation({
      title: 'Location Settings',
      message: 'Default location set to Madurai. You can change this later from settings.',
      confirmText: 'OK',
      cancelText: 'Close',
      onConfirm: () => {},
    });
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

  // Animate veg modal slide in/out
  React.useEffect(() => {
    if (showVegModePopup) {
      vegModalSlideAnim.setValue(500);
      vegModalOpacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(vegModalSlideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(vegModalOpacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [showVegModePopup]);

  const handleCloseVegModal = () => {
    Animated.parallel([
      Animated.timing(vegModalSlideAnim, {
        toValue: 500,
        duration: 75,
        useNativeDriver: true,
      }),
      Animated.timing(vegModalOpacityAnim, {
        toValue: 0,
        duration: 75,
        useNativeDriver: true,
      })
    ]).start(() => {
      setShowVegModePopup(false);
      // Reset for next opening
      vegModalSlideAnim.setValue(500);
      vegModalOpacityAnim.setValue(0);
    });
  };

  const handleApplyVegMode = () => {
    // Always persist veg mode when enabled (similar to major food delivery apps)
    setVegMode(tempVegSelection, true);
    handleCloseVegModal();
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
      setHasNetworkError(false);
      setNoRestaurantsFound(false);
      // Reset shimmers whenever a new fetch starts so UI never shows a blank state
      setShowBannerShimmer(true);
      setShowCategoryShimmer(true);
      setShowRestaurantShimmer(true);
      setIsLoadingBanners(true);
      setIsLoadingCategories(true);
      setIsLoadingRestaurants(true);

      // Reset pagination state for fresh load
      setCurrentPage(1);
      setHasMoreRestaurants(false);

      // Use provided coordinates or default Madurai location
      const lat = latitude ?? DEFAULT_LOCATION.latitude;
      const lng = longitude ?? DEFAULT_LOCATION.longitude;

      // Check if coordinates have actually changed (using small threshold for floating point comparison)
      const coordsChanged = !lastFetchedCoords.current || 
        Math.abs(lastFetchedCoords.current.latitude - lat) > 0.0001 || 
        Math.abs(lastFetchedCoords.current.longitude - lng) > 0.0001;

      // If coordinates changed, clear existing data immediately to prevent showing stale cached data
      if (coordsChanged) {
        setRestaurantData([]);
        setCarouselData([]);
        setCategoryData([]);
        lastFetchedCoords.current = { latitude: lat, longitude: lng };
      }

      // Check if location is serviceable
      const serviceable = homeService.isLocationServiceable(lat, lng);
      setIsLocationServiceable(serviceable);

      // If location is not serviceable, stop loading and don't fetch data
      if (!serviceable) {
        setIsLoadingBanners(false);
        setIsLoadingCategories(false);
        setIsLoadingRestaurants(false);
        return;
      }

      const response = await homeService.getHomeData(lat, lng, vegMode, 1);

        if (response.success && response.data) {
          // The API returns data nested as: { data: { data: { promotional_banner: {...} } } }
          const actualData = (response.data as any).data || response.data;
          const promotionalBanner = actualData.promotional_banner;
          const whatsOnYourMind = actualData.whats_on_your_mind;
          const nearbyRestaurants = actualData.nearby_restaurants;
          const pagination = actualData.pagination;


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
              sequence: banner.sequence !== undefined ? banner.sequence : index,
              promotionType: banner.promotion_type,
              promotionLink: banner.promotion_link,
              backgroundColor: banner.background_color,
            }));

            // Sort banners by sequence field
            const sortedBanners = transformedBanners.sort((a, b) => {
              const seqA = a.sequence !== undefined ? a.sequence : 999;
              const seqB = b.sequence !== undefined ? b.sequence : 999;
              return seqA - seqB;
            });

            if (sortedBanners.length > 0) {
              setCarouselData(sortedBanners);
            } else {
              setCarouselData([]);
            }
          } else {
            setCarouselData([]);
          }

          // Handle categories - use fallback if empty or undefined
          if (whatsOnYourMind && Array.isArray(whatsOnYourMind) && whatsOnYourMind.length > 0) {
            // Filter categories based on vegMode
            let filteredCategories = whatsOnYourMind;

            if (vegMode === 'pure') {
              // Show only Veg categories (handles values like "pure-veg")
              filteredCategories = whatsOnYourMind.filter((category: CategoryItem) =>
                isVegFoodType(category.food_type, category.is_veg)
              );
            } else if (vegMode === 'all') {
              // Show all categories regardless of food_type
              filteredCategories = whatsOnYourMind;
            }
            // If vegMode is 'off', show all categories (no filtering)

            // If filtered categories is empty, fetch dishes from API based on vegMode
            if (filteredCategories.length === 0 && vegMode !== 'off') {
              const foodTypeParam = vegMode === 'pure' ? 'Veg' : undefined;
              const dishResponse = await homeService.getDishes(foodTypeParam, 10, 1, vegMode);

              if (dishResponse.success && dishResponse.data?.dishes) {
                // Transform dishes to category format
                const dishCategories: CategoryItem[] = dishResponse.data.dishes.map((dish: any) => ({
                  id: dish.id,
                  name: dish.name || dish.dish_name,
                  description: dish.description,
                  icon: dish.image || dish.image_url || dish.dish_image,
                  sequence: dish.sequence,
                  food_type: dish.food_type || dish.foodType || dish.type,
                  is_veg: dish.is_veg || dish.isVeg || dish.is_vegetarian,
                }));

                // Sort by sequence
                const sortedDishCategories = dishCategories.sort((a, b) => {
                  const seqA = a.sequence !== undefined ? a.sequence : 999;
                  const seqB = b.sequence !== undefined ? b.sequence : 999;
                  return seqA - seqB;
                });

                // Add "View All" at the end
                const categoriesWithViewAll = [
                  ...sortedDishCategories,
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
                setCategoryData([]);
                onCategoriesLoaded?.([]);
              }
            } else {
              // Sort filtered categories by sequence field
              const sortedCategories = [...filteredCategories].sort((a, b) => {
                const seqA = a.sequence !== undefined ? a.sequence : 999;
                const seqB = b.sequence !== undefined ? b.sequence : 999;
                return seqA - seqB;
              });

              // Add "View All" item at the end (only if we have categories after filtering)
              const categoriesWithViewAll = sortedCategories.length > 0 ? [
                ...sortedCategories,
                {
                  id: 'view-all',
                  name: 'View All',
                  description: 'See all categories',
                  icon: require('@/assets/Group 1272628220.png'),
                }
              ] : sortedCategories;

              setCategoryData(categoriesWithViewAll);
              onCategoriesLoaded?.(categoriesWithViewAll);
            }
          } else {
            setCategoryData([]);
            onCategoriesLoaded?.([]);
          }

          // Handle restaurants - show error if empty or undefined
          if (nearbyRestaurants && Array.isArray(nearbyRestaurants) && nearbyRestaurants.length > 0) {
            // Filter restaurants based on vegMode and food_type
            let filteredRestaurants = nearbyRestaurants;

            if (vegMode === 'pure') {
              // Show only Veg restaurants (handles values like "pure-veg")
              filteredRestaurants = nearbyRestaurants.filter((restaurant: any) =>
                isVegFoodType(restaurant.food_type, restaurant.is_veg)
              );
            } else if (vegMode === 'all') {
              // Show all restaurants regardless of food_type
              filteredRestaurants = nearbyRestaurants;
            }
            // If vegMode is 'off', show all restaurants (no filtering)

            // Transform filtered restaurants to match our Restaurant interface
            const transformedRestaurants = filteredRestaurants.map((restaurant: any) => {
              const timings = restaurant.timings || [];
              const isOpen = homeService.isRestaurantOpen(timings);

              // Format cuisine_tags: if array, join with " • ", otherwise use as string
              let cuisineText = 'Restaurant';
              if (restaurant.cuisine_tags) {
                if (Array.isArray(restaurant.cuisine_tags)) {
                  cuisineText = restaurant.cuisine_tags.join(' • ');
                } else if (typeof restaurant.cuisine_tags === 'string') {
                  cuisineText = restaurant.cuisine_tags;
                }
              }

              return {
                id: restaurant.id,
                name: restaurant.name,
                cuisine: cuisineText,
                rating: restaurant.rating || 0,
                reviewCount: restaurant.review_count || restaurant.reviews_count || restaurant.total_reviews || 0,
                deliveryTime: restaurant.delivery_time || '25-30 mins',
                location: restaurant.location,
                distance: restaurant.distance ? `${restaurant.distance}Kms` : '0Kms',
                image: restaurant.logo_url || restaurant.image,
                isFavorite: restaurant.is_favorite || false,
                isVeg: restaurant.is_veg || restaurant.dietary_preference === 'veg' || false,
                timings: timings,
                isOpen: isOpen,
              };
            });

            setRestaurantData(transformedRestaurants);

            // Handle pagination metadata
            if (pagination) {
              setHasMoreRestaurants(pagination.has_more || false);
            }
          } else {
            // No restaurants found in the area
            setNoRestaurantsFound(true);
            setRestaurantData([]);
            setHasMoreRestaurants(false);
          }
        } else {
          // API call failed - show network error
          setCarouselData([]);
          setCategoryData([]);
          onCategoriesLoaded?.([]);
          setHasNetworkError(true);
          setRestaurantData([]);
        }
      } catch (error) {
        setCarouselData([]);
        setCategoryData([]);
        onCategoriesLoaded?.([]);
        setHasNetworkError(true);
        setRestaurantData([]);
      } finally {
        setIsLoadingBanners(false);
        setIsLoadingCategories(false);
        setIsLoadingRestaurants(false);
      }
  }, [vegMode]);

  // Load more restaurants function for pagination
  const loadMoreRestaurants = React.useCallback(async () => {
    // Don't load if already loading, no more data, or initial load is still in progress
    if (isLoadingMore || !hasMoreRestaurants || isLoadingRestaurants) {
      return;
    }

    try {
      setIsLoadingMore(true);

      const nextPage = currentPage + 1;
      const coords = defaultAddressCoords || { latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude };

      const response = await homeService.getHomeData(coords.latitude, coords.longitude, vegMode, nextPage);

      if (response.success && response.data) {
        const actualData = (response.data as any).data || response.data;
        const nearbyRestaurants = actualData.nearby_restaurants;
        const pagination = actualData.pagination;

        if (nearbyRestaurants && Array.isArray(nearbyRestaurants) && nearbyRestaurants.length > 0) {
          // Filter restaurants based on vegMode and food_type (same as initial load)
          let filteredRestaurants = nearbyRestaurants;

          if (vegMode === 'pure') {
            // Show only Veg restaurants (handles values like "pure-veg")
            filteredRestaurants = nearbyRestaurants.filter((restaurant: any) =>
              isVegFoodType(restaurant.food_type, restaurant.is_veg)
            );
          } else if (vegMode === 'all') {
            // Show all restaurants regardless of food_type
            filteredRestaurants = nearbyRestaurants;
          }

          // Transform filtered new restaurants
          const transformedRestaurants = filteredRestaurants.map((restaurant: any) => {
            const timings = restaurant.timings || [];
            const isOpen = homeService.isRestaurantOpen(timings);

            // Format cuisine_tags: if array, join with " • ", otherwise use as string
            let cuisineText = 'Restaurant';
            if (restaurant.cuisine_tags) {
              if (Array.isArray(restaurant.cuisine_tags)) {
                cuisineText = restaurant.cuisine_tags.join(' • ');
              } else if (typeof restaurant.cuisine_tags === 'string') {
                cuisineText = restaurant.cuisine_tags;
              }
            }

            return {
              id: restaurant.id,
              name: restaurant.name,
              cuisine: cuisineText,
              rating: restaurant.rating || 0,
              reviewCount: restaurant.review_count || restaurant.reviews_count || restaurant.total_reviews || 0,
              deliveryTime: restaurant.delivery_time || '25-30 mins',
              location: restaurant.location,
              distance: restaurant.distance ? `${restaurant.distance}Kms` : '0Kms',
              image: restaurant.logo_url || restaurant.image,
              isFavorite: restaurant.is_favorite || false,
              isVeg: restaurant.is_veg || restaurant.dietary_preference === 'veg' || false,
              timings: timings,
              isOpen: isOpen,
            };
          });

          // Append new restaurants to existing list
          setRestaurantData(prevData => [...prevData, ...transformedRestaurants]);
          setCurrentPage(nextPage);

          // Update pagination state
          if (pagination) {
            setHasMoreRestaurants(pagination.has_more || false);
          } else {
            setHasMoreRestaurants(false);
          }
        } else {
          setHasMoreRestaurants(false);
        }
      } else {
        setHasMoreRestaurants(false);
      }
    } catch (error) {
      setHasMoreRestaurants(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreRestaurants, isLoadingRestaurants, currentPage, defaultAddressCoords, vegMode]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleLogout = async () => {
    showConfirmation({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      confirmButtonColor: '#FF0000',
      onConfirm: async () => {
        try {
          await authService.logout();
          if (onLogout) {
            onLogout();
          }
        } catch (error) {
          showConfirmation({
            title: 'Error',
            message: 'Failed to logout. Please try again.',
            confirmText: 'OK',
            cancelText: 'Cancel',
            onConfirm: () => {},
          });
        }
      },
    });
  };

  const onViewRef = React.useRef((viewableItems: any) => {
    if (viewableItems.viewableItems.length > 0) {
      setCurrentSlide(viewableItems.viewableItems[0].index || 0);
    }
  });

  const viewConfigRef = React.useRef({ viewAreaCoveragePercentThreshold: 50 });

  // Auto-slide carousel every 3 seconds
  React.useEffect(() => {
    if (carouselData.length <= 1) {
      // Clear timer if only one banner
      if (autoSlideTimerRef.current) {
        clearInterval(autoSlideTimerRef.current);
        autoSlideTimerRef.current = null;
      }
      return;
    }

    // Clear existing timer
    if (autoSlideTimerRef.current) {
      clearInterval(autoSlideTimerRef.current);
    }

    // Set up auto-slide
    autoSlideTimerRef.current = setInterval(() => {
      if (flatListRef.current) {
        const nextIndex = (currentSlide + 1) % carouselData.length;
        flatListRef.current.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        setCurrentSlide(nextIndex);
      }
    }, 3000);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoSlideTimerRef.current) {
        clearInterval(autoSlideTimerRef.current);
        autoSlideTimerRef.current = null;
      }
    };
  }, [carouselData.length, currentSlide]);

  // Handle manual navigation
  const handleCarouselNavigation = React.useCallback((direction: 'prev' | 'next') => {
    if (!flatListRef.current || carouselData.length <= 1) return;

    let newIndex: number;
    if (direction === 'next') {
      newIndex = (currentSlide + 1) % carouselData.length;
    } else {
      newIndex = (currentSlide - 1 + carouselData.length) % carouselData.length;
    }

    flatListRef.current.scrollToIndex({
      index: newIndex,
      animated: true,
    });
    setCurrentSlide(newIndex);

    // Reset auto-slide timer after manual navigation
    if (autoSlideTimerRef.current) {
      clearInterval(autoSlideTimerRef.current);
    }
    autoSlideTimerRef.current = setInterval(() => {
      if (flatListRef.current) {
        const nextIndex = (newIndex + 1) % carouselData.length;
        flatListRef.current.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        setCurrentSlide(nextIndex);
      }
    }, 3000);
  }, [currentSlide, carouselData.length]);

  // Handle banner CTA click based on promotion type
  const handleBannerCTAClick = React.useCallback((item: CarouselItem) => {
    if (!item.promotionType || !item.promotionLink) {
      // No promotion data, do nothing
      return;
    }

    switch (item.promotionType) {
      case 'restaurant_id':
        // Navigate to restaurant page with the restaurant ID
        if (onNavigateToRestaurant) {
          const restaurantId = parseInt(item.promotionLink, 10);
          if (!isNaN(restaurantId)) {
            onNavigateToRestaurant(restaurantId, ''); // Restaurant name will be fetched by the restaurant page
          }
        }
        break;

      case 'category_id':
        // Navigate to category results page with the category ID
        if (onNavigateToCategory) {
          onNavigateToCategory(item.promotionLink);
        }
        break;

      case 'url':
        // Open external URL in system browser
        Linking.openURL(item.promotionLink).catch((err) => {
          console.error('Failed to open URL:', err);
          showConfirmation({
            title: 'Error',
            message: 'Failed to open the link. Please try again.',
            confirmText: 'OK',
            cancelText: 'Cancel',
            onConfirm: () => {},
          });
        });
        break;

      default:
        // Unknown promotion type, do nothing
        break;
    }
  }, [onNavigateToRestaurant, onNavigateToCategory, showConfirmation]);

  const renderCarouselItem = React.useCallback(({ item }: { item: CarouselItem }) => {
    return (
      <View style={styles.carouselSlide} testID={`carousel-slide-${item.id}`}>
        <View style={[styles.adBanner, { width: BANNER_WIDTH, backgroundColor: item.backgroundColor || '#00BEC8' }]} testID={`banner-${item.id}`}>
          {/* Background Image - fills entire rectangle */}
          {item.imageUrl && (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.adBannerImage}
              resizeMode="cover"
            />
          )}
          
          {/* Black overlay for text readability */}
          <View style={styles.adOverlay} />
          
          {/* Content with background color visible behind buttons */}
          <View style={styles.adContent} testID={`banner-content-${item.id}`}>
            <Text style={styles.adTitle} numberOfLines={1} ellipsizeMode="tail" testID={`banner-title-${item.id}`}>{item.title}</Text>
            <Text style={styles.adDescription} testID={`banner-description-${item.id}`}>{item.description}</Text>
            <TouchableOpacity
              style={[
                styles.adButton,
                { backgroundColor: item.backgroundColor || '#FFFFFF' }
              ]}
              testID={`banner-button-${item.id}`}
              onPress={() => handleBannerCTAClick(item)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.adButtonText,
                { color: item.backgroundColor ? '#FFFFFF' : '#000000' }
              ]}>
                {item.buttonText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [handleBannerCTAClick]);

  const renderCategoryItem = React.useCallback(({ item }: { item: CategoryItem }) => {
    const imageSource = typeof item.icon === 'string' ? { uri: item.icon } : item.icon;
    const isViewAll = item.id === 'view-all' || item.name === 'View All';

    return (
      <TouchableOpacity
        style={styles.categoryItem}
        testID={`category-${item.id}`}
        onPress={() => {
          if (isViewAll) {
            setShowCategoryModal(true);
          } else if (onNavigateToCategory) {
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
            onError={() => {
              // Mark as loaded anyway
              setLoadedCategoryImages(prev => new Set(prev).add(item.id.toString()));
            }}
            fadeDuration={300}
            progressiveRenderingEnabled={true}
          />
        </View>
        <Text style={styles.categoryName} testID={`category-name-${item.id}`}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  }, [onNavigateToCategory]);

  // Handle pull-to-refresh
  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);

    // Get current coordinates for refresh
    const lat = externalSelectedLocation?.latitude || defaultAddressCoords?.latitude || DEFAULT_LOCATION.latitude;
    const lng = externalSelectedLocation?.longitude || defaultAddressCoords?.longitude || DEFAULT_LOCATION.longitude;

    // Reload home data - clear cached data first
    setRestaurantData([]);
    setCarouselData([]);
    setCategoryData([]);
    await fetchHomeData(lat, lng);

    setIsRefreshing(false);
  }, [externalSelectedLocation, defaultAddressCoords, fetchHomeData]);

  // Handle scroll to detect when category section becomes sticky and load more restaurants
  const handleScroll = React.useCallback((event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const contentHeight = event.nativeEvent.contentSize.height;

    // Save scroll position for restoration after refresh
    scrollPositionRef.current = scrollY;

    // Category section becomes sticky after header (212px) + carousel (~165px) + section title (~40px)
    // Total: approximately 400px
    const threshold = 400;
    setIsCategorySectionSticky(scrollY > threshold);

    // Check if user has scrolled near the bottom (within 500px)
    const distanceFromBottom = contentHeight - (scrollY + layoutHeight);
    if (distanceFromBottom < 500) {
      if (hasMoreRestaurants && !isLoadingMore && !isLoadingRestaurants) {
        loadMoreRestaurants();
      }
    }
  }, [hasMoreRestaurants, isLoadingMore, isLoadingRestaurants, loadMoreRestaurants]);

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          stickyHeaderIndices={[3]}
          testID="home-screen"
          bounces={false}
          alwaysBounceVertical={true}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          removeClippedSubviews={true}
          decelerationRate="normal"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#00B14F']}
              tintColor="#00B14F"
              progressBackgroundColor="#FFFFFF"
            />
          }
        >

      {/* Header with Background Image */}
      <ImageBackground
        source={require('@/assets/home_app_bar.png')}
        style={[styles.headerBackground, { paddingTop: insets.top + 20 }]}
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
                  <View style={styles.arrowIconWrapper}>
                    <MaterialIcons name="keyboard-arrow-down" size={16} color="#FFFFFF" />
                  </View>
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
                  <View style={styles.arrowIconWrapper}>
                    <MaterialIcons name="keyboard-arrow-down" size={16} color="#FFFFFF" />
                  </View>
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
              activeOpacity={0.7}
              disabled={!isLocationServiceable}
              testID="profile-button"
            >
              <View style={[
                styles.profileAvatar,
                !isLocationServiceable && styles.profileAvatarDisabled
              ]}>
                <MaterialIcons 
                  name="person" 
                  size={22} 
                  color={isLocationServiceable ? "#00B14F" : "rgba(0, 177, 79, 0.4)"} 
                />
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
                disabled={!isLocationServiceable}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.2)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.searchBar,
                    !isLocationServiceable && styles.searchBarDisabled
                  ]}
                >
                  <MaterialIcons 
                    name="search" 
                    size={24} 
                    color={isLocationServiceable ? "#FFFFFF" : "rgba(255, 255, 255, 0.4)"} 
                  />
                  <Text 
                    style={[
                      styles.searchInput,
                      !isLocationServiceable && styles.searchInputDisabled
                    ]} 
                    numberOfLines={1}
                  >
                    Search Restaurants & foods..
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* VEG Mode Toggle */}
              <TouchableOpacity
                style={[
                  styles.vegModeContainer,
                  !isLocationServiceable && styles.vegModeContainerDisabled
                ]}
                onPress={handleVegModeToggle}
                disabled={!isLocationServiceable}
                testID="veg-mode-toggle"
              >
                <Text 
                  style={[
                    styles.vegModeLabel,
                    !isLocationServiceable && styles.vegModeLabelDisabled
                  ]}
                >
                  VEG{'\n'}MODE
                </Text>
                <View style={[
                  styles.vegToggle,
                  isVegModeEnabled && styles.vegToggleActive,
                  !isLocationServiceable && styles.vegToggleDisabled
                ]}>
                  <View style={[
                    styles.vegToggleThumb,
                    isVegModeEnabled && styles.vegToggleThumbActive,
                    !isLocationServiceable && styles.vegToggleThumbDisabled
                  ]} />
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ImageBackground>

      {/* Unserviceable Location Error Screen */}
      {!isLocationServiceable && !isLoadingBanners && !isLoadingCategories && !isLoadingRestaurants && (
        <View style={styles.unserviceableContainer}>
          <View style={styles.unserviceableIconContainer}>
            <MaterialIcons name="location-off" size={80} color="#CCCCCC" />
          </View>
          <Text style={styles.unserviceableTitle}>Sorry!</Text>
          <Text style={styles.unserviceableMessage}>
            We are not yet serviceable at your location
          </Text>
          <Text style={styles.unserviceableSubtext}>
            Currently, we only serve in Madurai city. Stay tuned for expansion to your area!
          </Text>
        </View>
      )}

      {/* Ad Banner Carousel */}
      {isLocationServiceable && (
      <>
      <View style={styles.carouselContainer}>
        {showBannerShimmer ? (
          <View style={styles.loadingContainer}>
            
            <Shimmer width="100%" height={149} borderRadius={20} backgroundColor="#00BEC8" />
          </View>
        ) : (
          <>
            <View style={styles.carouselWrapper}>
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
                snapToAlignment="start"
                snapToInterval={SCREEN_WIDTH}
                disableIntervalMomentum={true}
                removeClippedSubviews={false}
                bounces={false}
                overScrollMode="never"
                scrollEventThrottle={16}
                getItemLayout={(_data, index) => ({
                  length: SCREEN_WIDTH,
                  offset: SCREEN_WIDTH * index,
                  index,
                })}
                onScrollToIndexFailed={(info) => {
                  // Handle scroll to index failure
                  const wait = new Promise(resolve => setTimeout(resolve, 500));
                  wait.then(() => {
                    flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
                  });
                }}
              />

              {/* Navigation Buttons - removed but functionality preserved (manual sliding and auto-slide still work) */}
            </View>
          </>
        )}
      </View>

      {/* What's On Your Mind Section - Only show if there's data or still loading */}
      {(showCategoryShimmer || categoryData.length > 0) && (
        <>
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
                      <Shimmer width={50} height={50} borderRadius={25} backgroundColor="#E8E8E8" />
                    </View>
                    {/* Text Shimmer */}
                    <Shimmer width={50} height={10} borderRadius={5} backgroundColor="#E8E8E8" />
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
        </>
      )}

      {/* Restaurants Near You Section - Only show if there's data, still loading, or error states */}
      {(showRestaurantShimmer || restaurantData.length > 0 || noRestaurantsFound || hasNetworkError) && (
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
      )}

      {/* Filter Buttons - Hidden */}
      {/* <View style={styles.filterContainer}>
        {showRestaurantShimmer ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
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
      </View> */}

      {/* Restaurant List - Only show if there's data, still loading, or error states */}
      {(showRestaurantShimmer || restaurantData.length > 0 || noRestaurantsFound || hasNetworkError) && (
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
          ) : noRestaurantsFound ? (
            <View style={styles.noRestaurantsContainer}>
              <MaterialIcons name="store" size={64} color="rgba(0, 0, 0, 0.2)" />
              <Text style={styles.noRestaurantsTitle}>No Restaurants Nearby</Text>
              <Text style={styles.noRestaurantsMessage}>
                We couldn't find any restaurants within 10km of your location. Try changing your delivery address or check back later.
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRefresh}
                activeOpacity={0.7}
              >
                <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : hasNetworkError ? (
            <View style={styles.networkErrorContainer}>
              <MaterialIcons name="cloud-off" size={64} color="rgba(0, 0, 0, 0.2)" />
              <Text style={styles.networkErrorTitle}>Network Error</Text>
              <Text style={styles.networkErrorMessage}>
                Unable to load restaurants. Please check your connection and try again.
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRefresh}
                activeOpacity={0.7}
              >
                <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={restaurantData}
              renderItem={({ item: restaurant }) => (
                <View style={styles.restaurantCardWrapper}>
                  <RestaurantCard
                    restaurant={restaurant}
                    onPress={() => {
                      if (onNavigateToRestaurant) {
                        const restaurantId = typeof restaurant.id === 'string' ? parseInt(restaurant.id, 10) : restaurant.id;
                        onNavigateToRestaurant(restaurantId, restaurant.name);
                      }
                    }}
                    onImageLoad={() => {
                      setLoadedRestaurantImages(prev => new Set(prev).add(restaurant.id.toString()));
                    }}
                  />
                </View>
              )}
              keyExtractor={(restaurant) => restaurant.id.toString()}
              scrollEnabled={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={5}
              windowSize={5}
              initialNumToRender={3}
              updateCellsBatchingPeriod={50}
            />
          )}

          {/* Loading More Indicator */}
          {isLoadingMore && (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="large" color="#00B14F" />
              <Text style={styles.loadingMoreText}>Loading more restaurants...</Text>
            </View>
          )}
        </View>
      )}
      </>
      )}

      {/* Location Permission Modal */}
      {/* COMMENTED OUT: Custom location permission modal disabled */}
      {/* <Modal
        visible={showLocationPopup}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowLocationPopup(false)}
      >
        <BlurView intensity={80} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.illustrationContainer}>
              <Image
                source={require('@/assets/location-illustration.png')}
                style={styles.locationIllustration}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.modalTitle}>Location Access</Text>

            <Text style={styles.modalDescription}>
              Give the access to fetch accurate location that will ease to delivery
            </Text>

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
      </Modal> */}

      {/* VEG Mode Selection Modal */}
      <Modal
        visible={showVegModePopup}
        transparent={true}
        animationType="none"
        statusBarTranslucent={true}
        onRequestClose={handleCloseVegModal}
      >
        <View style={styles.vegModalOverlay}>
          <Animated.View
            style={[
              styles.vegModalContent,
              {
                transform: [{ translateY: vegModalSlideAnim }],
                opacity: vegModalOpacityAnim
              }
            ]}
          >
            {/* Close Button */}
            <TouchableOpacity
              style={styles.vegModalCloseButton}
              onPress={handleCloseVegModal}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="close" size={24} color="#666666" />
            </TouchableOpacity>

            {/* Title with Icon */}
            <View style={styles.vegModalHeader}>
              <View style={styles.vegModalTitleContainer}>
                <Text style={styles.vegModalTitle}>I want to see veg{'\n'}choices from</Text>
              </View>
              <Text style={styles.vegModalIcon}>🥗</Text>
            </View>

            {/* Divider */}
            <View style={styles.vegModalDivider} />

            {/* All restaurants Option */}
            <TouchableOpacity
              style={styles.vegOption}
              onPress={() => setTempVegSelection('all')}
              testID="veg-option-all"
              activeOpacity={0.7}
            >
              <Text style={styles.vegOptionText}>All restaurants</Text>
              <View style={styles.radioButton}>
                {tempVegSelection === 'all' && <View style={styles.radioButtonSelected} />}
              </View>
            </TouchableOpacity>

            {/* Pure Veg Option */}
            <TouchableOpacity
              style={styles.vegOption}
              onPress={() => setTempVegSelection('pure')}
              testID="veg-option-pure"
              activeOpacity={0.7}
            >
              <Text style={styles.vegOptionText}>Pure veg restaurants only</Text>
              <View style={styles.radioButton}>
                {tempVegSelection === 'pure' && <View style={styles.radioButtonSelected} />}
              </View>
            </TouchableOpacity>

            {/* Show Restaurants Button */}
            <TouchableOpacity
              style={styles.vegApplyButton}
              onPress={handleApplyVegMode}
              testID="veg-apply-button"
              activeOpacity={0.8}
            >
              <Text style={styles.vegApplyButtonText}>Show restaurants</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <AppFooter />
      </ScrollView>
      </SafeAreaView>

      {/* View Cart Bar - shows when cart has items and location is serviceable */}
      {isLocationServiceable && (
        <ViewCartBar
          onPress={async () => {
            // Navigate directly to checkout page, but only if restaurant is open
            if (!restaurantId || !onNavigateToCheckout) {
              return;
            }

            const isOpen = await ensureCartRestaurantOpen();
            if (!isOpen) {
              return;
            }

            onNavigateToCheckout(restaurantId, restaurantName, 'home');
          }}
          onViewMenu={() => {
            // Navigate to restaurant menu
            if (restaurantId && onNavigateToRestaurant) {
              onNavigateToRestaurant(restaurantId, restaurantName);
            }
          }}
          restaurantLogo={restaurantLogo}
          deliveryLocation={selectedLocation.name}
        />
      )}

      {/* Category Modal */}
      <CategoryModal
        visible={showCategoryModal}
        categories={categoryData.map(cat => ({
          id: cat.id,
          name: cat.name,
          description: cat.description || '',
          icon: cat.icon || require('@/assets/Group 1272628220.png'),
        }))}
        onClose={() => setShowCategoryModal(false)}
        onCategorySelect={(categoryName) => {
          if (onNavigateToCategory) {
            onNavigateToCategory(categoryName);
          }
        }}
        vegMode={vegMode}
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 18,
    minHeight: 240,
  },
  headerBackgroundImage: {
    width: '120%',
    height: '150%',
    resizeMode: 'cover',
    left: 0,
    top: 0,
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
  arrowIconWrapper: {
    ...Platform.select({
      ios: {
        paddingTop: 2,
      },
    }),
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
  profileAvatarDisabled: {
    opacity: 0.4,
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
  searchBarDisabled: {
    opacity: 0.4,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  searchInputDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  vegModeContainer: {
    width: 46,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  vegModeContainerDisabled: {
    opacity: 0.4,
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
  vegModeLabelDisabled: {
    opacity: 0.3,
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
  vegToggleDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  vegToggleThumb: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#FFFFFF',
  },
  vegToggleThumbDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
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
    marginTop: -35,
    marginBottom: 16,
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
    height: 149,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  carouselWrapper: {
    position: 'relative',
    width: '100%',
  },
  // Ad Banner
  adBanner: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 0,
    height: 149,
    backgroundColor: '#00BEC8',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    width: BANNER_WIDTH,
    minHeight: 149,
  },
  adBannerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BANNER_WIDTH,
    height: 149,
    borderRadius: 20,
  },
  adOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)', // 25% opacity black overlay (reduced from 40%)
    zIndex: 1,
  },
  adContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 11,
    position: 'relative',
    zIndex: 2,
    flex: 1,
    width: '100%',
    padding: 14,
  },
  adTitle: {
    maxWidth: '90%',
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  adDescription: {
    maxWidth: '80%',
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    flexWrap: 'wrap',
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
    opacity: 0.95, // Slight transparency to show background color through
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
  // Carousel Navigation Buttons
  carouselNavigation: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -40, // Half of total button height (40px * 2 + 8px gap) / 2
    flexDirection: 'column',
    gap: 8,
    zIndex: 10,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  // Section Title
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
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
    marginRight: 4,
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
  },
  viewAllImage: {
    width: 45,
    height: 45,
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
    paddingTop: 24,
    paddingBottom: 8,
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
    ...Platform.select({
      ios: {
        paddingTop: 4,
      },
    }),
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
    ...Platform.select({
      ios: {
        paddingTop: 4,
      },
    }),
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
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingMoreText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#00B14F',
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
    paddingHorizontal: 20,
  },
  vegModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    width: '100%',
    maxWidth: 400,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  vegModalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  vegModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingRight: 30,
  },
  vegModalTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  vegModalTitle: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 28,
    color: '#000000',
  },
  vegModalIcon: {
    fontSize: 36,
    marginTop: -4,
  },
  vegModalDivider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    width: '100%',
    marginBottom: 12,
  },
  vegOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  vegOptionText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: '#3D3D3D',
    flex: 1,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioButtonSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00B14F',
  },
  vegApplyButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    backgroundColor: '#00B14F',
    borderRadius: 12,
    marginTop: 4,
  },
  vegApplyButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  // Unserviceable Location Error
  unserviceableContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    backgroundColor: '#FFFFFF',
  },
  unserviceableIconContainer: {
    marginBottom: 24,
  },
  unserviceableTitle: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 32,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  unserviceableMessage: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 12,
  },
  unserviceableSubtext: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: '#9E9E9E',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // No Restaurants Found
  noRestaurantsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    minHeight: 300,
  },
  noRestaurantsTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 27,
    color: 'rgba(0, 0, 0, 0.8)',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  noRestaurantsMessage: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(0, 0, 0, 0.5)',
    textAlign: 'center',
    marginBottom: 24,
  },
  // Network Error
  networkErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    minHeight: 300,
  },
  networkErrorTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 27,
    color: 'rgba(0, 0, 0, 0.8)',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  networkErrorMessage: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(0, 0, 0, 0.5)',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00B14F',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  retryButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
