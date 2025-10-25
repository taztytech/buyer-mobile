import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/config/api.config';
import { Shimmer } from '@/components/Shimmer';
import { RestaurantCard } from '@/components/RestaurantCard';

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
}

interface TopRatedItem {
  id: string;
  name: string;
  rating: number;
  deliveryTime: string;
  image: any;
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


export const CategoryResultsScreen: React.FC<CategoryResultsScreenProps> = ({
  categoryName,
  categories,
  onBack,
  onNavigateToRestaurant,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categoryName);
  const [restaurants, setRestaurants] = useState<RestaurantItem[]>([]);
  const [topRatedRestaurants, setTopRatedRestaurants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Use provided categories or fallback
  const displayCategories = categories && categories.length > 0
    ? categories.filter(cat => cat.name !== 'View All').map(cat => cat.name)
    : FALLBACK_CATEGORIES;

  const fetchRestaurants = async () => {
    try {
      setIsLoading(true);

      // Default location - you can make this dynamic later
      const lat = 9.93550394286794;
      const lng = 78.13114931086115;
      const radius = 5;

      const query = selectedCategory.toLowerCase();
      const apiEndpoint = `/api/buyer/search?query=${query}&lat=${lat}&lng=${lng}&radius=${radius}&type=all&sort_by=distance&sort_order=asc&page=1&limit=20`;
      const fullUrl = `${API_CONFIG.BASE_URL}${apiEndpoint}`;

      console.log(`\n📍 Category API Call: ${selectedCategory}`);
      console.log(`🔗 Full URL: ${fullUrl}`);
      console.log(`📋 Query: ${query} | Lat: ${lat} | Lng: ${lng} | Radius: ${radius}km`);

      const response = await apiService.get(apiEndpoint);

      console.log(`✅ Response Success: ${response.data?.success}`);
      console.log(`📊 Restaurants Found: ${response.data?.data?.restaurants?.length || 0}`);
      console.log(`🌟 Top Rated Restaurants: ${response.data?.data?.top_rated_restaurants?.length || 0}`);

      if (response.data?.success && response.data?.data?.restaurants) {
        // Transform API data to match RestaurantCard interface
        const restaurantsData = response.data.data.restaurants.map((restaurant: any) => ({
          id: restaurant.id,
          name: restaurant.name,
          cuisine: restaurant.description || 'Restaurant',
          rating: restaurant.rating || 0,
          deliveryTime: restaurant.delivery_time || '25-30 mins',
          location: restaurant.location,
          distance: restaurant.distance ? `${restaurant.distance.toFixed(1)}Kms` : '0Kms',
          image: restaurant.logo_url || restaurant.image,
          isFavorite: false,
          isVeg: restaurant.is_veg || restaurant.dietary_preference === 'veg' || false,
        }));

        console.log(`📝 Restaurant List:`);
        restaurantsData.slice(0, 5).forEach((r: any, i: number) => {
          console.log(`   ${i + 1}. ${r.name} (ID: ${r.id})`);
        });
        if (restaurantsData.length > 5) {
          console.log(`   ... and ${restaurantsData.length - 5} more`);
        }
        console.log(''); // Empty line for readability

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
          console.log(`🌟 Top Rated List: ${topRatedData.map((r: any) => r.name).join(', ')}\n`);
        } else {
          setTopRatedRestaurants([]);
        }
      } else {
        console.log(`⚠️ No restaurants found or API failed\n`);
        setRestaurants([]);
        setTopRatedRestaurants([]);
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      setRestaurants([]);
      setTopRatedRestaurants([]);
    } finally {
      setIsLoading(false);
    }
  };


  // Fetch restaurants data from API
  useEffect(() => {
    fetchRestaurants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

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
          <View style={styles.topSection}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <MaterialIcons name="chevron-left" size={24} color="#000000" />
          </TouchableOpacity>

          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={24} color="#00B14F" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search.."
              placeholderTextColor="rgba(0, 0, 0, 0.5)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Categories Section with Images */}
        <View style={styles.categorySection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
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
                    onPress={() => setSelectedCategory(category)}
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
                        selectedCategory === category && styles.selectedCategoryText,
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
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterSection}>
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
        </View>

        {/* Top Rated Section - Show shimmer while loading, show data if available, hide if no data */}
        {isLoading || topRatedRestaurants.length > 0 ? (
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
              {isLoading ? (
                // Show 5 shimmer cards while loading
                <>
                  <ShimmerTopRatedCard />
                  <ShimmerTopRatedCard />
                  <ShimmerTopRatedCard />
                  <ShimmerTopRatedCard />
                  <ShimmerTopRatedCard />
                </>
              ) : (
                // Show actual data
                topRatedRestaurants.map(item => (
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
                ))
              )}
            </ScrollView>
          </>
        ) : null}

        {/* Restaurants Near You Section */}
        <View style={styles.sectionTitleContainer}>
          <LinearGradient
            colors={['rgba(0, 0, 0, 0)', '#000000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sectionTitleLine}
          />
          <Text style={styles.sectionTitle}>Restaurants Near You</Text>
          <LinearGradient
            colors={['#000000', 'rgba(0, 0, 0, 0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sectionTitleLine}
          />
        </View>

        <View style={styles.restaurantList}>
          {isLoading ? (
            <>
              <ShimmerRestaurantCard />
              <ShimmerRestaurantCard />
              <ShimmerRestaurantCard />
            </>
          ) : restaurants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No restaurants found</Text>
            </View>
          ) : (
            restaurants.map(restaurant => (
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
            ))
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
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 14,
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
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 19,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  // Category Section
  categorySection: {
    marginTop: 10,
    marginBottom: 0,
    height: 75,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 30,
    alignItems: 'center',
  },
  categoryItemWrapper: {
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
    height: 2,
  },
  fullLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    top: 0,
  },
  selectedLine: {
    position: 'absolute',
    width: 67,
    height: 2,
    backgroundColor: '#00B14F',
    top: 0,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    color: '#000000',
    opacity: 0.6,
  },
});
