import React, { useState, useEffect, useRef } from 'react';
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
  BackHandler,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@/shims/rn-vector-icons';
import { LinearGradient } from '@/shims/rn-linear-gradient';
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
  visible?: boolean;
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
  visible = false,
  onBack,
  onSelectItem,
  onSelectRestaurant,
}) => {
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [favoriteRestaurants, setFavoriteRestaurants] = useState<FavoriteRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingItemId, setTogglingItemId] = useState<string | number | null>(null);
  const [togglingRestaurantId, setTogglingRestaurantId] = useState<string | number | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  // Android: consume back here (mounted only on My Favorites) so App route ref cannot mis-route to profile.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBackRef.current?.();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Only fetch when screen becomes visible for the first time
  useEffect(() => {
    if (visible && !hasLoadedOnce) {
      fetchFavorites();
      setHasLoadedOnce(true);
    }
  }, [visible, hasLoadedOnce]);

  const fetchFavorites = async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const response = await favoritesService.getAllFavorites();

      if (response.success && response.data) {
        // The API returns nested data: response.data.data.data
        const actualData = response.data.data?.data || response.data;

        // Extract favorite items - need to go one level deeper
        const items = actualData.data?.items || actualData.items || actualData.favorite_items;
        if (items && Array.isArray(items)) {
          setFavoriteItems(items);
        } else {
          setFavoriteItems([]);
        }

        // Extract favorite restaurants - need to go one level deeper
        const restaurants = actualData.data?.restaurants || actualData.restaurants || actualData.favorite_restaurants;
        if (restaurants && Array.isArray(restaurants)) {
          setFavoriteRestaurants(restaurants);
        } else {
          setFavoriteRestaurants([]);
        }
      } else {
        setError(response.error || 'Failed to load favorites');
      }
    } catch (error) {
      setError('An error occurred while loading favorites');
    } finally {
      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  // Handle toggling favorite for an item
  const handleToggleFavoriteItem = async (itemId: string | number) => {
    if (togglingItemId) return; // Prevent multiple simultaneous calls

    setTogglingItemId(itemId);

    try {
      const response = await favoritesService.toggleFavoriteItem(itemId);

      if (response.success) {
        // Refresh the favorites list smoothly
        await fetchFavorites(true);
      }
    } catch (error) {
      // Silent fail
    } finally {
      setTogglingItemId(null);
    }
  };

  // Handle toggling favorite for a restaurant
  const handleToggleFavoriteRestaurant = async (restaurantId: string | number) => {
    if (togglingRestaurantId) return; // Prevent multiple simultaneous calls

    setTogglingRestaurantId(restaurantId);
    favoritesService.setRestaurantFavoriteOverride(restaurantId, false);

    try {
      const response = await favoritesService.toggleFavoriteRestaurant(restaurantId);

      if (response.success) {
        // Refresh the favorites list smoothly
        await fetchFavorites(true);
      } else {
        favoritesService.setRestaurantFavoriteOverride(restaurantId, true);
      }
    } catch (error) {
      // Silent fail
      favoritesService.setRestaurantFavoriteOverride(restaurantId, true);
    } finally {
      setTogglingRestaurantId(null);
    }
  };

  // Handle image load
  const handleImageLoad = (id: string) => {
    setLoadedImages((prev) => new Set([...prev, id]));
  };

  const renderItemCard = (item: FavoriteItem) => {
    // Get the first image from images array, or fallback to image field
    const imageUrl = item.images && item.images.length > 0 ? item.images[0] : item.image;
    const imageId = `item-${item.id}`;
    const isImageLoaded = loadedImages.has(imageId);

    return (
      <View key={item.id} style={styles.cardShadowWrapper}>
        <TouchableOpacity
          style={styles.dishCard}
          onPress={() => onSelectItem && onSelectItem(item)}
          activeOpacity={0.7}
        >
          {/* Image with loading shimmer */}
          {!isImageLoaded && (
            <View style={styles.imageShimmer}>
              <Shimmer width="100%" height={150} borderRadius={12} backgroundColor="#E8E8E8" />
            </View>
          )}
          <Image
            source={{ uri: imageUrl }}
            style={[styles.dishImage, !isImageLoaded && styles.hiddenImage]}
            resizeMode="cover"
            onLoad={() => handleImageLoad(imageId)}
          />

          {/* Top Gradient Overlay */}
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.1)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.gradientOverlayTop}
          />

          {/* Heart Icon (Clickable to remove from favorites) */}
          <TouchableOpacity
            style={styles.heartIcon}
            onPress={(e) => {
              e.stopPropagation();
              handleToggleFavoriteItem(item.id);
            }}
            disabled={togglingItemId === item.id}
          >
            {togglingItemId === item.id ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcons name="favorite" size={24} color="#FF0000" />
            )}
          </TouchableOpacity>

          <View style={styles.dishLabelContainer}>
            <Text style={styles.dishName} numberOfLines={1}>{item.name}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRestaurantCard = (item: FavoriteRestaurant) => {
    const imageId = `restaurant-${item.id}`;
    const isImageLoaded = loadedImages.has(imageId);

    return (
      <View key={item.id} style={styles.cardShadowWrapper}>
        <TouchableOpacity
          style={styles.dishCard}
          onPress={() => onSelectRestaurant && onSelectRestaurant(item.id, item.name)}
          activeOpacity={0.7}
        >
          {/* Image with loading shimmer */}
          {!isImageLoaded && (
            <View style={styles.imageShimmer}>
              <Shimmer width="100%" height={150} borderRadius={12} backgroundColor="#E8E8E8" />
            </View>
          )}
          <Image
            source={{ uri: item.logo_url }}
            style={[styles.dishImage, !isImageLoaded && styles.hiddenImage]}
            resizeMode="cover"
            onLoad={() => handleImageLoad(imageId)}
          />

          {/* Top Gradient Overlay */}
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.1)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.gradientOverlayTop}
          />

          {/* Heart Icon (Clickable to remove from favorites) */}
          <TouchableOpacity
            style={styles.heartIcon}
            onPress={(e) => {
              e.stopPropagation();
              handleToggleFavoriteRestaurant(item.id);
            }}
            disabled={togglingRestaurantId === item.id}
          >
            {togglingRestaurantId === item.id ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcons name="favorite" size={24} color="#FF0000" />
            )}
          </TouchableOpacity>

          <View style={styles.dishLabelContainer}>
            <Text style={styles.dishName} numberOfLines={1}>{item.name}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

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
              <TouchableOpacity style={styles.retryButton} onPress={() => { fetchFavorites(); }}>
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
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-SemiBold',
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
  cardShadowWrapper: {
    width: CARD_WIDTH,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  dishCard: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  dishImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  hiddenImage: {
    opacity: 0,
  },
  gradientOverlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  heartIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 10,
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
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-Regular',
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
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#000000',
    marginTop: 16,
    opacity: 0.7,
  },
  emptyText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.5)',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
