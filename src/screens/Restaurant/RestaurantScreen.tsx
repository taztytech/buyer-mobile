import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
  Dimensions,
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  BackHandler,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiService } from '@/services/api.service';
import { homeService } from '@/services/home.service';
import { addressService } from '@/services/address.service';
import { Shimmer } from '@/components/Shimmer';
import { OptimizedImage } from '@/components/OptimizedImage';
import { CustomizationModal } from '@/components/CustomizationModal';
import { AppFooter } from '@/components/AppFooter';
import { CustomisationsReviewModal } from '@/components/CustomisationsReviewModal';
import { FoodItemDetailModal } from '@/components/FoodItemDetailModal';
import { FilterState } from '@/components/FilterModal';
import { OrderSuccessScreen } from '@/screens/Order/OrderSuccessScreen';
import { SearchScreen } from './SearchScreen';
import { useCart } from '@/context/CartContext';
import { useVegMode } from '@/context/VegModeContext';
import { favoritesService } from '@/services/favorites.service';
import { useConfirmation } from '@/context/ConfirmationContext';
import { ItemTiming as ImportedItemTiming, isItemAvailable } from '@/utils/timing.utils';
import { MAX_ITEM_QUANTITY } from '@/constants/cart.constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Format time difference in a user-friendly way
 * @param minutes - Time difference in minutes
 * @returns User-friendly time string (e.g., "in 1 min", "in 2 hrs 15 min", "in 3 days")
 */
const formatTimeDifference = (minutes: number): string => {
  if (minutes < 60) {
    return `in ${minutes} min`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `in ${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
    } else {
      return `in ${hours} ${hours === 1 ? 'hr' : 'hrs'} ${remainingMinutes} min`;
    }
  } else {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    const remainingMinutes = minutes % 60;

    if (remainingHours === 0 && remainingMinutes === 0) {
      return `in ${days} ${days === 1 ? 'day' : 'days'}`;
    } else if (remainingMinutes === 0) {
      return `in ${days} ${days === 1 ? 'day' : 'days'} ${remainingHours} ${remainingHours === 1 ? 'hr' : 'hrs'}`;
    } else if (remainingHours === 0) {
      return `in ${days} ${days === 1 ? 'day' : 'days'} ${remainingMinutes} min`;
    } else {
      return `in ${days} ${days === 1 ? 'day' : 'days'} ${remainingHours} ${remainingHours === 1 ? 'hr' : 'hrs'} ${remainingMinutes} min`;
    }
  }
};

/**
 * Get the next available time slot from item timings (only for today)
 * Returns only today's upcoming time slot with time difference
 */
/**
 * Check if item has any timing slots for today (regardless of current time)
 */
const hasTimingForToday = (timings?: ItemTiming[]): boolean => {
  if (!timings || timings.length === 0) return false;

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
  const currentApiDay = currentDay === 0 ? 1 : currentDay + 1;

  return timings.some(timing => {
    if (timing.day_from <= timing.day_to) {
      // Normal range (e.g., Mon-Fri)
      return timing.day_from <= currentApiDay && currentApiDay <= timing.day_to;
    } else {
      // Wraps around week (e.g., Sat-Sun)
      return currentApiDay >= timing.day_from || currentApiDay <= timing.day_to;
    }
  });
};

const getNextAvailableTime = (timings?: ItemTiming[]): { timeDifference?: string; availableTime?: string; hoursRemaining?: number; minutesRemaining?: number; hasTodaySlot: boolean } | null => {
  if (!timings || timings.length === 0) return null;

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
  const currentTime = now.getHours() * 100 + now.getMinutes(); // HHMM format

  // Convert JS day (0-6) to API day format (1-7)
  const currentApiDay = currentDay === 0 ? 1 : currentDay + 1;

  // Check if item has any timing for today
  const hasTodaySlot = hasTimingForToday(timings);

  // Only find today's slots that haven't started yet
  const todaySlots: Array<{ day: number; timeFrom: number; timeTo: number; originalTiming: ItemTiming }> = [];

  timings.forEach(timing => {
    const timeFrom = parseInt(timing.time_from, 10);
    const timeTo = parseInt(timing.time_to, 10);

    // Check if timing is for today
    if (timing.day_from <= timing.day_to) {
      // Normal range (e.g., Mon-Fri)
      for (let day = timing.day_from; day <= timing.day_to; day++) {
        const isToday = day === currentApiDay;

        if (isToday && timeFrom > currentTime) {
          // Today, but time hasn't started yet
          todaySlots.push({ day, timeFrom, timeTo, originalTiming: timing });
        }
      }
    } else {
      // Wraps around week (e.g., Sat-Sun)
      for (let day = timing.day_from; day <= 7; day++) {
        const isToday = day === currentApiDay;

        if (isToday && timeFrom > currentTime) {
          todaySlots.push({ day, timeFrom, timeTo, originalTiming: timing });
        }
      }
      for (let day = 1; day <= timing.day_to; day++) {
        const isToday = day === currentApiDay;

        if (isToday && timeFrom > currentTime) {
          todaySlots.push({ day, timeFrom, timeTo, originalTiming: timing });
        }
      }
    }
  });

  // Sort today's slots by time
  todaySlots.sort((a, b) => a.timeFrom - b.timeFrom);

  // If there's a next slot today, return it with time difference
  const nextSlot = todaySlots.length > 0 ? todaySlots[0] : null;

  if (nextSlot) {
    // Calculate time difference in minutes (only for today)
    const hours = Math.floor(nextSlot.timeFrom / 100);
    const minutes = nextSlot.timeFrom % 100;
    const nextTime = new Date(now);
    nextTime.setHours(hours, minutes, 0, 0);
    const diffMs = nextTime.getTime() - now.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const timeDifference = formatTimeDifference(diffMinutes);

    // Format time with AM/PM
    const timeString = String(nextSlot.timeFrom).padStart(4, '0');
    const formatTime = (time: string): string => {
      const hours = parseInt(time.substring(0, 2), 10);
      const minutes = time.substring(2, 4);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${minutes} ${period}`;
    };
    const availableTime = formatTime(timeString);

    // Calculate hours and minutes remaining
    const hoursRemaining = Math.floor(diffMinutes / 60);
    const minutesRemaining = diffMinutes % 60;

    return { timeDifference, availableTime, hoursRemaining, minutesRemaining, hasTodaySlot };
  }

  // If no next slot today but has timing for today, return that info
  if (hasTodaySlot) {
    return { hasTodaySlot: true };
  }

  return null;
};

interface RestaurantScreenProps {
  visible: boolean;
  restaurantId: number;
  restaurantName?: string;
  onBack?: () => void;
  onNavigateToDetails?: () => void;
  onNavigateToOrders?: (orderId?: number) => void;
  onNavigateToHome?: () => void;
  onNavigateToCheckout?: (restaurantId: number, restaurantName: string, restaurantAddress?: string, from?: 'home' | 'restaurant') => void;
  selectedLocation?: { name: string; address: string; latitude?: number; longitude?: number };
}

interface AddOn {
  id: string;
  name: string;
  price: number;
  isVeg: boolean;
  discount?: string;
}

interface CustomizationOption {
  id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  is_default: boolean;
}

interface CustomizationGroup {
  id: number;
  name: string;
  description: string;
  min_selections: number;
  max_selections: number;
  input_type: string;
  is_mandatory: boolean;
  options: CustomizationOption[];
}

// Use imported ItemTiming type
type ItemTiming = ImportedItemTiming;

interface PreorderCampaign {
  id: string;
  title: string;
  available_slots: number;
  delivery_date: string;
  discount_amount: string;
  free_delivery: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  image: any | null;
  isVeg: boolean;
  isSpicy: boolean;
  isBestSeller: boolean;
  isCustomizable: boolean;
  isFavorite?: boolean;
  addOns?: AddOn[];
  customizations?: CustomizationGroup[];
  timings?: ItemTiming[];
  isPreorderAvailable?: boolean;
  preorderCampaign?: PreorderCampaign;
}

interface MenuSection {
  id: string;
  title: string;
  items: MenuItem[];
  isExpanded: boolean;
}

interface CustomizationVariant {
  id: string;
  addOns: string[];
  addOnNames?: string[];
  customizationGroups?: Array<{
    group_id: number;
    selected_option_ids: number[];
  }>;
  price: number;
  quantity: number;
}
const SHOW_DESCRIPTION_MORE_BUTTON = false;

