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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { apiService } from '@/services/api.service';
import { Shimmer } from '@/components/Shimmer';
import { CustomizationModal } from '@/components/CustomizationModal';
import { FoodItemDetailModal } from '@/components/FoodItemDetailModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RestaurantScreenProps {
  restaurantId: number;
  restaurantName?: string;
  onBack?: () => void;
}

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
}

interface MenuSection {
  id: string;
  title: string;
  items: MenuItem[];
  isExpanded: boolean;
}

const CATEGORIES = ['Briyani', 'Idly', 'Dosa', 'Pongal', 'Fried Rice', 'Noodles'];

const MENU_DATA: MenuSection[] = [
  {
    id: '1',
    title: 'Snacks',
    isExpanded: false,
    items: [],
  },
  {
    id: '2',
    title: 'Morning Tiffin',
    isExpanded: false,
    items: [],
  },
  {
    id: '3',
    title: 'Restaurants Near You',
    isExpanded: true,
    items: [
      {
        id: '1',
        name: 'Rava Kichadi',
        price: 120,
        description: 'Spicy Coriander leaves in the top and Freshly Cooked Rav with ghee in the top..More',
        image: require('@/assets/biriyani.png'),
        isVeg: true,
        isSpicy: true,
        isBestSeller: true,
        isCustomizable: true,
      },
      {
        id: '2',
        name: 'Idly',
        price: 120,
        description: 'Spicy Coriander leaves in the top and Freshly Cooked Rav with ghee in the top..More',
        image: require('@/assets/idlies.png'),
        isVeg: true,
        isSpicy: true,
        isBestSeller: true,
        isCustomizable: true,
      },
      {
        id: '3',
        name: 'Pongal',
        price: 120,
        description: 'Spicy Coriander leaves in the top and Freshly Cooked Rav with ghee in the top..More',
        image: require('@/assets/biriyani.png'),
        isVeg: true,
        isSpicy: true,
        isBestSeller: true,
        isCustomizable: true,
      },
    ],
  },
];

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
}

