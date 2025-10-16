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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CategoryResultsScreenProps {
  categoryName: string;
  onBack?: () => void;
  onNavigateToRestaurant?: (restaurantName: string) => void;
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

const CATEGORIES = ['Explore', 'Briyani', 'South Indian', 'Pizza', 'Burger', 'Cakes'];

const TOP_RATED_DATA: TopRatedItem[] = [
  {
    id: '1',
    name: 'Dindigul Thalapka..',
    rating: 4.5,
    deliveryTime: '10 - 15 mins',
    image: require('@/assets/biriyani.png'),
  },
  {
    id: '2',
    name: 'Moihaideen Bri...',
    rating: 4.5,
    deliveryTime: '20 - 25 mins',
    image: require('@/assets/biriyani.png'),
  },
  {
    id: '3',
    name: 'Sharief Briyani',
    rating: 4.5,
    deliveryTime: '20 - 25 mins',
    image: require('@/assets/biriyani.png'),
  },
];

const RESTAURANT_DATA: RestaurantItem[] = [
  {
    id: '1',
    name: 'Dinidigul Thalapakatti',
    cuisine: 'Burgers, Pizza, Chicken Wings Rolls & Wrap',
    rating: 4.5,
    deliveryTime: '10 - 15 mins',
    location: 'Keelkattalai',
    distance: '0.5Kms',
    image: require('@/assets/biriyani.png'),
    isFavorite: false,
  },
  {
    id: '2',
    name: 'Dominoz',
    cuisine: 'Burgers, Pizza, Chicken Wings Rolls & Wrap',
    rating: 4.5,
    deliveryTime: '10 - 15 mins',
    location: 'Keelkattalai',
    distance: '0.5Kms',
    image: require('@/assets/biriyani.png'),
    isFavorite: false,
  },
  {
    id: '3',
    name: 'KFC',
    cuisine: 'Burgers, Pizza, Chicken Wings Rolls & Wrap',
    rating: 4.5,
    deliveryTime: '10 - 15 mins',
    location: 'Keelkattalai',
    distance: '0.5Kms',
    image: require('@/assets/biriyani.png'),
    isFavorite: false,
  },
];

export const CategoryResultsScreen: React.FC<CategoryResultsScreenProps> = ({
  categoryName,
  onBack,
  onNavigateToRestaurant,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categoryName);
  const [restaurants, setRestaurants] = useState<RestaurantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch restaurants data from API
  useEffect(() => {
    fetchRestaurants();
  }, [selectedCategory]);

  const fetchRestaurants = async () => {
    try {
      setIsLoading(true);

      // Default location - you can make this dynamic later
      const lat = 9.93550394286794;
      const lng = 78.13114931086115;
      const radius = 5;

      const query = selectedCategory.toLowerCase();

      const response = await apiService.get(
        `/buyer/search?query=${query}&lat=${lat}&lng=${lng}&radius=${radius}&type=all&sort_by=distance&sort_order=asc&page=1&limit=20`
      );

      if (response.data?.success && response.data?.data?.restaurants) {
        const restaurantsData = response.data.data.restaurants.map((restaurant: any) => ({
          ...restaurant,
          isFavorite: false,
        }));
        setRestaurants(restaurantsData);
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = (id: number) => {
    setRestaurants(prev =>
      prev.map(r => (r.id === id ? { ...r, isFavorite: !r.isFavorite } : r))
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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

        {/* Explore + Categories Section with Images */}
        <View style={styles.categorySection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map((category, index) => {
              // Map category names to their images
              const categoryImages: { [key: string]: any } = {
                'Briyani': require('@/assets/biriyani.png'),
                'South Indian': require('@/assets/idlies.png'),
                'Pizza': require('@/assets/pizza.png'),
                'Burger': require('@/assets/burger.png'),
              };

              return (
                <View key={category} style={styles.categoryItemWrapper}>
                  {index === 0 ? (
                    // Explore button with arrow icon
                    <TouchableOpacity
                      style={styles.exploreButton}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <View style={styles.exploreIconContainer}>
                        <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
                      </View>
                      <Text style={styles.categoryText}>{category}</Text>
                    </TouchableOpacity>
                  ) : (
                    // Regular category with image above
                    <TouchableOpacity
                      onPress={() => setSelectedCategory(category)}
                      style={styles.categoryItem}
                    >
                      {categoryImages[category] && (
                        <Image
                          source={categoryImages[category]}
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
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Line with selected category indicator */}
        <View style={styles.lineContainer}>
          <View style={styles.fullLine} />
          <View
            style={[
              styles.selectedLine,
              {
                left:
                  selectedCategory === 'Briyani'
                    ? 90
                    : selectedCategory === 'South Indian'
                    ? 157
                    : selectedCategory === 'Pizza'
                    ? 262
                    : selectedCategory === 'Burger'
                    ? 344
                    : 90,
              },
            ]}
          />
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

        {/* Top Rated Section */}
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
          {TOP_RATED_DATA.map(item => (
            <View key={item.id} style={styles.topRatedCard}>
              <View style={styles.topRatedImageContainer}>
                <Image source={item.image} style={styles.topRatedImage} resizeMode="cover" />
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
            </View>
          ))}
        </ScrollView>

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
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00B14F" />
              <Text style={styles.loadingText}>Loading restaurants...</Text>
            </View>
          ) : restaurants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No restaurants found</Text>
            </View>
          ) : (
            restaurants.map(restaurant => (
              <TouchableOpacity
                key={restaurant.id}
                style={styles.restaurantCard}
                onPress={() => {
                  if (onNavigateToRestaurant) {
                    onNavigateToRestaurant(restaurant.name);
                  }
                }}
                activeOpacity={0.9}
              >
                {/* Image Section */}
                <View style={styles.restaurantImageContainer}>
                  <Image
                    source={{ uri: restaurant.logo_url }}
                    style={styles.restaurantImage}
                    resizeMode="cover"
                  />
                  {/* Favorite Button */}
                  <TouchableOpacity
                    style={styles.favoriteButton}
                    onPress={() => toggleFavorite(restaurant.id)}
                  >
                    <MaterialIcons
                      name={restaurant.isFavorite ? 'favorite' : 'favorite-border'}
                      size={17}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                  {/* Delivery Time Badge */}
                  <View style={styles.deliveryBadge}>
                    <MaterialIcons name="two-wheeler" size={15} color="#000080" />
                    <Text style={styles.deliveryBadgeText}>{restaurant.delivery_time}</Text>
                  </View>
                </View>

                {/* Details Section */}
                <View style={styles.restaurantDetails}>
                  <View style={styles.restaurantTopRow}>
                    <View style={styles.restaurantInfo}>
                      <Text style={styles.restaurantName} numberOfLines={1}>
                        {restaurant.name}
                      </Text>
                      <Text style={styles.restaurantCuisine} numberOfLines={2}>
                        {restaurant.description}
                      </Text>
                    </View>
                    <View style={styles.ratingBadge}>
                      <MaterialIcons name="star" size={14} color="#00B14F" />
                      <Text style={styles.ratingText}>{restaurant.rating || '0'}</Text>
                    </View>
                  </View>

                  {/* Dotted Divider */}
                  <View style={styles.dividerContainer}>
                    {Array.from({ length: 30 }).map((_, index) => (
                      <View key={index} style={styles.dash} />
                    ))}
                  </View>

                  <View style={styles.restaurantBottomRow}>
                    <Text style={styles.locationText}>{restaurant.location.locality}</Text>
                    <Text style={styles.distanceText}>{restaurant.distance.toFixed(1)}Kms</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
    gap: 22,
    paddingBottom: 20,
  },
  restaurantCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
    borderRadius: 20,
  },
  restaurantImageContainer: {
    width: '100%',
    height: 124,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  restaurantImage: {
    width: '100%',
    height: '100%',
  },
  favoriteButton: {
    position: 'absolute',
    top: 6,
    right: 9,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryBadge: {
    position: 'absolute',
    top: 0,
    left: 23,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  deliveryBadgeText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 10,
    lineHeight: 15,
    color: '#000080',
    opacity: 0.85,
  },
  restaurantDetails: {
    padding: 10,
    gap: 10,
  },
  restaurantTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  restaurantInfo: {
    flex: 1,
    gap: 2,
  },
  restaurantName: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'left',
    color: '#000000',
    opacity: 0.85,
  },
  restaurantCuisine: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.5)',
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
    alignItems: 'center',
  },
  locationText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(0, 0, 0, 0.5)',
    opacity: 0.85,
  },
  distanceText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 20,
    color: '#00B14F',
    opacity: 0.85,
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
