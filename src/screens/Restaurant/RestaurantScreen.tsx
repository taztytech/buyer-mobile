import React, { useState, useEffect, useRef } from 'react';
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
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiService } from '@/services/api.service';
import { homeService } from '@/services/home.service';
import { Shimmer } from '@/components/Shimmer';
import { CustomizationModal } from '@/components/CustomizationModal';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RestaurantScreenProps {
  visible: boolean;
  restaurantId: number;
  restaurantName?: string;
  onBack?: () => void;
  onNavigateToDetails?: () => void;
  onNavigateToOrders?: (orderId?: number) => void;
  onNavigateToHome?: () => void;
  onNavigateToCheckout?: (restaurantId: number, restaurantName: string, restaurantAddress?: string, from?: 'home' | 'restaurant') => void;
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

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  image: any;
  isVeg: boolean;
  isSpicy: boolean;
  isBestSeller: boolean;
  isCustomizable: boolean;
  isFavorite?: boolean;
  addOns?: AddOn[];
  customizations?: CustomizationGroup[];
  timings?: ItemTiming[];
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

export const RestaurantScreen: React.FC<RestaurantScreenProps> = ({
  visible,
  restaurantId,
  restaurantName,
  onBack,
  onNavigateToDetails,
  onNavigateToCheckout,
}) => {
  const { cart, addToCart: addToCartContext, removeFromCart, updateQuantity, setRestaurantInfo, clearCart, checkRestaurantConflict } = useCart();
  const { vegMode, setVegMode } = useVegMode();
  const { showConfirmation } = useConfirmation();
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
  const [activeDietaryFilter, setActiveDietaryFilter] = useState<'veg' | 'non-veg' | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [togglingFavoriteItemId, setTogglingFavoriteItemId] = useState<string | null>(null);

  const scrollViewRef = React.useRef<ScrollView>(null);
  const sectionRefs = React.useRef<{ [key: string]: View | null }>({});
  const sectionPositions = React.useRef<{ [key: string]: number }>({});

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


  // Add item to cart (for non-customizable items)
  const addToCart = (item: MenuItem) => {
    // Check if there's a restaurant conflict
    if (checkRestaurantConflict(restaurantId)) {
      showConfirmation({
        title: 'Replace cart item?',
        message: 'Your cart contains dishes from another restaurant. Do you want to discard the selection and add dishes from this restaurant?',
        confirmText: 'Replace',
        cancelText: 'Cancel',
        confirmButtonColor: '#FF0000',
        onConfirm: () => {
          // Clear cart and add new item
          clearCart();
          setRestaurantInfo(restaurantId, restaurantData?.name || restaurantName || 'Restaurant', restaurantData?.logo_url);
          addToCartContext({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            isVeg: item.isVeg,
            isCustomizable: false,
          }, restaurantId);
        },
      });
      return;
    }

    // Always ensure restaurant info is set before adding items
    setRestaurantInfo(restaurantId, restaurantData?.name || restaurantName || 'Restaurant', restaurantData?.logo_url);

    // Pass restaurantId directly to avoid race condition
    addToCartContext({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      isVeg: item.isVeg,
      image: item.image,
      isCustomizable: false,
    }, restaurantId);
  };

  // Increment item quantity
  const incrementItem = (itemId: string) => {
    const cartItem = cart[itemId];

    // If item is customizable, open review modal instead
    if (cartItem?.isCustomizable) {
      setReviewingItemId(itemId);
      setShowCustomisationsReviewModal(true);
      return;
    }

    // For non-customizable items, just increment quantity
    const currentQuantity = cartItem?.quantity || 0;
    updateQuantity(itemId, currentQuantity + 1);
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

    // For non-customizable items, decrement or remove
    const quantity = cartItem?.quantity || 0;
    updateQuantity(itemId, quantity - 1); // updateQuantity will remove if quantity becomes 0
  };

  // Handle opening customization modal
  const handleCustomizableItemClick = (item: MenuItem) => {
    // Check if there's a restaurant conflict
    if (checkRestaurantConflict(restaurantId)) {
      showConfirmation({
        title: 'Replace cart item?',
        message: 'Your cart contains dishes from another restaurant. Do you want to discard the selection and add dishes from this restaurant?',
        confirmText: 'Replace',
        cancelText: 'Cancel',
        confirmButtonColor: '#FF0000',
        onConfirm: () => {
          // Clear cart and open customization modal
          clearCart();
          setRestaurantInfo(restaurantId, restaurantData?.name || restaurantName || 'Restaurant', restaurantData?.logo_url);
          setSelectedCustomizableItem(item);
          setShowCustomizationModal(true);
        },
      });
      return;
    }

    // Always ensure restaurant info is set
    setRestaurantInfo(restaurantId, restaurantData?.name || restaurantName || 'Restaurant', restaurantData?.logo_url);

    setSelectedCustomizableItem(item);
    setShowCustomizationModal(true);
  };

  // Handle adding customizable item to cart with add-ons
  const handleAddCustomizableItem = (itemId: string, quantity: number, selectedAddOns: string[]) => {
    const item = menuSections
      .flatMap(section => section.items)
      .find(i => i.id === itemId);

    if (!item) return;

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
    if (!reviewingItemId) return;

    const item = cart[reviewingItemId];
    if (!item?.variants) return;

    addToCartContext({
      ...item,
      variants: item.variants.map(v =>
        v.id === variantId ? { ...v, quantity: v.quantity + 1 } : v
      ),
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
    setSelectedDetailItem(item);
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
  const getFilteredMenuSections = (): MenuSection[] => {
    return menuSections
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

        // Apply sorting if filter is active
        if (filters.sortBy) {
          filteredItems = [...filteredItems].sort((a, b) => {
            if (filters.sortBy === 'lowToHigh') {
              return a.price - b.price;
            } else if (filters.sortBy === 'highToLow') {
              return b.price - a.price;
            }
            return 0;
          });
        }

        return {
          ...section,
          items: filteredItems,
        };
      })
      .filter(section => section.items.length > 0); // Remove empty sections
  };

  const filteredMenuSections = getFilteredMenuSections();
  const hasNoFilteredItems = activeDietaryFilter && filteredMenuSections.length === 0;
  const hasNoItemsAtAll = !isLoading && menuSections.length === 0;
  const hasNoVegItems = vegMode === 'all' && filteredMenuSections.length === 0 && menuSections.length > 0;

  // Handle adding item from detail modal
  const handleAddFromDetail = (itemId: string, quantity: number) => {
    const item = menuSections
      .flatMap(section => section.items)
      .find(i => i.id === itemId);

    if (item) {
      addToCartContext({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: quantity,
        isVeg: item.isVeg,
        isCustomizable: false,
      });
    }
  };

  // Fetch restaurant details from API
  useEffect(() => {
    if (visible && restaurantId) {
      // Reset scroll immediately when becoming visible
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: false });
      }
      fetchRestaurantDetails();
    } else if (!visible) {
      // Clear data when screen is not visible to prevent showing old cache
      setRestaurantData(null);
      setMenuSections([]);
    }
  }, [visible, restaurantId]);

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

  const fetchRestaurantDetails = async () => {
    try {
      setIsLoading(true);

      // Default location - you can make this dynamic later
      const lat = 9.9352300;
      const lng = 78.1304040;

      // Add minimum delay to show shimmer animation
      const [response] = await Promise.all([
        apiService.get(
          `/api/buyer/restaurants/${restaurantId}?lat=${lat}&lng=${lng}&include_items=true`
        ),
        new Promise(resolve => setTimeout(resolve, 1500)) // 1.5 second delay
      ]);

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

              const menuItem: MenuItem = {
                id: item.id.toString(),
                name: item.name,
                price: parseFloat(item.price?.base_price || 0),
                description: item.description || '',
                image: item.images && item.images.length > 0
                  ? { uri: item.images[0] }
                  : require('@/assets/biriyani.png'),
                isVeg: isVeg,
                isSpicy: false, // API doesn't provide this info
                isBestSeller: item.is_recommended || false,
                isCustomizable: item.has_customizations || false,
                isFavorite: item.is_favorite || false,
                addOns: addOns.length > 0 ? addOns : undefined,
                customizations: item.customizations,
                timings: item.timings || undefined, // Keep API format (1-7)
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
    } finally{
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
        {/* Scrollable Content with Sticky Filter */}
        <ScrollView
        ref={scrollViewRef}
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]} // Make the filter section (index 1) sticky
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
        overScrollMode="never"
        removeClippedSubviews={true}
        decelerationRate="normal"
      >
        {/* Header Image with Overlay */}
        {restaurantData?.logo_url ? (
          <ImageBackground
            source={{ uri: restaurantData.logo_url }}
            style={styles.headerImage}
            resizeMode="cover"
          >
            <View style={styles.headerOverlay}>
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
                    <Text style={styles.restaurantName} numberOfLines={2}>
                      {restaurantData?.name || restaurantName || 'Restaurant'}
                      {onNavigateToDetails && (
                        <Text style={styles.infoIconText}>
                          {' '}
                          <MaterialIcons name="info-outline" size={18} color="#00B14F" />
                        </Text>
                      )}
                    </Text>
                  </TouchableOpacity>
                  {/* Opening Message */}
                  {restaurantData?.timings && (() => {
                    const openingMessage = homeService.getRestaurantOpeningMessage(restaurantData.timings);
                    if (openingMessage) {
                      return (
                        <View style={styles.openingMessageContainer}>
                          <MaterialIcons name="access-time" size={14} color="#FF6B6B" />
                          <Text style={styles.openingMessage}>{openingMessage}</Text>
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>
                {/* Only show rating and reviews if there's at least one review */}
                {(restaurantData?.stats?.total_reviews > 0 || restaurantData?.total_reviews > 0) && (
                  <View style={styles.ratingContainer}>
                    <View style={styles.ratingBadge}>
                      <MaterialIcons name="star" size={14} color="#00B14F" />
                      <Text style={styles.ratingText}>
                        {(restaurantData?.stats?.average_rating || restaurantData?.rating || 0).toFixed(1)}
                      </Text>
                    </View>
                    <Text style={styles.reviewCountText}>
                      {restaurantData?.stats?.total_reviews || restaurantData?.total_reviews || '0'} reviews
                    </Text>
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
          </ImageBackground>
        ) : (
          <View style={styles.headerImage}>
            {/* Shimmer for the banner image */}
            <Shimmer
              width={SCREEN_WIDTH}
              height={252}
              borderRadius={0}
              backgroundColor="#E8E8E8"
              style={{ position: 'absolute', top: 0, left: 0 }}
            />
            <View style={styles.headerOverlay}>
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
        )}

        {/* Filter Buttons with Search - STICKY */}
        <SafeAreaView edges={['top']} style={styles.filterSafeArea}>
          <View style={styles.filterSectionContainer}>
            <View style={styles.filterSection}>
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
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => setShowSearch(true)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="search" size={24} color="#00B14F" />
            </TouchableOpacity>
          </View>
          </View>
        </SafeAreaView>

        {/* Menu Sections */}
        <View style={[
          styles.menuContent,
          totalCartItems > 0 && {
            paddingBottom: 120 + Math.max(insets.bottom, 0)
          }
        ]}>
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
                  <View key={`shimmer-item-${sectionIndex}-${itemIndex}`} style={styles.menuItem}>
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
                ))}
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
                style={styles.sectionHeader}
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
              // Check if restaurant is open
              const isRestaurantOpen = restaurantData?.timings
                ? homeService.isRestaurantOpen(restaurantData.timings)
                : true; // Default to open if no timing data

              // Check if item is available based on its own timings
              const isItemCurrentlyAvailable = isItemAvailable(item.timings);

              // Item is only available if BOTH restaurant is open AND item timing is available
              const itemAvailable = isRestaurantOpen && isItemCurrentlyAvailable;

              return (
              <View key={item.id} style={styles.menuItem}>
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
                  <Text style={styles.itemPrice}>₹ {item.price}</Text>

                  {/* Description */}
                  <View style={styles.descriptionContainer}>
                    <Text
                      style={styles.itemDescription}
                      numberOfLines={expandedDescriptions.has(item.id) ? undefined : 2}
                    >
                      {item.description}
                    </Text>
                    {item.description && item.description.length > 80 && (
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
                  {/* Item Image with Shimmer */}
                  <TouchableOpacity
                    style={styles.itemImageContainer}
                    onPress={() => handleImageClick(item)}
                    activeOpacity={0.9}
                  >
                    {!loadedImages.has(item.id) && (
                      <Shimmer
                        width={166}
                        height={137}
                        borderRadius={16}
                        backgroundColor="#E8E8E8"
                        style={styles.imageShimmer}
                      />
                    )}
                    <Image
                      source={item.image}
                      style={styles.itemImage}
                      resizeMode="cover"
                      onLoad={() => handleImageLoad(item.id)}
                      fadeDuration={0}
                      progressiveRenderingEnabled={true}
                    />

                    {/* Top Gradient Overlay */}
                    <LinearGradient
                      colors={['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.1)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.itemGradientOverlayTop}
                    />

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

                    {/* Grey Overlay for Unavailable Items */}
                    {!itemAvailable && (
                      <View style={styles.unavailableOverlay} />
                    )}
                  </TouchableOpacity>

                  {/* Add Button or Increment/Decrement Controls */}
                  {loadedImages.has(item.id) && itemAvailable && (
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
                            style={styles.quantityButton}
                            onPress={() => incrementItem(item.id)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text style={styles.quantityButtonText}>+</Text>
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
              )
            })}
          </View>
          ))
        )}
        </View>
      </ScrollView>

      {/* Bottom Cart Bar */}
      {totalCartItems > 0 && (
        <View style={[styles.cartBar, { bottom: 0, paddingBottom: insets.bottom }]}>
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => {
              // Navigate to checkout page
              if (onNavigateToCheckout) {
                // Build restaurant address from available data
                const restaurantAddress = restaurantData?.locations?.[0]?.address ||
                  restaurantData?.location?.address ||
                  [
                    restaurantData?.locations?.[0]?.locality || restaurantData?.location?.locality,
                    restaurantData?.locations?.[0]?.city || restaurantData?.location?.city,
                  ].filter(Boolean).join(', ') ||
                  'Restaurant Address';

                onNavigateToCheckout(restaurantId, restaurantData?.name || restaurantName, restaurantAddress, 'restaurant');
              }
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
            { bottom: totalCartItems > 0 ? 130 : 30 }
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
            { bottom: totalCartItems > 0 ? 110 : 30 }
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
        initialQuantity={selectedDetailItem ? (cart[selectedDetailItem.id]?.quantity || undefined) : undefined}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedDetailItem(null);
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
    height: 252,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  headerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 20,
    paddingTop: 50,
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
    marginTop: 10,
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
  restaurantName: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    opacity: 0.85,
  },
  infoIconText: {
    lineHeight: 27,
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
  },
  filterSectionContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
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
    paddingHorizontal: 5,
    paddingTop: 10,
    gap: 20,
  },
  menuSection: {
    gap: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 0,
    marginVertical: 0,
  },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    height: 192,
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
    gap: 3,
    height: 13,
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
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 27,
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
  itemPrice: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    opacity: 0.85,
  },
  descriptionContainer: {
    width: 150,
  },
  itemDescription: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 18,
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
  unavailableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(128, 128, 128, 0.7)',
    borderRadius: 16,
    zIndex: 5,
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
  quantityButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 20,
    color: '#00B14F',
    opacity: 0.85,
    marginTop: -2,
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
    bottom: 30,
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
    bottom: 110,
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
    bottom: 110,
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
