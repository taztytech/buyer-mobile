import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/config/api.config';
import { Shimmer } from '@/components/Shimmer';
import { RestaurantCard } from '@/components/RestaurantCard';
import { SearchBar } from '@/components/SearchBar';
import { homeService } from '@/services/home.service';
import { useVegMode } from '@/context/VegModeContext';
import { addressService } from '@/services/address.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CategoryItem {
  id: number | string;
  name: string;
  description?: string;
  icon?: any;
}

interface CategoryResultsScreenProps {
  categoryName: string;
  categories?: CategoryItem[];
  onBack?: () => void;
  onNavigateToRestaurant?: (restaurantId: number, restaurantName: string) => void;
  selectedLocation?: { name: string; address: string; latitude?: number; longitude?: number };
}

interface TopRatedItem {
  id: string;
  name: string;
  rating: number;
  deliveryTime: string;
  image: any;
}

interface RestaurantTiming {
  day: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
}

interface RestaurantItem {
  id: number;
  name: string;
  description: string;
  logo_url: string;
  rating: number;
  delivery_time: string;
  location: {
    locality: string;
    city: string;
  };
  distance: number;
  is_open: boolean;
  items_count: number;
  isFavorite: boolean;
  timings?: RestaurantTiming[];
  isOpen?: boolean;
}

// Fallback categories if none provided
const FALLBACK_CATEGORIES = ['Biryani', 'South Indian', 'Pizza', 'Burger', 'Cakes'];

// Shimmer Restaurant Card Component - Matching HomeScreen style
const ShimmerRestaurantCard = () => (
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
);

// Shimmer Top Rated Card Component
const ShimmerTopRatedCard = () => (
  <View style={styles.topRatedCard}>
    {/* Image Shimmer */}
    <View style={styles.topRatedImageContainer}>
      <Shimmer width={140} height={139} borderRadius={20} backgroundColor="#E8E8E8" />
    </View>
    {/* Info Shimmer */}
    <View style={styles.topRatedInfo}>
      {/* Name */}
      <Shimmer width={100} height={16} borderRadius={4} backgroundColor="#E8E8E8" style={{ marginBottom: 4 }} />
      {/* Delivery Time */}
      <Shimmer width={80} height={14} borderRadius={4} backgroundColor="#E8E8E8" />
    </View>
  </View>
);


// Default location coordinates (Madurai) - fallback if no location provided
const DEFAULT_LOCATION = {
  latitude: 9.9252,
  longitude: 78.1198,
};

