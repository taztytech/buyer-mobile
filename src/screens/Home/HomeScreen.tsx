import React from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Modal, Image, ScrollView, FlatList, Keyboard, Platform, ActivityIndicator, Animated, RefreshControl, Linking, useWindowDimensions, BackHandler, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveBannerFont } from '../../constants/bannerFonts';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { authService } from '@/services/auth.service';
import { homeService, BannerItem, CategoryItem, Restaurant, OrganizationBanner } from '@/services/home.service';
import { OfferBannerSection } from '@/components/OfferBannerSection';
import { StoreDealsSection } from '@/components/StoreDealsSection';
import { RotatingTitle } from '@/components/home/RotatingTitle';
import { CloudsSky } from '@/components/home/CloudsSky';
import { HeroCarousel } from '@/components/home/HomeTopDash';
import { BannerCards } from '@/components/home/BannerCards';
import {
  normalizeBannerCardsStyle,
  DEFAULT_BANNER_CARDS_STYLE,
  type BannerCardsStyle,
} from '@/components/home/bannerCardsStyle';
import { apiService } from '@/services/api.service';
import type { HeroSlide, OrgCard } from '@/components/home/HomeTopDash';
import { ServiceTabs } from '@/components/home/ServiceTabs';
import type { TopDashTab } from '@/components/home/ServiceTabs';
import type { HomeTabSummary } from '@/services/homeTab.service';
import { homeTabService } from '@/services/homeTab.service';
import { HOME_CONFIG_EVENT } from '@/services/fcmNotification.service';
import type { TabShapeSpec } from '@/components/home/ServiceTabs';
import { HomeTabContent } from '@/components/home/HomeTabContent';
import {
  FilterBar,
  FilterSheet,
  SortSheet,
  EMPTY_FILTERS,
  filtersToParams,
  activeFilterCount,
} from '@/components/home/HomeFilters';
import type { HomeFilterState } from '@/components/home/HomeFilters';
import { VoiceSearchOverlay } from '@/components/home/VoiceSearchOverlay';
import { CategoryResultsBody } from '@/screens/Category/CategoryDishesScreen';
import {
  ThemedDashBackground,
  ThemedDashForeground,
  useThemeEngine,
} from '@/components/theme/ThemedDash';
import { ThemeGreeting } from '@/components/theme/ThemeExtras';
import {
  DEFAULT_THEME_CONFIG,
  effectiveColors,
  greetingText,
  isNightNow,
  tabPaletteFrom,
  type ActiveTheme,
} from '@/components/theme/themeTypes';
import { homeThemeService, parseActiveTheme } from '@/services/homeTheme.service';
import { normalizeCardStyle, DEFAULT_CARD_STYLE, type CardStyle } from '@/components/home/cardStyle';
import { useStoreDealAdd } from '@/hooks/useStoreDealAdd';
import storeDealService, {
  type StoreDeal,
  type StoreDealSection,
  DEFAULT_STORE_DEAL_SECTION,
  heroMediaUrl,
} from '@/services/storeDeal.service';
import type { Offer } from '@/services/offers.service';
import { paymentConfigService } from '@/services/payment-config.service';
import { walletService, formatRupees } from '@/services/wallet.service';
import { appConfigService } from '@/services/app-config.service';
import { addressService } from '@/services/address.service';
import { RestaurantCard } from '@/components/RestaurantCard';
import { Shimmer } from '@/components/Shimmer';
import { OptimizedImage } from '@/components/OptimizedImage';
import { AppFooter } from '@/components/AppFooter';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { Video, ResizeMode } from 'expo-av';
import { ViewCartBar } from '@/components/ViewCartBar';
import { BottomNav } from '@/components/BottomNav';
import { ordersService } from '@/services/orders.service';
import { CategoryModal } from '@/components/CategoryModal';
import { useCart } from '@/context/CartContext';
import { useVegMode } from '@/context/VegModeContext';
import { useConfirmation } from '@/context/ConfirmationContext';
import { useSnackbar } from '@/context/SnackbarContext';
import { ComingSoonScreen } from '@/screens/Home/components/ComingSoonScreen';
import { waitlistService } from '@/services/waitlist.service';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import { restaurantService } from '@/services/restaurant.service';
import { analyticsService, AnalyticsEvents, AnalyticsUserProperties } from '@/services/analytics.service';

/** Fixed header / hero block height (independent of screen size and background image) */
// Only needs to cover pull-to-refresh overscroll; taller would show through
// the header's rounded bottom corners.
const HEADER_BACKGROUND_HEIGHT = 300;
/** Tint behind a picked category and its results, and its tab outline. */
const WOYM_PANEL = '#EAF8EF';
const WOYM_TAB_BORDER = '#9BD8B2';
/** Size of every item in the row while a category is picked. */
const WOYM_ITEM_W = 80;
const WOYM_ITEM_H = 112;
const WOYM_TOP_R = 22; // rounded top corners
const WOYM_FLARE = 12; // inverted corners where the sides meet the line
const WOYM_STROKE = 1.4;

/** Outline (open at the bottom) and fill of the picked-category tab. */
const woymTabPaths = () => {
  const w = WOYM_ITEM_W;
  const h = WOYM_ITEM_H;
  const r = WOYM_TOP_R;
  const f = WOYM_FLARE;
  const s = WOYM_STROKE / 2;
  const x0 = f; // tab's left edge inside the wider canvas
  const x1 = f + w; // right edge
  const outline =
    `M0,${h - s} ` +
    `C${f * 0.55},${h - s} ${x0},${h - f * 0.45} ${x0},${h - f} ` +
    `L${x0},${r + s} ` +
    `C${x0},${s + r * 0.45} ${x0 + r * 0.45},${s} ${x0 + r},${s} ` +
    `L${x1 - r},${s} ` +
    `C${x1 - r * 0.45},${s} ${x1},${s + r * 0.45} ${x1},${r + s} ` +
    `L${x1},${h - f} ` +
    `C${x1},${h - f * 0.45} ${x1 + f * 0.45},${h - s} ${x1 + f},${h - s}`;
  // Same shape closed along the bottom: paints over the line under the tab.
  const fill = `${outline} L${x1 + f},${h} L0,${h} Z`;
  return { outline, fill, width: w + f * 2, height: h };
};
const WOYM_TAB = woymTabPaths();
/** Promotional carousel banner card height */
const STORE_BANNER_HEIGHT = 220;
const HOME_TOP_BG_FALLBACK = '#8B1D2C';
const AFTER_SEARCH_SPACER = 12;
const HOME_HEADER_IMAGE_HEIGHT = 320;

interface HomeScreenProps {
  onLogout?: () => void;
  /** Open a promo offer — from the offer strip or a promo_offer banner tap. */
  onNavigateToOffer?: (offerId: number) => void;
  onNavigateToProfile?: () => void;
  onNavigateToAddressSelection?: () => void;
  onNavigateToCategory?: (categoryName: string) => void;
  onNavigateToRestaurant?: (
    restaurantId: number,
    restaurantName: string,
    meta?: { distanceKm?: number; isOpen?: boolean; itemCount?: number }
  ) => void;
  onNavigateToCheckout?: (restaurantId: number, restaurantName: string, restaurantAddress?: string, from?: 'home' | 'restaurant') => void;
  /** Opens search; a query (e.g. from voice) is filled in and searched. */
  onNavigateToSearch?: (query?: string) => void;
  onNavigateToLocationSelection?: () => void;
  selectedLocation?: { name: string; address: string; latitude?: number; longitude?: number };
  onCategoriesLoaded?: (categories: CategoryItem[]) => void;
  isFocused?: boolean;
  addressRefreshTrigger?: number; // Trigger to refresh addresses when changed
  onForcedUpdateRequired?: (message?: string) => void; // Callback when API indicates forced update is required
  isGuest?: boolean;
  onNavigateToLogin?: () => void;
  /** Open the Tazty Wallet; pass true to jump straight into Add-money. */
  onNavigateToWallet?: (openAddMoney?: boolean) => void;
  /** Bottom-nav targets. */
  onNavigateToFlix?: () => void;
  onNavigateToOrders?: () => void;
  /** Report Flix availability up so the pager can block the swipe when off. */
  onFlixEnabledChange?: (enabled: boolean) => void;
  onFlixIntroEnabledChange?: (enabled: boolean) => void;
  /** Open the ₹99 Store page (hero tap or "See all"). */
  onNavigateToStore?: () => void;
}

interface CarouselItem {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  buttonColor?: string;
  imageUrl?: string;
  sequence?: number;
  // Mirrors BannerItem.promotion_type. 'promo_offer' banners are created
  // automatically when an offer is published and carry the offer id in
  // promotionLink.
  promotionType?: 'restaurant_id' | 'category_id' | 'url' | 'organization' | 'promo_offer';
  promotionLink?: string;
  backgroundColor?: string;
  /** Set when the banner is a video banner; plays only while its slide is on screen. */
  videoUrl?: string;
}

/** A video slide stays up this long (the panel caps clips at 10 s) before auto-advancing. */
const VIDEO_SLIDE_MS = 10000;
const IMAGE_SLIDE_MS = 3000;

