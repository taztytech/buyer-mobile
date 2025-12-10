import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { favoritesService } from '@/services/favorites.service';
import { Shimmer } from '@/components/Shimmer';
import { homeService } from '@/services/home.service';
import { formatTime } from '@/utils/timing.utils';

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
  isVerticalLayout?: boolean; // true = vertical (style 2), false = horizontal (style 1)
}

export const RestaurantCard: React.FC<RestaurantCardProps> = React.memo(({
  restaurant,
  onPress,
  onFavoriteToggle,
  onImageLoad,
  isVerticalLayout = false,
}) => {
  const [isFavorite, setIsFavorite] = useState(restaurant.isFavorite || false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageOpacity = useState(new Animated.Value(0))[0];

  // Update internal state when prop changes
  useEffect(() => {
    setIsFavorite(restaurant.isFavorite || false);
  }, [restaurant.isFavorite]);

  // Calculate isOpen dynamically from API timings if not provided
  const isRestaurantOpen = React.useMemo(() => {
    if (restaurant.isOpen !== undefined) {
      return restaurant.isOpen;
    }
    // If isOpen is not provided, calculate from timings
    if (restaurant.timings && restaurant.timings.length > 0) {
      return homeService.isRestaurantOpen(restaurant.timings);
    }
    // Default to true if no timing info available
    return true;
  }, [restaurant.isOpen, restaurant.timings]);

  // Handle location - convert object to string if needed
  const locationText = typeof restaurant.location === 'string'
    ? restaurant.location
    : restaurant.location?.locality || restaurant.location?.city || 'Unknown';

  // Get next opening time message from API timings - all data from API, no hardcoding
  const getNextOpeningTimeMessage = (): { message: string; time: string } | null => {
    // Only show message if restaurant is closed
    if (isRestaurantOpen) return null;
    
    // Use API timings data only
    if (!restaurant.timings || restaurant.timings.length === 0) return null;

    // First try the service method
    let nextOpening = homeService.getNextOpeningTime(restaurant.timings);
    
    // If service returns null, calculate from timings directly using open_time
    if (!nextOpening) {
      const now = new Date();
      const jsDay = now.getDay();
      const currentTime = now.getHours() * 100 + now.getMinutes();
      const apiDay = jsDay + 1;
      
      // Check if restaurant opens later today
      const todayTiming = restaurant.timings.find(t => t.day === apiDay);
      if (todayTiming && todayTiming.open_time) {
        const openTime = parseInt(todayTiming.open_time);
        if (currentTime < openTime) {
          nextOpening = {
            day: apiDay,
            time: todayTiming.open_time,
            daysUntil: 0,
            minutesUntil: 0,
          };
        }
      }
      
      // If not today, check next 7 days
      if (!nextOpening) {
        for (let i = 1; i <= 7; i++) {
          const nextDay = (apiDay + i) > 7 ? (apiDay + i) - 7 : (apiDay + i);
          const nextDayTiming = restaurant.timings.find(t => t.day === nextDay);
          
          if (nextDayTiming && nextDayTiming.open_time) {
            nextOpening = {
              day: nextDay,
              time: nextDayTiming.open_time,
              daysUntil: i,
              minutesUntil: 0,
            };
            break;
          }
        }
      }
    }
    
    if (!nextOpening) return null;

    // Format time from API data
    const formattedTime = formatTime(nextOpening.time);
    const dayNames = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Use API calculated daysUntil and day - all from API data
    let message = '';
    if (nextOpening.daysUntil === 0) {
      message = `Opens today at ${formattedTime}`;
    } else if (nextOpening.daysUntil === 1) {
      message = `Opens tomorrow at ${formattedTime}`;
    } else {
      // Use API day number to get day name
      const dayName = dayNames[nextOpening.day] || '';
      message = `Opens ${dayName} at ${formattedTime}`;
    }

    return {
      message,
      time: formattedTime,
    };
  };

  const nextOpeningInfo = getNextOpeningTimeMessage();

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

  useEffect(() => {
    setImageLoaded(false);
    imageOpacity.setValue(0);
  }, [isVerticalLayout, imageOpacity]);

  if (!isVerticalLayout) {
    return (
      <TouchableOpacity
        key="horizontal"
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.7}
        testID={`restaurant-card-${restaurant.id}`}
      >
        {/* Left Side - Image with Heart Button */}
        <View style={styles.imageContainer}>
          {/* Shimmer shown while image loads */}
          {!imageLoaded && (
            <View style={styles.imageShimmerContainer}>
              <Shimmer width={130} height={160} borderRadius={16} backgroundColor="#E8E8E8" />
            </View>
          )}

          {/* Actual image with fade-in animation - wrapped for grayscale effect */}
          <View style={styles.imageWrapper}>
            <Animated.Image
              source={getImageSource()}
              style={[
                styles.image,
                !isRestaurantOpen && styles.imageGrayscale,
                { opacity: imageOpacity }
              ]}
              resizeMode="cover"
              testID={`restaurant-image-${restaurant.id}`}
              onError={() => {
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
            {/* Single optimized overlay that blends with image to create grayscale - only for closed stores */}
            {!isRestaurantOpen && (
              <View style={styles.grayscaleBlendOverlay} pointerEvents="none" />
            )}
          </View>

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
          {!isRestaurantOpen && (
            <View style={styles.closedOverlay}>
              <Text style={styles.closedTextCurrently}>CURRENTLY</Text>
              <Text style={styles.closedTextClosed}>CLOSED</Text>
            </View>
          )}

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
          <Text style={[
            styles.restaurantName,
            !isRestaurantOpen && styles.restaurantNameClosed
          ]} numberOfLines={2} ellipsizeMode="tail">
            {restaurant.name}
          </Text>

          {/* Rating and Delivery Time */}
          <View style={styles.ratingDeliveryRow}>
            {restaurant.rating > 0 && (
              <>
                <View style={styles.ratingContainer}>
                  <MaterialIcons name="star" size={14} color="#00B14F" />
                  <Text style={[
                    styles.ratingText,
                    !isRestaurantOpen && styles.ratingTextClosed
                  ]}>
                    {restaurant.rating.toFixed(1)}
                  </Text>
                </View>
                <Text style={styles.deliveryDot}>•</Text>
              </>
            )}
            <Text style={styles.deliveryText}>{restaurant.deliveryTime}</Text>
          </View>

          {/* Cuisine */}
          <Text style={[
            styles.cuisineText,
            !isRestaurantOpen && styles.cuisineTextClosed
          ]} numberOfLines={2} ellipsizeMode="tail">
            {restaurant.cuisine}
          </Text>

          {/* Location - Separate Row */}
          <View style={styles.locationRow}>
            <Text style={[
              styles.locationText,
              !isRestaurantOpen && styles.locationTextClosed
            ]} numberOfLines={1} ellipsizeMode="tail">
              {locationText}
            </Text>
          </View>

          {/* Distance - Separate Row Below Location */}
          <View style={styles.distanceRow}>
            <MaterialIcons name="location-on" size={14} color="#00B14F" />
            <Text style={[
              styles.distanceText,
              !isRestaurantOpen && styles.distanceTextClosed
            ]}>{restaurant.distance}</Text>
          </View>

          {/* Opening Time (when closed) - All data from API */}
          {/* Always render container to maintain consistent row height */}
          <View style={styles.openingTimeContainer}>
            {nextOpeningInfo && (
              <>
                <View style={styles.separator} />
                <Text style={styles.openingTimeText}>{nextOpeningInfo.message}</Text>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      key="vertical"
      style={styles.cardVertical}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`restaurant-card-${restaurant.id}`}
    >
      {/* Top - Image Container */}
      <View style={styles.imageContainerVertical}>
        {/* Shimmer shown while image loads */}
        {!imageLoaded && (
          <View style={styles.imageShimmerContainerVertical}>
            <Shimmer width="100%" height={200} borderRadius={10} backgroundColor="#E8E8E8" />
          </View>
        )}

        {/* Actual image with fade-in animation - wrapped for grayscale effect */}
        <View style={styles.imageWrapperVertical}>
          <Animated.Image
            source={getImageSource()}
            style={[
              styles.imageVertical,
              !isRestaurantOpen && styles.imageGrayscale,
              { opacity: imageOpacity }
            ]}
            resizeMode="cover"
            testID={`restaurant-image-${restaurant.id}`}
            onError={() => {
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
          {/* Single optimized overlay that blends with image to create grayscale - only for closed stores */}
          {!isRestaurantOpen && (
            <View style={styles.grayscaleBlendOverlayVertical} pointerEvents="none" />
          )}
        </View>

        {/* Top Gradient Overlay */}
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.1)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradientOverlayTopVertical}
        />

        {/* Bottom Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0.5)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradientOverlayBottomVertical}
        />


        {/* Closed Now Overlay */}
        {!isRestaurantOpen && (
          <View style={styles.closedOverlayVertical}>
            <Text style={styles.closedTextCurrently}>CURRENTLY</Text>
            <Text style={styles.closedTextClosed}>CLOSED</Text>
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
      <View style={styles.detailsContainerVertical}>
        {/* Store Name Row with Rating on Right */}
        <View style={styles.nameRatingRow}>
          <Text style={[
            styles.restaurantNameVertical,
            !isRestaurantOpen && styles.restaurantNameVerticalClosed
          ]} numberOfLines={2} ellipsizeMode="tail">
            {restaurant.name}
          </Text>
          {restaurant.rating > 0 && (
            <View style={styles.ratingBadge}>
              <MaterialIcons name="star" size={14} color="#FFFFFF" />
              <Text style={[
                styles.ratingBadgeText,
                !isRestaurantOpen && styles.ratingBadgeTextClosed
              ]}>
                {restaurant.rating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Store Description/Cuisine */}
        <Text style={[
          styles.cuisineTextVertical,
          !isRestaurantOpen && styles.cuisineTextVerticalClosed
        ]} numberOfLines={2} ellipsizeMode="tail">
          {restaurant.cuisine}
        </Text>

        {/* Delivery Time with Clock Icon and Distance */}
        <View style={styles.deliveryRow}>
          <MaterialIcons name="access-time" size={16} color="#00B14F" />
          <Text style={styles.deliveryTextVertical}>{restaurant.deliveryTime}</Text>
          {restaurant.distance && (
            <>
              <Text style={styles.distanceSeparator}>•</Text>
              <MaterialIcons name="location-on" size={16} color="#00B14F" />
              <Text style={[
                styles.distanceTextVertical,
                !isRestaurantOpen && styles.distanceTextVerticalClosed
              ]}>{restaurant.distance}</Text>
            </>
          )}
        </View>

        {/* Price */}
        {restaurant.price !== undefined && (
          <Text style={styles.priceText}>₹{restaurant.price.toFixed(1)} for two</Text>
        )}

        {/* Opening Time (when closed) - All data from API */}
        {nextOpeningInfo && (
          <View style={styles.openingTimeContainerVertical}>
            <View style={styles.separatorVertical} />
            <Text style={styles.openingTimeTextVertical}>{nextOpeningInfo.message}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Return true if props are equal (skip re-render)
  // Compare timings array to ensure re-render when API timing data changes
  const timingsEqual = JSON.stringify(prevProps.restaurant.timings) === JSON.stringify(nextProps.restaurant.timings);
  
  return (
    prevProps.restaurant.id === nextProps.restaurant.id &&
    prevProps.restaurant.isFavorite === nextProps.restaurant.isFavorite &&
    prevProps.restaurant.name === nextProps.restaurant.name &&
    prevProps.restaurant.isOpen === nextProps.restaurant.isOpen &&
    timingsEqual &&
    prevProps.isVerticalLayout === nextProps.isVerticalLayout
  );
});

const styles = StyleSheet.create({
  // Horizontal Layout (Style 1)
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    height: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  // Left Side - Image
  imageContainer: {
    width: 130,
    height: 160,
    position: 'relative',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
  },
  imageShimmerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 130,
    height: 160,
    zIndex: 1,
  },
  image: {
    width: 130,
    height: 160,
    borderRadius: 16,
  },
  imageWrapper: {
    width: 130,
    height: 160,
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageWrapperVertical: {
    width: '100%',
    height: 200,
    position: 'relative',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: 'hidden',
  },
  imageClosed: {
    opacity: 1,
  },
  imageGrayscale: {
    // Style applied to image when closed - the overlay will create the grayscale effect
    opacity: 6,
  },
  grayscaleBlendOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Single overlay optimized to create true black & white grayscale effect
    // Using a neutral grey that desaturates colors completely when applied
    backgroundColor: 'rgba(127, 127, 127, 0.6)',
    borderRadius: 16,
    zIndex: 2,
  },
  grayscaleBlendOverlayVertical: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Single overlay optimized to create true black & white grayscale effect
    // Using a neutral grey that desaturates colors completely when applied
    backgroundColor: 'rgba(127, 127, 127, 0.15)',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    zIndex: 2,
  },
  closedOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    zIndex: 3,
  },
  closedTextCurrently: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  closedTextClosed: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginTop: -2,
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
  // Right Side - Details Container
  detailsContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 3,
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
    fontSize: 11,
    lineHeight: 16,
    color: '#00B14F',
  },
  // Restaurant Name
  restaurantName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 30,
    color: '#000000',
    marginBottom: 3,
    marginTop: 0,
  },
  restaurantNameClosed: {
    fontSize: 16,
    lineHeight: 24,
  },
  // Rating and Delivery Row
  ratingDeliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: '#000000',
  },
  ratingTextClosed: {
    fontSize: 11,
    lineHeight: 16,
  },
  deliveryDot: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#000000',
  },
  deliveryText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 18,
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
  cuisineTextClosed: {
    fontSize: 10,
    lineHeight: 16,
  },
  // Location Row (Separate)
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#666666',
    flex: 1,
  },
  locationTextClosed: {
    fontSize: 10,
    lineHeight: 14,
  },
  // Distance Row (Separate, Below Location)
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  distanceText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#666666',
  },
  distanceTextClosed: {
    fontSize: 10,
    lineHeight: 14,
  },
  openingTimeContainer: {
    marginTop: 4,
    minHeight: 20, // Reserve minimum height to maintain consistent row height
    justifyContent: 'flex-start',
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 3,
    width: '100%',
  },
  openingTimeText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#000000',
    letterSpacing: 0.1,
  },

  // Vertical Layout (Style 2)
  cardVertical: {
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
  // Top - Image Container
  imageContainerVertical: {
    width: '100%',
    height: 200,
    position: 'relative',
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  imageShimmerContainerVertical: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 200,
    zIndex: 1,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  imageVertical: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  closedOverlayVertical: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    zIndex: 3,
  },
  gradientOverlayTopVertical: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  gradientOverlayBottomVertical: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  // Bottom - Details Container
  detailsContainerVertical: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 6,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#FFFFFF',
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
  restaurantNameVertical: {
    flex: 1,
    fontFamily: 'Poppins_700Bold',
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 24,
    color: '#000000',
  },
  restaurantNameVerticalClosed: {
    fontSize: 16,
    lineHeight: 22,
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
  ratingBadgeTextClosed: {
    fontSize: 10,
    lineHeight: 16,
  },
  // Cuisine
  cuisineTextVertical: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    color: '#666666',
    marginBottom: 6,
  },
  cuisineTextVerticalClosed: {
    fontSize: 12,
    lineHeight: 16,
  },
  // Delivery Row
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  deliveryTextVertical: {
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
  distanceTextVertical: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#00B14F',
  },
  distanceTextVerticalClosed: {
    fontSize: 10,
    lineHeight: 16,
  },
  // Price
  priceText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
  },
  openingTimeContainerVertical: {
    marginTop: 6,
    paddingTop: 6,
  },
  separatorVertical: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 6,
    width: '100%',
  },
  openingTimeTextVertical: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#000000',
    letterSpacing: 0.1,
  },
});