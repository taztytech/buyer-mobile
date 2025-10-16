import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  onPress?: () => void;
  onFavoriteToggle?: () => void;
  onImageLoad?: () => void;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = ({
  restaurant,
  onPress,
  onFavoriteToggle,
  onImageLoad,
}) => {
  // Handle location - convert object to string if needed
  const locationText = typeof restaurant.location === 'string'
    ? restaurant.location
    : restaurant.location?.locality || restaurant.location?.city || 'Unknown';

  // Handle image source - support both local and remote images
  const getImageSource = () => {
    if (typeof restaurant.image === 'string') {
      // Remote URL
      console.log('[RestaurantCard] Loading remote image:', restaurant.image);
      return { uri: restaurant.image };
    } else if (typeof restaurant.image === 'number') {
      // Local require()
      console.log('[RestaurantCard] Loading local image');
      return restaurant.image;
    } else {
      // Default fallback
      console.log('[RestaurantCard] Using default image');
      return restaurant.image;
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`restaurant-card-${restaurant.id}`}
    >
      {/* Left Side - Image */}
      <View style={styles.imageContainer}>
        <Image
          source={getImageSource()}
          style={styles.image}
          resizeMode="cover"
          testID={`restaurant-image-${restaurant.id}`}
          onError={(error) => {
            console.error('[RestaurantCard] Image load error for', restaurant.name, ':', error.nativeEvent.error);
          }}
          onLoad={() => {
            console.log('[RestaurantCard] Image loaded successfully for', restaurant.name);
            if (onImageLoad) {
              onImageLoad();
            }
          }}
        />
      </View>

      {/* Right Side - Details */}
      <View style={styles.detailsContainer}>
        {/* Top Content - Name and Cuisine */}
        <View style={styles.topContent}>
          {/* Top Section - Name, Cuisine, Favorite */}
          <View style={styles.topSection}>
            <View style={styles.nameSection}>
              <View style={styles.nameRow}>
                <Text style={styles.restaurantName} numberOfLines={1} ellipsizeMode="tail">
                  {restaurant.name}
                </Text>
                {/* Favorite Button */}
                <TouchableOpacity
                  style={styles.favoriteButton}
                  onPress={onFavoriteToggle}
                  testID={`favorite-button-${restaurant.id}`}
                >
                  <MaterialIcons
                    name={restaurant.isFavorite ? 'favorite' : 'favorite-border'}
                    size={17}
                    color="#000000"
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.cuisine} numberOfLines={2} ellipsizeMode="tail">
                {restaurant.cuisine}
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Content - Rating, Delivery, Divider and Location */}
        <View style={styles.bottomContent}>
          {/* Rating and Delivery Time */}
          <View style={styles.metaSection}>
            <View style={styles.ratingContainer}>
              <MaterialIcons name="star" size={14} color="#00B14F" />
              <Text style={styles.ratingText}>{restaurant.rating}</Text>
            </View>

            <View style={styles.deliveryContainer}>
              <MaterialIcons name="two-wheeler" size={15} color="#B48300" />
              <Text style={styles.deliveryText}>{restaurant.deliveryTime}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            {Array.from({ length: 20 }).map((_, index) => (
              <View key={index} style={styles.dash} />
            ))}
          </View>

          {/* Bottom Section - Location and Distance */}
          <View style={styles.bottomSection}>
            <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
              {locationText}
            </Text>
            <Text style={styles.distanceText}>{restaurant.distance}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 0,
    width: '100%',
    height: 153,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    borderRadius: 20,
  },
  // Left Side - Image
  imageContainer: {
    width: 166,
    height: 153,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  image: {
    width: 166,
    height: 153,
    backgroundColor: 'transparent',
  },
  // Right Side - Details Container
  detailsContainer: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 10,
    minHeight: 137,
  },
  // Top Content Wrapper
  topContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },
  // Bottom Content Wrapper
  bottomContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    gap: 6,
    marginTop: 15,
  },
  // Top Section
  topSection: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: 0,
    gap: 4,
    alignSelf: 'stretch',
  },
  nameSection: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: 0,
    alignSelf: 'stretch',
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  restaurantName: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'left',
    color: '#000000',
    opacity: 0.85,
    paddingRight: 8,
  },
  cuisine: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(0, 0, 0, 0.5)',
    opacity: 0.85,
    width: '100%',
  },
  favoriteButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    width: 25,
    height: 25,
    borderRadius: 13,
  },
  // Meta Section - Rating and Delivery
  metaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 0,
    gap: 10,
    alignSelf: 'stretch',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    gap: 4,
    minWidth: 47,
    height: 22,
    backgroundColor: 'rgba(0, 128, 74, 0.1)',
    borderRadius: 13,
  },
  ratingText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 14,
    color: '#00B14F',
    opacity: 0.85,
  },
  deliveryContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    gap: 4,
    width: 86,
    height: 23,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  deliveryText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 10,
    lineHeight: 15,
    color: '#B48300',
    opacity: 0.85,
  },
  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    height: 1,
  },
  dash: {
    width: 5,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  // Bottom Section
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 0,
    gap: 10,
    alignSelf: 'stretch',
  },
  locationText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(0, 0, 0, 0.5)',
    opacity: 0.85,
    paddingRight: 8,
  },
  distanceText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 11,
    lineHeight: 16,
    color: '#00B14F',
    opacity: 0.85,
    flexShrink: 0,
  },
});