export const RestaurantScreen: React.FC<RestaurantScreenProps> = ({
  visible,
  restaurantId,
  restaurantName,
  onBack,
  onNavigateToDetails,
  onNavigateToCheckout,
  selectedLocation,
}) => {
  const { cart, addToCart: addToCartContext, removeFromCart, updateQuantity, setRestaurantInfo, clearCart, reloadCart, flushPendingQuantityUpdate, checkRestaurantConflict, restaurantId: cartRestaurantId, restaurantName: cartRestaurantName, restaurantLogo: cartRestaurantLogo } = useCart();
  const { vegMode, setVegMode } = useVegMode();
  const { showConfirmation } = useConfirmation();

  // Helper function to handle addToCart errors
  const handleAddToCartError = (error: any) => {
    // Extract error message from various possible locations
    let errorMessage = '';

    // Check if error has a message property
    if (error?.message) {
      errorMessage = error.message;
    }
    // Check if error has response data with message
    else if (error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    }
    // Check if error has fullResponse with message (from apiService logging)
    else if (error?.fullResponse?.message) {
      errorMessage = error.fullResponse.message;
    }
    // Fallback to string representation
    else {
      errorMessage = error?.toString() || 'Failed to add item to cart';
    }

    // Show error message popup when success is false (regardless of status code)
    // The error is thrown when backend returns success: false
    showConfirmation({
      title: '', // No title
      message: errorMessage,
      confirmText: 'OK',
      cancelText: '', // No cancel button (no close button)
      confirmButtonColor: '#00B14F',
      onConfirm: () => { },
    });
  };
  const insets = useSafeAreaInsets();
  const [menuSections, setMenuSections] = useState<MenuSection[]>([]);
  const [restaurantData, setRestaurantData] = useState<any>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [showCustomizationModal, setShowCustomizationModal] = useState(false);
  const [selectedCustomizableItem, setSelectedCustomizableItem] = useState<MenuItem | null>(null);
  const [showCustomisationsReviewModal, setShowCustomisationsReviewModal] = useState(false);
  const [reviewingItemId, setReviewingItemId] = useState<string | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingVariantQuantity, setEditingVariantQuantity] = useState<number | undefined>(undefined);
  const [preselectedAddOns, setPreselectedAddOns] = useState<string[]>([]);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [filters] = useState<FilterState>({
    sortBy: null,
    dietary: null,
  });
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<MenuItem | null>(null);
  const [selectedDetailItemAvailable, setSelectedDetailItemAvailable] = useState<boolean>(true);
  const [activeDietaryFilter, setActiveDietaryFilter] = useState<'veg' | 'non-veg' | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [togglingFavoriteItemId, setTogglingFavoriteItemId] = useState<string | null>(null);
  const [showClosedModal, setShowClosedModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [defaultAddressCoords, setDefaultAddressCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Effective restaurant open/closed status:
  // Use ONLY backend top-level is_open flag for store open/close.
  // Do NOT derive open state from timings.
  const isRestaurantOpenEffective = useMemo(() => {
    return typeof restaurantData?.is_open === 'boolean' ? restaurantData.is_open : true;
  }, [restaurantData?.is_open, restaurantData?.timings]);

  // Opening message shown when restaurant is closed.
  // Use timing-based helper, but respect backend is_open when present.
  const restaurantOpeningMessage = useMemo(() => {
    if (!restaurantData?.timings || restaurantData.timings.length === 0) {
      return null;
    }

    const timingMessage = homeService.getRestaurantOpeningMessage(restaurantData.timings);

    if (typeof restaurantData.is_open === 'boolean') {
      if (restaurantData.is_open) {
        // Backend says open → don't show "opens in..." message
        return null;
      }
      // Backend says closed → show timing message if available, otherwise a generic label
      return timingMessage || 'Currently closed';
    }

    return timingMessage;
  }, [restaurantData?.timings, restaurantData?.is_open]);

  const isRestaurantClosed = !isRestaurantOpenEffective;

  const showRestaurantClosedAlert = useCallback(() => {
    setShowClosedModal(true);
  }, []);

  const ensureRestaurantOpen = useCallback((): boolean => {
    if (isRestaurantClosed) {
      showRestaurantClosedAlert();
      return false;
    }
    return true;
  }, [isRestaurantClosed, showRestaurantClosedAlert]);

  const handleCloseClosedModal = useCallback(() => {
    setShowClosedModal(false);
  }, []);

  const scrollViewRef = React.useRef<ScrollView>(null);
  const sectionRefs = React.useRef<{ [key: string]: View | null }>({});
  const sectionPositions = React.useRef<{ [key: string]: number }>({});
  const updatingItemsRef = React.useRef<Set<string>>(new Set());
  // Track latest quantity for each item to prevent stale reads during rapid clicks
  const itemQuantityRefs = React.useRef<{ [key: string]: number }>({});

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  // Calculate total cart items
  const totalCartItems = Object.values(cart).reduce((sum, item) => {
    if (item.isCustomizable && item.variants) {
      return sum + item.variants.reduce((variantSum, variant) => variantSum + variant.quantity, 0);
    }
    return sum + (item.quantity || 0);
  }, 0);

  // Handle image load
  const handleImageLoad = (itemId: string) => {
    setLoadedImages(prev => new Set(prev).add(itemId));
  };

  // Handle favorite toggle for menu items
  const handleToggleFavoriteItem = async (sectionId: string, itemId: string) => {
    if (togglingFavoriteItemId === itemId) return; // Prevent multiple simultaneous calls

    setTogglingFavoriteItemId(itemId);

    // Find the item to get its current favorite state
    const section = menuSections.find(s => s.id === sectionId);
    const item = section?.items.find(i => i.id === itemId);
    const previousState = item?.isFavorite || false;

    // Optimistic update
    setMenuSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? {
            ...section,
            items: section.items.map(item =>
              item.id === itemId ? { ...item, isFavorite: !item.isFavorite } : item
            ),
          }
          : section
      )
    );

    try {
      const response = await favoritesService.toggleFavoriteItem(itemId);

      if (!response.success) {
        // Revert on failure
        setMenuSections(prev =>
          prev.map(section =>
            section.id === sectionId
              ? {
                ...section,
                items: section.items.map(item =>
                  item.id === itemId ? { ...item, isFavorite: previousState } : item
                ),
              }
              : section
          )
        );
      }
    } catch (error) {
      // Revert on error
      setMenuSections(prev =>
        prev.map(section =>
          section.id === sectionId
            ? {
              ...section,
              items: section.items.map(item =>
                item.id === itemId ? { ...item, isFavorite: previousState } : item
              ),
            }
            : section
        )
      );
    } finally {
      setTogglingFavoriteItemId(null);
    }
  };

  // Get total quantity for an item (works for both customizable and non-customizable)
  const getItemQuantity = (itemId: string): number => {
    const cartItem = cart[itemId];
    if (!cartItem) return 0;

    if (cartItem.isCustomizable && cartItem.variants) {
      return cartItem.variants.reduce((sum, variant) => sum + variant.quantity, 0);
    }

    return cartItem.quantity || 0;
  };

  // Flatten cart items for order details - convert variants into separate line items
  const getFlattenedCartItems = () => {
    const flattenedItems: any[] = [];

    Object.values(cart).forEach(cartItem => {
      if (cartItem.isCustomizable && cartItem.variants) {
        // For customizable items, add each variant as a separate line item
        cartItem.variants.forEach(variant => {
          const item = {
            id: cartItem.id,  // Original item ID
            variantId: variant.id,  // Variant ID
            addOnIds: variant.addOns,  // Array of add-on IDs
            name: cartItem.name,
            price: variant.price,
            quantity: variant.quantity,
            isVeg: cartItem.isVeg,
            image: cartItem.image,
            // Always include customizations text
            customizations: variant.addOnNames?.length
              ? variant.addOnNames.join(', ')
              : '',
          };
          flattenedItems.push(item);
        });
      } else {
        // For regular items, add as-is
        const item = {
          id: cartItem.id,
          name: cartItem.name,
          price: cartItem.price,
          quantity: cartItem.quantity || 0,
          isVeg: cartItem.isVeg,
          image: cartItem.image,
        };
        flattenedItems.push(item);
      }
    });

    return flattenedItems;
  };

  const addToCart = (item: MenuItem) => {
    if (!ensureRestaurantOpen()) {
      return;
    }

    const cartItemCount = Object.keys(cart).length;
    const hasConflict = cartItemCount > 0 &&
      (cartRestaurantId === null || cartRestaurantId !== restaurantId);

    if (hasConflict) {
      showConfirmation({
        title: 'Replace cart item?',
        message: 'Your cart contains dishes from another restaurant. Do you want to discard the selection and add dishes from this restaurant?',
        confirmText: 'Replace',
        cancelText: 'Cancel',
        confirmButtonColor: '#FF0000',
        onConfirm: async () => {
          await clearCart();
          setRestaurantInfo(restaurantId, restaurantData?.name || restaurantName || 'Restaurant', restaurantData?.logo_url);
          addToCartContext({
            id: item.id,
            itemId: parseInt(item.id, 10),
            name: item.name,
            price: item.price,
            quantity: 1,
            isVeg: item.isVeg,
            image: item.image,
            isCustomizable: false,
            isPreorder: item.isPreorderAvailable || false,
            campaignId: item.preorderCampaign?.id,
          }, restaurantId).catch((error) => {
            handleAddToCartError(error);
          });
        },
      });
      return;
    }

    setRestaurantInfo(restaurantId, restaurantData?.name || restaurantName || 'Restaurant', restaurantData?.logo_url);
    addToCartContext({
      id: item.id,
      itemId: parseInt(item.id, 10),
      name: item.name,
      price: item.price,
      quantity: 1,
      isVeg: item.isVeg,
      image: item.image,
      isCustomizable: false,
      isPreorder: item.isPreorderAvailable || false,
      campaignId: item.preorderCampaign?.id,
    }, restaurantId).catch((error) => {
      handleAddToCartError(error);
    });
  };

  // Sync itemQuantityRefs with cart state whenever cart changes
  React.useEffect(() => {
    Object.keys(cart).forEach(itemId => {
      const cartItem = cart[itemId];
      if (cartItem) {
        if (cartItem.isCustomizable && cartItem.variants) {
          const totalQuantity = cartItem.variants.reduce((sum, variant) => sum + variant.quantity, 0);
          itemQuantityRefs.current[itemId] = totalQuantity;
        } else {
          itemQuantityRefs.current[itemId] = cartItem.quantity || 0;
        }
      }
    });
    // Remove refs for items no longer in cart
    Object.keys(itemQuantityRefs.current).forEach(itemId => {
      if (!cart[itemId]) {
        delete itemQuantityRefs.current[itemId];
      }
    });
  }, [cart]);

  // Increment item quantity
  const incrementItem = (itemId: string) => {
    if (!ensureRestaurantOpen()) {
      return;
    }
    const cartItem = cart[itemId];

    // Find the menu item to check if it's a preorder item
    const menuItem = menuSections
      .flatMap(section => section.items)
      .find(i => i.id === itemId);

    // Check if item is preorder - only allow quantity of 1
    if (menuItem?.isPreorderAvailable) {
      const currentQuantity = getItemQuantity(itemId);
      if (currentQuantity >= 1) {
        showConfirmation({
          title: 'Preorder Limit',
          message: 'Only one quantity is allowed for preorder items. You can add this item only once.',
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#00B14F',
          onConfirm: () => { },
        });
        return;
      }
    }

    // If item is customizable, open review modal instead
    if (cartItem?.isCustomizable) {
      setReviewingItemId(itemId);
      setShowCustomisationsReviewModal(true);
      return;
    }

    // For non-customizable items, use ref to get latest quantity (avoids stale reads during rapid clicks)
    const currentQuantity = itemQuantityRefs.current[itemId] || cartItem?.quantity || 0;
    const newQuantity = currentQuantity + 1;

    // Update ref immediately for next click
    itemQuantityRefs.current[itemId] = newQuantity;

    // If item was removed (e.g. decremented to 0), re-add via addToCart so API and UI stay in sync.
    // updateQuantity(id, 1) no-ops when the item is not in cart, which caused "0 → 1" not updating.
    if (!cartItem) {
      const menuItem = menuSections.flatMap((s) => s.items).find((i) => i.id === itemId);
      if (menuItem) {
        addToCart(menuItem);
      }
      return;
    }

    // Update quantity (will sync with backend)
    updateQuantity(itemId, newQuantity);
  };

  // Decrement item quantity
  const decrementItem = (itemId: string) => {
    const cartItem = cart[itemId];

    // If item is customizable, open review modal instead
    if (cartItem?.isCustomizable) {
      setReviewingItemId(itemId);
      setShowCustomisationsReviewModal(true);
      return;
    }

    // For non-customizable items, use ref to get latest quantity (avoids stale reads during rapid clicks)
    const currentQuantity = itemQuantityRefs.current[itemId] || cartItem?.quantity || 0;
    const newQuantity = Math.max(0, currentQuantity - 1);

    // Update ref immediately for next click
    if (newQuantity > 0) {
      itemQuantityRefs.current[itemId] = newQuantity;
    } else {
      delete itemQuantityRefs.current[itemId];
    }

    // Update quantity (updateQuantity will remove if quantity becomes 0)
    updateQuantity(itemId, newQuantity);
  };

  const handleCustomizableItemClick = (item: MenuItem) => {
    if (!ensureRestaurantOpen()) {
      return;
    }
    const cartItemCount = Object.keys(cart).length;
    const hasConflict = cartItemCount > 0 &&
      (cartRestaurantId === null || cartRestaurantId !== restaurantId);

    if (hasConflict) {
      showConfirmation({
        title: 'Replace cart item?',
        message: 'Your cart contains dishes from another restaurant. Do you want to discard the selection and add dishes from this restaurant?',
        confirmText: 'Replace',
        cancelText: 'Cancel',
        confirmButtonColor: '#FF0000',
        onConfirm: async () => {
          await clearCart();
          setRestaurantInfo(restaurantId, restaurantData?.name || restaurantName || 'Restaurant', restaurantData?.logo_url);
          setSelectedCustomizableItem(item);
          setShowCustomizationModal(true);
        },
      });
      return;
    }

    setRestaurantInfo(restaurantId, restaurantData?.name || restaurantName || 'Restaurant', restaurantData?.logo_url);
    setSelectedCustomizableItem(item);
    setShowCustomizationModal(true);
  };

  // Handle adding customizable item to cart with add-ons
  const handleAddCustomizableItem = (itemId: string, quantity: number, selectedAddOns: string[]) => {
    if (!ensureRestaurantOpen()) {
      return;
    }
    const item = menuSections
      .flatMap(section => section.items)
      .find(i => i.id === itemId);

    if (!item) return;

    // Check if item is preorder and enforce quantity limit of 1
    if (item.isPreorderAvailable) {
      if (quantity > 1) {
        showConfirmation({
          title: 'Preorder Limit',
          message: 'Only one quantity is allowed for preorder items. You can add this item only once.',
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#00B14F',
          onConfirm: () => { },
        });
        return;
      }

      // Check if preorder item is already in cart
      const existingCartItem = cart[itemId];
      if (existingCartItem && existingCartItem.isPreorder) {
        const totalQuantity = existingCartItem.isCustomizable && existingCartItem.variants
          ? existingCartItem.variants.reduce((sum, variant) => sum + variant.quantity, 0)
          : existingCartItem.quantity || 0;

        if (totalQuantity >= 1) {
          showConfirmation({
            title: 'Preorder Limit',
            message: 'Only one quantity is allowed for preorder items. You can add this item only once.',
            confirmText: 'OK',
            cancelText: '',
            confirmButtonColor: '#00B14F',
            onConfirm: () => { },
          });
          return;
        }
      }
    }

    // Get all available options from customization groups
    const allOptions: Array<{ id: string; name: string; price: number }> = [];

    if (item.customizations) {
      item.customizations.forEach(group => {
        group.options.forEach(option => {
          allOptions.push({
            id: option.id.toString(),
            name: option.name,
            price: Number(option.price) || 0,
          });
        });
      });
    }

    const selectedAddOnObjects = allOptions.filter(ao => selectedAddOns.includes(ao.id));
    const addOnNames = selectedAddOnObjects.map(ao => ao.name);
    const addOnTotalPrice = selectedAddOnObjects.reduce((sum, ao) => sum + Number(ao.price), 0);
    const totalPrice = Number(item.price) + addOnTotalPrice;

    // Build customization groups array for API
    const customizationGroups: Array<{ group_id: number; selected_option_ids: number[] }> = [];
    if (item.customizations) {
      item.customizations.forEach(group => {
        const selectedInGroup = group.options
          .filter(opt => selectedAddOns.includes(opt.id.toString()))
          .map(opt => opt.id);

        if (selectedInGroup.length > 0) {
          customizationGroups.push({
            group_id: group.id,
            selected_option_ids: selectedInGroup
          });
        }
      });
    }

    const existingItem = cart[itemId];

    // Create new variant
    const newVariant: CustomizationVariant = {
      id: editingVariantId || `${itemId}_variant_${Date.now()}`,
      addOns: selectedAddOns,
      addOnNames: addOnNames,
      customizationGroups: customizationGroups,
      price: totalPrice,
      quantity: quantity,
    };

    let updatedVariants: CustomizationVariant[];

    if (editingVariantId) {
      // Update existing variant
      updatedVariants = (existingItem?.variants || []).map(v => {
        // Convert CartVariant to CustomizationVariant if needed
        const variant: CustomizationVariant = {
          id: v.id,
          addOns: v.addOns || [],
          addOnNames: v.addOnNames,
          price: v.price,
          quantity: v.quantity,
        };
        return v.id === editingVariantId ? newVariant : variant;
      });
    } else if (existingItem && existingItem.isCustomizable) {
      // Add to existing variants
      const existingVariants = (existingItem.variants || []).map(v => ({
        id: v.id,
        addOns: v.addOns || [],
        addOnNames: v.addOnNames,
        price: v.price,
        quantity: v.quantity,
      }));
      updatedVariants = [...existingVariants, newVariant];
    } else {
      // Create first variant
      updatedVariants = [newVariant];
    }

    // Update cart with new/updated variants
    addToCartContext({
      id: item.id,
      name: item.name,
      price: item.price,
      isVeg: item.isVeg,
      image: item.image,
      isCustomizable: true,
      variants: updatedVariants,
      isPreorder: item.isPreorderAvailable || false,
      campaignId: item.preorderCampaign?.id,
    }).catch((error) => {
      handleAddToCartError(error);
    });

    // Clear editing state
    setEditingVariantId(null);
    setPreselectedAddOns([]);
  };


  // Toggle description expansion
  const toggleDescription = (itemId: string) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Handlers for CustomisationsReviewModal
  const handleIncrementVariant = (variantId: string) => {
    if (!ensureRestaurantOpen()) {
      return;
    }
    if (!reviewingItemId) return;

    const item = cart[reviewingItemId];
    if (!item?.variants) return;

    // Check if item is preorder and enforce quantity limit of 1
    if (item.isPreorder) {
      const totalQuantity = item.variants.reduce((sum, variant) => sum + variant.quantity, 0);
      if (totalQuantity >= 1) {
        showConfirmation({
          title: 'Preorder Limit',
          message: 'Only one quantity is allowed for preorder items. You can add this item only once.',
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#00B14F',
          onConfirm: () => { },
        });
        return;
      }
    }

    addToCartContext({
      ...item,
      variants: item.variants.map(v =>
        v.id === variantId ? { ...v, quantity: v.quantity + 1 } : v
      ),
    }).catch((error) => {
      handleAddToCartError(error);
    });
  };

  const handleDecrementVariant = (variantId: string) => {
    if (!reviewingItemId) return;

    const item = cart[reviewingItemId];
    if (!item?.variants) return;

    const updatedVariants = item.variants
      .map(v => v.id === variantId ? { ...v, quantity: v.quantity - 1 } : v)
      .filter(v => v.quantity > 0);

    // If no variants left, remove the item from cart
    if (updatedVariants.length === 0) {
      removeFromCart(reviewingItemId);
    } else {
      addToCartContext({
        ...item,
        variants: updatedVariants,
      }).catch((error) => {
        handleAddToCartError(error);
      });
    }
  };

  const handleEditVariant = () => {
    // For now, just show a placeholder
    // In a full implementation, you would:
    // 1. Find the variant
    // 2. Pre-select its add-ons in the customization modal
    // 3. Allow editing
  };

  const handleAddNewCustomisation = () => {
    if (!ensureRestaurantOpen()) {
      return;
    }
    if (!reviewingItemId) return;

    const item = menuSections
      .flatMap(section => section.items)
      .find(i => i.id === reviewingItemId);

    if (item) {
      setShowCustomisationsReviewModal(false);
      setSelectedCustomizableItem(item);
      setShowCustomizationModal(true);
    }
  };

  const handleConfirmCustomisations = () => {
    setShowCustomisationsReviewModal(false);
    setReviewingItemId(null);
  };

  // Handle opening detail modal
  const handleImageClick = (item: MenuItem) => {
    // Allow opening modal even if restaurant is closed (to show disabled state)
    // Check if item is available based on its own timings
    const isItemCurrentlyAvailable = isItemAvailable(item.timings);

    // Item is only available if BOTH restaurant is open AND item timing is available
    const itemAvailable = isRestaurantOpenEffective && isItemCurrentlyAvailable;

    setSelectedDetailItem(item);
    setSelectedDetailItemAvailable(itemAvailable);
    setShowDetailModal(true);
  };

  // Toggle dietary filter
  const toggleDietaryFilter = (filterType: 'veg' | 'non-veg') => {
    if (activeDietaryFilter === filterType) {
      // If clicking the same filter, turn it off
      setActiveDietaryFilter(null);
    } else {
      // Otherwise, set the new filter
      setActiveDietaryFilter(filterType);
    }
  };

  // Get filtered menu sections based on active dietary filter and global veg mode
  // Helper function to check if item is fully available (considering both restaurant and item timings)
  const isItemFullyAvailable = (item: MenuItem): boolean => {
    // Check if item is available based on its own timings
    const isItemCurrentlyAvailable = isItemAvailable(item.timings);

    // Item is only available if BOTH restaurant is open AND item timing is available
    return isRestaurantOpenEffective && isItemCurrentlyAvailable;
  };

  const getFilteredMenuSections = (): MenuSection[] => {
    const processedSections = menuSections
      .map(section => {
        // Filter items
        let filteredItems = section.items.filter(item => {
          // First apply global veg mode filter
          if (vegMode === 'all') {
            // When veg mode is 'all', show only veg items
            if (!item.isVeg) {
              return false;
            }
          }
          // vegMode 'pure' is handled at restaurant level (API filters restaurants)
          // vegMode 'off' shows everything

          // Then apply local dietary filter if active
          if (activeDietaryFilter) {
            if (activeDietaryFilter === 'veg') {
              return item.isVeg === true;
            } else if (activeDietaryFilter === 'non-veg') {
              return item.isVeg === false;
            }
          }

          // Apply filter modal dietary filter
          if (filters.dietary) {
            if (filters.dietary === 'veg') {
              return item.isVeg === true;
            } else if (filters.dietary === 'nonVeg') {
              return item.isVeg === false;
            }
            // eggterian filter - would need an isEgg property on items
            // For now, treating as non-veg
            else if (filters.dietary === 'eggterian') {
              return item.isVeg === false;
            }
          }

          return true;
        });

        // Sort items within category: enabled items first, then disabled items
        filteredItems = [...filteredItems].sort((a, b) => {
          const aAvailable = isItemFullyAvailable(a);
          const bAvailable = isItemFullyAvailable(b);

          // Primary sort: availability (enabled items come first)
          if (aAvailable !== bAvailable) {
            return aAvailable ? -1 : 1; // true (available) comes before false (disabled)
          }

          // Secondary sort: price (if filter is active and both have same availability)
          if (filters.sortBy) {
            if (filters.sortBy === 'lowToHigh') {
              return a.price - b.price;
            } else if (filters.sortBy === 'highToLow') {
              return b.price - a.price;
            }
          }

          return 0;
        });

        // Check if category has any enabled items
        const hasEnabledItems = filteredItems.some(item => isItemFullyAvailable(item));

        return {
          ...section,
          items: filteredItems,
          hasEnabledItems, // Add flag for category sorting
        };
      })
      .filter(section => section.items.length > 0); // Remove empty sections

    // Sort categories: categories with enabled items first, then categories with only disabled items
    const sortedSections = [...processedSections].sort((a, b) => {
      if (a.hasEnabledItems !== b.hasEnabledItems) {
        return a.hasEnabledItems ? -1 : 1; // Categories with enabled items come first
      }
      return 0;
    });

    // Remove the hasEnabledItems flag before returning (it was just for sorting)
    return sortedSections.map(({ hasEnabledItems, ...section }) => section);
  };

  const filteredMenuSections = getFilteredMenuSections();
  const hasNoFilteredItems = activeDietaryFilter && filteredMenuSections.length === 0;
  const hasNoItemsAtAll = !isLoading && menuSections.length === 0;
  const hasNoVegItems = vegMode === 'all' && filteredMenuSections.length === 0 && menuSections.length > 0;

  // Show max quantity alert function
  const showMaxQuantityAlert = useCallback(() => {
    showConfirmation({
      title: 'Quantity limit reached',
      message: `You can add up to ${MAX_ITEM_QUANTITY} units of each item.`,
      confirmText: 'OK',
      cancelText: '',
      confirmButtonColor: '#00B14F',
      onConfirm: () => { },
    });
  }, [showConfirmation]);

  const handleAddFromDetail = useCallback((itemId: string, quantity: number) => {
    // Current flow: Check if restaurant is open first
    if (!ensureRestaurantOpen()) {
      return;
    }

    // Incoming flow: Prevent concurrent updates for the same item
    if (updatingItemsRef.current.has(itemId)) {
      return;
    }

    // Incoming flow: Check quantity limit
    if (quantity > MAX_ITEM_QUANTITY) {
      showMaxQuantityAlert();
      return;
    }

    const item = menuSections
      .flatMap(section => section.items)
      .find(i => i.id === itemId);

    if (!item) return;

    // Check if item is preorder and enforce quantity limit of 1
    if (item.isPreorderAvailable) {
      if (quantity > 1) {
        showConfirmation({
          title: 'Preorder Limit',
          message: 'Only one quantity is allowed for preorder items. You can add this item only once.',
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#00B14F',
          onConfirm: () => { },
        });
        return;
      }
    }

    const safeQuantity = Math.min(quantity, MAX_ITEM_QUANTITY);
    if (safeQuantity <= 0) {
      return;
    }

    // Check if item already exists in cart
    const existingCartItem = cart[itemId];

    // Check if preorder item is already in cart
    if (item.isPreorderAvailable && existingCartItem && existingCartItem.quantity && existingCartItem.quantity >= 1) {
      showConfirmation({
        title: 'Preorder Limit',
        message: 'Only one quantity is allowed for preorder items. You can add this item only once.',
        confirmText: 'OK',
        cancelText: '',
        confirmButtonColor: '#00B14F',
        onConfirm: () => { },
      });
      return;
    }

    if (existingCartItem) {
      // For preorder items, don't allow updating quantity if already at 1
      if (item.isPreorderAvailable && existingCartItem.quantity && existingCartItem.quantity >= 1) {
        showConfirmation({
          title: 'Preorder Limit',
          message: 'Only one quantity is allowed for preorder items. You can add this item only once.',
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#00B14F',
          onConfirm: () => { },
        });
        return;
      }

      // Get current quantity and calculate new total quantity (set, not incremental)
      const currentQuantity = existingCartItem.quantity || 0;
      const newQuantity = Math.min(safeQuantity, MAX_ITEM_QUANTITY);

      // Only update if the new quantity is different
      if (newQuantity !== currentQuantity) {
        // Mark item as being updated to prevent concurrent updates
        updatingItemsRef.current.add(itemId);

        // Call API to update quantity
        updateQuantity(itemId, newQuantity)
          .then(() => {
            // Update successful
          })
          .catch((error) => {
            // Handle error - quantity update failed
            console.error('[RestaurantScreen] Error updating quantity:', error);
          })
          .finally(() => {
            // Remove from updating set after update completes (success or failure)
            updatingItemsRef.current.delete(itemId);
          });
      }
      // If quantity is same, no API call needed
    } else {
      // Add new item to cart
      // Current flow: Check if there's a restaurant conflict using checkRestaurantConflict
      if (checkRestaurantConflict(restaurantId)) {
        showConfirmation({
          title: 'Replace cart item?',
          message: 'Your cart contains dishes from another restaurant. Do you want to discard the selection and add dishes from this restaurant?',
          confirmText: 'Replace',
          cancelText: 'Cancel',
          confirmButtonColor: '#FF0000',
          onConfirm: async () => {
            // Clear cart and add new item
            await clearCart();
            setRestaurantInfo(restaurantId, restaurantData?.name || restaurantName || 'Restaurant', restaurantData?.logo_url);
            addToCartContext({
              id: item.id,
              itemId: parseInt(item.id, 10),
              name: item.name,
              price: item.price,
              quantity: safeQuantity,
              isVeg: item.isVeg,
              image: item.image,
              isCustomizable: false,
              isPreorder: item.isPreorderAvailable || false,
              campaignId: item.preorderCampaign?.id,
            }, restaurantId).catch((error) => {
              handleAddToCartError(error);
            });
          },
        });
        return;
      }

      // Always ensure restaurant info is set before adding items
      setRestaurantInfo(restaurantId, restaurantData?.name || restaurantName || 'Restaurant', restaurantData?.logo_url);

      // Pass restaurantId directly to avoid race condition
      // Current flow: Include itemId field for compatibility
      addToCartContext({
        id: item.id,
        itemId: parseInt(item.id, 10),
        name: item.name,
        price: item.price,
        quantity: safeQuantity,
        isVeg: item.isVeg,
        image: item.image,
        isCustomizable: false,
        isPreorder: item.isPreorderAvailable || false,
        campaignId: item.preorderCampaign?.id,
      }, restaurantId).catch((error) => {
        handleAddToCartError(error);
      });
    }
  }, [cart, menuSections, updateQuantity, addToCartContext, checkRestaurantConflict, restaurantId, restaurantData, restaurantName, setRestaurantInfo, clearCart, showConfirmation, showMaxQuantityAlert, ensureRestaurantOpen]);

  const cartReloadedRef = useRef(false);

  useEffect(() => {
    if (visible && restaurantId) {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: false });
      }

      if (!cartReloadedRef.current) {
        reloadCart().catch(() => { });
        cartReloadedRef.current = true;
      }

      // Only fetch restaurant details if we have coordinates (either from default address or fallback)
      // This ensures we use the correct coordinates
      fetchRestaurantDetails();
    } else if (!visible) {
      setRestaurantData(null);
      setMenuSections([]);
      cartReloadedRef.current = false;
    }
  }, [visible, restaurantId, defaultAddressCoords]);

  // Fetch default address coordinates only if selectedLocation is not provided
  // Same pattern as CategoryResultsScreen - prioritize selectedLocation prop
  useEffect(() => {
    // If selectedLocation is provided, don't fetch address API
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      return;
    }

    const fetchDefaultAddress = async () => {
      try {
        const response = await addressService.getAddresses();
        if (response.success && response.data) {
          // Find the default address (is_default: true)
          const defaultAddress = response.data.find(addr => addr.is_default);
          if (defaultAddress) {
            setDefaultAddressCoords({
              latitude: defaultAddress.latitude,
              longitude: defaultAddress.longitude,
            });
          } else {
            // No default address found, set to null (will use fallback)
            setDefaultAddressCoords(null);
          }
        } else {
          // API failed, set to null (will use fallback)
          setDefaultAddressCoords(null);
        }
      } catch (error) {
        // Error fetching, set to null (will use fallback)
        setDefaultAddressCoords(null);
      }
    };

    // Fetch only once on mount - addressService handles caching internally
    fetchDefaultAddress();
  }, [selectedLocation]); // Only fetch if selectedLocation changes or is not provided

  // Initialize active category when menu sections load
  useEffect(() => {
    if (menuSections.length > 0 && !activeCategoryId) {
      setActiveCategoryId(menuSections[0].id);
    }
  }, [menuSections]);

  // Handle Android back button
  useEffect(() => {
    const backAction = () => {
      // If search is open, close it
      if (showSearch) {
        setShowSearch(false);
        return true;
      }
      // Otherwise, let the parent handle back (go to previous screen)
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [showSearch]);

  // Animate background when modal opens/closes
  useEffect(() => {
    if (showDetailModal || showCustomizationModal || showCustomisationsReviewModal) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 30,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showDetailModal, showCustomizationModal, showCustomisationsReviewModal]);

  const fetchRestaurantDetails = async (skipDelay: boolean = false) => {
    try {
      setIsLoading(true);

      // Use selectedLocation first, then defaultAddressCoords, then fallback to default location
      // Same priority as CategoryResultsScreen
      const lat = selectedLocation?.latitude || defaultAddressCoords?.latitude || 9.9352300;
      const lng = selectedLocation?.longitude || defaultAddressCoords?.longitude || 78.1304040;

      // Add minimum delay to show shimmer animation (skip during refresh)
      const promises = [
        apiService.get(
          `/api/buyer/restaurants/${restaurantId}?lat=${lat}&lng=${lng}&include_items=true`
        ),
      ];

      if (!skipDelay) {
        promises.push(new Promise(resolve => setTimeout(resolve, 1500))); // 1.5 second delay
      }

      const [response] = await Promise.all(promises);

      // Handle nested data structure: response.data.data.data
      const responseData = response.data as any;
      const nestedData = responseData?.data?.data || responseData?.data;

      if (nestedData) {
        const restaurant = nestedData;
        setRestaurantData(restaurant);

        // DON'T set restaurant info here - it will be set when adding first item to cart
        // This prevents overwriting cart restaurant info when viewing different restaurants

        // Process categories from API response
        if (restaurant.categories && Array.isArray(restaurant.categories)) {
          const sections: MenuSection[] = restaurant.categories.map((category: any) => {
            // Process items in this category
            const items: MenuItem[] = (category.items || []).map((item: any) => {
              // Parse customizations/add-ons from API
              // The API returns customization groups with options inside
              let addOns: AddOn[] = [];
              if (item.customizations && Array.isArray(item.customizations)) {
                // Flatten all options from all customization groups
                item.customizations.forEach((group: any) => {
                  if (group.options && Array.isArray(group.options)) {
                    group.options.forEach((option: any) => {
                      addOns.push({
                        id: option.id?.toString() || Math.random().toString(),
                        name: option.name || '',
                        price: parseFloat(option.price || 0),
                        isVeg: option.is_veg !== false, // Default to true if not specified
                        discount: option.discount || undefined,
                      });
                    });
                  }
                });
              }

              // Determine if item is vegetarian
              // Check multiple possible fields from API
              const isVeg =
                item.dietary_preference?.toLowerCase() === 'veg' ||
                item.dietary_preference?.toLowerCase() === 'vegetarian' ||
                item.is_veg === true ||
                item.is_veg === 1;

              // Parse preorder data
              const isPreorderAvailable = item.is_preorder_available === true;
              const preorderCampaign = isPreorderAvailable && item.preorder_campaign ? {
                id: item.preorder_campaign.id?.toString() || '',
                title: item.preorder_campaign.title || '',
                available_slots: item.preorder_campaign.available_slots || 0,
                delivery_date: item.preorder_campaign.delivery_date || '',
                discount_amount: item.preorder_campaign.discount_amount || '0',
                free_delivery: item.preorder_campaign.free_delivery === true,
              } : undefined;

              const menuItem: MenuItem = {
                id: item.id.toString(),
                name: item.name,
                price: parseFloat(item.price?.base_price || 0),
                description: item.long_description || item.full_description || item.detailed_description || item.description || '',
                image: item.images && item.images.length > 0
                  ? { uri: item.images[0] }
                  : null,
                isVeg: isVeg,
                isSpicy: false, // API doesn't provide this info
                isBestSeller: item.is_recommended || false,
                isCustomizable: item.has_customizations || false,
                isFavorite: item.is_favorite || false,
                addOns: addOns.length > 0 ? addOns : undefined,
                customizations: item.customizations,
                timings: item.timings || undefined, // Keep API format (1-7)
                isPreorderAvailable: isPreorderAvailable,
                preorderCampaign: preorderCampaign,
              };
              return menuItem;
            });

            // Sort items: available items first, unavailable items last
            const sortedItems = items.sort((a, b) => {
              const aAvailable = isItemAvailable(a.timings);
              const bAvailable = isItemAvailable(b.timings);

              if (aAvailable === bAvailable) return 0;
              return aAvailable ? -1 : 1; // Available items come first
            });

            return {
              id: category.id.toString(),
              title: category.name,
              items: sortedItems,
              isExpanded: true, // Expand all sections by default
            };
          });

          setMenuSections(sections);
        }
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setMenuSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? { ...section, isExpanded: !section.isExpanded }
          : section
      )
    );
  };

  // Scroll to category
  const scrollToCategory = (categoryId: string) => {
    const position = sectionPositions.current[categoryId];
    if (position !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: position - 100, animated: true });
      setActiveCategoryId(categoryId);
      // Close the menu immediately when category is clicked
      setShowQuickMenu(false);
    }
  };

  // Handle scroll to detect current category
  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;

    // Find which section is currently visible
    let currentSection = null;
    for (const section of menuSections) {
      const position = sectionPositions.current[section.id];
      if (position !== undefined && scrollY >= position - 150) {
        currentSection = section.id;
      }
    }

    if (currentSection && currentSection !== activeCategoryId) {
      setActiveCategoryId(currentSection);
    }
  };

  // Measure section positions after layout
  const handleSectionLayout = (sectionId: string, event: any) => {
    event.target.measure((_x: number, _y: number, _width: number, _height: number, _pageX: number, pageY: number) => {
      sectionPositions.current[sectionId] = pageY;
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View
        style={[
          styles.animatedContainer,
          {
            transform: [
              { scale: scaleAnim },
              { translateY: translateYAnim },
            ],
            borderTopLeftRadius: (showCustomizationModal || showCustomisationsReviewModal || showDetailModal) ? 20 : 0,
            borderTopRightRadius: (showCustomizationModal || showCustomisationsReviewModal || showDetailModal) ? 20 : 0,
          },
        ]}
      >
        {/* Scrollable Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollContainer}
          contentContainerStyle={{
            paddingBottom: totalCartItems > 0 ? 90 + insets.bottom : 0
          }}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          alwaysBounceVertical={true}
          overScrollMode="never"
          removeClippedSubviews={true}
          decelerationRate="normal"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={async () => {
                setIsRefreshing(true);
                await fetchRestaurantDetails(true); // Skip delay during refresh
                setIsRefreshing(false);
              }}
              colors={['#00B14F']}
              tintColor="#00B14F"
              progressBackgroundColor="#FFFFFF"
            />
          }
        >
          {/* Header Image with Overlay */}
          {isLoading ? (
            <View style={styles.headerImage}>
              {/* Shimmer for the banner image */}
              <Shimmer
                width={SCREEN_WIDTH}
                height={252}
                borderRadius={0}
                backgroundColor="#E8E8E8"
                style={{ position: 'absolute', top: 0, left: 0 }}
              />
              <View style={[styles.headerOverlay, { paddingTop: insets.top + 10 }]}>
                {/* Back Button */}
                <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
                  <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
                </TouchableOpacity>

                {/* Restaurant Info Card with Shimmer */}
                <View style={styles.restaurantCard}>
                  <View style={styles.restaurantTopRow}>
                    <View style={styles.restaurantNameRow}>
                      <Shimmer width={180} height={20} borderRadius={4} backgroundColor="#E8E8E8" />
                    </View>
                    <View style={styles.ratingContainer}>
                      <Shimmer width={80} height={16} borderRadius={4} backgroundColor="#E8E8E8" />
                    </View>
                  </View>

                  {/* Dotted Divider */}
                  <View style={styles.dividerContainer}>
                    {Array.from({ length: 30 }).map((_, index) => (
                      <View key={index} style={styles.dash} />
                    ))}
                  </View>

                  <View style={styles.restaurantBottomRow}>
                    <Shimmer width={120} height={14} borderRadius={4} backgroundColor="#E8E8E8" />
                    <Shimmer width={80} height={14} borderRadius={4} backgroundColor="#E8E8E8" />
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.headerImage}>
              {restaurantData?.logo_url && (
                <ImageBackground
                  source={{ uri: restaurantData.logo_url }}
                  style={[StyleSheet.absoluteFill, styles.headerImage]}
                  resizeMode="cover"
                />
              )}

              <View style={[styles.headerOverlay, { paddingTop: insets.top + 10, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
                {/* Back Button */}
                <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
                  <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
                </TouchableOpacity>

                {/* Restaurant Info Card */}
                <View style={styles.restaurantCard}>
                  <View style={styles.restaurantTopRow}>
                    <View style={styles.restaurantNameContainer}>
                      <TouchableOpacity
                        style={styles.restaurantNameRow}
                        onPress={onNavigateToDetails}
                        activeOpacity={1}
                        disabled={!onNavigateToDetails}
                      >
                        <View style={styles.restaurantNameWithIcon}>
                          <Text style={styles.restaurantName} numberOfLines={2}>
                            {restaurantData?.name || restaurantName || 'Restaurant'}
                          </Text>
                          {onNavigateToDetails && (
                            <MaterialIcons name="info-outline" size={18} color="#00B14F" style={styles.infoIcon} />
                          )}
                        </View>
                      </TouchableOpacity>
                      {/* Opening Message */}
                      {restaurantOpeningMessage && (
                        <View style={styles.openingMessageContainer}>
                          <MaterialIcons name="access-time" size={14} color="#FF6B6B" />
                          <Text style={styles.openingMessage}>{restaurantOpeningMessage}</Text>
                        </View>
                      )}
                    </View>
                    {/* Only show rating if available */}
                    {((restaurantData?.stats?.average_rating && restaurantData?.stats?.average_rating > 0) || (restaurantData?.rating && restaurantData?.rating > 0)) && (
                      <View style={styles.ratingContainer}>
                        <View style={styles.ratingBadge}>
                          <MaterialIcons name="star" size={14} color="#00B14F" />
                          <Text style={styles.ratingText}>
                            {(restaurantData?.stats?.average_rating || restaurantData?.rating || 0).toFixed(1)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Dotted Divider */}
                  <View style={styles.dividerContainer}>
                    {Array.from({ length: 30 }).map((_, index) => (
                      <View key={index} style={styles.dash} />
                    ))}
                  </View>

                  <View style={styles.restaurantBottomRow}>
                    <Text style={styles.locationText}>
                      {restaurantData?.locations?.[0]?.locality ||
                        restaurantData?.location?.locality ||
                        'Location'}
                    </Text>
                    <Text style={styles.deliveryText}>{restaurantData?.delivery_time || '25-30 mins'}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Filter Buttons with Search - STICKY */}
          <SafeAreaView edges={['top']} style={styles.filterSafeArea} collapsable={false}>
            <View style={styles.filterSectionContainer} collapsable={false}>
              <View style={styles.filterSection} collapsable={false}>
                <View style={styles.filterButtonsGroup}>
                  {/* <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowFilterModal(true)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="filter-list" size={14} color="#000000" />
                <Text style={styles.filterText}>Filters</Text>
              </TouchableOpacity> */}

                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      activeDietaryFilter === 'veg' && styles.filterButtonActive
                    ]}
                    onPress={() => toggleDietaryFilter('veg')}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {activeDietaryFilter === 'veg' ? (
                      <MaterialIcons name="close" size={14} color="#000000" />
                    ) : (
                      <View style={styles.vegIcon}>
                        <View style={styles.vegDot} />
                      </View>
                    )}
                    <Text style={[
                      styles.filterText,
                      activeDietaryFilter === 'veg' && styles.filterTextActive
                    ]}>
                      Veg
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.filterButton,
                      activeDietaryFilter === 'non-veg' && styles.filterButtonActive
                    ]}
                    onPress={() => toggleDietaryFilter('non-veg')}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {activeDietaryFilter === 'non-veg' ? (
                      <MaterialIcons name="close" size={14} color="#000000" />
                    ) : (
                      <View style={styles.nonVegIcon}>
                        <View style={styles.nonVegDot} />
                      </View>
                    )}
                    <Text style={[
                      styles.filterText,
                      activeDietaryFilter === 'non-veg' && styles.filterTextActive
                    ]}>
                      Non - Veg
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Search Button - right aligned */}
                {!isRestaurantClosed && (
                  <TouchableOpacity
                    style={styles.searchButton}
                    onPress={() => setShowSearch(true)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialIcons name="search" size={24} color="#00B14F" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </SafeAreaView>

          {/* Menu Sections */}
          <View style={styles.menuContent}>
            {isLoading ? (
              // Show shimmer loading cards while data is loading
              <View style={styles.loadingMenuContainer}>
                {[1, 2].map((sectionIndex) => (
                  <View key={`shimmer-section-${sectionIndex}`} style={styles.menuSection}>
                    {/* Section Header Shimmer */}
                    <View style={styles.sectionHeader}>
                      <Shimmer width={150} height={18} borderRadius={4} backgroundColor="#E8E8E8" />
                      <Shimmer width={24} height={24} borderRadius={12} backgroundColor="#E8E8E8" />
                    </View>

                    {/* Menu Items Shimmer */}
                    {[1, 2, 3].map((itemIndex) => (
                      <View key={`shimmer-item-${sectionIndex}-${itemIndex}`}>
                        <View style={styles.menuItem}>
                          <View style={styles.shimmerItemLeft}>
                            <Shimmer width={120} height={12} borderRadius={4} backgroundColor="#E8E8E8" style={{ marginBottom: 8 }} />
                            <Shimmer width={100} height={20} borderRadius={4} backgroundColor="#E8E8E8" style={{ marginBottom: 6 }} />
                            <Shimmer width={70} height={14} borderRadius={4} backgroundColor="#E8E8E8" style={{ marginBottom: 8 }} />
                            <Shimmer width={130} height={10} borderRadius={4} backgroundColor="#E8E8E8" style={{ marginBottom: 4 }} />
                            <Shimmer width={130} height={10} borderRadius={4} backgroundColor="#E8E8E8" />
                          </View>
                          <View style={styles.itemRight}>
                            <Shimmer width={155} height={137} borderRadius={16} backgroundColor="#E8E8E8" />
                          </View>
                        </View>
                      </View>
                    ))}
                    {/* Line after shimmer items */}
                    <View style={styles.categoryEndLine} />
                  </View>
                ))}
              </View>
            ) : hasNoItemsAtAll ? (
              <View style={styles.noItemsContainer}>
                <MaterialIcons name="restaurant" size={48} color="rgba(0, 0, 0, 0.3)" />
                <Text style={styles.noItemsTitle}>No menu available</Text>
                <Text style={styles.noItemsMessage}>
                  This restaurant hasn't added any menu items yet. Please check back later.
                </Text>
              </View>
            ) : hasNoVegItems ? (
              <View style={styles.noItemsContainer}>
                <MaterialIcons name="eco" size={48} color="#00B14F" />
                <Text style={styles.noItemsTitle}>No vegetarian items</Text>
                <Text style={styles.noItemsMessage}>
                  This restaurant doesn't have vegetarian items. Turn off veg mode to see all items.
                </Text>
                <TouchableOpacity
                  style={styles.turnOffVegModeButton}
                  onPress={async () => {
                    await setVegMode('off');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.turnOffVegModeButtonText}>Turn Off Veg Mode</Text>
                </TouchableOpacity>
              </View>
            ) : hasNoFilteredItems ? (
              <View style={styles.noItemsContainer}>
                <MaterialIcons name="search-off" size={48} color="rgba(0, 0, 0, 0.3)" />
                <Text style={styles.noItemsTitle}>No items found</Text>
                <Text style={styles.noItemsMessage}>
                  No {activeDietaryFilter === 'veg' ? 'vegetarian' : 'non-vegetarian'} items available in this restaurant.
                </Text>
              </View>
            ) : (
              filteredMenuSections.map((section) => (
                <View
                  key={section.id}
                  style={styles.menuSection}
                  ref={(ref) => {
                    sectionRefs.current[section.id] = ref;
                  }}
                  onLayout={(event) => handleSectionLayout(section.id, event)}
                >
                  <TouchableOpacity
                    style={[
                      styles.sectionHeader,
                      section.isExpanded && styles.sectionHeaderExpanded
                    ]}
                    onPress={() => toggleSection(section.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <MaterialIcons
                      name="arrow-drop-down"
                      size={24}
                      color="#000000"
                      style={[
                        styles.arrowIcon,
                        section.isExpanded && styles.arrowIconExpanded,
                      ]}
                    />
                  </TouchableOpacity>

                  {section.isExpanded && section.items.map((item) => {
                    // Check if item is available based on its own timings
                    const isItemCurrentlyAvailable = isItemAvailable(item.timings);

                    // Item is only available if BOTH restaurant is open AND item timing is available
                    const itemAvailable = !isRestaurantClosed && isItemCurrentlyAvailable;

                    // Get next available time slot to check if available today
                    const nextAvailableTime = getNextAvailableTime(item.timings);

                    // Format delivery date for display

                    return (
                      <View key={item.id}>
                        <View style={styles.menuItem}>
                          <View style={styles.itemLeft}>
                            {/* Veg/Non-Veg Icon and Spicy Badge */}
                            <View style={styles.itemBadges}>
                              <View style={[
                                styles.vegIconLarge,
                                !item.isVeg && styles.nonVegIconLarge
                              ]}>
                                <View style={[
                                  styles.vegDotLarge,
                                  !item.isVeg && styles.nonVegDotLarge
                                ]} />
                              </View>
                              {item.isSpicy && (
                                <View style={styles.spicyBadge}>
                                  <MaterialIcons name="local-fire-department" size={9} color="#FF0000" />
                                  <Text style={styles.spicyText}>Spicy</Text>
                                </View>
                              )}
                            </View>

                            {/* Item Name */}
                            <Text style={styles.itemName}>{item.name}</Text>

                            {/* Best Seller Badge */}
                            {item.isBestSeller && (
                              <View style={styles.bestSellerBadge}>
                                <MaterialIcons name="star" size={8} color="#FFC529" />
                                <Text style={styles.bestSellerText}>Best Seller</Text>
                              </View>
                            )}

                            {/* Price */}
                            {item.isPreorderAvailable && item.preorderCampaign && parseFloat(item.preorderCampaign.discount_amount || '0') > 0 ? (
                              <View style={styles.priceContainer}>
                                <Text style={[styles.itemPrice, styles.strikethroughPrice]}>₹ {item.price.toFixed(2)}</Text>
                                <Text style={[styles.itemPrice, styles.discountedPrice]}>
                                  ₹ {(item.price - parseFloat(item.preorderCampaign.discount_amount || '0')).toFixed(2)}
                                </Text>
                              </View>
                            ) : (
                              <Text style={styles.itemPrice}>₹ {item.price.toFixed(2)}</Text>
                            )}

                            {/* Description */}
                            <View style={styles.descriptionContainer}>
                              <Text
                                style={styles.itemDescription}
                                numberOfLines={expandedDescriptions.has(item.id) ? undefined : 2}
                              >
                                {item.description}
                              </Text>
                              {SHOW_DESCRIPTION_MORE_BUTTON && item.description && item.description.length > 80 && (
                                <TouchableOpacity
                                  onPress={() => toggleDescription(item.id)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.moreButton}>
                                    {expandedDescriptions.has(item.id) ? 'Less' : 'More'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>

                          <View style={styles.itemRight}>
                            {/* Item Image with Shimmer or No Image Box */}
                            <TouchableOpacity
                              style={styles.itemImageContainer}
                              onPress={() => handleImageClick(item)}
                              activeOpacity={0.9}
                            >
                              {item.image ? (
                                <>
                                  <OptimizedImage
                                    source={item.image}
                                    style={styles.itemImage}
                                    contentFit="cover"
                                    onLoad={() => handleImageLoad(item.id)}
                                    shimmerWidth={166}
                                    shimmerHeight={137}
                                    shimmerBorderRadius={16}
                                    transition={200}
                                    priority="normal"
                                    cachePolicy="memory-disk"
                                  />

                                  {/* Top Gradient Overlay */}
                                  <LinearGradient
                                    colors={['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.1)', 'transparent']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 0, y: 1 }}
                                    style={styles.itemGradientOverlayTop}
                                  />

                                  {/* Preorder Badge Overlay on Image - Top Left */}
                                  {item.isPreorderAvailable && (
                                    <View style={styles.preorderImageBadge}>
                                      <LinearGradient
                                        colors={['#00B14F', '#00A048']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.preorderImageBadgeGradient}
                                      >
                                        <MaterialIcons name="schedule" size={12} color="#FFFFFF" />
                                        <Text style={styles.preorderImageBadgeText}>Preorder</Text>
                                      </LinearGradient>
                                    </View>
                                  )}

                                  {/* Heart Button Overlay */}
                                  <TouchableOpacity
                                    style={styles.itemHeartButton}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      handleToggleFavoriteItem(section.id, item.id);
                                    }}
                                    disabled={togglingFavoriteItemId === item.id}
                                    activeOpacity={0.7}
                                  >
                                    {togglingFavoriteItemId === item.id ? (
                                      <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                      <MaterialIcons
                                        name={item.isFavorite ? 'favorite' : 'favorite-border'}
                                        size={24}
                                        color={item.isFavorite ? '#FF0000' : '#FFFFFF'}
                                      />
                                    )}
                                  </TouchableOpacity>

                                  {/* Gray Overlay for Unavailable Items - Only on image */}
                                  {!itemAvailable && (
                                    <View style={styles.unavailableOverlay} />
                                  )}
                                </>
                              ) : (
                                <View style={styles.noImageContainer}>
                                  <Text style={styles.noImageText}>No Image Available</Text>

                                  {/* Gray Overlay for Unavailable Items - Also on no image container */}
                                  {!itemAvailable && (
                                    <View style={styles.unavailableOverlay} />
                                  )}

                                  {/* Preorder Badge Overlay on No Image - Top Left */}
                                  {item.isPreorderAvailable && (
                                    <View style={styles.preorderImageBadge}>
                                      <LinearGradient
                                        colors={['#00B14F', '#00A048']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.preorderImageBadgeGradient}
                                      >
                                        <MaterialIcons name="schedule" size={12} color="#FFFFFF" />
                                        <Text style={styles.preorderImageBadgeText}>Preorder</Text>
                                      </LinearGradient>
                                    </View>
                                  )}

                                  {/* Heart Button Overlay - Same as when image exists */}
                                  <TouchableOpacity
                                    style={styles.itemHeartButton}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      handleToggleFavoriteItem(section.id, item.id);
                                    }}
                                    disabled={togglingFavoriteItemId === item.id}
                                    activeOpacity={0.7}
                                  >
                                    {togglingFavoriteItemId === item.id ? (
                                      <ActivityIndicator size="small" color="#000000" />
                                    ) : (
                                      <MaterialIcons
                                        name={item.isFavorite ? 'favorite' : 'favorite-border'}
                                        size={24}
                                        color={item.isFavorite ? '#FF0000' : '#9E9E9E'}
                                      />
                                    )}
                                  </TouchableOpacity>
                                </View>
                              )}

                              {/* Availability Badge - Bottom Left (like RestaurantCard design) */}
                              {!itemAvailable && (
                                <View style={styles.availabilityBadge}>
                                  {nextAvailableTime?.availableTime ? (
                                    // Item will be available today - show timing with AM/PM and "today" on same line
                                    <Text style={styles.availabilityTimeTextMain}>
                                      Available at {nextAvailableTime.availableTime}
                                      <Text style={styles.availabilityTimeTextSub}> today</Text>
                                    </Text>
                                  ) : (
                                    // Not available today - show simple message
                                    <Text style={styles.availabilityTimeTextMain}>
                                      Not available
                                    </Text>
                                  )}
                                </View>
                              )}
                            </TouchableOpacity>

                            {/* Add Button or Increment/Decrement Controls */}
                            {/* Only show when item is available and image is loaded (or no image) */}
                            {itemAvailable && (loadedImages.has(item.id) || !item.image) && (
                              <>
                                {cart[item.id] ? (
                                  // Show increment/decrement controls if item is in cart
                                  <View style={styles.quantityControl}>
                                    <TouchableOpacity
                                      style={styles.quantityButton}
                                      onPress={() => decrementItem(item.id)}
                                      activeOpacity={0.7}
                                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                      <Text style={styles.quantityButtonText}>-</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.quantityText}>{getItemQuantity(item.id)}</Text>
                                    <TouchableOpacity
                                      style={[
                                        styles.quantityButton,
                                        item.isPreorderAvailable && getItemQuantity(item.id) >= 1 && styles.quantityButtonDisabled
                                      ]}
                                      onPress={() => incrementItem(item.id)}
                                      activeOpacity={0.7}
                                      disabled={item.isPreorderAvailable && getItemQuantity(item.id) >= 1}
                                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                      <Text style={[
                                        styles.quantityButtonText,
                                        item.isPreorderAvailable && getItemQuantity(item.id) >= 1 && styles.quantityButtonTextDisabled
                                      ]}>+</Text>
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  // Show Add button
                                  <TouchableOpacity
                                    style={styles.addButton}
                                    onPress={() => {
                                      if (item.isCustomizable) {
                                        // Open customization modal for customizable items
                                        handleCustomizableItemClick(item);
                                      } else {
                                        // Add directly to cart for non-customizable items
                                        addToCart(item);
                                      }
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={styles.addButtonPlus}>+</Text>
                                    <Text style={styles.addButtonText}>Add</Text>
                                  </TouchableOpacity>
                                )}
                              </>
                            )}

                            {/* Customizable Text */}
                            {loadedImages.has(item.id) && item.isCustomizable && (
                              <Text style={styles.customizableText}>Customisable</Text>
                            )}
                          </View>
                        </View>
                      </View>
                    )
                  })}
                </View>
              ))
            )}
          </View>

          <AppFooter />
        </ScrollView>

        {/* Bottom Cart Bar */}
        {totalCartItems > 0 && (
          <View style={[styles.cartBar, { bottom: 0, paddingBottom: insets.bottom + 10 }]}>
            <TouchableOpacity
              style={styles.cartButton}
              onPress={async () => {
                if (!onNavigateToCheckout) return;
                if (!ensureRestaurantOpen()) return;

                // Flush any pending debounced quantity update so checkout sees the latest cart in the API
                await flushPendingQuantityUpdate();

                const restaurantAddress =
                  restaurantData?.locations?.[0]?.address ||
                  restaurantData?.location?.address ||
                  [
                    restaurantData?.locations?.[0]?.locality || restaurantData?.location?.locality,
                    restaurantData?.locations?.[0]?.city || restaurantData?.location?.city,
                  ]
                    .filter(Boolean)
                    .join(', ') ||
                  'Restaurant Address';

                onNavigateToCheckout(restaurantId, restaurantName || '', restaurantAddress, 'restaurant');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.cartItemCount}>
                {totalCartItems} Item{totalCartItems > 1 ? 's' : ''} Added
              </Text>
              <View style={styles.viewCartButton}>
                <Text style={styles.viewCartText}>View Cart</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#181C2E" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Floating Menu Button - Toggle (only show when menu is closed) */}
        {!showQuickMenu && (
          <TouchableOpacity
            style={[
              styles.floatingMenuButton,
              totalCartItems > 0 && styles.floatingMenuButtonWithCart,
              { bottom: totalCartItems > 0 ? 145 : 45 }
            ]}
            onPress={() => setShowQuickMenu(true)}
          >
            <MaterialIcons name="restaurant-menu" size={20} color="#000000" />
          </TouchableOpacity>
        )}

        {/* Overlay - closes menu when clicking outside */}
        {showQuickMenu && (
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setShowQuickMenu(false)}
          />
        )}

        {/* Close Menu Button (only show when menu is open) */}
        {showQuickMenu && (
          <TouchableOpacity
            style={[
              styles.closeMenuButton,
              totalCartItems > 0 && styles.closeMenuButtonWithCart,
              { bottom: totalCartItems > 0 ? 125 : 45 }
            ]}
            onPress={() => setShowQuickMenu(false)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="close" size={16} color="#000000" />
            <Text style={styles.closeMenuText}>Menu</Text>
          </TouchableOpacity>
        )}

        {/* Quick Menu Panel */}
        {showQuickMenu && menuSections.length > 0 && (
          <View style={[
            styles.quickMenuPanel,
            totalCartItems > 0 && styles.quickMenuPanelWithCart,
            { bottom: totalCartItems > 0 ? 180 : 100 }
          ]}>
            <ScrollView style={styles.quickMenuScroll} showsVerticalScrollIndicator={false}>
              {menuSections.map((section) => (
                <TouchableOpacity
                  key={section.id}
                  style={[
                    styles.quickMenuItem,
                    activeCategoryId === section.id && styles.quickMenuItemActive
                  ]}
                  onPress={() => scrollToCategory(section.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.quickMenuText,
                      activeCategoryId === section.id && styles.quickMenuTextActive
                    ]}
                    numberOfLines={1}
                  >
                    {section.title}
                  </Text>
                  <Text
                    style={[
                      styles.quickMenuCount,
                      activeCategoryId === section.id && styles.quickMenuCountActive
                    ]}
                  >
                    {section.items.length}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {/* Customization Modal */}
      <CustomizationModal
        visible={showCustomizationModal}
        item={selectedCustomizableItem}
        preselectedAddOns={preselectedAddOns}
        initialQuantity={editingVariantQuantity}
        onClose={() => {
          // Just close the modal and reset editing state
          setShowCustomizationModal(false);
          setSelectedCustomizableItem(null);
          setEditingVariantId(null);
          setEditingVariantQuantity(undefined);
          setPreselectedAddOns([]);
          // Order details remains open if it was already open
        }}
        onAddToCart={handleAddCustomizableItem}
      />

      {/* Customisations Review Modal */}
      {reviewingItemId && cart[reviewingItemId] && (
        <CustomisationsReviewModal
          visible={showCustomisationsReviewModal}
          itemName={cart[reviewingItemId].name}
          basePrice={cart[reviewingItemId].price}
          variants={(cart[reviewingItemId].variants || []).map(v => ({
            id: v.id,
            addOns: v.addOns || [],
            addOnNames: v.addOnNames,
            price: v.price,
            quantity: v.quantity,
            isVeg: cart[reviewingItemId].isVeg,
          }))}
          onClose={() => {
            setShowCustomisationsReviewModal(false);
            setReviewingItemId(null);
          }}
          onIncrement={handleIncrementVariant}
          onDecrement={handleDecrementVariant}
          onEdit={handleEditVariant}
          onAddNewCustomisation={handleAddNewCustomisation}
          onConfirm={handleConfirmCustomisations}
        />
      )}

      {/* Food Item Detail Modal */}
      <FoodItemDetailModal
        visible={showDetailModal}
        item={selectedDetailItem}
        initialQuantity={selectedDetailItem ? (getItemQuantity(selectedDetailItem.id) || undefined) : undefined}
        maxQuantity={MAX_ITEM_QUANTITY}
        isAvailable={selectedDetailItemAvailable}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedDetailItem(null);
          setSelectedDetailItemAvailable(true);
        }}
        onAddToCart={handleAddFromDetail}
      />

      {/* Filter Modal */}
      {/* <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setShowFilterModal(false);
        }}
        initialFilters={filters}
      /> */}

      {/* Search Screen */}
      {showSearch && (
        <View style={styles.searchOverlay}>
          <SearchScreen
            menuItems={menuSections}
            cart={Object.keys(cart).reduce((acc, key) => {
              const item = cart[key];
              acc[key] = {
                id: item.id,
                name: item.name,
                price: item.price,
                isVeg: item.isVeg,
                isCustomizable: item.isCustomizable,
                quantity: item.quantity,
                variants: item.variants?.map(v => ({
                  id: v.id,
                  addOns: v.addOns || [],
                  addOnNames: v.addOnNames,
                  price: v.price,
                  quantity: v.quantity,
                })),
              };
              return acc;
            }, {} as { [key: string]: any })}
            onAddToCart={addToCart}
            onIncrementItem={incrementItem}
            onDecrementItem={decrementItem}
            onCustomizableItemClick={handleCustomizableItemClick}
            onImageClick={handleImageClick}
            loadedImages={loadedImages}
            onImageLoad={handleImageLoad}
            isRestaurantClosed={isRestaurantClosed}
            onBack={() => setShowSearch(false)}
          />
        </View>
      )}

      {/* Order Success Screen */}
      {showOrderSuccess && (
        <View style={styles.orderSuccessOverlay}>
          <OrderSuccessScreen
            onContinue={() => {
              setShowOrderSuccess(false);
              clearCart(); // Clear the cart after successful order
            }}
          />
        </View>
      )}

      {/* Restaurant Closed Modal */}
      <Modal
        visible={showClosedModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCloseClosedModal}
      >
        <View style={styles.closedModalOverlay}>
          <View style={styles.closedModalContent}>
            <MaterialIcons name="access-time" size={32} color="#FF6B6B" />
            <Text style={styles.closedModalTitle}>Restaurant is currently closed</Text>
            <TouchableOpacity
              style={styles.closedModalButton}
              onPress={handleCloseClosedModal}
              activeOpacity={0.8}
            >
              <Text style={styles.closedModalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  animatedContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  headerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.32,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  headerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 20,
    paddingBottom: 20,
    justifyContent: 'space-between',
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
  restaurantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  restaurantTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  restaurantNameContainer: {
    flex: 1,
    gap: 4,
  },
  restaurantNameRow: {
    position: 'relative',
    marginRight: 8,
  },
  restaurantNameWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restaurantName: {
    fontFamily: 'Poppins_700Bold',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    opacity: 0.85,
    flexShrink: 1,
  },
  infoIcon: {
    marginTop: 2,
  },
  openingMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  openingMessage: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#FF6B6B',
  },
  ratingContainer: {
    alignItems: 'center',
    gap: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    backgroundColor: 'rgba(0, 128, 74, 0.1)',
    borderRadius: 13,
  },
  ratingText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#00B14F',
    opacity: 0.85,
  },
  reviewCountText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 15,
    color: '#000000',
    opacity: 0.6,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    height: 1,
  },
  dash: {
    width: 8,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  restaurantBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  locationText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(0, 0, 0, 0.5)',
    opacity: 0.85,
  },
  deliveryText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 20,
    color: '#00B14F',
    opacity: 0.85,
  },
  filterSafeArea: {
    backgroundColor: '#FFFFFF', // Add background for sticky effect
    zIndex: 10
  },
  filterSectionContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 0,
    marginTop: -20,
  },
  scrollContainer: {
    flex: 1,
  },
  filterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
    height: 29,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 13,
  },
  filterButtonActive: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
    height: 29,
    backgroundColor: 'rgba(0, 177, 79, 0.1)',
    borderWidth: 1,
    borderColor: '#00B14F',
    borderRadius: 13,
  },
  filterText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    opacity: 0.85,
  },
  filterTextActive: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#00B14F',
    opacity: 0.85,
  },
  vegIcon: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00B14F',
  },
  nonVegIcon: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nonVegDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FF0000',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    flex: 1,
    marginTop: 0,
  },
  menuContent: {
    paddingHorizontal: 0,
    paddingBottom: 40,
  },
  menuContentWithCart: {
    paddingBottom: 120,
  },
  loadingMenuContainer: {
    paddingTop: 10,
  },
  menuSection: {
    // backgroundColor: '#FFFFFF',
    // borderRadius: 10,
    marginHorizontal: 10,
    // marginTop: 16,
    // marginBottom: 10,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginHorizontal: 0,
    marginVertical: 0,
  },
  sectionHeaderExpanded: {
    // borderBottomWidth: 1,
    // borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left',
    color: '#000000',
    opacity: 0.85,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 0,
    marginHorizontal: 10,
    height: 170,
    marginTop: 16,
  },
  itemDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    // marginVertical: 6,
    marginBottom: 6,
    height: 1,
  },
  itemLeft: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 12,
    gap: 3,
  },
  shimmerItemLeft: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 0,
    paddingRight: 35,
    gap: 3,
  },
  itemBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
    flexWrap: 'wrap',
    minHeight: 13,
  },
  itemBadgesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  freeDeliveryTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 2,
    height: 13,
    backgroundColor: 'rgba(0, 177, 79, 0.12)',
    borderWidth: 0.5,
    borderColor: '#00B14F',
    borderRadius: 8,
  },
  freeDeliveryTopText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 7,
    lineHeight: 10,
    color: '#00B14F',
  },
  vegIconLarge: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDotLarge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00B14F',
  },
  nonVegIconLarge: {
    borderColor: '#FF0000',
  },
  nonVegDotLarge: {
    backgroundColor: '#FF0000',
  },
  spicyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 1,
    height: 13,
    backgroundColor: 'rgba(213, 0, 0, 0.13)',
    borderWidth: 0.5,
    borderColor: '#FF0000',
    borderRadius: 13,
  },
  spicyText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 7,
    lineHeight: 10,
    color: '#FF0000',
    opacity: 0.85,
  },
  itemName: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left',
    color: '#000000',
    opacity: 0.85,
  },
  bestSellerBadge: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 4,
    gap: 1,
    width: 55,
    height: 16,
    backgroundColor: 'linear-gradient(90deg, #FFF2CF 0%, rgba(255, 255, 255, 0) 100%)',
    borderRadius: 2,
  },
  bestSellerText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 8,
    lineHeight: 12,
    color: '#000000',
    opacity: 0.85,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemPrice: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    opacity: 0.85,
  },
  strikethroughPrice: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  discountedPrice: {
    color: '#00B14F',
    opacity: 1,
  },
  preorderDiscountContainer: {
    marginTop: 3,
    marginBottom: 2,
  },
  preorderDiscountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  preorderDiscountAmount: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#00B14F',
  },
  preorderPriceContainer: {
    marginTop: 2,
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  originalPrice: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.45)',
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
  },
  finalPrice: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    lineHeight: 24,
    color: '#00B14F',
  },
  deliveryDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  deliveryDateText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
  },
  availableSlotsText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(0, 0, 0, 0.5)',
    opacity: 0.85,
  },
  menuItemPreorder: {
    borderLeftWidth: 2,
    borderLeftColor: '#00B14F',
    paddingLeft: 6,
    backgroundColor: 'rgba(0, 177, 79, 0.02)',
    borderRadius: 2,
  },
  descriptionContainer: {
    width: 150,
  },
  itemDescription: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
  },
  moreButton: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: '#00B14F',
    marginTop: 2,
  },
  itemRight: {
    width: 155,
    alignItems: 'center',
    gap: 26,
  },
  itemImageContainer: {
    width: 155,
    height: 137,
    borderRadius: 16,
    position: 'relative',
  },
  imageShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  itemImage: {
    width: 155,
    height: 137,
    borderRadius: 16,
    padding: 2,
  },
  noImageContainer: {
    width: 155,
    height: 137,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'solid',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    position: 'relative',
  },
  noImageText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  itemGradientOverlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  itemHeartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 10,
  },
  preorderImageBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  preorderImageBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  preorderImageBadgeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    lineHeight: 14,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  unavailableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(120, 120, 120, 0.75)',
    borderRadius: 16,
    zIndex: 5,
  },
  availabilityBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    zIndex: 6,
  },
  availabilityTimeTextMain: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  availabilityTimeTextSub: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  addButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 13,
    gap: 2,
    width: 76,
    height: 37,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#00B14F',
    borderRadius: 9,
    position: 'absolute',
    top: 115,
    left: 39.5,
  },
  addButtonDisabled: {
    borderColor: 'rgba(0, 177, 79, 0.4)',
    backgroundColor: '#F5F5F5',
  },
  addButtonPlus: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 18,
    lineHeight: 27,
    color: '#00B14F',
    opacity: 0.85,
    ...Platform.select({
      ios: {
        marginTop: -3,
      },
    }),
  },
  addButtonDisabledText: {
    color: 'rgba(0, 177, 79, 0.4)',
  },
  addButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 17,
    lineHeight: 26,
    color: '#00B14F',
    opacity: 0.85,
    ...Platform.select({
      ios: {
        marginTop: -3,
      },
    }),
  },
  quantityControl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    width: 76,
    height: 37,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#00B14F',
    borderRadius: 9,
    position: 'absolute',
    top: 115,
    left: 39.5,
  },
  quantityButton: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 20,
    color: '#00B14F',
    opacity: 0.85,
    marginTop: -2,
  },
  quantityButtonTextDisabled: {
    color: 'rgba(0, 177, 79, 0.4)',
  },
  quantityText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#00B14F',
    minWidth: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  customizableText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
    width: 181,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  categoryEndLine: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 20,
    marginTop: 16,
  },
  categoryCollapsedContent: {
    paddingVertical: 20,
  },
  categoryCollapsedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    height: 1,
  },
  categoryGapLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginVertical: 16,
    height: 1,
  },
  categoryExpandedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 0,
    height: 1,
  },
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  cartButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    height: 60,
    backgroundColor: '#181C2E',
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 29,
    elevation: 5,
  },
  cartItemCount: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  viewCartButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
  },
  viewCartText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#181C2E',
    opacity: 0.85,
  },
  floatingMenuButton: {
    position: 'absolute',
    right: 20,
    bottom: 45,
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#FFC529',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 29,
    elevation: 10,
  },
  floatingMenuButtonWithCart: {
    bottom: 125,
  },
  arrowIcon: {
    transform: [{ rotate: '0deg' }],
  },
  arrowIconExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#000000',
    opacity: 0.6,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  closeMenuButton: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 122,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 7,
    backgroundColor: '#FFC529',
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 29,
    elevation: 10,
    zIndex: 3,
  },
  closeMenuButtonWithCart: {
    bottom: 125,
  },
  closeMenuText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    opacity: 0.85,
  },
  quickMenuPanel: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: '60%',
    maxHeight: 280,
    backgroundColor: '#000000',
    borderRadius: 16,
    paddingVertical: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
    zIndex: 2,
  },
  quickMenuPanelWithCart: {
    bottom: 180,
  },
  quickMenuScroll: {
    maxHeight: 280,
  },
  quickMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 6,
  },
  quickMenuItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickMenuText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  quickMenuTextActive: {
    fontFamily: 'Poppins_600SemiBold',
    opacity: 1,
  },
  quickMenuCount: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    opacity: 0.7,
    marginLeft: 12,
  },
  quickMenuCountActive: {
    fontFamily: 'Poppins_600SemiBold',
    opacity: 1,
  },
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: '#FFFFFF',
  },
  orderSuccessOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1001,
  },
  closedModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  closedModalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  closedModalTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 27,
    color: '#111111',
    textAlign: 'center',
  },
  closedModalMessage: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(0, 0, 0, 0.7)',
    textAlign: 'center',
  },
  closedModalButton: {
    marginTop: 12,
    backgroundColor: '#00B14F',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  closedModalButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  noItemsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  noItemsTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    opacity: 0.85,
    marginTop: 16,
    marginBottom: 8,
  },
  noItemsMessage: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
    textAlign: 'center',
  },
  turnOffVegModeButton: {
    marginTop: 20,
    backgroundColor: '#00B14F',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  turnOffVegModeButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