export const RestaurantScreen: React.FC<RestaurantScreenProps> = ({
  restaurantId,
  restaurantName,
  onBack,
}) => {
  const [menuSections, setMenuSections] = useState<MenuSection[]>([]);
  const [restaurantData, setRestaurantData] = useState<any>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Idly');
  const [cart, setCart] = useState<{ [key: string]: CartItem }>({});
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [showCustomizationModal, setShowCustomizationModal] = useState(false);
  const [selectedCustomizableItem, setSelectedCustomizableItem] = useState<MenuItem | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<MenuItem | null>(null);

  const scrollViewRef = React.useRef<ScrollView>(null);
  const sectionRefs = React.useRef<{ [key: string]: View | null }>({});
  const sectionPositions = React.useRef<{ [key: string]: number }>({});

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  // Calculate total cart items
  const totalCartItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);

  console.log('[RestaurantScreen] Component render - restaurantId:', restaurantId, 'name:', restaurantName);

  // Handle image load
  const handleImageLoad = (itemId: string) => {
    setLoadedImages(prev => new Set(prev).add(itemId));
  };

  // Add item to cart
  const addToCart = (item: MenuItem) => {
    setCart(prev => ({
      ...prev,
      [item.id]: {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        isVeg: item.isVeg,
      }
    }));
  };

  // Increment item quantity
  const incrementItem = (itemId: string) => {
    setCart(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quantity: prev[itemId].quantity + 1,
      }
    }));
  };

  // Decrement item quantity
  const decrementItem = (itemId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[itemId].quantity === 1) {
        delete newCart[itemId];
      } else {
        newCart[itemId] = {
          ...newCart[itemId],
          quantity: newCart[itemId].quantity - 1,
        };
      }
      return newCart;
    });
  };

  // Handle opening customization modal
  const handleCustomizableItemClick = (item: MenuItem) => {
    setSelectedCustomizableItem(item);
    setShowCustomizationModal(true);
  };

  // Handle adding customizable item to cart with add-ons
  const handleAddCustomizableItem = (itemId: string, quantity: number, selectedAddOns: string[]) => {
    // For now, we'll just add the item without add-ons tracking
    // You can extend this later to track add-ons in the cart
    const item = menuSections
      .flatMap(section => section.items)
      .find(i => i.id === itemId);

    if (item) {
      setCart(prev => ({
        ...prev,
        [item.id]: {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: quantity,
          isVeg: item.isVeg,
        }
      }));
    }
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

  // Handle opening detail modal
  const handleImageClick = (item: MenuItem) => {
    setSelectedDetailItem(item);
    setShowDetailModal(true);
  };

  // Handle adding item from detail modal
  const handleAddFromDetail = (itemId: string, quantity: number) => {
    const item = menuSections
      .flatMap(section => section.items)
      .find(i => i.id === itemId);

    if (item) {
      setCart(prev => ({
        ...prev,
        [item.id]: {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: quantity,
          isVeg: item.isVeg,
        }
      }));
    }
  };

  // Fetch restaurant details from API
  useEffect(() => {
    console.log('[RestaurantScreen] useEffect triggered with restaurantId:', restaurantId);
    if (restaurantId) {
      fetchRestaurantDetails();
    } else {
      console.log('[RestaurantScreen] No restaurantId provided, skipping API call');
    }
  }, [restaurantId]);

  // Initialize active category when menu sections load
  useEffect(() => {
    if (menuSections.length > 0 && !activeCategoryId) {
      setActiveCategoryId(menuSections[0].id);
    }
  }, [menuSections]);

  // Animate background when modal opens/closes
  useEffect(() => {
    if (showDetailModal) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: -20,
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
  }, [showDetailModal]);

  const fetchRestaurantDetails = async () => {
    console.log('[RestaurantScreen] fetchRestaurantDetails called for ID:', restaurantId);
    try {
      setIsLoading(true);

      // Default location - you can make this dynamic later
      const lat = 9.9352300;
      const lng = 78.1304040;

      console.log('[RestaurantScreen] Making API call to:', `/api/buyer/restaurants/${restaurantId}?lat=${lat}&lng=${lng}&include_items=true`);

      const response = await apiService.get(
        `/api/buyer/restaurants/${restaurantId}?lat=${lat}&lng=${lng}&include_items=true`
      );

      console.log('Restaurant API Response:', JSON.stringify(response.data, null, 2));

      // Handle nested data structure: response.data.data.data
      const nestedData = response.data?.data?.data || response.data?.data;

      if (nestedData) {
        const restaurant = nestedData;
        console.log('Restaurant data:', restaurant);
        setRestaurantData(restaurant);

        // Process categories from API response
        if (restaurant.categories && Array.isArray(restaurant.categories)) {
          console.log('Processing categories:', restaurant.categories.length);

          const sections: MenuSection[] = restaurant.categories.map((category: any, index: number) => {
            console.log(`Category ${index}:`, category.name, 'Items:', category.items?.length || 0);

            // Process items in this category
            const items: MenuItem[] = (category.items || []).map((item: any) => {
              const menuItem = {
                id: item.id.toString(),
                name: item.name,
                price: parseFloat(item.price?.base_price || 0),
                description: item.description || '',
                image: item.images && item.images.length > 0
                  ? { uri: item.images[0] }
                  : require('@/assets/biriyani.png'),
                isVeg: item.dietary_preference === 'veg',
                isSpicy: false, // API doesn't provide this info
                isBestSeller: item.is_recommended || false,
                isCustomizable: item.has_customizations || false,
              };
              console.log(`  Item:`, menuItem.name, `Price: ${menuItem.price}`);
              return menuItem;
            });

            return {
              id: category.id.toString(),
              title: category.name,
              items,
              isExpanded: true, // Expand all sections by default
            };
          });

          console.log('Menu sections created:', sections.length);
          setMenuSections(sections);
        } else {
          console.log('No categories found in restaurant data');
        }
      }
    } catch (error) {
      console.error('Error fetching restaurant details:', error);
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
    event.target.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
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
      >
        {/* Header Image with Overlay */}
        <ImageBackground
          source={
            restaurantData?.logo_url
              ? { uri: restaurantData.logo_url }
              : require('@/assets/biriyani.png')
          }
          style={styles.headerImage}
          resizeMode="cover"
        >
          <View style={styles.headerOverlay}>
            {/* Status Bar Placeholder */}
            <View style={styles.statusBar}>
              <Text style={styles.time}>9:41</Text>
              <View style={styles.statusIcons} />
            </View>

            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
              <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
            </TouchableOpacity>

            {/* Restaurant Info Card */}
            <View style={styles.restaurantCard}>
              <View style={styles.restaurantTopRow}>
                <View style={styles.restaurantNameRow}>
                  <Text style={styles.restaurantName} numberOfLines={1}>
                    {restaurantData?.name || restaurantName || 'Restaurant'}
                  </Text>
                  <MaterialIcons name="info-outline" size={19} color="#00B14F" />
                </View>
                <View style={styles.ratingBadge}>
                  <MaterialIcons name="star" size={14} color="#00B14F" />
                  <Text style={styles.ratingText}>
                    {restaurantData?.stats?.average_rating || restaurantData?.rating || '0'}
                  </Text>
                </View>
              </View>

              {/* Dotted Divider */}
              <View style={styles.dividerContainer}>
                {Array.from({ length: 30 }).map((_, index) => (
                  <View key={index} style={styles.dash} />
                ))}
              </View>

              <View style={styles.restaurantBottomRow}>
                <Text style={styles.locationText}>
                  {restaurantData?.locations?.[0]?.street ||
                   restaurantData?.locations?.[0]?.locality ||
                   restaurantData?.location?.locality ||
                   'Location'}
                </Text>
                <Text style={styles.deliveryText}>{restaurantData?.delivery_time || '25-30 mins'}</Text>
              </View>
            </View>
          </View>
        </ImageBackground>

        {/* Filter Buttons with Search - STICKY */}
        <View style={styles.filterSectionContainer}>
          <View style={styles.filterSection}>
            <View style={styles.filterButtonsGroup}>
              <TouchableOpacity style={styles.filterButton}>
                <MaterialIcons name="filter-list" size={16} color="#000000" />
                <Text style={styles.filterText}>Filters</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.filterButtonActive}>
                <View style={styles.vegIcon}>
                  <View style={styles.vegDot} />
                </View>
                <Text style={styles.filterTextActive}>Veg</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.filterButton}>
                <View style={styles.nonVegIcon}>
                  <View style={styles.nonVegDot} />
                </View>
                <Text style={styles.filterText}>Non - Veg</Text>
              </TouchableOpacity>
            </View>

            {/* Search Button - right aligned */}
            <TouchableOpacity style={styles.searchButton}>
              <MaterialIcons name="search" size={24} color="#00B14F" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Sections */}
        <View style={[styles.menuContent, totalCartItems > 0 && styles.menuContentWithCart]}>
        {menuSections.map((section) => (
          <View
            key={section.id}
            style={styles.menuSection}
            ref={ref => sectionRefs.current[section.id] = ref}
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

            {section.isExpanded && section.items.map((item) => (
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

                  {/* Like and Share Buttons */}
                  <View style={styles.itemActions}>
                    <TouchableOpacity style={styles.actionButton}>
                      <MaterialIcons name="favorite-border" size={17} color="rgba(0, 0, 0, 0.5)" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton}>
                      <MaterialIcons name="share" size={17} color="rgba(0, 0, 0, 0.5)" />
                    </TouchableOpacity>
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
                    />
                  </TouchableOpacity>

                  {/* Add Button or Increment/Decrement Controls */}
                  {loadedImages.has(item.id) && (
                    <>
                      {!item.isCustomizable && cart[item.id] ? (
                        // Show increment/decrement controls if item is in cart and not customizable
                        <View style={styles.quantityControl}>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => decrementItem(item.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.quantityButtonText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.quantityText}>{cart[item.id].quantity}</Text>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => incrementItem(item.id)}
                            activeOpacity={0.7}
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
            ))}
          </View>
        ))}
        </View>
      </ScrollView>

      {/* Bottom Cart Bar */}
      {totalCartItems > 0 && (
        <View style={styles.cartBar}>
          <View style={styles.cartButton}>
            <Text style={styles.cartItemCount}>
              {totalCartItems} Item{totalCartItems > 1 ? 's' : ''} Added
            </Text>
            <View style={styles.viewCartButton}>
              <Text style={styles.viewCartText}>View Cart</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#181C2E" />
            </View>
          </View>
        </View>
      )}

      {/* Floating Menu Button - Toggle (only show when menu is closed) */}
      {!showQuickMenu && (
        <TouchableOpacity
          style={[
            styles.floatingMenuButton,
            totalCartItems > 0 && styles.floatingMenuButtonWithCart
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
            totalCartItems > 0 && styles.closeMenuButtonWithCart
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
          totalCartItems > 0 && styles.quickMenuPanelWithCart
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
        item={selectedCustomizableItem ? {
          ...selectedCustomizableItem,
          addOns: [
            { id: '1', name: 'Gulab Jamun', price: 50, isVeg: true },
            { id: '2', name: 'Kesari', price: 50, isVeg: true, discount: 'Save Upto 25%' },
            { id: '3', name: 'Milk Halwa', price: 50, isVeg: true },
          ],
        } : null}
        onClose={() => {
          setShowCustomizationModal(false);
          setSelectedCustomizableItem(null);
        }}
        onAddToCart={handleAddCustomizableItem}
      />

      {/* Food Item Detail Modal */}
      <FoodItemDetailModal
        visible={showDetailModal}
        item={selectedDetailItem}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedDetailItem(null);
        }}
        onAddToCart={handleAddFromDetail}
      />
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
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 44,
    paddingTop: 10,
  },
  time: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 16,
    color: '#FFFFFF',
  },
  statusIcons: {
    width: 80,
    height: 13,
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
  restaurantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  restaurantName: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
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
  filterSectionContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF', // Add background for sticky effect
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
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 13,
  },
  filterText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    opacity: 0.85,
  },
  filterTextActive: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    opacity: 0.85,
  },
  vegIcon: {
    width: 16,
    height: 16,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00B14F',
  },
  nonVegIcon: {
    width: 16,
    height: 16,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nonVegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  menuSection: {
    gap: 9,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 0,
    marginVertical: 5,
  },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: '600',
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
    fontFamily: 'Poppins',
    fontWeight: '600',
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
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 8,
    lineHeight: 12,
    color: '#000000',
    opacity: 0.85,
  },
  itemPrice: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    opacity: 0.85,
  },
  descriptionContainer: {
    width: 165,
  },
  itemDescription: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
  },
  moreButton: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 18,
    color: '#00B14F',
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 3,
    width: 53,
    height: 25,
  },
  actionButton: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemRight: {
    width: 166,
    alignItems: 'flex-start',
    gap: 26,
  },
  itemImageContainer: {
    width: 166,
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
    width: 166,
    height: 137,
    borderRadius: 16,
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
    left: 53,
  },
  addButtonPlus: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 18,
    lineHeight: 27,
    color: '#00B14F',
    opacity: 0.85,
  },
  addButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 17,
    lineHeight: 26,
    color: '#00B14F',
    opacity: 0.85,
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
    left: 53,
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
    height: 100,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
    paddingHorizontal: 20,
    paddingVertical: 20,
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
});