export const CategoryResultsScreen: React.FC<CategoryResultsScreenProps> = ({
  categoryName,
  categories,
  onBack,
  onNavigateToRestaurant,
  selectedLocation,
}) => {
  const { vegMode } = useVegMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categoryName);
  const [restaurants, setRestaurants] = useState<RestaurantItem[]>([]);
  const [topRatedRestaurants, setTopRatedRestaurants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<RestaurantItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [defaultAddressCoords, setDefaultAddressCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Use provided categories or fallback
  const displayCategories = categories && categories.length > 0
    ? categories.filter(cat => cat.name !== 'View All').map(cat => cat.name)
    : FALLBACK_CATEGORIES;

  // Track if we've attempted to fetch default address
  const [hasFetchedDefaultAddress, setHasFetchedDefaultAddress] = useState(false);

  // Fetch default address coordinates
  useEffect(() => {
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
            // No default address found, mark as fetched but set to null
            setDefaultAddressCoords(null);
          }
        } else {
          // API failed, mark as fetched but set to null
          setDefaultAddressCoords(null);
        }
      } catch (error) {
        // Error fetching, mark as fetched but set to null
        setDefaultAddressCoords(null);
      } finally {
        setHasFetchedDefaultAddress(true);
      }
    };

    fetchDefaultAddress();
  }, []);

  const fetchRestaurants = async () => {
    try {
      setIsLoading(true);

      // Use default address coordinates, then selectedLocation, then fallback to default
      const lat = defaultAddressCoords?.latitude || selectedLocation?.latitude || DEFAULT_LOCATION.latitude;
      const lng = defaultAddressCoords?.longitude || selectedLocation?.longitude || DEFAULT_LOCATION.longitude;
      const radius = 10;

      const query = selectedCategory.toLowerCase();
      let apiEndpoint = `/api/buyer/search?query=${query}&lat=${lat}&lng=${lng}&radius=${radius}&type=all&sort_by=distance&sort_order=asc&page=1&limit=20`;

      // Add veg mode parameter if active
      if (vegMode && vegMode !== 'off') {
        apiEndpoint += `&veg_mode=${vegMode}&dietary_preference=veg`;
      }

      // Add minimum delay to show shimmer animation
      const [response] = await Promise.all([
        apiService.get(apiEndpoint),
        new Promise(resolve => setTimeout(resolve, 1500)) // 1.5 second delay
      ]);

      if (response.data?.success && response.data?.data?.restaurants) {
        // Transform API data to match RestaurantCard interface
        const restaurantsData = response.data.data.restaurants.map((restaurant: any) => {
          // Calculate real-time open status using timings if available
          const timings = restaurant.timings || [];
          const isOpen = timings.length > 0
            ? homeService.isRestaurantOpen(timings)
            : (restaurant.is_open !== undefined ? restaurant.is_open : true);

          // Format cuisine_tags: if array, join with " • ", otherwise use as string
          let cuisineText = 'Restaurant';
          if (restaurant.cuisine_tags) {
            if (Array.isArray(restaurant.cuisine_tags)) {
              cuisineText = restaurant.cuisine_tags.join(' • ');
            } else if (typeof restaurant.cuisine_tags === 'string' && restaurant.cuisine_tags.trim()) {
              cuisineText = restaurant.cuisine_tags;
            }
          }

          return {
            id: restaurant.id,
            name: restaurant.name,
            cuisine: cuisineText,
            rating: restaurant.rating || 0,
            deliveryTime: restaurant.delivery_time || '25-30 mins',
            location: restaurant.location,
            distance: restaurant.distance ? `${(Math.floor(restaurant.distance * 100) / 100).toFixed(2)}Kms` : '0Kms',
            image: restaurant.logo_url || restaurant.image,
            isFavorite: restaurant.is_favorite || false,
            isVeg: restaurant.is_veg || restaurant.dietary_preference === 'veg' || false,
            timings: timings,
            isOpen: isOpen,
          };
        });

        setRestaurants(restaurantsData);

        // Handle top rated restaurants if available
        if (response.data?.data?.top_rated_restaurants && response.data.data.top_rated_restaurants.length > 0) {
          const topRatedData = response.data.data.top_rated_restaurants.map((restaurant: any) => ({
            id: restaurant.id.toString(),
            name: restaurant.name,
            rating: restaurant.rating || 0,
            deliveryTime: restaurant.delivery_time || '25-30 mins',
            image: restaurant.logo_url,
          }));
          setTopRatedRestaurants(topRatedData);
        } else {
          setTopRatedRestaurants([]);
        }
      } else {
        setRestaurants([]);
        setTopRatedRestaurants([]);
      }
    } catch (error) {
      setRestaurants([]);
      setTopRatedRestaurants([]);
    } finally {
      setIsLoading(false);
    }
  };

  const searchRestaurants = async (query: string) => {
    try {
      setIsSearching(true);

      // Use default address coordinates, then selectedLocation, then fallback to default
      const lat = defaultAddressCoords?.latitude || selectedLocation?.latitude || DEFAULT_LOCATION.latitude;
      const lng = defaultAddressCoords?.longitude || selectedLocation?.longitude || DEFAULT_LOCATION.longitude;
      const radius = 10;

      let apiEndpoint = `/api/buyer/search?query=${query}&lat=${lat}&lng=${lng}&radius=${radius}&type=all&sort_by=distance&sort_order=asc&page=1&limit=20`;

      // Add veg mode parameter if active
      if (vegMode && vegMode !== 'off') {
        apiEndpoint += `&veg_mode=${vegMode}&dietary_preference=veg`;
      }

      const response = await apiService.get(apiEndpoint);

      if (response.data?.success && response.data?.data?.restaurants) {
        // Transform API data to match RestaurantCard interface
        const restaurantsData = response.data.data.restaurants.map((restaurant: any) => {
          // Calculate real-time open status using timings if available
          const timings = restaurant.timings || [];
          const isOpen = timings.length > 0
            ? homeService.isRestaurantOpen(timings)
            : (restaurant.is_open !== undefined ? restaurant.is_open : true);

          // Format cuisine_tags: if array, join with " • ", otherwise use as string
          let cuisineText = 'Restaurant';
          if (restaurant.cuisine_tags) {
            if (Array.isArray(restaurant.cuisine_tags)) {
              cuisineText = restaurant.cuisine_tags.join(' • ');
            } else if (typeof restaurant.cuisine_tags === 'string' && restaurant.cuisine_tags.trim()) {
              cuisineText = restaurant.cuisine_tags;
            }
          }

          return {
            id: restaurant.id,
            name: restaurant.name,
            cuisine: cuisineText,
            rating: restaurant.rating || 0,
            deliveryTime: restaurant.delivery_time || '25-30 mins',
            location: restaurant.location,
            distance: restaurant.distance ? `${(Math.floor(restaurant.distance * 100) / 100).toFixed(2)}Kms` : '0Kms',
            image: restaurant.logo_url || restaurant.image,
            isFavorite: restaurant.is_favorite || false,
            isVeg: restaurant.is_veg || restaurant.dietary_preference === 'veg' || false,
            timings: timings,
            isOpen: isOpen,
          };
        });

        setSearchResults(restaurantsData);
        setHasSearched(true);
      } else {
        setSearchResults([]);
        setHasSearched(true);
      }
    } catch (error) {
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setIsSearching(false);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };


  // Fetch restaurants data from API
  useEffect(() => {
    // Wait for default address fetch to complete before fetching restaurants
    if (hasFetchedDefaultAddress) {
      fetchRestaurants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, defaultAddressCoords, hasFetchedDefaultAddress]);

  // Handle search with debounce
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If search query is empty, clear results
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    // Set debounce timeout
    searchTimeoutRef.current = setTimeout(() => {
      searchRestaurants(searchQuery.trim());
    }, 500); // 500ms debounce

    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Trigger animation when loading completes
  useEffect(() => {
    if (!isLoading) {
      // Reset animation values
      fadeAnim.setValue(0);
      slideAnim.setValue(30);

      // Start animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoading]);

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#00B14F" translucent={false} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          {/* Top Section - Back Button + Search Bar */}
          <SearchBar
            onBack={onBack}
            value={searchQuery}
            onChangeText={setSearchQuery}
            showClearButton={true}
          />

        {/* Categories Section with Images */}
        <View style={styles.categorySection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
            onScroll={(event) => {
              setScrollOffset(event.nativeEvent.contentOffset.x);
            }}
            scrollEventThrottle={16}
          >
            {displayCategories.map((category, index) => {
              // Map category names to their images
              const categoryImages: { [key: string]: any } = {
                'Biryani': require('@/assets/biriyani.png'),
                'South Indian': require('@/assets/idlies.png'),
                'Pizza': require('@/assets/pizza.png'),
                'Burger': require('@/assets/burger.png'),
                'Cakes': require('@/assets/cake.png'),
              };

              // Find the category object to get icon
              const categoryObj = categories?.find(cat => cat.name === category);

              // Determine the image source - use API icon if available, otherwise fallback to local
              let imageSource;
              if (categoryObj?.icon) {
                // Check if icon is a string (URL) or a require() object
                if (typeof categoryObj.icon === 'string') {
                  imageSource = { uri: categoryObj.icon };
                } else {
                  imageSource = categoryObj.icon;
                }
              } else {
                // Fallback to local images
                imageSource = categoryImages[category];
              }

              return (
                <View key={`${category}-${index}`} style={styles.categoryItemWrapper}>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCategory(category);
                      handleClearSearch();
                    }}
                    style={styles.categoryItem}
                  >
                    {imageSource && (
                      <Image
                        source={imageSource}
                        style={styles.categoryFoodImage}
                        resizeMode="contain"
                      />
                    )}
                    <Text
                      style={[
                        styles.categoryText,
                        !hasSearched && selectedCategory === category && styles.selectedCategoryText,
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Line separator */}
        <View style={styles.lineContainer}>
          <View style={styles.fullLine} />
          {/* Selected category indicator line */}
          {!hasSearched && (() => {
            const selectedIndex = displayCategories.indexOf(selectedCategory);
            if (selectedIndex === -1) return null;

            // Calculate position based on category index and scroll offset
            const categoryWidth = 74 + 4; // categoryItemWrapper width + marginRight
            const leftOffset = 20 + (selectedIndex * categoryWidth) + (74 - 67) / 2 - scrollOffset; // paddingLeft + offset + centering - scroll

            return (
              <View
                style={[
                  styles.selectedLine,
                  { left: leftOffset }
                ]}
              />
            );
          })()}
        </View>

        {/* Filter Buttons */}
        {/* <View style={styles.filterSection}>
          <TouchableOpacity style={styles.filterButtonActive}>
            <MaterialIcons name="filter-list" size={16} color="#00B14F" />
            <Text style={styles.filterTextActive}>Filters</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterText}>Sort By</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterText}>Price</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterText}>Veg</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterText}>10 Mins Delivery</Text>
          </TouchableOpacity>
        </View> */}

        {/* Top Rated Section - Only show when not loading, has data, and not showing search results */}
        {!hasSearched && !isLoading && topRatedRestaurants.length > 0 ? (
          <>
            <View style={styles.sectionTitleContainer}>
              <LinearGradient
                colors={['rgba(0, 0, 0, 0)', '#000000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionTitleLine}
              />
              <Text style={styles.sectionTitle}>Top Rated</Text>
              <LinearGradient
                colors={['#000000', 'rgba(0, 0, 0, 0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionTitleLine}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topRatedScroll}
            >
              <Animated.View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }}
              >
                {topRatedRestaurants.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.topRatedCard}
                      onPress={() => {
                        if (onNavigateToRestaurant) {
                          onNavigateToRestaurant(parseInt(item.id), item.name);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.topRatedImageContainer}>
                        <Image
                          source={typeof item.image === 'string' ? { uri: item.image } : item.image}
                          style={styles.topRatedImage}
                          resizeMode="cover"
                        />
                        <View style={styles.topRatedRatingBadge}>
                          <MaterialIcons name="star" size={10} color="#00B14F" />
                          <Text style={styles.topRatedRatingText}>{item.rating}</Text>
                        </View>
                      </View>
                      <View style={styles.topRatedInfo}>
                        <View style={styles.topRatedNameRow}>
                          <Text style={styles.topRatedName} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </View>
                        <View style={styles.topRatedDeliveryRow}>
                          <MaterialIcons name="two-wheeler" size={15} color="#00B14F" />
                          <Text style={styles.topRatedDeliveryText}>{item.deliveryTime}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                ))}
              </Animated.View>
            </ScrollView>
          </>
        ) : null}

        {/* Restaurants Near You Section - Only show title if loading or has data */}
        {(hasSearched ? (isSearching || searchResults.length > 0) : (isLoading || restaurants.length > 0)) && (
          <View style={styles.sectionTitleContainer}>
            <LinearGradient
              colors={['rgba(0, 0, 0, 0)', '#000000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionTitleLine}
            />
            <Text style={styles.sectionTitle}>
              {hasSearched ? `Search Results (${searchResults.length})` : 'Restaurants Near You'}
            </Text>
            <LinearGradient
              colors={['#000000', 'rgba(0, 0, 0, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionTitleLine}
            />
          </View>
        )}

        <View style={styles.restaurantList}>
          {(hasSearched ? isSearching : isLoading) ? (
            <>
              <ShimmerRestaurantCard />
              <ShimmerRestaurantCard />
              <ShimmerRestaurantCard />
            </>
          ) : (hasSearched ? searchResults : restaurants).length === 0 ? (
            <View style={styles.noResultsContainer}>
              <MaterialIcons name="search-off" size={64} color="rgba(0, 0, 0, 0.3)" />
              <Text style={styles.noResultsTitle}>No restaurants found</Text>
              <Text style={styles.noResultsMessage}>
                {hasSearched
                  ? `We couldn't find any restaurants for "${searchQuery}". Try searching for something else.`
                  : `We couldn't find any restaurants for "${selectedCategory}". Try searching for something else.`
                }
              </Text>
            </View>
          ) : (
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              {(hasSearched ? searchResults : restaurants).map(restaurant => (
                <View key={restaurant.id} style={styles.restaurantCardWrapper}>
                  <RestaurantCard
                    restaurant={restaurant}
                    onPress={() => {
                      if (onNavigateToRestaurant) {
                        onNavigateToRestaurant(restaurant.id, restaurant.name);
                      }
                    }}
                  />
                </View>
              ))}
            </Animated.View>
          )}
        </View>
      </ScrollView>
      </SafeAreaView>
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
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  // Top Section
  // Category Section
  categorySection: {
    marginTop: 10,
    marginBottom: 0,
    height: 75,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    paddingRight: 20,
    alignItems: 'flex-start',
  },
  categoryItemWrapper: {
    width: 74,
    marginRight: 4,
    alignItems: 'center',
    height: 75,
    justifyContent: 'center',
  },
  exploreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 75,
  },
  exploreIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 26,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryItem: {
    alignItems: 'center',
    gap: 3,
    justifyContent: 'center',
  },
  categoryFoodImage: {
    width: 55,
    height: 45,
  },
  categoryText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  selectedCategoryText: {
    color: '#00B14F',
  },
  // Line Container
  lineContainer: {
    marginTop: 10,
    position: 'relative',
    height: 5,
  },
  fullLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    top: 2,
  },
  selectedLine: {
    position: 'absolute',
    width: 67,
    height: 5,
    backgroundColor: '#00B14F',
    top: 0,
    borderRadius: 2.5,
  },
  // Filter Section
  filterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    lineHeight: 21,
    color: '#00B14F',
    opacity: 0.85,
  },
  filterButton: {
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
  filterText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    opacity: 0.85,
  },
  // Section Title
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 15,
  },
  sectionTitleLine: {
    width: 35,
    height: 1,
  },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  // Top Rated Section
  topRatedScroll: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 16,
  },
  topRatedCard: {
    width: 140,
    gap: 8,
  },
  topRatedImageContainer: {
    width: 140,
    height: 139,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  topRatedImage: {
    width: '100%',
    height: '100%',
  },
  topRatedRatingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
  },
  topRatedRatingText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 15,
    color: '#00B14F',
    opacity: 0.85,
  },
  topRatedInfo: {
    gap: 2,
  },
  topRatedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topRatedName: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    opacity: 0.85,
  },
  topRatedDeliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  topRatedDeliveryText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 10,
    lineHeight: 15,
    color: '#00B14F',
    opacity: 0.85,
  },
  // Restaurant List
  restaurantList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
    marginBottom: 10,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#000000',
    opacity: 0.6,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  noResultsTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    opacity: 0.85,
    marginTop: 8,
  },
  noResultsMessage: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
    textAlign: 'center',
  },
});