interface AppOperationStatus {
  is_open: boolean;
  reason?: string;
  message?: string;
  next_open_time?: string;
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



/**
 * Which language the organizational banner is showing.
 *
 * Deliberately banner-scoped: the app itself is not translated, so this must
 * not read as an app-wide language setting.
 */
const BANNER_LANGUAGE_STORAGE_KEY = 'tazty.banner.language';

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onLogout,
  onNavigateToProfile,
  onNavigateToAddressSelection,
  onNavigateToCategory,
  onNavigateToOffer,
  onNavigateToRestaurant,
  onNavigateToCheckout,
  onNavigateToSearch,
  onNavigateToLocationSelection,
  selectedLocation: externalSelectedLocation,
  isGuest = false,
  onNavigateToLogin,
  onNavigateToWallet,
  onNavigateToFlix,
  onNavigateToOrders,
  onFlixEnabledChange,
  onFlixIntroEnabledChange,
  onCategoriesLoaded,
  addressRefreshTrigger,
  isFocused = true,
  onForcedUpdateRequired,
  onNavigateToStore,
}) => {
  const {
    restaurantId,
    restaurantName,
    restaurantLogo,
    getTotalItems,
    flushPendingQuantityUpdate,
    reloadCart,
    setRestaurantInfo,
  } = useCart();
  const { vegMode, setVegMode, isVegModeEnabled } = useVegMode();
  const { showConfirmation } = useConfirmation();
  const { onScroll: hideCartBarOnScroll } = useHideOnScroll(getTotalItems());
  // Bottom nav (Crave · Flix) + Active-orders pill: visible only at the very top.
  const [navAtTop, setNavAtTop] = React.useState(true);
  const navAtTopRef = React.useRef(true);
  const [activeOrderCount, setActiveOrderCount] = React.useState(0);
  // Flix availability (server flag from the home payload); off => grey + toast.
  const [flixEnabled, setFlixEnabled] = React.useState(true);
  const { showSnackbar } = useSnackbar();

  // Live count of the customer's in-progress orders for the "Active orders" pill.
  React.useEffect(() => {
    if (isGuest) {
      setActiveOrderCount(0);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res: any = await ordersService.getOrders();
        const raw = res?.data;
        const arr: any[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.orders)
            ? raw.orders
            : Array.isArray(raw?.data)
              ? raw.data
              : Array.isArray(raw?.data?.orders)
                ? raw.data.orders
                : [];
        const done = ['delivered', 'completed', 'cancelled', 'canceled', 'rejected'];
        const active = arr.filter((o) => {
          const s = String(o?.status ?? o?.order_status ?? '')
            .toLowerCase()
            .replace(/[\s-]+/g, '_');
          return s !== '' && !done.includes(s);
        }).length;
        if (alive) setActiveOrderCount(active);
      } catch {
        /* a failed count must never block home */
      }
    })();
    return () => {
      alive = false;
    };
  }, [isGuest, isFocused]);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const bannerWidth = Math.max(0, windowWidth - 40);
  const [searchSectionBottomY, setSearchSectionBottomY] = React.useState<number>(0);
  const { add: addStoreDeal, addingDealId } = useStoreDealAdd();

  /**
   * ADD on a ₹99 Store card.
   *
   * The deal price, its daily budget and this customer's daily limit are all
   * enforced by the API, so whatever it refuses is shown as it came back. A
   * deal cart is standalone, so an existing cart is cleared only after the
   * customer says so.
   */
  const handleStoreDealAdd = React.useCallback(
    async (deal: StoreDeal, forceClearCart = false) => {
      const outcome = await addStoreDeal(deal, { forceClearCart });

      if (outcome.status === 'needs_login') {
        onNavigateToLogin?.();
        return;
      }

      if (outcome.status === 'needs_cart_clear') {
        showConfirmation({
          title: 'Start a new cart?',
          message:
            '₹99 Store deals are ordered on their own. Your current cart will be cleared.',
          confirmText: 'Clear and add',
          cancelText: 'Keep my cart',
          confirmButtonColor: '#E8501C',
          onConfirm: () => {
            handleStoreDealAdd(deal, true);
          },
        });
        return;
      }

      if (outcome.status === 'unavailable') {
        showConfirmation({
          title: '₹99 Store',
          message: outcome.message,
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#E8501C',
          onConfirm: () => { },
        });
        // Whatever it was, this card's state has moved on.
        const fresh = await storeDealService.getDeals(
          externalSelectedLocation?.latitude,
          externalSelectedLocation?.longitude,
        );
        if (fresh.length) setStoreDeals(fresh);
        return;
      }

      if (outcome.status === 'in_cart') {
        setRestaurantInfo(deal.restaurant_id, deal.restaurant?.name || '');
        await reloadCart();
      }
    },
    [
      addStoreDeal,
      externalSelectedLocation?.latitude,
      externalSelectedLocation?.longitude,
      onNavigateToLogin,
      reloadCart,
      setRestaurantInfo,
      showConfirmation,
    ],
  );

  const [organizationBanners, setOrganizationBanners] = React.useState<OrganizationBanner[]>([]);
  // Top-dash tabs after "Food", from the home payload (admin-managed).
  const [homeTabs, setHomeTabs] = React.useState<HomeTabSummary[]>([]);
  const [foodTabImageUrl, setFoodTabImageUrl] = React.useState<string | null>(null);
  const [foodTabTitle, setFoodTabTitle] = React.useState('Food');
  const [tabShape, setTabShape] = React.useState<TabShapeSpec | null>(null);
  const [woymTitle, setWoymTitle] = React.useState("What's on your mind?");
  // Top-dash theme (festival / season), its night variant and size.
  const [activeTheme, setActiveTheme] = React.useState<ActiveTheme | null>(null);
  // Card Studio global look for the restaurant cards.
  const [cardStyle, setCardStyle] = React.useState<CardStyle>(DEFAULT_CARD_STYLE);
  const [bannerCardsStyle, setBannerCardsStyle] = React.useState<BannerCardsStyle>(DEFAULT_BANNER_CARDS_STYLE);
  const [isNight, setIsNight] = React.useState(isNightNow());
  const [dashSize, setDashSize] = React.useState({ width: 0, height: 0 });
  const [dashOnScreen, setDashOnScreen] = React.useState(true);
  const dashOnScreenRef = React.useRef(true);
  const dashSizeRef = React.useRef(0);
  // Category picked in "What's on your mind?": its dishes and restaurants
  // replace the feed below the row, in place. Back clears it.
  const [selectedWoym, setSelectedWoym] = React.useState<CategoryItem | null>(null);
  const categoriesRowY = React.useRef(0);
  const lastScrollY = React.useRef(0);
  const scrollBeforeWoym = React.useRef<number | null>(null);
  // Restaurant-list filters (filter bar) and their sheets; voice search.
  const [homeFilters, setHomeFilters] = React.useState<HomeFilterState>(EMPTY_FILTERS);
  const homeFiltersRef = React.useRef<HomeFilterState>(EMPTY_FILTERS);
  homeFiltersRef.current = homeFilters;
  const [cuisineOptions, setCuisineOptions] = React.useState<string[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [sortSheetOpen, setSortSheetOpen] = React.useState(false);
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const restaurantsTitleY = React.useRef(0);
  const cardsReloadRef = React.useRef<(() => void) | null>(null);
  const solidTopY = React.useRef(0);
  // Filter bar position, and whether it is pinned (needs status-bar padding).
  const filterBarY = React.useRef(0);
  const filterStuckRef = React.useRef(false);
  const [filterStuck, setFilterStuck] = React.useState(false);
  // Selected top-dash tab; null = Food (the normal home feed). Switching is in
  // place - the tabs and search stay, only the content below changes.
  const [selectedHomeTab, setSelectedHomeTab] = React.useState<HomeTabSummary | null>(null);
  const selectedHomeTabRef = React.useRef<HomeTabSummary | null>(null);
  selectedHomeTabRef.current = selectedHomeTab;
  const [offerBanners, setOfferBanners] = React.useState<Offer[]>([]);
  // ₹99 Store deals. Arrive with the home payload already carrying their
  // state, so the row renders without a request of its own.
  const [storeDeals, setStoreDeals] = React.useState<StoreDeal[]>([]);
  const [restaurantTitles, setRestaurantTitles] = React.useState<string[]>([]);
  const [dealSection, setDealSection] = React.useState<StoreDealSection>(
    DEFAULT_STORE_DEAL_SECTION,
  );
  // Admin-configurable ₹99 section look & motion (separate so the labels type
  // stays unchanged).
  const [dealSectionStyle, setDealSectionStyle] = React.useState<{
    bg?: string | null;
    accent?: string | null;
    anim?: string | null;
    speed?: number | null;
  }>({});
  // Wallet balance for the header pill. null = wallet off / not loaded (pill
  // still shows for guests, who are sent to login on tap).
  const [walletBalance, setWalletBalance] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (isGuest) {
      setWalletBalance(null);
      return;
    }
    let alive = true;
    walletService
      .getSummary()
      .then(s => {
        if (alive && s) setWalletBalance(s.balance ?? 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // Refetch when returning to Home so the balance reflects a just-added top-up.
  }, [isGuest, isFocused]);

  const [activeBannerIndex, setActiveBannerIndex] = React.useState(0);

  // Auto-slide for organization banner. A video banner stays up long enough to
  // play its clip (the panel caps clips at 10 s); image banners every 4 s.
  React.useEffect(() => {
    if (!organizationBanners || organizationBanners.length <= 1) return;
    const current = organizationBanners[activeBannerIndex];
    const isVideo = current?.media_type === 'video' && Boolean(current?.video_url);
    const timeout = setTimeout(() => {
      setActiveBannerIndex(prev => (prev + 1) % organizationBanners.length);
    }, isVideo ? 10000 : 4000);
    return () => clearTimeout(timeout);
  }, [organizationBanners, activeBannerIndex]);
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

  // "Coming soon" waitlist (shown when the area is unserviceable).
  const [waitlistLoading, setWaitlistLoading] = React.useState(false);
  const [waitlistDone, setWaitlistDone] = React.useState(false);
  // First human-readable locality in the address; skips Google plus-codes
  // (e.g. "M3PW+984"), pure numbers and tiny fragments so the message reads
  // naturally ("…reaches Anna Nagar") or falls back to "your area".
  const unserviceableArea = React.useMemo(() => {
    const addr = externalSelectedLocation?.address || '';
    const parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
    const isPlusCode = (s: string) => /[A-Z0-9]{2,}\+[A-Z0-9]{2,}/i.test(s);
    const isJunk = (s: string) => s.length < 3 || /^\d[\d\s/-]*$/.test(s) || isPlusCode(s);
    return parts.find((p) => !isJunk(p));
  }, [externalSelectedLocation?.address]);

  const handleJoinWaitlist = React.useCallback(async () => {
    if (waitlistLoading || waitlistDone) return;
    setWaitlistLoading(true);
    try {
      const res = await waitlistService.submit({
        area: unserviceableArea || externalSelectedLocation?.name,
        address: externalSelectedLocation?.address,
        latitude: externalSelectedLocation?.latitude,
        longitude: externalSelectedLocation?.longitude,
      });
      if (res.success) {
        setWaitlistDone(true);
        showSnackbar({
          message: "Great! We'll let you know the moment Tazty launches here.",
          type: 'success',
        });
      } else {
        showSnackbar({ message: res.error || 'Could not save. Please try again.', type: 'error' });
      }
    } catch {
      showSnackbar({ message: 'Could not save. Please try again.', type: 'error' });
    } finally {
      setWaitlistLoading(false);
    }
  }, [waitlistLoading, waitlistDone, unserviceableArea, externalSelectedLocation, showSnackbar]);

  const handleWaitlistHelp = React.useCallback(() => {
    Linking.openURL(
      'mailto:support@tazty.in?subject=' +
        encodeURIComponent("Tazty isn't in my area yet"),
    ).catch(() => {});
  }, []);

  const handleWaitlistInstagram = React.useCallback(() => {
    Linking.openURL('https://www.instagram.com/tazty.app/').catch(() => {});
  }, []);

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
  // Tracked separately: a video that fails falls back to the banner image, and
  // only a failed image leaves the plain colour.
  const [headerVideoFailed, setHeaderVideoFailed] = React.useState(false);
  const [headerBackgroundLoadFailed, setHeaderBackgroundLoadFailed] = React.useState(false);
  const [bannerLanguage, setBannerLanguage] = React.useState<'en' | 'ta'>('en');

  // Remembered so the choice survives leaving the screen. A read failure is
  // ignored on purpose: no stored preference simply means English.
  React.useEffect(() => {
    AsyncStorage.getItem(BANNER_LANGUAGE_STORAGE_KEY)
      .then((stored) => {
        if (stored === 'ta' || stored === 'en') {
          setBannerLanguage(stored);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleBannerLanguage = React.useCallback(() => {
    setBannerLanguage((current) => {
      const next = current === 'ta' ? 'en' : 'ta';
      AsyncStorage.setItem(BANNER_LANGUAGE_STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  // Derived state for the header display
  const activeOrganizationBanner = organizationBanners.length > 0 ? organizationBanners[activeBannerIndex] : null;
  const homeTopBackgroundColor = activeOrganizationBanner?.background_color || '#FFFFFF';
  const displayBackgroundImageUrl = activeOrganizationBanner?.image_url || '';
  const hasExistingBannerVisual = Boolean(activeOrganizationBanner?.image_url || activeOrganizationBanner?.background_color);

  /**
   * Banner language.
   *
   * The toggle is offered only when the admin actually filled Tamil in - a
   * banner with no Tamil title has nothing to switch to, and a dead control at
   * the very top of the first screen is worse than no control.
   */
  const bannerHasTamil = Boolean(activeOrganizationBanner?.title_ta);
  const bannerIsTamil = bannerHasTamil && bannerLanguage === 'ta';

  const promoTitle = bannerIsTamil
    ? activeOrganizationBanner?.title_ta || ''
    : activeOrganizationBanner?.title || '';
  // Falls back to the English subtitle rather than showing nothing: the admin
  // may have translated the headline and left the line beneath it alone.
  const promoSubtitle = bannerIsTamil
    ? activeOrganizationBanner?.subtitle_ta || activeOrganizationBanner?.subtitle || ''
    : activeOrganizationBanner?.subtitle || '';

  /**
   * Banner appearance, all optional.
   *
   * Every value falls back to what the screen used before these fields
   * existed, so a banner created without them looks exactly as it always did.
   */
  const bannerIsVideo =
    activeOrganizationBanner?.media_type === 'video' &&
    Boolean(activeOrganizationBanner?.video_url);
  // The poster fills this space until the first frame is ready. Without it the
  // top of the home screen would be blank while the video downloads.
  const bannerPosterUrl =
    activeOrganizationBanner?.poster_url || displayBackgroundImageUrl;
  const bannerGradientFrom = activeOrganizationBanner?.gradient_from || null;
  const bannerGradientTo = activeOrganizationBanner?.gradient_to || null;
  const bannerHasGradient = Boolean(bannerGradientFrom && bannerGradientTo);
  const bannerGradientDirection =
    activeOrganizationBanner?.gradient_direction || 'vertical';
  // expo-linear-gradient takes start/end points rather than an angle.
  const bannerGradientStart =
    bannerGradientDirection === 'horizontal'
      ? { x: 0, y: 0.5 }
      : bannerGradientDirection === 'diagonal'
        ? { x: 0, y: 0 }
        : { x: 0.5, y: 0 };
  const bannerGradientEnd =
    bannerGradientDirection === 'horizontal'
      ? { x: 1, y: 0.5 }
      : bannerGradientDirection === 'diagonal'
        ? { x: 1, y: 1 }
        : { x: 0.5, y: 1 };
  /**
   * Typography follows the language, because the families are not
   * interchangeable: none of the Latin ones carry Tamil glyphs.
   *
   * resolveBannerFont translates the family the panel stored into the key the
   * face was actually loaded under, and returns undefined for anything not
   * bundled - React Native does not error on an unknown family, it silently
   * drops to the system font, so passing the raw name through would quietly
   * undo the app's typography instead of showing a problem.
   */
  const bannerFontFamily = bannerIsTamil
    ? activeOrganizationBanner?.font_family_ta
    : activeOrganizationBanner?.font_family;
  const bannerTitleFont = resolveBannerFont(bannerFontFamily, 'bold');
  const bannerSubtitleFont = resolveBannerFont(bannerFontFamily, 'regular');
  // Tamil sizes are optional; unset means reuse whatever English uses.
  const bannerTitleSize = bannerIsTamil
    ? activeOrganizationBanner?.title_font_size_ta ?? activeOrganizationBanner?.title_font_size
    : activeOrganizationBanner?.title_font_size;
  const bannerSubtitleSize = bannerIsTamil
    ? activeOrganizationBanner?.subtitle_font_size_ta ?? activeOrganizationBanner?.subtitle_font_size
    : activeOrganizationBanner?.subtitle_font_size;

  const bannerTitleStyle = {
    ...(bannerTitleFont ? { fontFamily: bannerTitleFont } : {}),
    ...(bannerTitleSize ? { fontSize: Number(bannerTitleSize) } : {}),
    ...(activeOrganizationBanner?.title_color
      ? { color: activeOrganizationBanner.title_color }
      : {}),
  };
  const bannerSubtitleStyle = {
    ...(bannerSubtitleFont ? { fontFamily: bannerSubtitleFont } : {}),
    ...(bannerSubtitleSize ? { fontSize: Number(bannerSubtitleSize) } : {}),
    ...(activeOrganizationBanner?.subtitle_color
      ? { color: activeOrganizationBanner.subtitle_color }
      : {}),
  };

  // Top-dash data: category shortcuts beside "Food", restaurant banners in
  // the hero, and the home (org) banners as image/video cards.
  // Admin-created tabs only (home_tabs); Food is fixed in ServiceTabs.
  const topDashTabs = React.useMemo<TopDashTab[]>(
    () =>
      homeTabs.map(t => ({ id: t.id, title: t.title, imageUrl: t.image_url })),
    [homeTabs],
  );
  // Admin changed the tabs or their shape: a silent push arrives, reload
  // just the tab settings (no full home reload). Bursts are coalesced.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sub = DeviceEventEmitter.addListener(HOME_CONFIG_EVENT, (data: any) => {
      // Card Studio change: reload the restaurant list (style + overrides).
      if (data?.what === 'cards') {
        cardsReloadRef.current?.();
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const cfg = await homeTabService.getActive();
        if (!cfg) return;
        setHomeTabs(cfg.tabs);
        if (cfg.food_title) setFoodTabTitle(cfg.food_title);
        setFoodTabImageUrl(cfg.food_image_url || null);
        setTabShape(cfg.shape || null);
        const t = await homeThemeService.getActive(themeAddressRef.current);
        if (t) setActiveTheme(t);
        // Banner boxes (Banner Cards Studio, or the live theme's own style).
        try {
          const params: Record<string, string> = {};
          if (themeAddressRef.current) params.city = themeAddressRef.current.slice(0, 200);
          let node: any = await apiService.get('/banner-cards/style', params);
          for (let i = 0; i < 4 && node && !node.style; i++) node = node.data;
          if (node?.style) setBannerCardsStyle(normalizeBannerCardsStyle(node.style));
        } catch {
          // keep the current style
        }
        if ((cfg as any).woym_title) setWoymTitle((cfg as any).woym_title);
      }, 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, []);

  // A tab the admin removed or hid drops the selection back to Food.
  React.useEffect(() => {
    if (selectedHomeTab && !homeTabs.some(t => t.id === selectedHomeTab.id)) {
      setSelectedHomeTab(null);
    }
  }, [homeTabs, selectedHomeTab]);

  // Hardware back on a selected tab returns to Food instead of leaving Home.
  React.useEffect(() => {
    if (!selectedHomeTab || !isFocused) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedHomeTab(null);
      return true;
    });
    return () => sub.remove();
  }, [selectedHomeTab, isFocused]);

  React.useEffect(() => {
    if (!selectedWoym || !isFocused) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedWoym(null);
      return true;
    });
    return () => sub.remove();
  }, [selectedWoym, isFocused]);

  React.useEffect(() => {
    if (selectedWoym) {
      if (categoriesRowY.current > 0) {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, categoriesRowY.current - 60), animated: true });
      }
      return;
    }
    // Back from a category: return to exactly where the user was.
    const y = scrollBeforeWoym.current;
    if (y !== null) {
      scrollBeforeWoym.current = null;
      requestAnimationFrame(() => scrollViewRef.current?.scrollTo({ y, animated: false }));
    }
  }, [selectedWoym]);

  const handleSelectHomeTab = React.useCallback((tab: TopDashTab | null) => {
    setSelectedHomeTab(
      tab ? { id: tab.id, title: tab.title, image_url: tab.imageUrl ?? null } : null,
    );
    setSelectedWoym(null);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const heroSlides = React.useMemo<HeroSlide[]>(
    () =>
      carouselData.map(c => ({
        id: c.id,
        imageUrl: c.imageUrl,
        videoUrl: c.videoUrl,
        title: c.title,
        backgroundColor: c.backgroundColor,
      })),
    [carouselData],
  );
  const orgCards = React.useMemo<OrgCard[]>(
    () =>
      organizationBanners.map((b, i) => {
        const isVideo = b.media_type === 'video' && Boolean(b.video_url);
        return {
          id: `${i}-${b.title ?? ''}`,
          title: b.title,
          imageUrl: b.image_url,
          videoUrl: isVideo ? b.video_url : undefined,
          posterUrl: b.poster_url,
          backgroundColor: b.background_color,
        };
      }),
    [organizationBanners],
  );

  const shouldShowBadgesRow =
    appOperationStatus?.is_open !== false && (showCategoryShimmer || categoryData.length > 0);

  // Every banner gets a fresh try. This used to reset only when the legacy
  // background URL changed, so one failed load (a video, or a single image on
  // a weak connection) blanked the media of every banner until the app was
  // restarted.
  React.useEffect(() => {
    setHeaderBackgroundLoadFailed(false);
    setHeaderVideoFailed(false);
  }, [homeBackgroundImageUrl, activeBannerIndex, displayBackgroundImageUrl, activeOrganizationBanner?.video_url]);

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

            // Fetch home data. Prefer an explicitly selected location's
            // coordinates (e.g. the current GPS location resolved at launch) so
            // the restaurants shown match the displayed location; otherwise use
            // the saved default address's coordinates. On an explicit override
            // (address delete/edit) always use the saved default.
            const useExternalCoords =
              !options?.overrideSelectedLocation &&
              typeof externalSelectedLocation?.latitude === 'number' &&
              typeof externalSelectedLocation?.longitude === 'number';
            // Clear data first to prevent showing stale cached data
            setRestaurantData([]);
            setCarouselData([]);
            setCategoryData([]);
            await fetchHomeData(
              useExternalCoords ? externalSelectedLocation!.latitude! : defaultAddress.latitude,
              useExternalCoords ? externalSelectedLocation!.longitude! : defaultAddress.longitude,
            );
          } else {
            // No default address. Prefer an explicitly selected location (e.g.
            // the current GPS location resolved at launch); otherwise fall back
            // to the default Madurai location.
            setHasDefaultAddress(false);
            const hasExternalCoords =
              typeof externalSelectedLocation?.latitude === 'number' &&
              typeof externalSelectedLocation?.longitude === 'number';
            if (externalSelectedLocation?.name && externalSelectedLocation?.address) {
              setSelectedLocation(externalSelectedLocation);
            } else {
              setSelectedLocation({
                name: DEFAULT_LOCATION.name,
                address: DEFAULT_LOCATION.address,
              });
            }

            setRestaurantData([]);
            setCarouselData([]);
            setCategoryData([]);
            await fetchHomeData(
              hasExternalCoords ? externalSelectedLocation!.latitude! : undefined,
              hasExternalCoords ? externalSelectedLocation!.longitude! : undefined,
            );
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

  // Safety: never leave the category shimmer (empty grey circles) stuck on if a
  // load path forgets to clear it — after 8s force it off so the section either
  // shows its data or hides cleanly.
  React.useEffect(() => {
    if (!showCategoryShimmer) return;
    const t = setTimeout(() => setShowCategoryShimmer(false), 8000);
    return () => clearTimeout(t);
  }, [showCategoryShimmer]);

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
        setIsLoadingBanners(false);
        setIsLoadingCategories(false);
        setIsLoadingRestaurants(false);
        return;
      }

      const response = await homeService.getHomeData(lat, lng, vegMode, 1, {
        ...filtersToParams(homeFiltersRef.current),
        ...(themeAddressRef.current ? { city: themeAddressRef.current.slice(0, 200) } : {}),
      });

      // Check if API indicates forced update is required
      // Response format: { success: false, statusCode: 426, message: "Please update your app..." }
      if (!response.success && response.statusCode === 426) {
        // Show forced update modal
        if (onForcedUpdateRequired) {
          onForcedUpdateRequired(response.message);
        }
        // Stop loading and don't process data
        setIsLoadingBanners(false);
        setIsLoadingCategories(false);
        setIsLoadingRestaurants(false);
        return;
      }

      if (response.success && response.data) {
        // The API returns data nested as: { data: { data: { promotional_banner: {...} } } }
        const actualData = (response.data as any).data || response.data;
        const promotionalBanner = actualData.promotional_banner;
        const whatsOnYourMind = actualData.whats_on_your_mind;
        const nearbyRestaurants = actualData.nearby_restaurants;
        const pagination = actualData.pagination;
        const appOperationStatusData = actualData.app_operation_status;
        const codSettings = actualData.cod_settings;

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
        const homeTabsRaw = (actualData as any).home_tabs;
        setHomeTabs(Array.isArray(homeTabsRaw) ? homeTabsRaw : []);
        setFoodTabImageUrl((actualData as any).home_food_tab_image_url || null);
        setFoodTabTitle((actualData as any).home_food_tab_title || 'Food');
        setTabShape((actualData as any).home_tab_shape || null);
        const cardStyleRaw = (actualData as any).restaurant_card_style;
        if (cardStyleRaw) setCardStyle(normalizeCardStyle(cardStyleRaw));
        const bannerStyleRaw = (actualData as any).banner_cards_style;
        if (bannerStyleRaw) setBannerCardsStyle(normalizeBannerCardsStyle(bannerStyleRaw));
        const themeRaw = (actualData as any).home_theme;
        if (themeRaw) setActiveTheme(parseActiveTheme(themeRaw));
        if ((actualData as any).whats_on_your_mind_title) {
          setWoymTitle((actualData as any).whats_on_your_mind_title);
        }
        const cuisinesRaw = (actualData as any).restaurant_filter_options?.cuisines;
        if (Array.isArray(cuisinesRaw)) setCuisineOptions(cuisinesRaw);

        const orgBannerRaw = (actualData as any).organization_banner;
        if (orgBannerRaw && Array.isArray(orgBannerRaw)) {
          setOrganizationBanners(orgBannerRaw);
        } else {
          setOrganizationBanners([]);
        }

        // Live promo offers. Already clock-filtered server-side, so whatever
        // arrives here is claimable right now — no expiry logic in the app.
        const offerBannerRaw = (actualData as any).offer_banner;
        setOfferBanners(
          Array.isArray(offerBannerRaw) ? (offerBannerRaw as Offer[]) : [],
        );

        // ₹99 Store deals, already filtered and state-stamped server-side.
        const storeDealsRaw = (actualData as any).store_deals;
        setStoreDeals(
          Array.isArray(storeDealsRaw) ? (storeDealsRaw as StoreDeal[]) : [],
        );

        // Admin-editable rotating titles for the restaurants section.
        const titlesRaw = (actualData as any).restaurants_section_titles;
        setRestaurantTitles(
          Array.isArray(titlesRaw) && titlesRaw.length
            ? titlesRaw.filter((t: any) => typeof t === 'string' && t.trim())
            : [],
        );

        // Flix availability flag (server-controlled). Absent → default on.
        const flix = (actualData as any).flix;
        if (flix && typeof flix.enabled === 'boolean') {
          setFlixEnabled(flix.enabled);
          onFlixEnabledChange?.(flix.enabled);
        }
        if (flix && typeof flix.intro_enabled === 'boolean') {
          onFlixIntroEnabledChange?.(flix.intro_enabled);
        }

        // Editable ₹99 Store labels (name/tagline/row title).
        const sectionRaw = (actualData as any).store_deal_section;
        if (sectionRaw && typeof sectionRaw === 'object') {
          setDealSection({
            name: sectionRaw.name || DEFAULT_STORE_DEAL_SECTION.name,
            tagline: sectionRaw.tagline || DEFAULT_STORE_DEAL_SECTION.tagline,
            home_title:
              sectionRaw.home_title || DEFAULT_STORE_DEAL_SECTION.home_title,
            hero_image_url: heroMediaUrl(sectionRaw.hero_image_url),
            hero_video_url: heroMediaUrl(sectionRaw.hero_video_url),
          });
          setDealSectionStyle({
            bg: sectionRaw.bg_color || null,
            accent: sectionRaw.accent_color || null,
            anim: sectionRaw.anim_style || null,
            speed: typeof sectionRaw.anim_speed === 'number' ? sectionRaw.anim_speed : null,
          });
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
            // The poster doubles as the slide image, so a video banner never
            // shows an empty slide while its clip loads (or if it fails).
            imageUrl: banner.image_url || banner.poster_url || banner.banner_url,
            videoUrl:
              banner.media_type === 'video' && banner.video_url ? banner.video_url : undefined,
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
              gallery: Array.isArray(restaurant.gallery) ? restaurant.gallery : undefined,
              offerLabel: restaurant.offer_label ?? null,
              card: restaurant.card ?? null,
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
  // With { reset: true } this reloads page 1 (filters changed) and replaces
  // the list; otherwise it appends the next page.
  const loadMoreRestaurants = React.useCallback(async (opts?: { reset?: boolean }) => {
    const reset = !!opts?.reset;
    // Don't load if already loading, no more data, or initial load is still in progress
    if (!reset && (isLoadingMore || !hasMoreRestaurants || isLoadingRestaurants)) {
      return;
    }

    try {
      if (reset) setIsLoadingRestaurants(true);
      else setIsLoadingMore(true);

      const nextPage = reset ? 1 : currentPage + 1;
      const coords = defaultAddressCoords || { latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude };

      const response = await homeService.getHomeData(
        coords.latitude,
        coords.longitude,
        vegMode,
        nextPage,
        filtersToParams(homeFiltersRef.current),
      );

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
        if (reset && actualData.restaurant_card_style) {
          setCardStyle(normalizeCardStyle(actualData.restaurant_card_style));
        }

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
              isFavorite: restaurant.is_favorite || false,
              isVeg: restaurant.is_veg || restaurant.dietary_preference === 'veg' || false,
              timings: timings,
              isOpen: isOpen,
              gallery: Array.isArray(restaurant.gallery) ? restaurant.gallery : undefined,
              offerLabel: restaurant.offer_label ?? null,
              card: restaurant.card ?? null,
            };
          });

          // Append new restaurants to existing list with deduplication
          setNoRestaurantsFound(false);
          setRestaurantData(prevData => {
            const combined = [...(reset ? [] : prevData), ...transformedRestaurants];
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
          if (reset) {
            setRestaurantData([]);
            setNoRestaurantsFound(true);
          }
        }
      } else {
        setHasMoreRestaurants(false);
      }
    } catch (error) {
      setHasMoreRestaurants(false);
    } finally {
      setIsLoadingMore(false);
      if (reset) setIsLoadingRestaurants(false);
    }
  }, [isLoadingMore, hasMoreRestaurants, isLoadingRestaurants, currentPage, defaultAddressCoords, vegMode]);

  cardsReloadRef.current = () => loadMoreRestaurants({ reset: true });

  // Filter bar: apply, reload the list, and bring it into view.
  const applyHomeFilters = React.useCallback((next: HomeFilterState) => {
    homeFiltersRef.current = next;
    setHomeFilters(next);
    loadMoreRestaurants({ reset: true });
    if (restaurantsTitleY.current > 0) {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, restaurantsTitleY.current - 70), animated: true });
    }
  }, [loadMoreRestaurants]);

  const togglePureVeg = React.useCallback(() => {
    setVegMode(vegMode === 'off' ? 'pure' : 'off', true);
  }, [vegMode, setVegMode]);

  const filtersActive = activeFilterCount(homeFilters) > 0 || vegMode !== 'off';
  const showFilterBar =
    isLocationServiceable && !selectedHomeTab && !selectedWoym && !isLoadingLocation;

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

    // Set up auto-slide. Re-armed on every slide change (currentSlide is a
    // dependency), so a video slide gets time to play its clip.
    const slideMs = carouselData[currentSlide]?.videoUrl ? VIDEO_SLIDE_MS : IMAGE_SLIDE_MS;
    autoSlideTimerRef.current = setInterval(() => {
      if (flatListRef.current) {
        const nextIndex = (currentSlide + 1) % carouselData.length;
        flatListRef.current.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        setCurrentSlide(nextIndex);
      }
    }, slideMs);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoSlideTimerRef.current) {
        clearInterval(autoSlideTimerRef.current);
        autoSlideTimerRef.current = null;
      }
    };
  }, [carouselData, currentSlide]);

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
      case 'promo_offer':
        // Banner auto-created when an offer is published; promotionLink holds
        // the offer id. Guests are diverted to login by onNavigateToOffer,
        // since a claim is tied to a user id.
        {
          const offerId = parseInt(item.promotionLink, 10);
          if (!isNaN(offerId)) {
            onNavigateToOffer?.(offerId);
          }
        }
        break;

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
            onConfirm: () => { },
          });
        });
        break;

      default:
        // Unknown promotion type, do nothing
        break;
    }
  }, [onNavigateToRestaurant, onNavigateToCategory, onNavigateToOffer, showConfirmation]);


  const renderCarouselItem = React.useCallback(({ item, index }: { item: CarouselItem; index: number }) => {
    // Only the slide on screen plays; the rest show their image/poster, so a
    // row of video banners never decodes several clips at once.
    const playVideo = !!item.videoUrl && index === currentSlide;
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

          {playVideo ? (
            <Video
              source={{ uri: item.videoUrl as string }}
              style={[styles.adBannerImage, { width: bannerWidth }]}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted
              useNativeControls={false}
              testID={`banner-video-${item.id}`}
            />
          ) : null}

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
            {item.buttonText ? (
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
  }, [handleBannerCTAClick, windowWidth, bannerWidth, currentSlide]);

  const renderCategoryItem = React.useCallback(({ item }: { item: CategoryItem }) => {
    const imageSource = typeof item.icon === 'string' ? { uri: item.icon } : item.icon;
    const isViewAll = item.id === 'view-all' || item.name === 'View All';
    const isSelected = !!selectedWoym && String(selectedWoym.id) === String(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.categoryBadge,
          selectedWoym && styles.categoryBadgeOnPanel,
          isSelected && styles.categoryBadgeSelected,
        ]}
        testID={`category-${item.id}`}
        onPress={() => {
          if (isViewAll) {
            setShowCategoryModal(true);
          } else {
            setSelectedWoym(prev => {
              if (!prev) scrollBeforeWoym.current = lastScrollY.current;
              return prev && String(prev.id) === String(item.id) ? null : item;
            });
          }
        }}
        activeOpacity={0.7}
      >
        {isSelected && (
          <Svg
            width={WOYM_TAB.width}
            height={WOYM_TAB.height}
            style={styles.woymTabSvg}
            pointerEvents="none"
          >
            <SvgPath d={WOYM_TAB.fill} fill={WOYM_PANEL} />
            <SvgPath
              d={WOYM_TAB.outline}
              fill="none"
              stroke={WOYM_TAB_BORDER}
              strokeWidth={WOYM_STROKE}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}
        <View
          style={[
            styles.categoryBadgeImageWrap,
            isViewAll && styles.categoryBadgeImageWrapViewAll,
            selectedWoym && styles.categoryBadgeImageWrapPanel,
          ]}
        >
          {isViewAll ? (
            <MaterialIcons name="apps" size={30} color="#00B14F" testID={`category-image-${item.id}`} />
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
        <Text
          style={[
            styles.categoryBadgeLabel,
            selectedWoym && !isSelected && styles.categoryBadgeLabelDim,
            isSelected && styles.categoryBadgeLabelSelected,
          ]}
          numberOfLines={1}
          testID={`category-name-${item.id}`}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedWoym]);

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
    lastScrollY.current = scrollY;
    const onScreen = scrollY < Math.max(200, dashSizeRef.current - 40);
    if (onScreen !== dashOnScreenRef.current) {
      dashOnScreenRef.current = onScreen;
      setDashOnScreen(onScreen);
    }

    // Cart pill gets out of the way while the customer browses.
    hideCartBarOnScroll(scrollY);

    // Bottom nav + active-orders pill show ONLY at the very top; the instant the
    // list moves they slide away (nav down, pill right) and return only here.
    const atTop = scrollY < 24;
    if (navAtTopRef.current !== atTop) {
      navAtTopRef.current = atTop;
      setNavAtTop(atTop);
    }
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const contentHeight = event.nativeEvent.contentSize.height;

    // Sync animated value for header background stay-put effect on pull
    scrollYAnimated.setValue(scrollY);

    // Save scroll position for restoration after refresh
    scrollPositionRef.current = scrollY;

    // Category section becomes sticky after header + taller banner + reserved spacer + section title
    const threshold = 520;
    setIsCategorySectionSticky(scrollY > threshold);

    const stuck = filterBarY.current > 0 && scrollY >= filterBarY.current;
    if (stuck !== filterStuckRef.current) {
      filterStuckRef.current = stuck;
      setFilterStuck(stuck);
    }

    // Check if user has scrolled near the bottom (within 500px)
    const distanceFromBottom = contentHeight - (scrollY + layoutHeight);
    const scrollCount = Math.max(0, Math.floor(scrollY / 500));
    if (scrollCount > maxScrollCountTrackedRef.current) {
      maxScrollCountTrackedRef.current = scrollCount;
      analyticsService.logEvent(AnalyticsEvents.RESTAURANT_LIST_VIEWED, {
        restaurant_scroll_count: scrollCount,
      });
    }
    if (distanceFromBottom < 500 && !selectedHomeTabRef.current) {
      if (hasMoreRestaurants && !isLoadingMore && !isLoadingRestaurants) {
        loadMoreRestaurants();
      }
    }
  }, [hasMoreRestaurants, isLoadingMore, isLoadingRestaurants, loadMoreRestaurants]);

  const cardRowHeight =
    (cardStyle.layout === 'split' ? 172 : cardStyle.layout === 'classic' ? Math.round(cardStyle.height * 0.62) + 96 : cardStyle.height) + 10;

  // ---- top-dash theme ----
  const themeAddressRef = React.useRef('');
  themeAddressRef.current = String(externalSelectedLocation?.address || '');
  const themeCfg = activeTheme?.config ?? DEFAULT_THEME_CONFIG;
  const themeColors = React.useMemo(() => effectiveColors(themeCfg, isNight), [themeCfg, isNight]);
  const tabPalette = React.useMemo(() => tabPaletteFrom(themeColors), [themeColors]);
  const themeEngine = useThemeEngine(
    themeCfg,
    !!isFocused && isLocationServiceable && dashOnScreen,
  );
  const greeting = greetingText(themeCfg.greeting, false);
  const roundEdge = themeCfg.edge.preset === 'round';

  // Night colours switch on/off on their own.
  React.useEffect(() => {
    const id = setInterval(() => setIsNight(isNightNow()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // A scheduled theme starts/ends: refetch exactly then.
  React.useEffect(() => {
    const at = activeTheme?.next_change_at ? Date.parse(activeTheme.next_change_at) : NaN;
    if (!Number.isFinite(at)) return;
    const wait = Math.min(Math.max(at - Date.now() + 1500, 1000), 24 * 60 * 60 * 1000);
    const id = setTimeout(async () => {
      const t = await homeThemeService.getActive(themeAddressRef.current);
      if (t) setActiveTheme(t);
    }, wait);
    return () => clearTimeout(id);
  }, [activeTheme?.next_change_at, activeTheme?.version]);

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
      <StatusBar
        barStyle={isLocationServiceable && themeColors.statusBar === 'dark' ? 'dark-content' : 'light-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Top background filler for pull-to-refresh overscroll - Layer 1 (Back) */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_BACKGROUND_HEIGHT, backgroundColor: isLocationServiceable ? themeColors.dashFrom : '#8FC4EE' }}
        pointerEvents="none"
      />

      {/* SafeAreaView and Content - Layer 3 (Front) */}
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          contentContainerStyle={{
            paddingBottom: totalCartItems > 0 ? 100 + insets.bottom : 0
          }}
          // The filter bar (child 1) sticks under the status bar on scroll.
          stickyHeaderIndices={showFilterBar ? [1] : []}
          testID="home-screen"
          alwaysBounceVertical={true}
          overScrollMode="always"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // Off on purpose: with it on, Android left re-shown sections blank
          // until the next scroll (white page after leaving a category).
          removeClippedSubviews={false}
          decelerationRate="normal"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#FFFFFF']}
              tintColor="#FFFFFF"
              progressBackgroundColor={themeColors.accent}
              {...(Platform.OS === 'android' ? { progressViewOffset: insets.top + 30 } : {})}
            />
          }
        >

          {/* Header Content Wrapper */}
          <View style={styles.headerStack} testID="header-stack">
            <View
              style={[
                styles.headerBackground,
                { paddingTop: insets.top + 10, backgroundColor: isLocationServiceable ? themeColors.dashFrom : '#BFE0F5' },
                isLocationServiceable && !roundEdge && styles.headerBackgroundSquare,
              ]}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                dashSizeRef.current = height;
                if (Math.abs(width - dashSize.width) > 1 || Math.abs(height - dashSize.height) > 1) {
                  setDashSize({ width, height });
                }
              }}
              testID="header-background"
            >
              {/* Theme: gradient, art, particles, layers, 3D, tap bursts. */}
              {isLocationServiceable && (
                <ThemedDashBackground
                  cfg={themeCfg}
                  colors={themeColors}
                  engine={themeEngine}
                  width={dashSize.width}
                  height={dashSize.height}
                />
              )}
              {/* Unserviceable area → soft clouds sky behind the header */}
              {!isLocationServiceable && <CloudsSky />}

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
                        <MaterialIcons name="location-on" size={20} color={isLocationServiceable ? themeColors.onDash : '#1E3A52'} />
                        <Text style={[styles.cityName, { color: isLocationServiceable ? themeColors.onDash : '#14232F' }]}>{selectedLocation.name}</Text>
                        <View style={styles.arrowIconWrapper}>
                          <MaterialIcons name="keyboard-arrow-down" size={16} color={isLocationServiceable ? themeColors.onDash : '#1E3A52'} />
                        </View>
                      </View>
                      {/* Address */}
                      <Text
                        style={[styles.addressText, { color: isLocationServiceable ? themeColors.onDash : '#3A5568', opacity: isLocationServiceable ? 0.92 : 1 }]}
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

                    {/* Wallet balance pill with a quick + to add money. */}
                    <View style={styles.walletPill}>
                      <TouchableOpacity
                        style={styles.walletPillMain}
                        onPress={() =>
                          isGuest
                            ? onNavigateToLogin?.()
                            : onNavigateToWallet?.(false)
                        }
                        activeOpacity={0.8}
                        disabled={!isLocationServiceable}
                        testID="home-wallet-pill"
                      >
                        <MaterialIcons
                          name="account-balance-wallet"
                          size={13}
                          color="#00B14F"
                        />
                        <Text style={styles.walletPillText} numberOfLines={1}>
                          {isGuest ? 'Wallet' : formatRupees(walletBalance ?? 0)}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.walletPillAdd}
                        onPress={() =>
                          isGuest
                            ? onNavigateToLogin?.()
                            : onNavigateToWallet?.(true)
                        }
                        activeOpacity={0.8}
                        disabled={!isLocationServiceable}
                        testID="home-wallet-add"
                        accessibilityLabel="Add money to wallet"
                      >
                        <MaterialIcons name="add" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>

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

              {isLocationServiceable && !!greeting && (
                <View style={styles.greetingRow}>
                  <ThemeGreeting
                    text={greeting}
                    color={themeCfg.greeting.color}
                    effect={themeCfg.greeting.effect}
                    time={themeEngine.time}
                  />
                </View>
              )}

              {/* Service tabs: Food (fixed) + tabs the admin created. */}
              {isLocationServiceable && (
                <View style={styles.serviceTabsWrap}>
                  <ServiceTabs
                    tabs={topDashTabs}
                    selectedId={selectedHomeTab?.id ?? null}
                    foodImageUrl={foodTabImageUrl}
                    foodTitle={foodTabTitle}
                    shape={tabShape}
                    palette={tabPalette}
                    onSelect={handleSelectHomeTab}
                  />
                </View>
              )}

              {/* Search Bar and VEG Mode Toggle */}
              <View
                style={styles.searchSection}
                onLayout={(e) => {
                  const { y, height } = e.nativeEvent.layout;
                  setSearchSectionBottomY(y + height);
                }}
              >
                {isLoadingLocation ? (
                  <View style={{ flex: 1 }}>
                    <Shimmer width="100%" height={48} borderRadius={14} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.searchBar,
                      styles.searchBarWhite,
                      isLocationServiceable && { backgroundColor: themeColors.searchBg },
                      !isLocationServiceable && styles.searchBarDisabled
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.searchTapArea}
                      onPress={() => onNavigateToSearch?.()}
                      activeOpacity={0.7}
                      disabled={!isLocationServiceable}
                      testID="home-search-bar"
                    >
                      <MaterialIcons
                        name="search"
                        size={24}
                        color={isLocationServiceable ? themeColors.searchIcon : 'rgba(255, 255, 255, 0.4)'}
                      />
                      <Text
                        style={[
                          styles.searchInput,
                          isLocationServiceable && styles.searchInputDark,
                          isLocationServiceable && { color: themeColors.searchText },
                          !isLocationServiceable && styles.searchInputDisabled
                        ]}
                        numberOfLines={1}
                      >
                        Search Restaurants & foods...
                      </Text>
                    </TouchableOpacity>
                    {/* Voice search: full-screen listening overlay. */}
                    <View style={styles.searchDivider} />
                    <TouchableOpacity
                      style={styles.micButton}
                      onPress={() => setVoiceOpen(true)}
                      disabled={!isLocationServiceable}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Search by voice"
                      testID="home-voice-search"
                    >
                      <MaterialIcons name="mic" size={24} color={themeColors.micColor} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Hero: rotating restaurant banners, then the home (org)
                  banners as small image/video cards - all on the green. */}
              {isLocationServiceable && !selectedHomeTab && (
                <View style={[styles.topDashBleed, styles.orgCardsOnly]}>
                  <BannerCards
                    cards={orgCards}
                    style={bannerCardsStyle}
                    active={!!isFocused && isLocationServiceable && dashOnScreen}
                  />
                </View>
              )}
              {isLocationServiceable && (!!selectedHomeTab || orgCards.length === 0) && (
                <View style={{ height: 16 }} />
              )}

              {isLocationServiceable && (
                <ThemedDashForeground
                  cfg={themeCfg}
                  engine={themeEngine}
                  width={dashSize.width}
                  height={dashSize.height}
                  topInset={insets.top}
                  pageColor={colors.background}
                />
              )}
            </View>

            {/* Rotating restaurant banners: on white, just under the green
                top-dash and above the filter pills. */}
            {isLocationServiceable && !selectedHomeTab && heroSlides.length > 0 && (
              <View style={styles.heroBelowDash}>
                <HeroCarousel
                  slides={heroSlides}
                  onPress={(s) => {
                    const item = carouselData.find(c => c.id === s.id);
                    if (item) handleBannerCTAClick(item);
                  }}
                />
              </View>
            )}
          </View>


          {/* Filter bar: sticky, filters the restaurant list only. */}
          {showFilterBar && (
            <View
              style={[styles.filterBarWrap, filterStuck && { paddingTop: insets.top }]}
              onLayout={(e) => {
                if (!filterStuckRef.current) filterBarY.current = e.nativeEvent.layout.y;
              }}
            >
              <FilterBar
                filters={homeFilters}
                pureVeg={vegMode !== 'off'}
                onChange={applyHomeFilters}
                onTogglePureVeg={togglePureVeg}
                onOpenFilter={() => setFilterSheetOpen(true)}
                onOpenSort={() => setSortSheetOpen(true)}
              />
            </View>
          )}

          {/* Solid background for everything after the header */}
          <View
            style={{ backgroundColor: colors.background, flex: 1 }}
            onLayout={(e) => { solidTopY.current = e.nativeEvent.layout.y; }}
          >

            {/* Unserviceable area → branded "coming soon" + waitlist */}
            {!isLocationServiceable && !isLoadingBanners && !isLoadingCategories && !isLoadingRestaurants && (
              <ComingSoonScreen
                areaName={unserviceableArea}
                onNotify={handleJoinWaitlist}
                notifyLoading={waitlistLoading}
                notified={waitlistDone}
                onHelp={handleWaitlistHelp}
                onInstagram={handleWaitlistInstagram}
              />
            )}

            {/* Ad Banner Carousel or Closed Banner */}
            {/* A selected top-dash tab replaces the Food feed below. */}
            {isLocationServiceable && selectedHomeTab && (
              <HomeTabContent
                tab={selectedHomeTab}
                latitude={externalSelectedLocation?.latitude || defaultAddressCoords?.latitude}
                longitude={externalSelectedLocation?.longitude || defaultAddressCoords?.longitude}
                onOpenRestaurant={(id, name) => onNavigateToRestaurant?.(id, name)}
                isGuest={isGuest}
                onNavigateToLogin={onNavigateToLogin}
              />
            )}

            {isLocationServiceable && !selectedHomeTab && (
              <>
                {/* Categories: large circular food images with a label below,
                    under a "What's on your mind?" title; View All opens the grid. */}
                {shouldShowBadgesRow && (
                  <View
                    style={selectedWoym ? styles.woymPanel : undefined}
                    onLayout={(e) => {
                      categoriesRowY.current = solidTopY.current + e.nativeEvent.layout.y;
                    }}
                  >
                    {!isCategorySectionSticky && (
                      <Text style={[styles.whatsOnTitle, selectedWoym && styles.transparentBg]}>{woymTitle}</Text>
                    )}
                    <View style={[
                      styles.categoryListContainer,
                      selectedWoym && styles.categoryListContainerPanel,
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
                              <Shimmer width={66} height={66} borderRadius={33} backgroundColor="#ECECEC" />
                              <Shimmer width={52} height={11} borderRadius={6} backgroundColor="#ECECEC" style={styles.categoryBadgeShimmerText} />
                            </View>
                          ))}
                        </ScrollView>
                      ) : (
                        <>
                        {selectedWoym && <View style={styles.woymRowLine} pointerEvents="none" />}
                        <FlatList
                          data={categoryData}
                          renderItem={renderCategoryItem}
                          keyExtractor={(item) => item.id.toString()}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={[
                            styles.categoryListContent,
                            selectedWoym && styles.categoryListContentPanel,
                          ]}
                          extraData={selectedWoym}
                          testID="category-list"
                        />
                        </>
                      )}
                    </View>
                  </View>
                )}

                {/* A picked category: its dishes + restaurants, in place of
                    the feed below. */}
                {selectedWoym && (
                  <LinearGradient
                    colors={[WOYM_PANEL, '#F4FBF6', colors.background]}
                    locations={[0, 0.3, 0.55]}
                  >
                  <CategoryResultsBody
                    categoryId={selectedWoym.id}
                    categoryName={selectedWoym.name}
                    latitude={externalSelectedLocation?.latitude || defaultAddressCoords?.latitude}
                    longitude={externalSelectedLocation?.longitude || defaultAddressCoords?.longitude}
                    onNavigateToRestaurant={(id, name) => onNavigateToRestaurant?.(id, name)}
                    isGuest={isGuest}
                    onNavigateToLogin={onNavigateToLogin}
                  />
                  </LinearGradient>
                )}

                {/* The normal feed stays mounted (hidden) while a category is
                    open, so Back shows it instantly with its state intact. */}
                <View style={selectedWoym ? styles.feedHidden : undefined}>
                {/* ₹99 Store: placed right after "What's on your mind?".
                    Renders nothing when there are no live deals. */}
                <StoreDealsSection
                  deals={storeDeals}
                  addingDealId={addingDealId}
                  onAdd={deal => handleStoreDealAdd(deal)}
                  onOpenStore={deal =>
                    onNavigateToRestaurant?.(
                      deal.restaurant_id,
                      deal.restaurant?.name ?? '',
                    )
                  }
                  onSeeAll={() => onNavigateToStore?.()}
                  sectionName={dealSection.name}
                  tagline={dealSection.tagline}
                  homeTitle={dealSection.home_title}
                  heroImageUrl={dealSection.hero_image_url ?? null}
                  heroVideoUrl={dealSection.hero_video_url ?? null}
                  bgColor={dealSectionStyle.bg}
                  accentColor={dealSectionStyle.accent}
                  animStyle={dealSectionStyle.anim}
                  animSpeed={dealSectionStyle.speed}
                />

                {/* The reason the app is closed. Everything below this is
                    hidden while closed, so without it a buyer just sees an
                    emptier home screen and no explanation - the message only
                    reached them if they got as far as trying to order. */}
                {appOperationStatus?.is_open === false && !!appOperationStatus?.message && (
                  <View style={styles.appClosedNotice} testID="home-app-closed-notice">
                    <Text style={styles.appClosedTitle}>Currently closed</Text>
                    <Text style={styles.appClosedMessage}>
                      {appOperationStatus.message}
                    </Text>
                  </View>
                )}

                {/* Limited-slot offers, pinned below the shop banners.
                    Renders nothing when there are none. */}
                <OfferBannerSection
                  offers={offerBanners}
                  onOfferPress={offer => onNavigateToOffer?.(offer.id)}
                />

                {/* Restaurants Near You Section - Only show if there's data, still loading, or error states */}
                {(showRestaurantShimmer || restaurantData.length > 0 || noRestaurantsFound || hasNetworkError) && (
                  <View
                    style={styles.restaurantsSectionTitleContainer}
                    onLayout={(e) => {
                      restaurantsTitleY.current = solidTopY.current + e.nativeEvent.layout.y;
                    }}
                  >
                    <LinearGradient
                      colors={['rgba(0, 0, 0, 0)', '#000000']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.restaurantsTitleLine}
                    />
                    <RotatingTitle titles={restaurantTitles} textStyle={styles.restaurantsTitle} />
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
                    ) : noRestaurantsFound && filtersActive ? (
                      <View style={styles.noRestaurantsContainer} testID="filters-no-results">
                        <MaterialIcons name="filter-alt-off" size={56} color="rgba(0, 0, 0, 0.2)" />
                        <Text style={styles.noRestaurantsTitle}>No restaurants match</Text>
                        <Text style={styles.noRestaurantsMessage}>
                          Try removing a filter or two to see more places.
                        </Text>
                        <TouchableOpacity
                          style={styles.retryButton}
                          onPress={() => {
                            if (vegMode !== 'off') setVegMode('off', true);
                            applyHomeFilters(EMPTY_FILTERS);
                          }}
                          activeOpacity={0.7}
                          testID="filters-clear-empty"
                        >
                          <Text style={styles.retryButtonText}>Clear filters</Text>
                        </TouchableOpacity>
                      </View>
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
                          Unable to load restaurants. Please try these steps:
                        </Text>
                        {/* Hardcoded self-help guidance before contacting support. */}
                        <View style={styles.networkErrorSteps}>
                          <Text style={styles.networkErrorStep}>
                            1. Check your network connection
                          </Text>
                          <Text style={styles.networkErrorStep}>
                            2. Once try logout and login
                          </Text>
                          <Text style={styles.networkErrorStep}>
                            3. If the above two don't work, contact Tazty support
                          </Text>
                          <TouchableOpacity
                            style={styles.supportPhoneRow}
                            onPress={() => Linking.openURL('tel:9952520699')}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="Call Tazty support"
                            testID="network-error-support-phone"
                          >
                            <MaterialIcons name="call" size={16} color="#00B14F" />
                            <Text style={styles.supportPhoneText}>9952520699</Text>
                          </TouchableOpacity>
                        </View>
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
                              layoutMode={4}
                              cardStyle={cardStyle}
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
                              onShowSimilar={() => {
                                const cuisine = String(restaurant.cuisine || '')
                                  .split(',')[0]
                                  .trim();
                                if (cuisine && onNavigateToCategory) {
                                  onNavigateToCategory(cuisine);
                                }
                              }}
                            />
                          </View>
                        )}
                        keyExtractor={(restaurant) => restaurant.id.toString()}
                        scrollEnabled={false}
                        removeClippedSubviews={false}
                        maxToRenderPerBatch={3}
                        windowSize={3}
                        initialNumToRender={2}
                        updateCellsBatchingPeriod={100}
                        getItemLayout={(data, index) => ({
                          // Card height from the Card Studio style + row gap.
                          length: cardRowHeight,
                          offset: cardRowHeight * index,
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
                </View>
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

      <FilterSheet
        visible={filterSheetOpen}
        value={homeFilters}
        pureVeg={vegMode !== 'off'}
        cuisines={cuisineOptions}
        onClose={() => setFilterSheetOpen(false)}
        onApply={(next, veg) => {
          if (veg !== (vegMode !== 'off')) setVegMode(veg ? 'pure' : 'off', true);
          applyHomeFilters(next);
        }}
      />
      <SortSheet
        visible={sortSheetOpen}
        value={homeFilters.sort}
        onClose={() => setSortSheetOpen(false)}
        onPick={(sort) => applyHomeFilters({ ...homeFilters, sort })}
      />
      <VoiceSearchOverlay
        visible={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onResult={(text) => {
          setVoiceOpen(false);
          onNavigateToSearch?.(text);
        }}
      />

      {/* View Cart Bar - shows when cart has items and location is serviceable */}
      {isLocationServiceable && (
        <ViewCartBar
          // Keep the cart pinned on Home so it's always reachable; it goes broad
          // when scrolled. Compact + lifted above the Crave/Flix pills at the top
          // so it never collides with them.
          hidden={false}
          compact={navAtTop}
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

      {/* Floating bottom overlay: Crave·Active-orders pill + Flix pill (top-only).
          Hidden in unserviceable areas — no Crave and no Flix there. */}
      {isLocationServiceable && (
        <BottomNav
          atTop={navAtTop}
          activeOrderCount={activeOrderCount}
          onActiveOrders={() => onNavigateToOrders?.()}
          flixEnabled={flixEnabled}
          onFlix={() => onNavigateToFlix?.()}
          onFlixSuspended={() =>
            showSnackbar({ message: 'Flix is suspended right now', type: 'info' })
          }
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
    paddingBottom: 6,
    gap: 8,
    minHeight: 180,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
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
    fontFamily: 'Poppins_600SemiBold',
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
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    lineHeight: 34,
    color: '#FFFFFF',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9F9F0',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#BdEBD1',
    paddingLeft: 8,
    paddingRight: 3,
    height: 30,
  },
  walletPillMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingRight: 5,
  },
  walletPillText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: 0.2,
    color: '#0B7A3B',
    maxWidth: 62,
  },
  walletPillAdd: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00B14F',
    alignItems: 'center',
    justifyContent: 'center',
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
  // The top-dash pieces size themselves to the window, so they step out of
  // the header's 20px side padding.
  serviceTabsWrap: { marginHorizontal: -20, marginTop: 2 },
  topDashBleed: { marginHorizontal: -20, marginTop: -4 },
  orgCardsOnly: { marginTop: 2 },
  heroBelowDash: { backgroundColor: colors.background, paddingTop: 4 },
  // Themed edges (wave/scallop/zigzag/flat) draw their own bottom shape.
  headerBackgroundSquare: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  greetingRow: { marginTop: 2, marginBottom: -2, alignItems: 'flex-start' },
  searchBarWhite: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#003D1C',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInputDark: { color: '#8A8A8A', letterSpacing: 0.1 },
  searchTapArea: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E5E3',
    marginHorizontal: 10,
  },
  micButton: { height: '100%', justifyContent: 'center', paddingLeft: 2 },
  filterBarWrap: { backgroundColor: '#FFFFFF' },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 48,
    gap: 11,
    marginTop: 6,
  },
  searchBar: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 14,
    gap: 0,
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
  appClosedNotice: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#FFF4E5',
    borderWidth: 1,
    borderColor: '#F5C983',
  },
  appClosedTitle: {
    fontFamily: 'Poppins',
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: 0.1,
    color: '#8A5200',
    marginBottom: 4,
  },
  appClosedMessage: {
    fontFamily: 'Poppins',
    fontSize: 13,
    fontWeight: 400,
    letterSpacing: 0.1,
    lineHeight: 19,
    color: '#6B4A15',
  },
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
  bannerLanguageToggle: {
    position: 'absolute',
    top: 8,
    right: 16,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  bannerLanguageText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.2,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  bannerLanguageTamilText: {
    // Poppins has no Tamil glyphs, so even this one-letter label needs a
    // Tamil face or the phone substitutes one of its own.
    fontFamily: 'NotoSansTamil_400Regular',
  },
  bannerLanguageTextActive: {
    color: '#FFFFFF',
  },
  bannerLanguageDivider: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: 400,
    letterSpacing: 0.2,
    color: 'rgba(255, 255, 255, 0.45)',
    marginHorizontal: 6,
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
    fontFamily: 'Poppins_600SemiBold',
    // fontWeight: '700',
    fontSize: 36,
    lineHeight: 44,
    color: '#FFFFFF',
    marginTop: 2,
    marginBottom: 2,
  },
  adDescription: {
    width: '88%',
    fontFamily: 'Poppins_500Medium',
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
  whatsOnTitle: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: -0.2,
    color: '#14181B',
    backgroundColor: '#FFFFFF',
    paddingLeft: 20,
    paddingTop: 12,
    paddingBottom: 2,
  },
  categoryListContainer: {
    width: '100%',
    minHeight: 96,
    paddingLeft: 20,
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: 10,
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
    flexDirection: 'column',
    alignItems: 'center',
    width: 78,
    marginRight: 6,
  },
  categoryBadgeImageWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryBadgeImageWrapViewAll: {
    backgroundColor: '#E7F7EE',
    borderColor: '#CDEBD6',
  },
  categoryBadgeImage: {
    width: '100%',
    height: '100%',
  },
  // "What's on your mind?" with a category picked: one tinted panel, the
  // picked item a folder tab opening into the results (reference style).
  woymPanel: { backgroundColor: WOYM_PANEL },
  transparentBg: { backgroundColor: 'transparent' },
  feedHidden: { display: 'none' },
  categoryListContainerPanel: {
    backgroundColor: 'transparent',
    paddingBottom: 0,
    paddingLeft: 0,
  },
  // Inside the list so the first tab's flared corner is not clipped.
  categoryListContentPanel: { paddingLeft: 20, alignItems: 'flex-end' },
  woymRowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: WOYM_STROKE,
    backgroundColor: WOYM_TAB_BORDER,
  },
  categoryBadgeOnPanel: {
    width: WOYM_ITEM_W,
    height: WOYM_ITEM_H,
    marginRight: 4,
    paddingTop: 10,
    justifyContent: 'flex-start',
  },
  // Above its neighbours so the flared corners draw over the gaps.
  categoryBadgeSelected: { zIndex: 2 },
  woymTabSvg: {
    position: 'absolute',
    left: -WOYM_FLARE,
    top: 0,
  },
  categoryBadgeImageWrapPanel: {
    backgroundColor: '#F6FCF8',
    borderColor: 'rgba(255,255,255,0.9)',
  },
  categoryBadgeLabelDim: { fontWeight: '500', color: '#3B4540' },
  categoryBadgeLabelSelected: { color: '#0A7A3C', fontWeight: '700' },
  categoryBadgeLabel: {
    marginTop: 8,
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 15,
    color: '#14181B',
    textAlign: 'center',
    maxWidth: 78,
  },
  categoryBadgeShimmer: {
    flexDirection: 'column',
    alignItems: 'center',
    width: 78,
    marginRight: 6,
  },
  categoryBadgeShimmerText: {
    marginTop: 8,
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
    marginBottom: 14,
  },
  networkErrorSteps: {
    alignSelf: 'stretch',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 6,
  },
  networkErrorStep: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: 'rgba(0, 0, 0, 0.65)',
  },
  supportPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    paddingLeft: 16,
  },
  supportPhoneText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    letterSpacing: 0.2,
    color: '#00B14F',
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
