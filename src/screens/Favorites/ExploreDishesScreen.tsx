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
const CARD_GAP = 16;
const NUM_COLUMNS = 2;
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
  <View style={styles.shimmerCard}>
    <Shimmer width={CARD_WIDTH} height={150} borderRadius={12} backgroundColor="#E8E8E8" />
  </View>
);

export const ExploreDishesScreen: React.FC<ExploreDishesScreenProps> = ({
  onBack,
  onSelectItem,
  onSelectRestaurant,
}) => {
  console.log('🎯 ExploreDishesScreen component mounted');

  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [favoriteRestaurants, setFavoriteRestaurants] = useState<FavoriteRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch on mount
  useEffect(() => {
    console.log('🔄 useEffect triggered, calling fetchFavorites');
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    console.log('📞 fetchFavorites called');
    try {
      setIsLoading(true);
      setError(null);

      console.log('🌐 Calling favoritesService.getAllFavorites()');
      const response = await favoritesService.getAllFavorites();

      console.log('🔍 Full Response:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        // The API returns nested data: response.data.data.data
        const actualData = response.data.data?.data || response.data;
        console.log('📦 Actual Data:', JSON.stringify(actualData, null, 2));

        // Extract favorite items - need to go one level deeper
        const items = actualData.data?.items || actualData.items || actualData.favorite_items;
        console.log('🍔 Items found:', items?.length || 0);
        if (items && Array.isArray(items)) {
          setFavoriteItems(items);
        }

        // Extract favorite restaurants - need to go one level deeper
        const restaurants = actualData.data?.restaurants || actualData.restaurants || actualData.favorite_restaurants;
        console.log('🏪 Restaurants found:', restaurants?.length || 0);
        if (restaurants && Array.isArray(restaurants)) {
          setFavoriteRestaurants(restaurants);
        }
      } else {
        console.log('❌ Response failed or no data');
        setError(response.error || 'Failed to load favorites');
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
        <Image
          source={{ uri: imageUrl }}
          style={styles.dishImage}
          resizeMode="cover"
        />
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
      <Image
        source={{ uri: item.logo_url }}
        style={styles.dishImage}
        resizeMode="cover"
      />
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
                  {[1, 2, 3, 4].map((item) => (
                    <ShimmerCard key={`item-shimmer-${item}`} />
                  ))}
                </View>
              </View>

              {/* Shimmer for Favorite Restaurants */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Favorite Restaurants</Text>
                <View style={styles.gridContainer}>
                  {[1, 2, 3, 4].map((item) => (
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
    rowGap: CARD_GAP,
    justifyContent: 'flex-start',
  },
  shimmerCard: {
    width: CARD_WIDTH,
    height: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dishCard: {
    width: CARD_WIDTH,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  dishImageContainer: {
    width: CARD_WIDTH,
    height: 79,
    backgroundColor: '#C9F5C6',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: -9,
    zIndex: 2,
  },
  dishImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  dishLabelContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  dishName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
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
