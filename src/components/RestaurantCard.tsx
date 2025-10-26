import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { favoritesService } from '@/services/favorites.service';

export interface Restaurant {
  id: string | number;
  name: string;
  cuisine: string;
  rating: number;
  deliveryTime: string;
  location: string | { lat?: number; lng?: number; city?: string; locality?: string };
  distance: string;
  image: any;
  isFavorite?: boolean;
  isVeg?: boolean;
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
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`restaurant-card-${restaurant.id}`}
    >
      {/* Left Side - Image with Heart Button */}
      <View style={styles.imageContainer}>
        <Image
          source={getImageSource()}
          style={styles.image}
          resizeMode="cover"
          testID={`restaurant-image-${restaurant.id}`}
          onError={(error) => {}}
          onLoad={() => {
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

        {/* Heart Button Overlay */}
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

      {/* Right Side - Details (Vertically Centered) */}
      <View style={styles.detailsContainer}>
        {/* Pure Veg Badge */}
        {restaurant.isVeg && (
          <View style={styles.pureVegBadge}>
            <MaterialIcons name="eco" size={14} color="#00B14F" />
            <Text style={styles.pureVegText}>Pure Veg</Text>
          </View>
        )}

        {/* Restaurant Name */}
        <Text style={styles.restaurantName} numberOfLines={2} ellipsizeMode="tail">
          {restaurant.name}
        </Text>

        {/* Rating and Delivery Time */}
        <View style={styles.ratingDeliveryRow}>
          <View style={styles.ratingContainer}>
            <MaterialIcons name="star" size={16} color="#00B14F" />
            <Text style={styles.ratingText}>
              {restaurant.rating} ({restaurant.rating >= 1 ? `${restaurant.rating.toFixed(1)}K+` : '0'})
            </Text>
          </View>
          <Text style={styles.deliveryDot}>•</Text>
          <Text style={styles.deliveryText}>{restaurant.deliveryTime}</Text>
        </View>

        {/* Cuisine */}
        <Text style={styles.cuisineText} numberOfLines={2} ellipsizeMode="tail">
          {restaurant.cuisine}
        </Text>

        {/* Location and Distance */}
        <View style={styles.locationRow}>
          <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
            {locationText}
          </Text>
          <Text style={styles.distanceDot}>•</Text>
          <Text style={styles.distanceText}>{restaurant.distance}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Return true if props are equal (skip re-render)
  return (
    prevProps.restaurant.id === nextProps.restaurant.id &&
    prevProps.restaurant.isFavorite === nextProps.restaurant.isFavorite &&
    prevProps.restaurant.name === nextProps.restaurant.name
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    height: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  // Left Side - Image
  imageContainer: {
    width: 130,
    height: 160,
    position: 'relative',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
  },
  image: {
    width: 130,
    height: 160,
    borderRadius: 16,
  },
  gradientOverlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  gradientOverlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 10,
  },
  // Right Side - Details Container (Vertically Centered)
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 4,
  },
  // Pure Veg Badge
  pureVegBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  pureVegText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 18,
    color: '#00B14F',
  },
  // Restaurant Name
  restaurantName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: '#000000',
    marginBottom: 2,
  },
  // Rating and Delivery Row
  ratingDeliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#000000',
  },
  deliveryDot: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: '#000000',
  },
  deliveryText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#000000',
  },
  // Cuisine
  cuisineText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#666666',
    marginBottom: 2,
  },
  // Location Row
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: '#666666',
    flex: 1,
  },
  distanceDot: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: '#666666',
  },
  distanceText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: '#666666',
  },
});
