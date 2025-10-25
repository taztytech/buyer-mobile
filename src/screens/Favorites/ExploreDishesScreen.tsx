import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { favoritesService } from '@/services/favorites.service';
import { Shimmer } from '@/components/Shimmer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PADDING = 20;
const CARD_GAP = 10;
const NUM_COLUMNS = 3;
// Calculate card width: total available width minus gaps, divided by number of columns
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

interface FavoriteItem {
  id: string | number;
  name: string;
  images?: string[];
  image?: string;
  restaurant?: {
    id: number;
    name: string;
    logo_url: string;
  };
  restaurant_name?: string;
}

interface FavoriteRestaurant {
  id: string | number;
  name: string;
  logo_url: string;
}

interface ExploreDishesScreenProps {
  onBack?: () => void;
  onSelectItem?: (item: FavoriteItem) => void;
  onSelectRestaurant?: (restaurantId: number | string, restaurantName: string) => void;
}

// Shimmer Card Component
const ShimmerCard = () => (
  <View style={styles.dishCard}>
    <View style={styles.dishImageContainer}>
      <Shimmer width={CARD_WIDTH - 30} height={60} borderRadius={8} backgroundColor="#E8E8E8" />
    </View>
    <View style={styles.dishLabelContainer}>
      <Shimmer width={CARD_WIDTH - 20} height={16} borderRadius={4} backgroundColor="#E8E8E8" />
    </View>
  </View>
);

export const ExploreDishesScreen: React.FC<ExploreDishesScreenProps> = ({
  onBack,
  onSelectItem,
  onSelectRestaurant,
}) => {
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [favoriteRestaurants, setFavoriteRestaurants] = useState<FavoriteRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await favoritesService.getAllFavorites();

      if (response.success && response.data) {
        console.log('✅ Favorites loaded successfully');

        // The API returns nested data: response.data.data.data
        const actualData = response.data.data?.data || response.data;

        // Extract favorite items (API returns "items", not "favorite_items")
        const items = actualData.items || actualData.favorite_items;
        if (items && Array.isArray(items)) {
          setFavoriteItems(items);
          console.log(`📦 Favorite Items: ${items.length}`);
        }

        // Extract favorite restaurants (API returns "restaurants", not "favorite_restaurants")
        const restaurants = actualData.restaurants || actualData.favorite_restaurants;
        if (restaurants && Array.isArray(restaurants)) {
          setFavoriteRestaurants(restaurants);
          console.log(`🏪 Favorite Restaurants: ${restaurants.length}`);
        }
      } else {
        setError(response.error || 'Failed to load favorites');
        console.error('❌ Failed to load favorites:', response.error);
      }
    } catch (error) {
      setError('An error occurred while loading favorites');
      console.error('Error fetching favorites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderItemCard = (item: FavoriteItem) => {
    // Get the first image from images array, or fallback to image field
    const imageUrl = item.images && item.images.length > 0 ? item.images[0] : item.image;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.dishCard}
        onPress={() => onSelectItem && onSelectItem(item)}
        activeOpacity={0.7}
      >
        <View style={styles.dishImageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.dishImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.dishLabelContainer}>
          <Text style={styles.dishName} numberOfLines={1}>{item.name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRestaurantCard = (item: FavoriteRestaurant) => (
    <TouchableOpacity
      key={item.id}
      style={styles.dishCard}
      onPress={() => onSelectRestaurant && onSelectRestaurant(item.id, item.name)}
      activeOpacity={0.7}
    >
      <View style={styles.dishImageContainer}>
        <Image
          source={{ uri: item.logo_url }}
          style={styles.dishImage}
          resizeMode="contain"
        />
      </View>
      <View style={styles.dishLabelContainer}>
        <Text style={styles.dishName} numberOfLines={1}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Favorites</Text>
      </View>

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <>
              {/* Shimmer for Favorite Items */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Favorite Food Items</Text>
                <View style={styles.gridContainer}>
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <ShimmerCard key={`item-shimmer-${item}`} />
                  ))}
                </View>
              </View>

              {/* Shimmer for Favorite Restaurants */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Favorite Restaurants</Text>
                <View style={styles.gridContainer}>
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <ShimmerCard key={`restaurant-shimmer-${item}`} />
                  ))}
                </View>
              </View>
            </>
          ) : error ? (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={48} color="rgba(0, 0, 0, 0.3)" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchFavorites}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Favorite Food Items Section */}
              {favoriteItems.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Favorite Food Items</Text>
                  <View style={styles.gridContainer}>
                    {favoriteItems.map((item) => renderItemCard(item))}
                  </View>
                </View>
              )}

              {/* Favorite Restaurants Section */}
              {favoriteRestaurants.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Favorite Restaurants</Text>
                  <View style={styles.gridContainer}>
                    {favoriteRestaurants.map((item) => renderRestaurantCard(item))}
                  </View>
                </View>
              )}

              {/* Empty State */}
              {favoriteItems.length === 0 && favoriteRestaurants.length === 0 && (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="favorite-border" size={64} color="rgba(0, 0, 0, 0.2)" />
                  <Text style={styles.emptyTitle}>No Favorites Yet</Text>
                  <Text style={styles.emptyText}>
                    Start adding your favorite restaurants and dishes!
                  </Text>
                </View>
              )}
            </>
          )}
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
  safeAreaTop: {
    backgroundColor: '#00B14F',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 76,
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
  headerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
    color: '#FFFFFF',
    opacity: 0.85,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    opacity: 0.85,
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: CARD_GAP,
    rowGap: 20,
    justifyContent: 'flex-start',
  },
  dishCard: {
    width: CARD_WIDTH,
    height: 103,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  dishImageContainer: {
    width: CARD_WIDTH,
    height: 79,
    backgroundColor: '#C9F5C6',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 22,
    marginBottom: -9,
    zIndex: 2,
  },
  dishImage: {
    width: CARD_WIDTH - 30,
    height: 60,
    resizeMode: 'contain',
  },
  dishLabelContainer: {
    width: CARD_WIDTH,
    height: 37,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 4,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  dishName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.5)',
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#00B14F',
    borderRadius: 8,
  },
  retryButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#000000',
    marginTop: 16,
    opacity: 0.7,
  },
  emptyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.5)',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
