import React from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Modal, Image, ScrollView, FlatList, Keyboard, Platform, ActivityIndicator, Animated, RefreshControl, Linking, useWindowDimensions, ImageSourcePropType } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@/shims/rn-vector-icons';
import { colors, spacing, typography } from '@/theme';
import { authService } from '@/services/auth.service';
import { homeService, BannerItem, CategoryItem, Restaurant, OrganizationBanner, HomeRestaurantsFilterParams } from '@/services/home.service';
import { paymentConfigService } from '@/services/payment-config.service';
import { appConfigService } from '@/services/app-config.service';
import { addressService } from '@/services/address.service';
import { RestaurantCard } from '@/components/RestaurantCard';
import { Shimmer } from '@/components/Shimmer';
import { OptimizedImage } from '@/components/OptimizedImage';
import { AppFooter } from '@/components/AppFooter';
import * as Location from '@/shims/rn-location';
import { LinearGradient } from '@/shims/rn-linear-gradient';
import { ViewCartBar } from '@/components/ViewCartBar';
import { CategoryModal } from '@/components/CategoryModal';
import { FoodAddCard } from '@/components/FoodAddCard';
import { useCart } from '@/context/CartContext';
import { useVegMode } from '@/context/VegModeContext';
import { useConfirmation } from '@/context/ConfirmationContext';
import { restaurantService } from '@/services/restaurant.service';
import { favoritesService } from '@/services/favorites.service';
import { analyticsService, AnalyticsEvents, AnalyticsUserProperties } from '@/services/analytics.service';

/** Fixed header / hero block height (independent of screen size and background image) */
const HEADER_BACKGROUND_HEIGHT = 660;
/** Promotional carousel banner card height */
const STORE_BANNER_HEIGHT = 220;
const HOME_TOP_BG_FALLBACK = '#8B1D2C';
const AFTER_SEARCH_SPACER = 12;
const HOME_HEADER_IMAGE_HEIGHT = 320;

interface HomeScreenProps {
  onLogout?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToAddressSelection?: () => void;
  onNavigateToCategory?: (categoryName: string) => void;
  onNavigateToPopularDishes?: (collectionId?: number) => void;
  onNavigateToRestaurant?: (
    restaurantId: number,
    restaurantName: string,
    meta?: { distanceKm?: number; isOpen?: boolean; itemCount?: number }
  ) => void;
  onNavigateToCheckout?: (restaurantId: number, restaurantName: string, restaurantAddress?: string, from?: 'home' | 'restaurant') => void;
  onNavigateToSearch?: () => void;
  onNavigateToLocationSelection?: () => void;
  selectedLocation?: { name: string; address: string; latitude?: number; longitude?: number };
  onCategoriesLoaded?: (categories: CategoryItem[]) => void;
  isFocused?: boolean;
  addressRefreshTrigger?: number; // Trigger to refresh addresses when changed
  onForcedUpdateRequired?: (message?: string) => void; // Callback when API indicates forced update is required
  isGuest?: boolean;
  onNavigateToLogin?: () => void;
}

interface CarouselItem {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  buttonColor?: string;
  imageUrl?: string;
  sequence?: number;
  promotionType?: 'restaurant_id' | 'category_id' | 'collection_id' | 'organization' | 'organisation' | 'url';
  promotionLink?: string;
  backgroundColor?: string;
}

interface AppOperationStatus {
  is_open: boolean;
  reason?: string;
  message?: string;
  next_open_time?: string;
}

interface HomeFilterOption {
  label: string;
  value: string;
}

interface HomeFilterDefinition {
  key: 'sort_by' | 'veg_mode' | 'cuisines' | 'availability' | string;
  label: string;
  selection_type: 'single' | 'multiple';
  options: HomeFilterOption[];
}

type HomeFilterSelections = Record<string, string | string[]>;

const DEFAULT_HOME_FILTERS: HomeFilterDefinition[] = [
  {
    key: 'sort_by',
    label: 'Sort By',
    selection_type: 'single',
    options: [
      { label: 'Distance', value: 'distance' },
      { label: 'Rating', value: 'rating' },
    ],
  },
  {
    key: 'veg_mode',
    label: 'Food Type',
    selection_type: 'single',
    options: [
      { label: 'All', value: 'all' },
      { label: 'Pure Veg', value: 'pure' },
    ],
  },
  {
    key: 'cuisines',
    label: 'Cuisine',
    selection_type: 'multiple',
    options: [
      { label: 'South Indian', value: 'south_indian' },
      { label: 'Chettinad', value: 'chettinad' },
      { label: 'Biryani', value: 'biryani' },
      { label: 'BBQ', value: 'bbq' },
      { label: 'Grill', value: 'grill' },
      { label: 'Arabian', value: 'arabian' },
      { label: 'Tandoori', value: 'tandoori' },
      { label: 'Chinese', value: 'chinese' },
      { label: 'North Indian', value: 'north_indian' },
      { label: 'Fast Food', value: 'fast_food' },
      { label: 'Burger', value: 'burger' },
      { label: 'Cafe', value: 'cafe' },
      { label: 'Bakery', value: 'bakery' },
      { label: 'Beverages', value: 'beverages' },
      { label: 'Juices', value: 'juices' },
      { label: 'Ice Cream', value: 'ice_cream' },
      { label: 'Desserts', value: 'desserts' },
      { label: 'Sweets', value: 'sweets' },
      { label: 'Parotta', value: 'parotta' },
      { label: 'Meals', value: 'meals' },
      { label: 'Fried Chicken', value: 'fried_chicken' },
      { label: 'Italian', value: 'italian' },
      { label: 'Korean', value: 'korean' },
      { label: 'Pizza', value: 'pizza' },
    ],
  },
  {
    key: 'availability',
    label: 'Availability',
    selection_type: 'single',
    options: [
      { label: 'Open', value: 'open' },
      { label: 'Closed', value: 'closed' },
    ],
  },
];

interface PopularDishItem {
  id: string;
  restaurantId?: number;
  storeId?: number;
  storeName?: string;
  locality?: string;
  storeLogoUrl?: string;
  name: string;
  restaurantName: string;
  image: ImageSourcePropType;
  showAddButton: boolean;
  priceLabel?: string;
  basePrice?: number;
  isVeg?: boolean;
  isFavorite?: boolean;
  isAvailable?: boolean;
  isOpen?: boolean;
}

const POPULAR_DISH_FALLBACK_IMAGE = require('../../assets/pre-prepared-food-showcasing-ready-eat-delicious-meals-go.jpg');

const mapHomeCollectionItemToPopularDish = (
  item: any,
  index: number,
  collectionImageUrl?: string,
  showAddButton: boolean = false
): PopularDishItem => {
  const imageUrl =
    item?.image_url ||
    item?.image ||
    item?.thumbnail ||
    item?.thumbnail_url ||
    item?.collection_image ||
    collectionImageUrl ||
    (Array.isArray(item?.images) && item.images.length > 0 ? item.images[0] : undefined);

  const basePriceRaw = item?.price?.base_price ?? item?.base_price;
  const basePrice = typeof basePriceRaw === 'number' ? basePriceRaw : Number(basePriceRaw);
  const currency = String(item?.price?.currency || 'INR').toUpperCase();
  const priceLabel = Number.isFinite(basePrice)
    ? currency === 'INR'
      ? `₹${basePrice.toFixed(2)}`
      : `${currency} ${basePrice.toFixed(2)}`
    : undefined;

  return {
    id: String(item?.id ?? `collection-${index}`),
    restaurantId: Number.isFinite(Number(item?.id)) ? Number(item?.id) : undefined,
    storeId: Number.isFinite(Number(item?.store_id ?? item?.store?.id))
      ? Number(item?.store_id ?? item?.store?.id)
      : undefined,
    storeName:
      typeof item?.store_name === 'string' && item.store_name.trim().length > 0
        ? item.store_name.trim()
        : typeof item?.store?.name === 'string' && item.store.name.trim().length > 0
          ? item.store.name.trim()
          : undefined,
    locality:
      typeof item?.store?.location?.locality === 'string' && item.store.location.locality.trim().length > 0
        ? item.store.location.locality.trim()
        : typeof item?.location?.locality === 'string' && item.location.locality.trim().length > 0
          ? item.location.locality.trim()
          : undefined,
    storeLogoUrl:
      typeof item?.store?.logo_url === 'string' && item.store.logo_url.trim().length > 0
        ? item.store.logo_url.trim()
        : undefined,
    name: String(item?.name || item?.title || `Dish ${index + 1}`),
    restaurantName: (() => {
      const locality =
        item?.store?.location?.locality ||
        item?.location?.locality ||
        item?.locality ||
        item?.store?.location?.city ||
        item?.location?.city;
      if (typeof locality === 'string' && locality.trim().length > 0) {
        return locality.trim();
      }
      return 'Location unavailable';
    })(),
    image: typeof imageUrl === 'string' && imageUrl.trim().length > 0
      ? { uri: imageUrl }
      : POPULAR_DISH_FALLBACK_IMAGE,
    showAddButton,
    priceLabel,
    basePrice: Number.isFinite(basePrice) ? basePrice : undefined,
    isVeg: isVegDietaryPreference(item?.dietary_preference),
    isFavorite: Boolean(item?.is_favorite),
    isAvailable: item?.is_available !== false,
    isOpen:
      typeof item?.is_open === 'boolean'
        ? item.is_open
        : typeof item?.store?.is_open === 'boolean'
          ? item.store.is_open
          : undefined,
  };
};

