import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { favoritesService } from '@/services/favorites.service';
import { OptimizedImage } from '@/components/OptimizedImage';
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
  /**
   * Layout mode for the restaurant card.
   * 1 = horizontal (style 1)
   * 2 = vertical (style 2)
   * 3 = outlined card: full-width image, heart top-right, details below (e.g. home list)
   * 4 = home horizontal: image left, details right; overlays on image (home list)
   */
  layoutMode?: 1 | 2 | 3 | 4;
  isGuest?: boolean;
  onNavigateToLogin?: () => void;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = React.memo(({
  restaurant,
  onPress,
  onFavoriteToggle,
  onImageLoad,
  layoutMode = 1,
  isGuest = false,
  onNavigateToLogin,
}) => {
  const [isFavorite, setIsFavorite] = useState(restaurant.isFavorite || false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageOpacity = useState(new Animated.Value(0))[0];

  // Update internal state when prop changes
  useEffect(() => {
    setIsFavorite(restaurant.isFavorite || false);
  }, [restaurant.isFavorite]);

  // Store open/close:
  // Use ONLY the derived isOpen flag from top-level API is_open.
  // Do NOT derive open state from timings.
  const isRestaurantOpen = React.useMemo(() => {
    if (restaurant.isOpen !== undefined) {
      return restaurant.isOpen;
    }
    // Default to true if not provided
    return true;
  }, [restaurant.isOpen]);

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


  // Handle favorite toggle with API call
  const handleFavoriteToggle = async () => {
    if (isGuest && onNavigateToLogin) {
      onNavigateToLogin();
      return;
    }
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
  }, [layoutMode, imageOpacity]);

  // Layout mode 3 => Outlined card: full-width image, heart top-right, stacked details (home)
  if (layoutMode === 3) {
    const showImageMeta = restaurant.rating > 0 || !!restaurant.deliveryTime;
    return (
      <TouchableOpacity
        key="home-outlined"
        style={styles.cardHomeOutlined}
        onPress={onPress}
        activeOpacity={0.7}
        testID={`restaurant-card-${restaurant.id}`}
      >
        <View style={styles.imageContainerHomeOutlined}>
          <OptimizedImage
            source={restaurant.image}
            style={[styles.imageHomeOutlined, !isRestaurantOpen && styles.imageClosed]}
            contentFit="cover"
            animatedOpacity={imageOpacity}
            onLoad={() => {
              setImageLoaded(true);
              if (onImageLoad) onImageLoad();
            }}
            onError={() => {
              setImageLoaded(true);
              if (onImageLoad) onImageLoad();
            }}
            shimmerWidth="100%"
            shimmerHeight={180}
            shimmerBorderRadius={0}
            transition={300}
            priority="high"
            cachePolicy="memory-disk"
            testID={`restaurant-image-${restaurant.id}`}
          />

          <LinearGradient
            colors={['rgba(0, 0, 0, 0.35)', 'rgba(0, 0, 0, 0.08)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.gradientOverlayTopHomeOutlined}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.15)', 'rgba(0, 0, 0, 0.45)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.gradientOverlayBottomHomeOutlined}
          />

          {showImageMeta && (
            <View style={styles.imageMetaPillHomeOutlined}>
              {restaurant.rating > 0 && (
                <View style={styles.imageMetaGroupHomeOutlined}>
                  <MaterialIcons name="star" size={14} color="#FFB800" />
                  <Text style={styles.imageMetaTextHomeOutlined}>{restaurant.rating.toFixed(1)}</Text>
                </View>
              )}
              {restaurant.rating > 0 && restaurant.deliveryTime ? (
                <Text style={styles.imageMetaDotHomeOutlined}>•</Text>
              ) : null}
              {!!restaurant.deliveryTime && (
                <Text style={styles.imageMetaTextHomeOutlined}>{restaurant.deliveryTime}</Text>
              )}
            </View>
          )}

          {!isRestaurantOpen && <View style={styles.grayOverlayHomeOutlined} />}
          {!isRestaurantOpen && (
            <View style={styles.closedOverlayHomeOutlined}>
              <Text style={styles.closedTextCurrently}>CURRENTLY</Text>
              <Text style={styles.closedTextClosed}>CLOSED</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.heartButtonHomeOutlined}
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

        <View style={styles.detailsContainerHomeOutlined}>
          {/* Subtle corner wash (top-right → inward), matches soft UI card reference */}
          <LinearGradient
            pointerEvents="none"
            colors={['#EEF2FF', '#F6F8FD', '#FFFFFF']}
            locations={[0, 0.42, 1]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.detailsBackgroundGradientHomeOutlined}
          />
          {restaurant.isVeg && (
            <View style={styles.pureVegBadgeHomeOutlined}>
              <MaterialIcons name="eco" size={14} color="#00B14F" />
              <Text style={styles.pureVegTextHomeOutlined}>Pure Veg</Text>
            </View>
          )}

          <View style={styles.nameRowHomeOutlined}>
            <Text
              style={[styles.restaurantNameHomeOutlined, isRestaurantOpen && styles.restaurantNameHomeOutlinedOpen]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {restaurant.name}
            </Text>
            {!!restaurant.distance && (
              <Text style={styles.distanceInlineHomeOutlined} numberOfLines={1}>
                {restaurant.distance}
              </Text>
            )}
          </View>

          <Text style={styles.cuisineTextHomeOutlined} numberOfLines={2} ellipsizeMode="tail">
            {restaurant.cuisine}
          </Text>

          <View style={styles.locationRowHomeOutlined}>
            <Text style={styles.locationTextHomeOutlined} numberOfLines={2} ellipsizeMode="tail">
              {locationText}
            </Text>
          </View>

          {/* Distance shown inline with store name */}

          {!isRestaurantOpen && nextOpeningInfo && (
            <>
              <View style={styles.separatorHomeOutlined} />
              <Text style={styles.openingTimeTextHomeOutlined}>{nextOpeningInfo.message}</Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Layout mode 4 => Home horizontal card: image left, details right; overlays on image (home)
  if (layoutMode === 4) {
    const showImageMeta = restaurant.rating > 0 || !!restaurant.deliveryTime;
    return (
      <TouchableOpacity
        key="home-horizontal"
        style={styles.cardHomeHorizontal}
        onPress={onPress}
        activeOpacity={0.7}
        testID={`restaurant-card-${restaurant.id}`}
      >
        <View style={styles.imageContainerHomeHorizontal}>
          <OptimizedImage
            source={restaurant.image}
            style={[styles.imageHomeHorizontal, !isRestaurantOpen && styles.imageClosed]}
            contentFit="cover"
            animatedOpacity={imageOpacity}
            onLoad={() => {
              setImageLoaded(true);
              if (onImageLoad) onImageLoad();
            }}
            onError={() => {
              setImageLoaded(true);
              if (onImageLoad) onImageLoad();
            }}
            shimmerWidth={140}
            shimmerHeight={160}
            shimmerBorderRadius={18}
            transition={300}
            priority="high"
            cachePolicy="memory-disk"
            testID={`restaurant-image-${restaurant.id}`}
          />

          {/* Heart on top-right */}
          <TouchableOpacity
            style={styles.heartButtonHomeHorizontal}
            onPress={handleFavoriteToggle}
            disabled={isTogglingFavorite}
            testID={`favorite-button-${restaurant.id}`}
          >
            {isTogglingFavorite ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcons
                name={isFavorite ? 'favorite' : 'favorite-border'}
                size={22}
                color={isFavorite ? '#FF0000' : '#FFFFFF'}
              />
            )}
          </TouchableOpacity>

        </View>

        <View style={styles.detailsContainerHomeHorizontal}>
          <View style={styles.nameRowHomeHorizontal}>
            <Text style={styles.restaurantNameHomeHorizontal} numberOfLines={1} ellipsizeMode="tail">
              {restaurant.name}
            </Text>
          </View>

          {showImageMeta && (
            <View style={styles.ratingDurationRowHomeHorizontal}>
              {restaurant.rating > 0 && (
                <>
                  <MaterialIcons name="star" size={14} color="#00B14F" />
                  <Text style={styles.ratingDurationTextHomeHorizontal}>{restaurant.rating.toFixed(1)}</Text>
                  {restaurant.deliveryTime ? <Text style={styles.ratingDurationDotHomeHorizontal}>•</Text> : null}
                </>
              )}
              {!!restaurant.deliveryTime && (
                <Text style={styles.ratingDurationTextHomeHorizontal}>{restaurant.deliveryTime}</Text>
              )}
            </View>
          )}

          <Text style={styles.cuisineTextHomeHorizontal} numberOfLines={1} ellipsizeMode="tail">
            {restaurant.cuisine}
          </Text>

          <Text style={styles.locationTextHomeHorizontal} numberOfLines={1} ellipsizeMode="tail">
            {locationText}
          </Text>

          {!!restaurant.distance && (
            <View style={styles.distanceRowHomeHorizontal}>
              <MaterialIcons name="location-on" size={14} color="#00B14F" />
              <Text style={styles.distanceRowTextHomeHorizontal} numberOfLines={1}>
                {restaurant.distance}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Layout mode 1 => Horizontal layout (style 1)
  if (layoutMode === 1) {
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
          {/* Optimized image with built-in shimmer and caching */}
          <OptimizedImage
            source={restaurant.image}
            style={[
              styles.image,
              !isRestaurantOpen && styles.imageClosed,
            ]}
            contentFit="cover"
            animatedOpacity={imageOpacity}
            onLoad={() => {
              setImageLoaded(true);
              if (onImageLoad) {
                onImageLoad();
              }
            }}
            onError={() => {
              setImageLoaded(true);
              if (onImageLoad) {
                onImageLoad();
              }
            }}
            shimmerWidth={130}
            shimmerHeight={160}
            shimmerBorderRadius={16}
            transition={300}
            priority="high"
            cachePolicy="memory-disk"
            testID={`restaurant-image-${restaurant.id}`}
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

          {/* Gray Overlay for Closed Restaurants */}
          {!isRestaurantOpen && (
            <View style={styles.grayOverlay} />
          )}

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
            isRestaurantOpen && styles.restaurantNameOpen
          ]} numberOfLines={2} ellipsizeMode="tail">
            {restaurant.name}
          </Text>

          {/* Rating and Timings */}
          <View style={[
            styles.ratingDeliveryRow,
            isRestaurantOpen && styles.ratingDeliveryRowOpen
          ]}>
            {restaurant.rating > 0 && (
              <>
                <View style={styles.ratingContainer}>
                  <MaterialIcons name="star" size={14} color="#00B14F" />
                  <Text style={styles.ratingText}>
                    {restaurant.rating.toFixed(1)}
                  </Text>
                </View>
                <Text style={styles.deliveryDot}>•</Text>
              </>
            )}
            <Text style={styles.deliveryText}>{restaurant.deliveryTime}</Text>
          </View>

          {/* Product Items (Cuisine) */}
          <Text style={[
            styles.cuisineText,
            isRestaurantOpen && styles.cuisineTextOpen
          ]} numberOfLines={2} ellipsizeMode="tail">
            {restaurant.cuisine}
          </Text>

          {/* When Open: Location and Distance on separate rows */}
          {isRestaurantOpen ? (
            <>
              {/* Location - No icon */}
              <View style={[
                styles.locationRow,
                styles.locationRowOpen
              ]}>
                <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
                  {locationText}
                </Text>
              </View>
              {/* Distance - With icon */}
              <View style={styles.distanceRow}>
                <MaterialIcons name="location-on" size={14} color="#00B14F" />
                <Text style={styles.distanceText}>{restaurant.distance}</Text>
              </View>
            </>
          ) : (
            <>
              {/* When Closed: Location (left) and Distance (right) - Same Row */}
              <View style={styles.locationDistanceRowClosed}>
                <View style={styles.locationRowClosed}>
                  <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
                    {locationText}
                  </Text>
                </View>
                <View style={styles.distanceRowClosed}>
                  <MaterialIcons name="location-on" size={14} color="#00B14F" />
                  <Text style={styles.distanceText}>{restaurant.distance}</Text>
                </View>
              </View>
              {/* Separator Line */}
              <View style={styles.separator} />
              {/* Opens Tomorrow Text */}
              {nextOpeningInfo && (
                <Text style={styles.openingTimeText}>{nextOpeningInfo.message}</Text>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    // Layout mode 2 => Vertical layout (style 2)
    <TouchableOpacity
      key="vertical"
      style={styles.cardVertical}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`restaurant-card-${restaurant.id}`}
    >
      {/* Top - Image Container */}
      <View style={styles.imageContainerVertical}>
        {/* Optimized image with built-in shimmer and caching */}
        <OptimizedImage
          source={restaurant.image}
          style={[
            styles.imageVertical,
            !isRestaurantOpen && styles.imageClosed,
          ]}
          contentFit="cover"
          animatedOpacity={imageOpacity}
          onLoad={() => {
            setImageLoaded(true);
            if (onImageLoad) {
              onImageLoad();
            }
          }}
          onError={() => {
            setImageLoaded(true);
            if (onImageLoad) {
              onImageLoad();
            }
          }}
          shimmerWidth="100%"
          shimmerHeight={200}
          shimmerBorderRadius={10}
          transition={300}
          priority="high"
          cachePolicy="memory-disk"
          testID={`restaurant-image-${restaurant.id}`}
        />

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

        {/* Gray Overlay for Closed Restaurants */}
        {!isRestaurantOpen && (
          <View style={styles.grayOverlayVertical} />
        )}

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
          <Text style={styles.restaurantNameVertical} numberOfLines={2} ellipsizeMode="tail">
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
        <Text style={styles.cuisineTextVertical} numberOfLines={2} ellipsizeMode="tail">
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
              <Text style={styles.distanceTextVertical}>{restaurant.distance}</Text>
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
    prevProps.layoutMode === nextProps.layoutMode &&
    prevProps.isGuest === nextProps.isGuest &&
    prevProps.onNavigateToLogin === nextProps.onNavigateToLogin
  );
});

const styles = StyleSheet.create({
  // Horizontal Layout (Style 1)
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    height: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  // Left Side - Image
  imageContainer: {
    width: 130,
    height: 150,
    position: 'relative',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
  },
  imageShimmerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 130,
    height: 150,
    zIndex: 1,
  },
  image: {
    width: 130,
    height: 150,
    borderRadius: 16,
  },
  imageClosed: {
    opacity: 1,
  },
  grayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(120, 120, 120, 0.75)',
    borderRadius: 16,
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
    fontSize: 15,
    lineHeight: 20,
    color: '#000000',
    marginBottom: 3,
    marginTop: 0,
  },
  restaurantNameOpen: {
    marginBottom: 6,
  },
  // Rating and Delivery Row
  ratingDeliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  ratingDeliveryRowOpen: {
    marginBottom: 6,
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
    fontSize: 10,
    lineHeight: 14,
    color: '#666666',
    marginBottom: 2,
  },
  cuisineTextOpen: {
    marginBottom: 6,
  },
  // Location Row (when open - separate row)
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  locationRowOpen: {
    marginBottom: 6,
  },
  // Distance Row (when open - separate row)
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  // Location and Distance Row (when closed - same row, left and right)
  locationDistanceRowClosed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  locationRowClosed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: 8,
  },
  distanceRowClosed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    lineHeight: 14,
    color: '#666666',
    flexShrink: 1,
  },
  locationSeparator: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    color: '#666666',
  },
  distanceText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    lineHeight: 14,
    color: '#666666',
  },
  openingTimeContainer: {
    marginTop: 4,
    paddingTop: 3,
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginTop: 4,
    marginBottom: 4,
    width: '100%',
  },
  openingTimeText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#666666',
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
  grayOverlayVertical: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(120, 120, 120, 0.75)',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    zIndex: 2,
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
  cuisineTextVertical: {
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

  // Layout mode 3 — Home outlined card (full-width image + stacked details)
  cardHomeOutlined: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0,
    borderColor: 'transparent',
    overflow: 'hidden',
    marginBottom: 12,
  },
  // Layout mode 4 — Home horizontal card (image left, details right)
  cardHomeHorizontal: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    // marginBottom: 12,
  },
  imageContainerHomeHorizontal: {
    width: 140,
    height: 160,
    marginVertical: 10,
    marginRight: 10,
    marginLeft: 0,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  imageHomeHorizontal: {
    width: '100%',
    height: '100%',
  },
  heartButtonHomeHorizontal: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 10,
  },
  detailsContainerHomeHorizontal: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 0,
    gap: 6,
    justifyContent: 'center',
  },
  nameRowHomeHorizontal: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  restaurantNameHomeHorizontal: {
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
    color: '#111827',
  },
  ratingDurationRowHomeHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  ratingDurationTextHomeHorizontal: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: '#111827',
  },
  ratingDurationDotHomeHorizontal: {
    fontSize: 13,
    lineHeight: 18,
    color: '#9CA3AF',
  },
  cuisineTextHomeHorizontal: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
  },
  locationTextHomeHorizontal: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#9CA3AF',
  },
  distanceRowHomeHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  distanceRowTextHomeHorizontal: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
  },
  imageContainerHomeOutlined: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  imageHomeOutlined: {
    width: '100%',
    height: 180,
  },
  grayOverlayHomeOutlined: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(100, 100, 100, 0.72)',
    zIndex: 2,
  },
  closedOverlayHomeOutlined: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    zIndex: 3,
  },
  gradientOverlayTopHomeOutlined: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    zIndex: 1,
  },
  gradientOverlayBottomHomeOutlined: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    zIndex: 1,
  },
  heartButtonHomeOutlined: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
    zIndex: 10,
  },
  imageMetaPillHomeOutlined: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    zIndex: 6,
  },
  imageMetaGroupHomeOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageMetaTextHomeOutlined: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#FFFFFF',
  },
  imageMetaDotHomeOutlined: {
    marginHorizontal: 6,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  detailsContainerHomeOutlined: {
    position: 'relative',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    overflow: 'hidden',
  },
  detailsBackgroundGradientHomeOutlined: {
    ...StyleSheet.absoluteFillObject,
  },
  pureVegBadgeHomeOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  pureVegTextHomeOutlined: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    lineHeight: 16,
    color: '#00B14F',
  },
  restaurantNameHomeOutlined: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 17,
    lineHeight: 22,
    color: '#111827',
  },
  nameRowHomeOutlined: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  distanceInlineHomeOutlined: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
    paddingTop: 2,
  },
  restaurantNameHomeOutlinedOpen: {
    marginBottom: 0,
  },
  ratingDeliveryRowHomeOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  ratingContainerHomeOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingTextHomeOutlined: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: '#111827',
  },
  metaDotHomeOutlined: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  deliveryTextHomeOutlined: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 18,
    color: '#374151',
  },
  cuisineTextHomeOutlined: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
    marginTop: 2,
  },
  locationRowHomeOutlined: {
    marginTop: 2,
  },
  locationTextHomeOutlined: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: '#6B7280',
  },
  distanceRowHomeOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  distanceTextHomeOutlined: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: '#00B14F',
  },
  separatorHomeOutlined: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 8,
    marginBottom: 4,
    width: '100%',
  },
  openingTimeTextHomeOutlined: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
  },
});