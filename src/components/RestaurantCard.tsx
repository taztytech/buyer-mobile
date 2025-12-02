import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { favoritesService } from '@/services/favorites.service';
import { Shimmer } from '@/components/Shimmer';

export interface RestaurantTiming {
  day: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
}

export interface Restaurant {
  id: string | number;
  name: string;
  cuisine: string;
  rating: number;
  reviewCount?: number;
  deliveryTime: string;
  location: string | { lat?: number; lng?: number; city?: string; locality?: string };
  distance: string;
  image: any;
  isFavorite?: boolean;
  isVeg?: boolean;
  timings?: RestaurantTiming[];
  isOpen?: boolean;
  price?: number; // Price for two people
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  onPress?: () => void;
  onFavoriteToggle?: () => void;
  onImageLoad?: () => void;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = React.memo(({
  restaurant,
  onPress,
  onFavoriteToggle,
  onImageLoad,
}) => {
  const [isFavorite, setIsFavorite] = useState(restaurant.isFavorite || false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageOpacity = useState(new Animated.Value(0))[0];

  // Update internal state when prop changes
  useEffect(() => {
    setIsFavorite(restaurant.isFavorite || false);
  }, [restaurant.isFavorite]);

  // Handle location - convert object to string if needed
  const locationText = typeof restaurant.location === 'string'
    ? restaurant.location
    : restaurant.location?.locality || restaurant.location?.city || 'Unknown';

  // Handle image source - support both local and remote images
  const getImageSource = () => {
    if (typeof restaurant.image === 'string') {
      // Remote URL
      return { uri: restaurant.image };
    } else if (typeof restaurant.image === 'number') {
      // Local require()
      return restaurant.image;
    } else {
      // Default fallback
      return restaurant.image;
    }
  };

  // Handle favorite toggle with API call
  const handleFavoriteToggle = async () => {
    if (isTogglingFavorite) return; // Prevent multiple simultaneous calls

    setIsTogglingFavorite(true);

    // Optimistic update
    const previousState = isFavorite;
    setIsFavorite(!isFavorite);

    try {
      const response = await favoritesService.toggleFavoriteRestaurant(restaurant.id);

      if (!response.success) {
        // Revert on failure
        setIsFavorite(previousState);
      }

      // Call parent callback if provided
      if (onFavoriteToggle) {
        onFavoriteToggle();
      }
    } catch (error) {
      // Revert on error
      setIsFavorite(previousState);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        restaurant.isOpen === false && styles.cardClosed
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`restaurant-card-${restaurant.id}`}
    >
      {/* Top - Image Container */}
      <View style={styles.imageContainer}>
        {/* Shimmer shown while image loads */}
        {!imageLoaded && (
          <View style={styles.imageShimmerContainer}>
            <Shimmer width="100%" height={200} borderRadius={10} backgroundColor="#E8E8E8" />
          </View>
        )}

        {/* Actual image with fade-in animation */}
        <Animated.Image
          source={getImageSource()}
          style={[
            styles.image,
            restaurant.isOpen === false && styles.imageClosed,
            { opacity: imageOpacity }
          ]}
          resizeMode="cover"
          testID={`restaurant-image-${restaurant.id}`}
          onError={(error) => {
            // Mark as loaded even on error
            setImageLoaded(true);
            Animated.timing(imageOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
            if (onImageLoad) {
              onImageLoad();
            }
          }}
          onLoad={() => {
            // Fade in the image
            setImageLoaded(true);
            Animated.timing(imageOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
            if (onImageLoad) {
              onImageLoad();
            }
          }}
          fadeDuration={0}
          progressiveRenderingEnabled={true}
        />

        {/* Top Gradient Overlay */}
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.1)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradientOverlayTop}
        />

        {/* Bottom Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0.5)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradientOverlayBottom}
        />

        {/* Closed Now Overlay */}
        {restaurant.isOpen === false && (
          <View style={styles.closedOverlay}>
            <Text style={styles.closedText}>CLOSED NOW</Text>
          </View>
        )}

        {/* Heart Button Overlay - Right Side of Image */}
        <TouchableOpacity
          style={styles.heartButton}
          onPress={handleFavoriteToggle}
          disabled={isTogglingFavorite}
          testID={`favorite-button-${restaurant.id}`}
        >
          {isTogglingFavorite ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <MaterialIcons
              name={isFavorite ? 'favorite' : 'favorite-border'}
              size={24}
              color={isFavorite ? '#FF0000' : '#FFFFFF'}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom - Details Below Image */}
      <View style={[
        styles.detailsContainer,
        restaurant.isOpen === false && styles.detailsContainerClosed
      ]}>
        {/* Store Name Row with Rating on Right */}
        <View style={styles.nameRatingRow}>
          <Text style={styles.restaurantName} numberOfLines={2} ellipsizeMode="tail">
            {restaurant.name}
          </Text>
          {restaurant.rating > 0 && (
            <View style={styles.ratingBadge}>
              <MaterialIcons name="star" size={14} color="#FFFFFF" />
              <Text style={styles.ratingBadgeText}>
                {restaurant.rating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Store Description/Cuisine */}
        <Text style={styles.cuisineText} numberOfLines={2} ellipsizeMode="tail">
          {restaurant.cuisine}
        </Text>

        {/* Delivery Time with Clock Icon and Distance */}
        <View style={styles.deliveryRow}>
          <MaterialIcons name="access-time" size={16} color="#00B14F" />
          <Text style={styles.deliveryText}>{restaurant.deliveryTime}</Text>
          {restaurant.distance && (
            <>
              <Text style={styles.distanceSeparator}>•</Text>
              <MaterialIcons name="two-wheeler" size={16} color="#00B14F" />
              <Text style={styles.distanceText}>{restaurant.distance}</Text>
            </>
          )}
        </View>

        {/* Price */}
        {restaurant.price !== undefined && (
          <Text style={styles.priceText}>₹{restaurant.price.toFixed(1)} for two</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Return true if props are equal (skip re-render)
  return (
    prevProps.restaurant.id === nextProps.restaurant.id &&
    prevProps.restaurant.isFavorite === nextProps.restaurant.isFavorite &&
    prevProps.restaurant.name === nextProps.restaurant.name &&
    prevProps.restaurant.isOpen === nextProps.restaurant.isOpen
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'column',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardClosed: {
    opacity: 0.6,
  },
  // Top - Image Container
  imageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  imageShimmerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 200,
    zIndex: 1,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  image: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  imageClosed: {
    opacity: 0.5,
  },
  closedOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  closedText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  gradientOverlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  gradientOverlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 10,
  },
  // Bottom - Details Container
  detailsContainer: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 6,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  detailsContainerClosed: {
    opacity: 0.5,
  },
  // Store Name Row with Rating
  nameRatingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  // Restaurant Name
  restaurantName: {
    flex: 1,
    fontFamily: 'Poppins_700Bold',
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 24,
    color: '#000000',
  },
  // Rating Badge
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00B14F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexShrink: 0,
  },
  ratingBadgeText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
  },
  // Cuisine
  cuisineText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    color: '#666666',
    marginBottom: 6,
  },
  // Delivery Row
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  deliveryText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#00B14F',
  },
  distanceSeparator: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    color: '#00B14F',
    marginHorizontal: 4,
  },
  distanceText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#00B14F',
  },
  // Price
  priceText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
  },
});