const isVegDietaryPreference = (dietaryPreference?: string): boolean => {
  if (!dietaryPreference) {
    return false;
  }

  const normalized = dietaryPreference.trim().toLowerCase();
  return normalized === 'veg' || normalized === 'vegetarian' || normalized === 'pure-veg';
};


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
  onNavigateToPopularDishes,
  onNavigateToRestaurant,
  onNavigateToCheckout,
  onNavigateToSearch,
  onNavigateToLocationSelection,
  selectedLocation: externalSelectedLocation,
  isGuest = false,
  onNavigateToLogin,
  onCategoriesLoaded,
  addressRefreshTrigger,
  isFocused = true,
  onForcedUpdateRequired,
}) => {
  const {
    restaurantId,
    restaurantName,
    restaurantLogo,
    getTotalItems,
    flushPendingQuantityUpdate,
    addToCart,
    setRestaurantInfo,
    checkRestaurantConflict,
    clearCart,
  } = useCart();
  const { vegMode, setVegMode, isVegModeEnabled } = useVegMode();
  const { showConfirmation } = useConfirmation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const bannerWidth = Math.max(0, windowWidth - 40);
  const [searchSectionBottomY, setSearchSectionBottomY] = React.useState<number>(0);

  const [organizationBanners, setOrganizationBanners] = React.useState<OrganizationBanner[]>([]);
  const [activeBannerIndex, setActiveBannerIndex] = React.useState(0);

  // Auto-slide for organization banner
  React.useEffect(() => {
    if (!organizationBanners || organizationBanners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIndex(prev => (prev + 1) % organizationBanners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [organizationBanners]);
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
  const [homeFilterDefinitions, setHomeFilterDefinitions] = React.useState<HomeFilterDefinition[]>([]);
  const [selectedHomeFilters, setSelectedHomeFilters] = React.useState<HomeFilterSelections>({});
  const [draftHomeFilters, setDraftHomeFilters] = React.useState<HomeFilterSelections>({});
  const [showHomeFilterModal, setShowHomeFilterModal] = React.useState(false);
  const [activeHomeFilterKey, setActiveHomeFilterKey] = React.useState<string>('sort_by');
  const [quickFilterKey, setQuickFilterKey] = React.useState<string | null>(null);
  const [popularDishesData, setPopularDishesData] = React.useState<PopularDishItem[]>([]);
  const [popularDishesTitle, setPopularDishesTitle] = React.useState('Popular Dishes');
  const [popularCollectionType, setPopularCollectionType] = React.useState<'store' | 'item' | 'unknown'>('unknown');
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

  const scrollYAnimated = React.useRef(new Animated.Value(0)).current;

  const [isCategorySectionSticky, setIsCategorySectionSticky] = React.useState(false);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);
  const flatListRef = React.useRef<FlatList>(null);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const maxScrollCountTrackedRef = React.useRef(0);
  const scrollPositionRef = React.useRef(0);
  const autoSlideTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [defaultAddressCoords, setDefaultAddressCoords] = React.useState<{ latitude: number; longitude: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_hasDefaultAddress, setHasDefaultAddress] = React.useState(false);
  const isInitialVegModeLoad = React.useRef(true);
  const hasRedirectedToLocationMap = React.useRef(false); // Prevent multiple redirects
  const hasHandledReturnFromLocationSelection = React.useRef(false); // Track if we've handled return from location selection
  const isFetchingAddressRef = React.useRef(false); // Prevent concurrent address fetches
  const lastFetchedCoords = React.useRef<{ latitude: number; longitude: number } | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = React.useState(1);
  const [hasMoreRestaurants, setHasMoreRestaurants] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  // App operation status from API
  const [appOperationStatus, setAppOperationStatus] = React.useState<AppOperationStatus | null>(null);

  /** Remote URL for home header background from API; null = use bundled default */
  const [homeBackgroundImageUrl, setHomeBackgroundImageUrl] = React.useState<string | null>(null);
  const [headerBackgroundLoadFailed, setHeaderBackgroundLoadFailed] = React.useState(false);

  const isHomeFilterApplied = (filterKey: string) => {
    const value = selectedHomeFilters[filterKey];
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return String(value || '').trim().length > 0;
  };

  const getHomeFilterSelectedCount = (filter: HomeFilterDefinition) => {
    const value = selectedHomeFilters[filter.key];
    if (Array.isArray(value)) {
      return value.length;
    }
    return String(value || '').trim().length > 0 ? 1 : 0;
  };

  const resolveVegModeForApi = (filters: HomeFilterSelections): 'off' | 'pure' | 'all' => {
    const selectedVegMode = String(filters.veg_mode || '').toLowerCase();
    if (selectedVegMode === 'pure' || selectedVegMode === 'all') {
      return selectedVegMode;
    }
    return vegMode;
  };

  const buildRestaurantFilterParams = (filters: HomeFilterSelections): HomeRestaurantsFilterParams | undefined => {
    const sortByRaw = String(filters.sort_by || '').toLowerCase();
    const sortBy = sortByRaw === 'distance' || sortByRaw === 'rating' ? sortByRaw : undefined;
    const cuisines = Array.isArray(filters.cuisines) ? filters.cuisines.filter((value) => String(value).trim().length > 0) : [];
    const availabilityRaw = String(filters.availability || '').toLowerCase();
    const availability = availabilityRaw === 'open' || availabilityRaw === 'closed' ? availabilityRaw : undefined;

    if (!sortBy && cuisines.length === 0 && !availability) {
      return undefined;
    }

    return {
      ...(sortBy ? { sort_by: sortBy } : {}),
      ...(cuisines.length > 0 || availability
        ? {
            filters: {
              ...(cuisines.length > 0 ? { cuisines } : {}),
              ...(availability ? { availability } : {}),
            },
          }
        : {}),
    };
  };

  const filteredRestaurantData = React.useMemo(() => {
    const toNumber = (rawDistance: string): number => {
      const parsed = Number(String(rawDistance || '').replace(/[^0-9.]/g, ''));
      return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
    };

    const normalizedSelections = selectedHomeFilters;
    let filtered = [...restaurantData];

    const availabilityFilter = String(normalizedSelections.availability || '').toLowerCase();
    if (availabilityFilter === 'open') {
      filtered = filtered.filter((restaurant) => restaurant.isOpen !== false);
    } else if (availabilityFilter === 'closed') {
      filtered = filtered.filter((restaurant) => restaurant.isOpen === false);
    }

    const foodTypeFilter = String(normalizedSelections.veg_mode || '').toLowerCase();
    if (foodTypeFilter === 'pure') {
      filtered = filtered.filter((restaurant) => Boolean(restaurant.isVeg));
    }

    const selectedCuisineValues = Array.isArray(normalizedSelections.cuisines)
      ? normalizedSelections.cuisines
      : [];
    if (selectedCuisineValues.length > 0) {
      filtered = filtered.filter((restaurant) => {
        const cuisineText = String(restaurant.cuisine || '').toLowerCase();
        return selectedCuisineValues.some((value) => {
          const normalizedValue = value.replace(/_/g, ' ').toLowerCase();
          return cuisineText.includes(normalizedValue);
        });
      });
    }

    const sortBy = String(normalizedSelections.sort_by || '').toLowerCase();
    if (sortBy === 'distance') {
      filtered.sort((a, b) => toNumber(a.distance) - toNumber(b.distance));
    } else if (sortBy === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return filtered;
  }, [restaurantData, selectedHomeFilters]);

  // Derived state for the header display
  const activeOrganizationBanner = organizationBanners.length > 0 ? organizationBanners[activeBannerIndex] : null;
  const activeHomeFilter = homeFilterDefinitions.find((filter) => filter.key === activeHomeFilterKey) || homeFilterDefinitions[0];
  const homeFilterModalTitle = quickFilterKey
    ? (activeHomeFilter?.key === 'cuisines' ? 'Cuisines' : activeHomeFilter?.label || 'Filter')
    : 'Filter';
  const homeTopBackgroundColor = activeOrganizationBanner?.background_color || '#00B14F';
  const displayBackgroundImageUrl = activeOrganizationBanner?.image_url || '';
  const promoTitle = activeOrganizationBanner?.title || (isLoadingBanners ? '' : '');
  const promoSubtitle = activeOrganizationBanner?.subtitle || (isLoadingBanners ? '' : '');
  const promoType = String(activeOrganizationBanner?.promotion_type || '').trim().toLowerCase();
  const promoCtaButton =
    promoType === 'organization' || promoType === 'organisation'
      ? ''
      : activeOrganizationBanner?.cta_button ||
        activeOrganizationBanner?.button_text ||
        '';
  const hasPromoCtaNavigation =
    typeof activeOrganizationBanner?.promotion_type === 'string' &&
    activeOrganizationBanner.promotion_type.trim().length > 0 &&
    String(activeOrganizationBanner?.promotion_link || '').trim().length > 0;
  const hasExistingBannerVisual = Boolean(activeOrganizationBanner?.image_url || activeOrganizationBanner?.background_color);

  const shouldShowBadgesRow =
    appOperationStatus?.is_open !== false && (showCategoryShimmer || categoryData.length > 0);

  React.useEffect(() => {
    if (homeFilterDefinitions.length === 0) {
      return;
    }
    const hasCurrent = homeFilterDefinitions.some((filter) => filter.key === activeHomeFilterKey);
    if (!hasCurrent) {
      setActiveHomeFilterKey(homeFilterDefinitions[0].key);
    }
  }, [activeHomeFilterKey, homeFilterDefinitions]);

  React.useEffect(() => {
    setHeaderBackgroundLoadFailed(false);
  }, [homeBackgroundImageUrl]);

  // Refresh trigger - increments to force data reload
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_refreshTrigger, _setRefreshTrigger] = React.useState(0);

  // Location serviceability state
  const [isLocationServiceable, setIsLocationServiceable] = React.useState(true);
  const hasCartItems = totalCartItems > 0;

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

      // Use top-level is_open flag only for store open/close.
      // Do NOT derive open state from timings.
      const isOpen =
        typeof response.data.is_open === 'boolean' ? response.data.is_open : true;

      if (!isOpen) {
        showConfirmation({
          title: 'Restaurant is currently closed',
          message: 'This restaurant is closed right now. You can place the order when it reopens.',
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#00B14F',
          onConfirm: () => { },
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

  // Log API endpoint URL on mount
  React.useEffect(() => {
    // API endpoint configuration check
  }, []);

  // Update local state when external selectedLocation changes
  // IMPORTANT:
  // - This effect ONLY updates the displayed location text
  // - Actual home data fetching is handled by:
  //   1) addressRefreshTrigger → fetchDefaultAddress() → fetchHomeData(...)
  //   2) isFocused change (coming back to home) → fetchHomeData(...)
  // This avoids double-calling home API and prevents potential refresh loops
  React.useEffect(() => {
    if (externalSelectedLocation) {
      setSelectedLocation(externalSelectedLocation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSelectedLocation]);

  // Extract address fetching logic into a reusable function
  const fetchDefaultAddress = React.useCallback(
    async (options?: { overrideSelectedLocation?: boolean }) => {
      // Prevent concurrent calls - return immediately if already fetching
      if (isFetchingAddressRef.current) {
        return;
      }

      try {
        // Set flag immediately to prevent any other calls
        isFetchingAddressRef.current = true;

        // Guests: skip getAddresses (API requires registered user). Use externalSelectedLocation or default.
        if (isGuest) {
          setHasDefaultAddress(false);
          if (externalSelectedLocation?.name && externalSelectedLocation?.address) {
            setSelectedLocation(externalSelectedLocation);
            const lat = externalSelectedLocation.latitude ?? DEFAULT_LOCATION.latitude;
            const lng = externalSelectedLocation.longitude ?? DEFAULT_LOCATION.longitude;
            setRestaurantData([]);
            setCarouselData([]);
            setCategoryData([]);
            await fetchHomeData(lat, lng);
          } else {
            setSelectedLocation({
              name: DEFAULT_LOCATION.name,
              address: DEFAULT_LOCATION.address,
            });
            setRestaurantData([]);
            setCarouselData([]);
            setCategoryData([]);
            await fetchHomeData(undefined, undefined);
          }
          return;
        }

        // Clear cache to ensure we get fresh data
        addressService.clearCache();
        const response = await addressService.getAddresses();

        if (response.success && response.data) {
          // Reset redirect flag if user has addresses now (allows redirect again if they delete all addresses later)
          if (response.data.length > 0) {
            hasRedirectedToLocationMap.current = false;
            // Also reset the handled flag since addresses now exist
            hasHandledReturnFromLocationSelection.current = false;
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

            // Set analytics user properties for location context (non-PII)
            analyticsService.setUserProperties({
              [AnalyticsUserProperties.CITY]: defaultAddress.city ? String(defaultAddress.city) : null,
              [AnalyticsUserProperties.AREA_NAME]: defaultAddress.address3 ? String(defaultAddress.address3) : null,
              [AnalyticsUserProperties.PINCODE]: defaultAddress.pincode ? String(defaultAddress.pincode) : null,
            });

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
          // API failed - preserve guest/external selection if we have one
          setHasDefaultAddress(false);
          if (externalSelectedLocation?.name && externalSelectedLocation?.address) {
            setSelectedLocation(externalSelectedLocation);
            const lat = externalSelectedLocation.latitude ?? DEFAULT_LOCATION.latitude;
            const lng = externalSelectedLocation.longitude ?? DEFAULT_LOCATION.longitude;
            setRestaurantData([]);
            setCarouselData([]);
            setCategoryData([]);
            await fetchHomeData(lat, lng);
          } else {
            setSelectedLocation({
              name: DEFAULT_LOCATION.name,
              address: DEFAULT_LOCATION.address,
            });
            setRestaurantData([]);
            setCarouselData([]);
            setCategoryData([]);
            await fetchHomeData(undefined, undefined);
          }
        }
      } catch (error) {
        // Error fetching addresses (e.g. guest mode) - preserve external selection if we have one
        setHasDefaultAddress(false);
        if (externalSelectedLocation?.name && externalSelectedLocation?.address) {
          setSelectedLocation(externalSelectedLocation);
          const lat = externalSelectedLocation.latitude ?? DEFAULT_LOCATION.latitude;
          const lng = externalSelectedLocation.longitude ?? DEFAULT_LOCATION.longitude;
          setRestaurantData([]);
          setCarouselData([]);
          setCategoryData([]);
          await fetchHomeData(lat, lng);
        } else {
          setSelectedLocation({
            name: DEFAULT_LOCATION.name,
            address: DEFAULT_LOCATION.address,
          });
          setRestaurantData([]);
          setCarouselData([]);
          setCategoryData([]);
          await fetchHomeData(undefined, undefined);
        }
      } finally {
        setIsLoadingLocation(false);
        isFetchingAddressRef.current = false;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [externalSelectedLocation, isFocused, isGuest, onNavigateToLocationSelection]);

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
        analyticsService.logEvent(AnalyticsEvents.LOCATION_PERMISSION_GRANTED, { method: 'foreground' });
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
        analyticsService.logEvent(AnalyticsEvents.LOCATION_PERMISSION_DENIED, { method: 'foreground' });
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
        onConfirm: () => { },
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
      onConfirm: () => { },
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
  const fetchHomeData = React.useCallback(async (
    latitude?: number,
    longitude?: number,
    filtersOverride?: HomeFilterSelections,
    options?: { sectionScope?: 'full' | 'restaurants_and_collections' }
  ) => {
    const sectionScope = options?.sectionScope ?? 'full';
    const isPartialFilterRefresh = sectionScope === 'restaurants_and_collections';
    try {
      setHasNetworkError(false);
      setNoRestaurantsFound(false);
      // Reset shimmers for sections that are part of this refresh scope.
      if (!isPartialFilterRefresh) {
        setShowBannerShimmer(true);
        setShowCategoryShimmer(true);
      }
      setShowRestaurantShimmer(true);
      if (!isPartialFilterRefresh) {
        setIsLoadingBanners(true);
        setIsLoadingCategories(true);
      }
      setIsLoadingRestaurants(true);

      // Reset pagination state for fresh load
      setCurrentPage(1);
      setHasMoreRestaurants(false);

      // Reset app operation status
      setAppOperationStatus(null);

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
        if (!isPartialFilterRefresh) {
          setIsLoadingBanners(false);
          setIsLoadingCategories(false);
        }
        setIsLoadingRestaurants(false);
        return;
      }

      const effectiveFilters = filtersOverride ?? selectedHomeFilters;
      const effectiveVegMode = resolveVegModeForApi(effectiveFilters);
      const restaurantFilterParams = buildRestaurantFilterParams(effectiveFilters);
      const response = await homeService.getHomeData(lat, lng, effectiveVegMode, 1, restaurantFilterParams);
      console.log('[HomeScreen] /api/buyer/home response', {
        lat,
        lng,
        vegMode: effectiveVegMode,
        page: 1,
        restaurantFilterParams,
        response,
      });

      // Check if API indicates forced update is required
      // Response format: { success: false, statusCode: 426, message: "Please update your app..." }
      if (!response.success && response.statusCode === 426) {
        // Show forced update modal
        if (onForcedUpdateRequired) {
          onForcedUpdateRequired(response.message);
        }
        // Stop loading and don't process data
        if (!isPartialFilterRefresh) {
          setIsLoadingBanners(false);
          setIsLoadingCategories(false);
        }
        setIsLoadingRestaurants(false);
        return;
      }

      if (response.success && response.data) {
        // The API returns data nested as: { data: { data: { promotional_banner: {...} } } }
        const actualData = (response.data as any).data || response.data;
        const homeCollectionTitle = (actualData as any)?.home_collection?.collection?.title;
        const homeCollectionItems = (actualData as any)?.home_collection?.data;
        const homeCollectionImageUrl = (actualData as any)?.home_collection?.collection?.image_url;
        const homeCollectionType = String((actualData as any)?.home_collection?.collection?.type || '').toLowerCase();
        const shouldShowAddButton = homeCollectionType === 'item';
        setPopularCollectionType(
          homeCollectionType === 'store' ? 'store' : homeCollectionType === 'item' ? 'item' : 'unknown'
        );

        setPopularDishesTitle(
          typeof homeCollectionTitle === 'string' && homeCollectionTitle.trim().length > 0
            ? homeCollectionTitle.trim()
            : 'Popular Dishes'
        );

        if (Array.isArray(homeCollectionItems) && homeCollectionItems.length > 0) {
          const limitedHomeCollectionItems = homeCollectionItems.slice(0, 5);
          const mappedItems = limitedHomeCollectionItems.map((item: any, index: number) =>
            mapHomeCollectionItemToPopularDish(item, index, homeCollectionImageUrl, shouldShowAddButton)
          );
          setPopularDishesData(
            mappedItems.map((dish) =>
              (() => {
                const favoriteKey = String(dish.restaurantId ?? dish.storeId ?? dish.id);
                const override =
                  homeCollectionType === 'store'
                    ? favoritesService.getRestaurantFavoriteOverride(favoriteKey)
                    : favoritesService.getItemFavoriteOverride(dish.id);
                return typeof override === 'boolean' ? { ...dish, isFavorite: override } : dish;
              })()
            )
          );
        } else {
          setPopularDishesData([]);
        }

        const promotionalBanner = actualData.promotional_banner;
        const whatsOnYourMind = actualData.whats_on_your_mind;
        const nearbyRestaurants = actualData.nearby_restaurants;
        const pagination = actualData.pagination;
        const appOperationStatusData = actualData.app_operation_status;
        const codSettings = actualData.cod_settings;
        const filtersPayload = (actualData as any)?.filters;

        // Store COD settings globally for checkout/payment screens
        paymentConfigService.setCodSettings(codSettings);

        // Store cancel timer for order cancellation countdown (Order Detail screen)
        if (actualData.cancel_timer != null) {
          appConfigService.setCancelTimer(actualData.cancel_timer);
        }

        // Store app operation status
        if (appOperationStatusData) {
          setAppOperationStatus(appOperationStatusData);
        }

        if (Array.isArray(filtersPayload) && filtersPayload.length > 0) {
          setHomeFilterDefinitions(filtersPayload as HomeFilterDefinition[]);
        } else {
          setHomeFilterDefinitions(DEFAULT_HOME_FILTERS);
        }

        if (!isPartialFilterRefresh) {
          // Home header background image (URL string from API — any supported key)
          const rawHeaderBg =
            (actualData as any).home_background_image_url ??
            (actualData as any).home_background_image ??
            (actualData as any).header_background_image ??
            (actualData as any).background_image_url ??
            (actualData as any).home_screen_background_image;
          const headerBgStr = typeof rawHeaderBg === 'string' ? rawHeaderBg.trim() : '';
          setHomeBackgroundImageUrl(headerBgStr.length > 0 ? headerBgStr : null);

          // Handle organization banners for dynamic header
          const orgBannerRaw = (actualData as any).organization_banner;
          if (orgBannerRaw && Array.isArray(orgBannerRaw)) {
            setOrganizationBanners(orgBannerRaw);
          } else {
            setOrganizationBanners([]);
          }

          // Handle promotional banners
          if (promotionalBanner) {
            // Handle if it's a single object or array
            const bannerArray = Array.isArray(promotionalBanner) ? promotionalBanner : [promotionalBanner];
            // Transform API data to carousel format
            const transformedBanners: CarouselItem[] = bannerArray.map((banner: BannerItem, index: number) => ({
              id: banner.id || `banner-${index}`,
              title: banner.title || '',
              description: banner.subtitle || banner.description || '',
              buttonText: banner.cta_button || banner.button_text || '',
              buttonColor: banner.button_color,
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
              // Sort filtered categories by sequence field (dev/iOS)
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

              // Deduplicate categories by ID
              const uniqueCategories = Array.from(
                new Map(categoriesWithViewAll.map(item => [item.id.toString(), item])).values()
              );

              setCategoryData(uniqueCategories);
              onCategoriesLoaded?.(uniqueCategories);
            }
          } else {
            setCategoryData([]);
            onCategoriesLoaded?.([]);
          }
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
              isFavorite:
                favoritesService.getRestaurantFavoriteOverride(restaurant.id) ??
                Boolean(restaurant.is_favorite),
              isVeg: restaurant.is_veg || restaurant.dietary_preference === 'veg' || false,
              timings: timings,
              isOpen: isOpen,
            };
          });

          // Deduplicate restaurants by ID
          const uniqueRestaurants = Array.from(
            new Map(transformedRestaurants.map(item => [item.id.toString(), item])).values()
          );

          setRestaurantData(uniqueRestaurants);
          analyticsService.logEvent(AnalyticsEvents.RESTAURANT_LIST_VIEWED, {
            restaurant_scroll_count: 0,
            item_count: uniqueRestaurants.length,
          });

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
        if (!isPartialFilterRefresh) {
          setCarouselData([]);
          setCategoryData([]);
          onCategoriesLoaded?.([]);
        }
        setHasNetworkError(true);
        setRestaurantData([]);
        setPopularDishesData([]);
        setPopularDishesTitle('Popular Dishes');
        setPopularCollectionType('unknown');
      }
    } catch (error) {
      if (!isPartialFilterRefresh) {
        setCarouselData([]);
        setCategoryData([]);
        onCategoriesLoaded?.([]);
      }
      setHasNetworkError(true);
      setRestaurantData([]);
      setPopularDishesData([]);
      setPopularDishesTitle('Popular Dishes');
      setPopularCollectionType('unknown');
    } finally {
      if (!isPartialFilterRefresh) {
        setIsLoadingBanners(false);
        setIsLoadingCategories(false);
      }
      setIsLoadingRestaurants(false);
    }
  }, [onCategoriesLoaded, onForcedUpdateRequired, resolveVegModeForApi, selectedHomeFilters, vegMode]);

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

      const effectiveVegMode = resolveVegModeForApi(selectedHomeFilters);
      const restaurantFilterParams = buildRestaurantFilterParams(selectedHomeFilters);
      const response = await homeService.getHomeData(
        coords.latitude,
        coords.longitude,
        effectiveVegMode,
        nextPage,
        restaurantFilterParams
      );
      console.log('[HomeScreen] /api/buyer/home load-more response', {
        lat: coords.latitude,
        lng: coords.longitude,
        vegMode: effectiveVegMode,
        page: nextPage,
        restaurantFilterParams,
        response,
      });

      // Check if API indicates forced update is required
      if (!response.success && response.statusCode === 426) {
        // Show forced update modal
        if (onForcedUpdateRequired) {
          onForcedUpdateRequired(response.message);
        }
        // Stop loading
        setIsLoadingMore(false);
        return;
      }

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
            // For store open/close, use ONLY backend top-level is_open flag.
            const isOpen: boolean =
              typeof restaurant.is_open === 'boolean' ? restaurant.is_open : true;

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
              isFavorite:
                favoritesService.getRestaurantFavoriteOverride(restaurant.id) ??
                Boolean(restaurant.is_favorite),
              isVeg: restaurant.is_veg || restaurant.dietary_preference === 'veg' || false,
              timings: timings,
              isOpen: isOpen,
            };
          });

          // Append new restaurants to existing list with deduplication
          setRestaurantData(prevData => {
            const combined = [...prevData, ...transformedRestaurants];
            return Array.from(
              new Map(combined.map(item => [item.id.toString(), item])).values()
            );
          });
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
  }, [isLoadingMore, hasMoreRestaurants, isLoadingRestaurants, currentPage, defaultAddressCoords, selectedHomeFilters, vegMode]);

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
            onConfirm: () => { },
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

      case 'collection_id':
        // Navigate to View All / Popular Dishes with a specific collection id
        if (onNavigateToPopularDishes) {
          const collectionId = parseInt(item.promotionLink, 10);
          if (!isNaN(collectionId)) {
            onNavigateToPopularDishes(collectionId);
          } else {
            onNavigateToPopularDishes();
          }
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
            onConfirm: () => { },
          });
        });
        break;

      default:
        // Unknown promotion type, do nothing
        break;
    }
  }, [onNavigateToRestaurant, onNavigateToCategory, onNavigateToPopularDishes, showConfirmation]);

  const handleOrganizationBannerCTAClick = React.useCallback(() => {
    if (!activeOrganizationBanner) {
      return;
    }

    const promotionTypeRaw = String(activeOrganizationBanner.promotion_type || '').trim().toLowerCase();
    const promotionLinkRaw = String(activeOrganizationBanner.promotion_link || '').trim();
    if (!promotionTypeRaw || !promotionLinkRaw) {
      return;
    }

    handleBannerCTAClick({
      id: `organization-banner-${activeBannerIndex}`,
      title: activeOrganizationBanner.title || '',
      description: activeOrganizationBanner.subtitle || '',
      buttonText: activeOrganizationBanner.cta_button || activeOrganizationBanner.button_text || '',
      promotionType: promotionTypeRaw as CarouselItem['promotionType'],
      promotionLink: promotionLinkRaw,
      backgroundColor: activeOrganizationBanner.background_color,
    });
  }, [activeBannerIndex, activeOrganizationBanner, handleBannerCTAClick]);

  const renderCarouselItem = React.useCallback(({ item }: { item: CarouselItem }) => {
    return (
      <View style={[styles.carouselSlide, { width: windowWidth }]} testID={`carousel-slide-${item.id}`}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handleBannerCTAClick(item)}
          style={[styles.adBanner, { width: bannerWidth, backgroundColor: item.backgroundColor || '#00BEC8' }]}
          testID={`banner-${item.id}`}
        >
          {/* Background Image - fills entire rectangle */}
          {item.imageUrl && (
            <OptimizedImage
              source={item.imageUrl}
              style={[styles.adBannerImage, { width: bannerWidth }]}
              contentFit="cover"
              shimmerWidth={bannerWidth}
              shimmerHeight={STORE_BANNER_HEIGHT}
              transition={300}
              priority="high"
              cachePolicy="memory-disk"
            />
          )}

          {/* Black overlay for text readability */}
          <View style={styles.adOverlay} />

          {/* Content with background color visible behind buttons */}
          <View style={styles.adContent} testID={`banner-content-${item.id}`}>
            <Text
              style={styles.adTitle}
              numberOfLines={3}
              testID={`banner-title-${item.id}`}
            >
              {item.title}
            </Text>
            <Text
              style={[styles.adDescription, { maxWidth: bannerWidth - 32 }]}
              numberOfLines={5}
              testID={`banner-description-${item.id}`}
            >
              {item.description}
            </Text>
            {item.buttonText && item.promotionType !== 'organization' && item.promotionType !== 'organisation' ? (
              <View
                style={[
                  styles.adButton,
                  { backgroundColor: item.buttonColor || item.backgroundColor || '#FFFFFF' }
                ]}
                testID={`banner-button-${item.id}`}
              >
                <Text style={[
                  styles.adButtonText,
                  { color: item.buttonColor ? '#FFFFFF' : (item.backgroundColor ? '#FFFFFF' : '#000000') }
                ]}>
                  {item.buttonText}
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [handleBannerCTAClick, windowWidth, bannerWidth]);

  const renderCategoryItem = React.useCallback(({ item }: { item: CategoryItem }) => {
    const imageSource = typeof item.icon === 'string' ? { uri: item.icon } : item.icon;
    const isViewAll = item.id === 'view-all' || item.name === 'View All';

    return (
      <TouchableOpacity
        style={styles.categoryBadge}
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
        <View style={[styles.categoryBadgeImageWrap, isViewAll && styles.categoryBadgeImageWrapViewAll]}>
          {isViewAll ? (
            <MaterialIcons name="apps" size={20} color="#111827" testID={`category-image-${item.id}`} />
          ) : (
            <Image
              source={imageSource}
              style={styles.categoryBadgeImage}
              resizeMode="cover"
              testID={`category-image-${item.id}`}
              onLoad={() => {
                setLoadedCategoryImages(prev => new Set(prev).add(item.id.toString()));
              }}
              onError={() => {
                setLoadedCategoryImages(prev => new Set(prev).add(item.id.toString()));
              }}
              fadeDuration={300}
              progressiveRenderingEnabled={true}
            />
          )}
        </View>
        <Text style={styles.categoryBadgeLabel} numberOfLines={1} testID={`category-name-${item.id}`}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  }, [onNavigateToCategory]);

  const renderPopularDishItem = ({ item }: { item: PopularDishItem }) => {
    const handleWishlistPress = async () => {
      if (isGuest && onNavigateToLogin) {
        onNavigateToLogin();
        return;
      }

      const previousIsFavorite = Boolean(item.isFavorite);
      const nextIsFavorite = !previousIsFavorite;
      const favoriteEntityId =
        popularCollectionType === 'store'
          ? (item.restaurantId ?? item.storeId ?? item.id)
          : item.id;
      if (popularCollectionType === 'store') {
        favoritesService.setRestaurantFavoriteOverride(favoriteEntityId, nextIsFavorite);
      } else {
        favoritesService.setItemFavoriteOverride(favoriteEntityId, nextIsFavorite);
      }
      setPopularDishesData(prev =>
        prev.map(dish =>
          dish.id === item.id ? { ...dish, isFavorite: nextIsFavorite } : dish
        )
      );

      try {
        console.log('[HomeScreen] wishlist toggle request', {
          collectionType: popularCollectionType,
          itemId: item.id,
          favoriteEntityId,
          nextIsFavorite,
        });
        const response =
          popularCollectionType === 'store'
            ? await favoritesService.toggleFavoriteRestaurant(
                item.restaurantId ?? item.storeId ?? item.id
              )
            : await favoritesService.toggleFavoriteItem(item.id);
        console.log('[HomeScreen] wishlist toggle response', {
          collectionType: popularCollectionType,
          itemId: item.id,
          favoriteEntityId,
          response,
        });
        if (!response.success) {
          if (popularCollectionType === 'store') {
            favoritesService.setRestaurantFavoriteOverride(favoriteEntityId, previousIsFavorite);
          } else {
            favoritesService.setItemFavoriteOverride(favoriteEntityId, previousIsFavorite);
          }
          setPopularDishesData(prev =>
            prev.map(dish =>
              dish.id === item.id ? { ...dish, isFavorite: previousIsFavorite } : dish
            )
          );
        }
      } catch {
        if (popularCollectionType === 'store') {
          favoritesService.setRestaurantFavoriteOverride(favoriteEntityId, previousIsFavorite);
        } else {
          favoritesService.setItemFavoriteOverride(favoriteEntityId, previousIsFavorite);
        }
        setPopularDishesData(prev =>
          prev.map(dish =>
            dish.id === item.id ? { ...dish, isFavorite: previousIsFavorite } : dish
          )
        );
      }
    };

    const handleAddPress = async () => {
      if (isGuest && onNavigateToLogin) {
        onNavigateToLogin();
        return;
      }

      if (item.isAvailable === false) {
        return;
      }
      if (!item.storeId) {
        return;
      }

      const hasConflict = checkRestaurantConflict(item.storeId);
      if (hasConflict) {
        await clearCart();
      }

      const effectiveStoreName = item.storeName || 'Restaurant';
      setRestaurantInfo(item.storeId, effectiveStoreName, item.storeLogoUrl);

      try {
        await addToCart(
          {
            id: item.id,
            itemId: Number(item.id),
            name: item.name,
            price: item.basePrice ?? 0,
            quantity: 1,
            isVeg: Boolean(item.isVeg),
            image: typeof item.image === 'object' && item.image && 'uri' in item.image ? item.image.uri : undefined,
            isCustomizable: false,
          },
          item.storeId
        );

        if (onNavigateToRestaurant) {
          onNavigateToRestaurant(item.storeId, effectiveStoreName);
        }
      } catch (error: any) {
        const errorMessage =
          typeof error?.message === 'string' && error.message.trim().length > 0
            ? error.message.trim()
            : 'Unable to add this item right now. Please try again.';
        showConfirmation({
          title: 'Unable to add item',
          message: errorMessage,
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#00B14F',
          onConfirm: () => { },
        });
      }
    };

    return (
      <View
        style={[
          styles.popularDishCard,
          popularCollectionType === 'store' ? styles.popularDishCardStore : null,
        ]}
      >
        <FoodAddCard
          image={item.image}
          name={item.name}
          subtitle={
            popularCollectionType === 'item'
              ? `by ${item.storeName || 'Hotel'}`
              : (item.locality || item.restaurantName)
          }
          priceLabel={item.priceLabel}
          showAddButton={item.showAddButton}
          isClosed={
            popularCollectionType === 'store'
              ? item.isOpen === false
              : item.isAvailable === false
          }
          closedOverlayLabel="Currently closed"
          unavailableLabel="Not available"
          imageWidth={popularCollectionType === 'store' ? 140 : 155}
          imageHeight={popularCollectionType === 'store' ? 160 : 137}
          imageBorderRadius={popularCollectionType === 'store' ? 18 : 16}
          showWishlistIcon={true}
          isWishlisted={Boolean(item.isFavorite)}
          onWishlistPress={() => {
            handleWishlistPress().catch(() => {});
          }}
          onAddPress={() => {
            handleAddPress().catch(() => {});
          }}
          onPress={() => {
            if (
              popularCollectionType === 'store' &&
              item.isOpen !== false &&
              item.restaurantId &&
              onNavigateToRestaurant
            ) {
              onNavigateToRestaurant(item.restaurantId, item.name);
            }
          }}
          disabled={popularCollectionType !== 'store' || item.isOpen === false}
          cardWidth="100%"
        />
      </View>
    );
  };

  React.useEffect(() => {
    const unsubscribe = favoritesService.subscribeToItemFavoriteChanges((itemId, isFavorite) => {
      setPopularDishesData((prev) =>
        prev.map((dish) => (dish.id === itemId ? { ...dish, isFavorite } : dish))
      );
    });
    const unsubscribeRestaurant = favoritesService.subscribeToRestaurantFavoriteChanges(
      (restaurantId, isFavorite) => {
        setPopularDishesData((prev) =>
          prev.map((dish) =>
            String(dish.restaurantId ?? dish.storeId ?? dish.id) === restaurantId
              ? { ...dish, isFavorite }
              : dish
          )
        );
        setRestaurantData((prev) =>
          prev.map((restaurant) =>
            String(restaurant.id) === restaurantId
              ? { ...restaurant, isFavorite }
              : restaurant
          )
        );
      }
    );
    return () => {
      unsubscribe();
      unsubscribeRestaurant();
    };
  }, []);

  const openHomeFilters = React.useCallback(() => {
    setQuickFilterKey(null);
    setDraftHomeFilters(selectedHomeFilters);
    setShowHomeFilterModal(true);
  }, [selectedHomeFilters]);

  const openHomeFiltersForKey = (filterKey: string) => {
    setQuickFilterKey(filterKey);
    setActiveHomeFilterKey(filterKey);
    setDraftHomeFilters(selectedHomeFilters);
    setShowHomeFilterModal(true);
  };

  const startRestaurantFilterLoading = () => {
    setHasNetworkError(false);
    setNoRestaurantsFound(false);
    setShowRestaurantShimmer(true);
    setIsLoadingRestaurants(true);
  };

  const handleHomeFilterSelect = React.useCallback(
    (filter: HomeFilterDefinition, value: string) => {
      setDraftHomeFilters((prev) => {
        const next: HomeFilterSelections = { ...prev };
        if (filter.selection_type === 'multiple') {
          const current = Array.isArray(next[filter.key]) ? [...(next[filter.key] as string[])] : [];
          if (current.includes(value)) {
            next[filter.key] = current.filter((entry) => entry !== value);
          } else {
            next[filter.key] = [...current, value];
          }
        } else {
          const current = String(next[filter.key] || '');
          next[filter.key] = current === value ? '' : value;
        }
        return next;
      });
    },
    []
  );

  const handleApplyHomeFilters = React.useCallback(async () => {
    startRestaurantFilterLoading();
    setSelectedHomeFilters(draftHomeFilters);
    setQuickFilterKey(null);
    setShowHomeFilterModal(false);
    const lat = externalSelectedLocation?.latitude || defaultAddressCoords?.latitude || DEFAULT_LOCATION.latitude;
    const lng = externalSelectedLocation?.longitude || defaultAddressCoords?.longitude || DEFAULT_LOCATION.longitude;
    await fetchHomeData(lat, lng, draftHomeFilters, { sectionScope: 'restaurants_and_collections' });
  }, [defaultAddressCoords, draftHomeFilters, externalSelectedLocation, fetchHomeData]);

  const handleClearHomeFilters = React.useCallback(async () => {
    startRestaurantFilterLoading();
    setDraftHomeFilters({});
    setSelectedHomeFilters({});
    setQuickFilterKey(null);
    setShowHomeFilterModal(false);
    const lat = externalSelectedLocation?.latitude || defaultAddressCoords?.latitude || DEFAULT_LOCATION.latitude;
    const lng = externalSelectedLocation?.longitude || defaultAddressCoords?.longitude || DEFAULT_LOCATION.longitude;
    await fetchHomeData(lat, lng, {}, { sectionScope: 'restaurants_and_collections' });
  }, [defaultAddressCoords, externalSelectedLocation, fetchHomeData]);

  const handleClearSingleHomeFilter = async (filterKey: string) => {
    startRestaurantFilterLoading();
    const nextFilters: HomeFilterSelections = { ...selectedHomeFilters };
    delete nextFilters[filterKey];
    setDraftHomeFilters(nextFilters);
    setSelectedHomeFilters(nextFilters);

    const lat = externalSelectedLocation?.latitude || defaultAddressCoords?.latitude || DEFAULT_LOCATION.latitude;
    const lng = externalSelectedLocation?.longitude || defaultAddressCoords?.longitude || DEFAULT_LOCATION.longitude;
    await fetchHomeData(lat, lng, nextFilters, { sectionScope: 'restaurants_and_collections' });
  };

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

    // Sync animated value for header background stay-put effect on pull
    scrollYAnimated.setValue(scrollY);

    // Save scroll position for restoration after refresh
    scrollPositionRef.current = scrollY;

    // Category section becomes sticky after header + taller banner + reserved spacer + section title
    const threshold = 520;
    setIsCategorySectionSticky(scrollY > threshold);

    // Check if user has scrolled near the bottom (within 500px)
    const distanceFromBottom = contentHeight - (scrollY + layoutHeight);
    const scrollCount = Math.max(0, Math.floor(scrollY / 500));
    if (scrollCount > maxScrollCountTrackedRef.current) {
      maxScrollCountTrackedRef.current = scrollCount;
      analyticsService.logEvent(AnalyticsEvents.RESTAURANT_LIST_VIEWED, {
        restaurant_scroll_count: scrollCount,
      });
    }
    if (distanceFromBottom < 500) {
      if (hasMoreRestaurants && !isLoadingMore && !isLoadingRestaurants) {
        loadMoreRestaurants();
      }
    }
  }, [hasMoreRestaurants, isLoadingMore, isLoadingRestaurants, loadMoreRestaurants]);

  const handleCartPress = React.useCallback(async () => {
    if (!restaurantId || !onNavigateToCheckout || !hasCartItems) {
      return;
    }

    const isOpen = await ensureCartRestaurantOpen();
    if (!isOpen) {
      return;
    }

    await flushPendingQuantityUpdate();
    onNavigateToCheckout(restaurantId, restaurantName, 'home');
  }, [restaurantId, restaurantName, hasCartItems, onNavigateToCheckout, ensureCartRestaurantOpen, flushPendingQuantityUpdate]);

  return (
    <View style={[styles.outerContainer, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Top background filler for pull-to-refresh overscroll - Layer 1 (Back) */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_BACKGROUND_HEIGHT, backgroundColor: homeTopBackgroundColor }}
        pointerEvents="none"
      />

      {/* SafeAreaView and Content - Layer 3 (Front) */}
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: totalCartItems > 0 ? 100 + insets.bottom : 0
          }}
          stickyHeaderIndices={[3]}
          testID="home-screen"
          alwaysBounceVertical={true}
          overScrollMode="always"
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
              colors={['#FFFFFF']}
              tintColor="#FFFFFF"
              progressBackgroundColor="#00B14F"
              {...(Platform.OS === 'android' ? { progressViewOffset: insets.top + 30 } : {})}
            />
          }
        >

          {/* Header Content Wrapper */}
          <View style={styles.headerStack} testID="header-stack">
            <View
              style={[styles.headerBackground, { paddingTop: insets.top + 10, backgroundColor: homeTopBackgroundColor }]}
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

                {/* Profile & Cart Actions */}
                {isLoadingLocation ? (
                  <View style={styles.profileButton}>
                    <Shimmer width={50} height={50} borderRadius={25} />
                  </View>
                ) : (
                  <View style={styles.headerActionsRow}>
                    {/* Cart Icon - hidden */}
                    {/* {hasCartItems && (
                <TouchableOpacity
                  style={styles.cartButton}
                  onPress={handleCartPress}
                  activeOpacity={0.7}
                  disabled={!isLocationServiceable}
                  testID="cart-button"
                >
                  <View
                    style={[
                      styles.cartAvatar,
                      !isLocationServiceable && styles.cartAvatarDisabled,
                    ]}
                  >
                    <MaterialIcons
                      name="shopping-cart"
                      size={22}
                      color={
                        isLocationServiceable
                          ? '#00B14F'
                          : 'rgba(0, 177, 79, 0.4)'
                      }
                    />
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText} numberOfLines={1}>
                        {totalCartItems > 99 ? '99+' : totalCartItems}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )} */}

                    {/* Profile Avatar */}
                    <TouchableOpacity
                      style={styles.profileButton}
                      onPress={onNavigateToProfile}
                      activeOpacity={0.7}
                      disabled={!isLocationServiceable}
                      testID="profile-button"
                    >
                      <View
                        style={[
                          styles.profileAvatar,
                          !isLocationServiceable && styles.profileAvatarDisabled,
                        ]}
                      >
                        <MaterialIcons
                          name="person"
                          size={22}
                          color={
                            isLocationServiceable
                              ? '#00B14F'
                              : 'rgba(0, 177, 79, 0.4)'
                          }
                        />
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Search Bar and VEG Mode Toggle */}
              <View
                style={styles.searchSection}
                onLayout={(e) => {
                  const { y, height } = e.nativeEvent.layout;
                  setSearchSectionBottomY(y + height);
                }}
              >
                {isLoadingLocation ? (
                  <>
                    {/* Search Bar Shimmer */}
                    <View style={styles.searchBarWrapper}>
                      <Shimmer width="100%" height={60} borderRadius={10} />
                    </View>

                    {/* VEG Mode Shimmer */}
                    <Shimmer width={46} height={60} borderRadius={10} />
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.searchBarWrapper}
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
                          style={{marginLeft: 10}}
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
                        VEG
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

            </View>
          </View>

          {/* Organization Banner Section (Overlay + Spacer) */}
          {(isLoadingBanners || organizationBanners.length > 0 || (displayBackgroundImageUrl && displayBackgroundImageUrl.length > 0)) && (
            <>
              {/* Background image section (overlay, outside header) */}
              <View
                style={[
                  styles.headerImageOverlay,
                  {
                    top: searchSectionBottomY + AFTER_SEARCH_SPACER,
                    opacity: searchSectionBottomY > 0 ? 1 : 0
                  },
                ]}
                pointerEvents="box-none"
                testID="home-header-image-overlay"
              >
                {isLoadingBanners && !hasExistingBannerVisual ? (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : displayBackgroundImageUrl && !headerBackgroundLoadFailed ? (
                  <OptimizedImage
                    source={displayBackgroundImageUrl}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    showShimmer={false}
                    transition={200}
                    priority="high"
                    cachePolicy="memory-disk"
                    onError={() => setHeaderBackgroundLoadFailed(true)}
                    testID="home-header-image-section-remote"
                  />
                ) : null}

                {(!isLoadingBanners || hasExistingBannerVisual) && (
                  <>
                    <LinearGradient
                      colors={[homeTopBackgroundColor, homeTopBackgroundColor, 'rgba(0,0,0,0)']}
                      locations={[0, 0.6, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.headerImageSectionTopFade}
                    />

                    {/* Lighter at top, darker downwards */}
                    <LinearGradient
                      colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.18)']}
                      locations={[0, 0.55, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.headerImageDarkenGradient}
                    />
                  </>
                )}

                {!isLoadingLocation && (
                  <View style={styles.headerImageInnerContent}>
                    <View
                      style={[styles.homePromoBlockInImageSection, !isLocationServiceable && styles.homePromoBlockDisabled]}
                      pointerEvents="box-none"
                    >
                      <Text style={styles.homePromoHeadline}>{promoTitle}</Text>
                      {promoSubtitle ? (
                        <Text style={styles.homePromoSubline}>
                          {promoSubtitle}
                        </Text>
                      ) : null}
                      {promoCtaButton ? (
                        <TouchableOpacity
                          activeOpacity={hasPromoCtaNavigation ? 0.8 : 1}
                          onPress={hasPromoCtaNavigation ? handleOrganizationBannerCTAClick : undefined}
                          style={styles.homePromoCtaButton}
                          disabled={!hasPromoCtaNavigation}
                        >
                          <Text style={styles.homePromoCtaButtonText}>{promoCtaButton}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                )}
              </View>

              {/* Reserve space for overlay image section */}
              <View style={styles.headerImageOverlaySpacer} />
            </>
          )}

          {/* Solid background for everything after the header */}
          <View style={{ backgroundColor: isLocationServiceable ? colors.background : '#FFFFFF', flex: 1 }}>

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

            {/* Ad Banner Carousel or Closed Banner */}
            {isLocationServiceable && (
              <>
                {/* Categories: horizontal badges on home; View All opens CategoryModal (grid unchanged) */}
                {shouldShowBadgesRow && (
                  <>
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
                          {[1, 2, 3, 4, 5, 6].map((item) => (
                            <View key={item} style={styles.categoryBadgeShimmer}>
                              <Shimmer width={32} height={32} borderRadius={16} backgroundColor="#E8E8E8" />
                              <Shimmer width={58} height={12} borderRadius={6} backgroundColor="#E8E8E8" style={styles.categoryBadgeShimmerText} />
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

                {(showBannerShimmer || carouselData.length > 0) && appOperationStatus?.is_open !== false && (
                  <View
                    style={[
                      styles.carouselContainer,
                      { marginTop: shouldShowBadgesRow ? 8 : 12 },
                    ]}
                  >
                    {showBannerShimmer ? (
                      <View style={styles.loadingContainer}>
                        <Shimmer width="100%" height={STORE_BANNER_HEIGHT} borderRadius={20} />
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
                            snapToInterval={windowWidth}
                            disableIntervalMomentum={true}
                            removeClippedSubviews={false}
                            bounces={false}
                            overScrollMode="never"
                            scrollEventThrottle={16}
                            getItemLayout={(_data, index) => ({
                              length: windowWidth,
                              offset: windowWidth * index,
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
                )}

                <View style={styles.popularDishesSection}>
                  {popularDishesTitle.trim().toLowerCase() !== 'popular dishes' ? (
                    <View style={styles.popularDishesHeaderRow}>
                      <Text style={styles.popularDishesTitle}>{popularDishesTitle}</Text>
                      {onNavigateToPopularDishes ? (
                        <TouchableOpacity
                          onPress={() => onNavigateToPopularDishes()}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.popularDishesViewAll}>View all</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}

                  {popularDishesData.length > 0 && (
                    <FlatList
                      data={popularDishesData}
                      renderItem={renderPopularDishItem}
                      keyExtractor={(item) => item.id}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.popularDishesListContent}
                    />
                  )}
                </View>

                {/* Restaurants Near You Section - Only show if there's data, still loading, or error states */}
                {(showRestaurantShimmer || filteredRestaurantData.length > 0 || restaurantData.length > 0 || noRestaurantsFound || hasNetworkError) && (
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

                {homeFilterDefinitions.length > 0 && (
                  <View style={styles.filterContainer}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.filterRowScroll}
                      contentContainerStyle={styles.filterRowScrollContent}
                    >
                      <TouchableOpacity
                        style={styles.filterButtonInactive}
                        onPress={openHomeFilters}
                        testID="home-filter-button"
                      >
                        <MaterialIcons
                          name="filter-list"
                          size={16}
                          color="#6B7280"
                        />
                        <Text style={styles.filterTextInactive}>
                          Filters
                        </Text>
                      </TouchableOpacity>
                      {homeFilterDefinitions.map((filter) => {
                        const applied = isHomeFilterApplied(filter.key);
                        const selectedCount = getHomeFilterSelectedCount(filter);
                        const showCount = filter.selection_type === 'multiple' && selectedCount > 1;
                        return (
                          <TouchableOpacity
                            key={`home-filter-type-${filter.key}`}
                            style={applied ? styles.homeFilterTypeChipActive : styles.homeFilterTypeChip}
                            onPress={() => {
                              if (filter.selection_type === 'multiple' && applied) {
                                openHomeFiltersForKey(filter.key);
                                return;
                              }
                              setActiveHomeFilterKey(filter.key);
                            }}
                            activeOpacity={0.85}
                          >
                            <View style={styles.homeFilterTypeChipContent}>
                              {applied && showCount && (
                                <MaterialIcons name="filter-list" size={14} color="#00B14F" style={styles.homeFilterTypeChipFilterIcon} />
                              )}
                              {applied && !showCount && (
                                <TouchableOpacity
                                  onPress={(event) => {
                                    event.stopPropagation();
                                    handleClearSingleHomeFilter(filter.key).catch(() => {});
                                  }}
                                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                                  style={styles.homeFilterTypeChipCloseButton}
                                >
                                  <MaterialIcons name="close" size={14} color="#00B14F" style={styles.homeFilterTypeChipCloseIcon} />
                                </TouchableOpacity>
                              )}
                              <Text style={applied ? styles.homeFilterTypeChipTextActive : styles.homeFilterTypeChipText}>
                                {filter.label}
                              </Text>
                              {applied && showCount && (
                                <Text style={styles.homeFilterTypeChipCountTextActive}>({selectedCount})</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Restaurant List - Only show if there's data, still loading, or error states */}
                {(showRestaurantShimmer || filteredRestaurantData.length > 0 || restaurantData.length > 0 || noRestaurantsFound || hasNetworkError) && (
                  <View style={styles.restaurantListContainer}>
                    {showRestaurantShimmer ? (
                      <>
                        {/* Shimmer for 2 restaurant cards */}
                        {[1, 2].map((item) => (
                          <View key={item} style={styles.restaurantCardWrapper}>
                            <View style={styles.restaurantCardShimmer}>
                              <Shimmer width="100%" height={180} borderRadius={0} backgroundColor="#E8E8E8" />
                              <View style={styles.restaurantDetailsShimmer}>
                                <Shimmer width="75%" height={20} borderRadius={6} backgroundColor="#E8E8E8" style={{ marginBottom: 8 }} />
                                <Shimmer width="55%" height={16} borderRadius={6} backgroundColor="#E8E8E8" style={{ marginBottom: 8 }} />
                                <Shimmer width="90%" height={14} borderRadius={6} backgroundColor="#E8E8E8" style={{ marginBottom: 6 }} />
                                <Shimmer width="85%" height={14} borderRadius={6} backgroundColor="#E8E8E8" style={{ marginBottom: 6 }} />
                                <Shimmer width={40} height={16} borderRadius={6} backgroundColor="#E8E8E8" />
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
                    ) : filteredRestaurantData.length === 0 ? (
                      <View style={styles.noRestaurantsContainer}>
                        <MaterialIcons name="tune" size={64} color="rgba(0, 0, 0, 0.2)" />
                        <Text style={styles.noRestaurantsTitle}>No matching restaurants</Text>
                        <Text style={styles.noRestaurantsMessage}>
                          Try changing or clearing filters to see more restaurants.
                        </Text>
                        <TouchableOpacity
                          style={styles.retryButton}
                          onPress={handleClearHomeFilters}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="clear-all" size={20} color="#FFFFFF" />
                          <Text style={styles.retryButtonText}>Clear Filters</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <FlatList
                        data={filteredRestaurantData}
                        renderItem={({ item: restaurant }) => (
                          <View style={styles.restaurantCardWrapper}>
                            <RestaurantCard
                              restaurant={restaurant}
                              layoutMode={4}
                              onPress={() => {
                                if (onNavigateToRestaurant) {
                                  const restaurantId = typeof restaurant.id === 'string' ? parseInt(restaurant.id, 10) : restaurant.id;
                                  const parsedDistance = parseFloat(String(restaurant.distance || '').replace(/[^0-9.]/g, ''));
                                  const parsedItemCount = Number(
                                    (restaurant as any)?.item_count ??
                                    (restaurant as any)?.items_count ??
                                    (restaurant as any)?.total_items ??
                                    (restaurant as any)?.menu_item_count ??
                                    0
                                  );
                                  onNavigateToRestaurant(restaurantId, restaurant.name, {
                                    distanceKm: Number.isFinite(parsedDistance) ? parsedDistance : undefined,
                                    isOpen: typeof restaurant.isOpen === 'boolean' ? restaurant.isOpen : undefined,
                                    itemCount: Number.isFinite(parsedItemCount) ? parsedItemCount : undefined,
                                  });
                                }
                              }}
                              onImageLoad={() => {
                                setLoadedRestaurantImages(prev => new Set(prev).add(restaurant.id.toString()));
                              }}
                              isGuest={isGuest}
                              onNavigateToLogin={onNavigateToLogin}
                            />
                          </View>
                        )}
                        keyExtractor={(restaurant) => restaurant.id.toString()}
                        scrollEnabled={false}
                        removeClippedSubviews={true}
                        maxToRenderPerBatch={3}
                        windowSize={3}
                        initialNumToRender={2}
                        updateCellsBatchingPeriod={100}
                        getItemLayout={(data, index) => ({
                          length: 380,
                          offset: 380 * index,
                          index,
                        })}
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

                <Modal
                  visible={showHomeFilterModal}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setShowHomeFilterModal(false)}
                >
                  <View style={styles.homeFiltersOverlay}>
                    <View style={styles.homeFiltersCard}>
                      <View style={styles.homeFiltersHeader}>
                        <Text style={styles.homeFiltersTitle}>{homeFilterModalTitle}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setQuickFilterKey(null);
                            setShowHomeFilterModal(false);
                          }}
                        >
                          <MaterialIcons name="close" size={22} color="#9CA3AF" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.homeFiltersDivider} />
                      <View style={styles.homeFiltersBody}>
                        {!quickFilterKey && (
                          <View style={styles.homeFiltersLeftPane}>
                            {homeFilterDefinitions.map((filter) => (
                              <TouchableOpacity
                                key={filter.key}
                                style={[
                                  styles.homeFilterTab,
                                  activeHomeFilter?.key === filter.key && styles.homeFilterTabActive,
                                ]}
                                onPress={() => setActiveHomeFilterKey(filter.key)}
                                activeOpacity={1}
                              >
                                <Text
                                  style={[
                                    styles.homeFilterTabText,
                                    activeHomeFilter?.key === filter.key && styles.homeFilterTabTextActive,
                                  ]}
                                >
                                  {filter.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                        <ScrollView
                          style={quickFilterKey ? styles.homeFiltersRightPaneQuick : styles.homeFiltersRightPane}
                          contentContainerStyle={styles.homeFiltersRightPaneContent}
                          showsVerticalScrollIndicator={false}
                        >
                          {activeHomeFilter?.options.map((option) => {
                            const selectedValue = draftHomeFilters[activeHomeFilter.key];
                            const isSelected = Array.isArray(selectedValue)
                              ? selectedValue.includes(option.value)
                              : String(selectedValue || '') === option.value;
                            return (
                              <TouchableOpacity
                                key={`${activeHomeFilter.key}-${option.value}`}
                                style={styles.homeFilterOptionRow}
                                onPress={() => handleHomeFilterSelect(activeHomeFilter, option.value)}
                                activeOpacity={1}
                              >
                                <MaterialIcons
                                  name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                                  size={22}
                                  color={isSelected ? '#00B14F' : '#9CA3AF'}
                                />
                                <Text style={styles.homeFilterOptionText}>{option.label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                      <View
                        style={[
                          styles.homeFiltersFooter,
                          quickFilterKey && styles.homeFiltersFooterQuick,
                          { paddingBottom: Math.max(insets.bottom, 12) },
                        ]}
                      >
                        {!quickFilterKey && (
                          <TouchableOpacity
                            style={styles.homeFiltersClearButton}
                            onPress={() => {
                              handleClearHomeFilters().catch(() => {});
                            }}
                          >
                            <Text style={styles.homeFiltersClearText}>Clear Filters</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[
                            styles.homeFiltersApplyButton,
                            quickFilterKey && styles.homeFiltersApplyButtonFullWidth,
                          ]}
                          onPress={() => {
                            handleApplyHomeFilters().catch(() => {});
                          }}
                        >
                          <Text style={styles.homeFiltersApplyText}>Apply</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Modal>
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

            {/* <AppFooter /> */}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* View Cart Bar - shows when cart has items and location is serviceable */}
      {isLocationServiceable && (
        <ViewCartBar
          onPress={handleCartPress}
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
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  // Header styles
  headerBackground: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
    minHeight: 180,
  },
  headerStack: {
    position: 'relative',
    width: '100%',
  },
  homeFutureContentSpacer: {
    width: '100%',
    minHeight: 36,
  },
  headerBackgroundImage: {
    width: '120%',
    resizeMode: 'cover',
    backgroundColor: '#00B14F',
    left: 0,
    top: 0,
  },
  headerBackgroundImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  homePromoBlock: {
    width: '100%',
    marginTop: 20,
    paddingRight: 8,
  },
  homePromoBlockInImageSection: {
    width: '100%',
    paddingTop: 12,
  },
  homePromoHeadline: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 36,
    lineHeight: 42,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  homePromoSubline: {
    marginTop: 8,
    fontFamily: 'Poppins-Medium',
    fontSize: 24,
    lineHeight: 34,
    color: '#FFFFFF',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  homePromoCtaButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    minWidth: 94,
    height: 36,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homePromoCtaButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    lineHeight: 20,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  homePromoBlockDisabled: {
    opacity: 0.45,
  },
  // Location section
  locationSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: 44,
  },
  locationInfo: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: 0,
    gap: 2,
    width: 326,
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarDisabled: {
    opacity: 0.4,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cartButton: {
    width: 50,
    height: 50,
  },
  cartAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartAvatarDisabled: {
    opacity: 0.4,
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 14,
    color: '#FFFFFF',
  },
  // Search section
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 50,
    gap: 11,
    marginTop: 16,
    marginHorizontal: 0,
  },
  searchBar: {
    flex: 1,
    height: 50,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    gap: 4,
  },
  searchBarWrapper: {
    flex: 1,
    marginLeft: 0,
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
    height: 50,
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
    marginTop: 0,
    marginBottom: 16,
    height: 220
  },
  afterSearchSpacer: {
    height: AFTER_SEARCH_SPACER,
  },
  headerImageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HOME_HEADER_IMAGE_HEIGHT,
    zIndex: 50,
    elevation: 6,
  },
  headerImageOverlaySpacer: {
    height: HOME_HEADER_IMAGE_HEIGHT,
  },
  headerImageInnerContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    justifyContent: 'flex-start',
    position: 'relative',
    zIndex: 10,
    elevation: 10,
  },
  headerImageSectionTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 1,
  },
  headerImageDarkenGradient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  closedBannerContainer: {
    width: '100%',
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  closedBannerImage: {
    height: 340,
    borderRadius: 20,
  },
  closedBannerMessageContainer: {
    position: 'absolute',
    bottom: 45,
    left: 20,
    right: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedBannerMessage: {
    width: '100%',
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 18,
    color: '#00B14F',
    textAlign: 'center',
  },
  loadingContainer: {
    width: '100%',
    height: STORE_BANNER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  carouselSlide: {
    height: STORE_BANNER_HEIGHT,
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
    height: STORE_BANNER_HEIGHT,
    backgroundColor: '#00BEC8',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    minHeight: STORE_BANNER_HEIGHT,
  },
  adBannerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: STORE_BANNER_HEIGHT,
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
    gap: 8,
    position: 'relative',
    zIndex: 2,
    flex: 1,
    width: '100%',
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  adTitle: {
    width: '82%',
    maxWidth: 280,
    // minHeight: 56,
    fontFamily: 'Poppins-SemiBold',
    // fontWeight: '700',
    fontSize: 36,
    lineHeight: 44,
    color: '#FFFFFF',
    marginTop: 2,
    marginBottom: 2,
  },
  adDescription: {
    width: '88%',
    fontFamily: 'Poppins-Medium',
    // fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    opacity: 0.98,
  },
  adButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 15,
    minWidth: 103,
    height: 28,
    // marginBottom: 3,
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
  // Category List (home row: horizontal badges)
  categoryListContainer: {
    width: '100%',
    minHeight: 48,
    paddingLeft: 20,
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 8,
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
    alignItems: 'center',
    gap: 0,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    marginRight: 8,
    maxWidth: 200,
  },
  categoryBadgeImageWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadgeImageWrapViewAll: {
    backgroundColor: '#FFFFFF',
  },
  categoryBadgeImage: {
    width: '100%',
    height: '100%',
  },
  categoryBadgeLabel: {
    marginLeft: 8,
    flexShrink: 1,
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 15,
    color: '#111827',
    maxWidth: 120,
  },
  categoryBadgeShimmer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  categoryBadgeShimmerText: {
    marginLeft: 8,
  },
  popularDishesSection: {
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  popularDishesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  popularDishesTitle: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 26,
    color: '#111827',
  },
  popularDishesViewAll: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 18,
    color: '#00B14F',
  },
  popularDishesListContent: {
    paddingLeft: 20,
    paddingRight: 0,
  },
  popularDishCard: {
    width: 170,
    marginRight: 10,
    paddingBottom: 0,
  },
  popularDishCardStore: {
    width: 140,
  },
  popularDishImageWrapper: {
    width: '100%',
    height: 130,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1F2937',
    position: 'relative',
  },
  popularDishImage: {
    width: '100%',
    height: '100%',
  },
  popularDishAddButton: {
    alignSelf: 'center',
    marginTop: -18,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22C55E',
    paddingHorizontal: 24,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    elevation: 3,
  },
  popularDishAddButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 20,
    color: '#22C55E',
  },
  popularDishTextContent: {
    marginTop: 10,
    paddingHorizontal: 1,
  },
  popularDishName: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  popularDishRestaurantName: {
    marginTop: 2,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 11,
    lineHeight: 16,
    color: '#6B7280',
  },
  popularDishPrice: {
    marginTop: 4,
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
    color: '#111827',
  },
  // Restaurants Near You Section
  restaurantsSectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginTop: 20,
    paddingTop: 4,
    // paddingBottom: 2,
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
    paddingTop: 14,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterRowScroll: {
    width: '100%',
  },
  filterRowScrollContent: {
    alignItems: 'center',
    gap: 10,
    paddingRight: 4,
  },
  filterScrollContent: {
    gap: 10,
  },
  filterChipsScroll: {
    flex: 1,
    marginLeft: 10,
  },
  filterChipsContent: {
    gap: 10,
    paddingRight: 4,
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
  homeFilterTypeChip: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    height: 29,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  homeFilterTypeChipActive: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    height: 29,
    borderWidth: 1,
    borderColor: 'rgba(0, 177, 79, 0.35)',
    borderRadius: 13,
    backgroundColor: '#ECFDF3',
  },
  homeFilterTypeChipText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 16,
    color: '#374151',
  },
  homeFilterTypeChipTextActive: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 16,
    color: '#00B14F',
  },
  homeFilterTypeChipCountTextActive: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 16,
    color: '#00B14F',
  },
  homeFilterTypeChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  homeFilterTypeChipCloseIcon: {
    marginRight: 1,
  },
  homeFilterTypeChipFilterIcon: {
    marginRight: 1,
  },
  homeFilterTypeChipCloseButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeFiltersOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  homeFiltersCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    height: '80%',
    width: '100%',
  },
  homeFiltersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  homeFiltersTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 30 / 2,
    lineHeight: 44 / 2,
    color: '#111827',
  },
  homeFiltersDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  homeFiltersBody: {
    flexDirection: 'row',
    flex: 1,
    overflow: 'hidden',
  },
  homeFiltersLeftPane: {
    width: '36%',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  homeFiltersRightPane: {
    flex: 1,
    paddingHorizontal: 16,
  },
  homeFiltersRightPaneQuick: {
    flex: 1,
    paddingHorizontal: 16,
  },
  homeFiltersRightPaneContent: {
    paddingTop: 14,
    paddingBottom: 24,
  },
  homeFilterTab: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  homeFilterTabActive: {
    backgroundColor: '#FFFFFF',
    borderLeftColor: '#00B14F',
  },
  homeFilterTabText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  homeFilterTabTextActive: {
    color: '#00B14F',
    fontFamily: 'Poppins-SemiBold',
  },
  homeFilterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  homeFilterOptionText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  homeFiltersFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  homeFiltersFooterQuick: {
    justifyContent: 'center',
    paddingHorizontal: 25,
  },
  homeFiltersClearButton: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  homeFiltersClearText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 24 / 2,
    lineHeight: 16,
    color: '#00B14F',
  },
  homeFiltersApplyButton: {
    minWidth: 150,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#00B14F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeFiltersApplyButtonFullWidth: {
    width: '100%',
    minWidth: 0,
  },
  homeFiltersApplyText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
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
    flexDirection: 'column',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  restaurantDetailsShimmer: {
    paddingVertical: 14,
    paddingHorizontal: 14,
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
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
