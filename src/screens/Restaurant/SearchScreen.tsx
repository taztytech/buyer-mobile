import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@/shims/rn-vector-icons';
import { LinearGradient } from '@/shims/rn-linear-gradient';
import { Shimmer } from '@/components/Shimmer';
import { OptimizedImage } from '@/components/OptimizedImage';
import { SearchBar } from '@/components/SearchBar';
import { MAX_ITEM_QUANTITY } from '@/constants/cart.constants';
import { ItemTiming, isItemAvailable, formatTime } from '@/utils/timing.utils';

/**
 * Format time difference in a user-friendly way
 * @param minutes - Time difference in minutes
 * @returns User-friendly time string (e.g., "in 1 min", "in 2 hrs 15 min", "in 3 days")
 */
const formatTimeDifference = (minutes: number): string => {
  if (minutes < 60) {
    return `in ${minutes} min`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `in ${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
    } else {
      return `in ${hours} ${hours === 1 ? 'hr' : 'hrs'} ${remainingMinutes} min`;
    }
  } else {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    const remainingMinutes = minutes % 60;

    if (remainingHours === 0 && remainingMinutes === 0) {
      return `in ${days} ${days === 1 ? 'day' : 'days'}`;
    } else if (remainingMinutes === 0) {
      return `in ${days} ${days === 1 ? 'day' : 'days'} ${remainingHours} ${remainingHours === 1 ? 'hr' : 'hrs'}`;
    } else if (remainingHours === 0) {
      return `in ${days} ${days === 1 ? 'day' : 'days'} ${remainingMinutes} min`;
    } else {
      return `in ${days} ${days === 1 ? 'day' : 'days'} ${remainingHours} ${remainingHours === 1 ? 'hr' : 'hrs'} ${remainingMinutes} min`;
    }
  }
};

/**
 * Check if item has any timing slots for today (regardless of current time)
 */
const hasTimingForToday = (timings?: ItemTiming[]): boolean => {
  if (!timings || timings.length === 0) return false;

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
  const currentApiDay = currentDay === 0 ? 1 : currentDay + 1;

  return timings.some(timing => {
    if (timing.day_from <= timing.day_to) {
      // Normal range (e.g., Mon-Fri)
      return timing.day_from <= currentApiDay && currentApiDay <= timing.day_to;
    } else {
      // Wraps around week (e.g., Sat-Sun)
      return currentApiDay >= timing.day_from || currentApiDay <= timing.day_to;
    }
  });
};

/**
 * Get the next available time slot from item timings (only for today)
 * Returns only today's upcoming time slot with time difference
 */
const getNextAvailableTime = (timings?: ItemTiming[]): { timeDifference?: string; availableTime?: string; hoursRemaining?: number; minutesRemaining?: number; hasTodaySlot: boolean } | null => {
  if (!timings || timings.length === 0) return null;

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
  const currentTime = now.getHours() * 100 + now.getMinutes(); // HHMM format

  // Convert JS day (0-6) to API day format (1-7)
  const currentApiDay = currentDay === 0 ? 1 : currentDay + 1;

  // Check if item has any timing for today
  const hasTodaySlot = hasTimingForToday(timings);

  // Only find today's slots that haven't started yet
  const todaySlots: Array<{ day: number; timeFrom: number; timeTo: number; originalTiming: ItemTiming }> = [];

  timings.forEach(timing => {
    const timeFrom = parseInt(timing.time_from, 10);
    const timeTo = parseInt(timing.time_to, 10);

    // Check if timing is for today
    if (timing.day_from <= timing.day_to) {
      // Normal range (e.g., Mon-Fri)
      for (let day = timing.day_from; day <= timing.day_to; day++) {
        const isToday = day === currentApiDay;

        if (isToday && timeFrom > currentTime) {
          // Today, but time hasn't started yet
          todaySlots.push({ day, timeFrom, timeTo, originalTiming: timing });
        }
      }
    } else {
      // Wraps around week (e.g., Sat-Sun)
      for (let day = timing.day_from; day <= 7; day++) {
        const isToday = day === currentApiDay;

        if (isToday && timeFrom > currentTime) {
          todaySlots.push({ day, timeFrom, timeTo, originalTiming: timing });
        }
      }
      for (let day = 1; day <= timing.day_to; day++) {
        const isToday = day === currentApiDay;

        if (isToday && timeFrom > currentTime) {
          todaySlots.push({ day, timeFrom, timeTo, originalTiming: timing });
        }
      }
    }
  });

  // Sort today's slots by time
  todaySlots.sort((a, b) => a.timeFrom - b.timeFrom);

  // If there's a next slot today, return it with time difference
  const nextSlot = todaySlots.length > 0 ? todaySlots[0] : null;

  if (nextSlot) {
    // Calculate time difference in minutes (only for today)
    const hours = Math.floor(nextSlot.timeFrom / 100);
    const minutes = nextSlot.timeFrom % 100;
    const nextTime = new Date(now);
    nextTime.setHours(hours, minutes, 0, 0);
    const diffMs = nextTime.getTime() - now.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const timeDifference = formatTimeDifference(diffMinutes);

    // Format time with AM/PM
    const timeString = String(nextSlot.timeFrom).padStart(4, '0');
    const availableTime = formatTime(timeString);

    // Calculate hours and minutes remaining
    const hoursRemaining = Math.floor(diffMinutes / 60);
    const minutesRemaining = diffMinutes % 60;

    return { timeDifference, availableTime, hoursRemaining, minutesRemaining, hasTodaySlot };
  }

  return { hasTodaySlot };
};

interface PreorderCampaign {
  id: string;
  title: string;
  available_slots: number;
  delivery_date: string;
  discount_amount: string;
  free_delivery: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  image: any;
  isVeg: boolean;
  isSpicy: boolean;
  isBestSeller: boolean;
  isCustomizable: boolean;
  isPreorderAvailable?: boolean;
  preorderCampaign?: PreorderCampaign;
  timings?: ItemTiming[];
}

interface MenuSection {
  id: string;
  items: MenuItem[];
}

interface CustomizationVariant {
  id: string;
  addOns: string[];
  addOnNames?: string[];
  price: number;
  quantity: number;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  isVeg: boolean;
  isCustomizable?: boolean;
  // For non-customizable items
  quantity?: number;
  // For customizable items
  variants?: CustomizationVariant[];
}

interface SearchScreenProps {
  onBack?: () => void;
  menuItems?: MenuSection[];
  cart?: { [key: string]: CartItem };
  onAddToCart?: (item: MenuItem) => void;
  onIncrementItem?: (itemId: string) => void;
  onDecrementItem?: (itemId: string) => void;
  onCustomizableItemClick?: (item: MenuItem) => void;
  onImageClick?: (item: MenuItem) => void;
  loadedImages?: Set<string>;
  onImageLoad?: (itemId: string) => void;
  isRestaurantClosed?: boolean;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onBack,
  menuItems = [],
  cart = {},
  onAddToCart,
  onIncrementItem,
  onDecrementItem,
  onCustomizableItemClick,
  onImageClick,
  loadedImages = new Set(),
  onImageLoad,
  isRestaurantClosed = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MenuItem[]>([]);

  // Get total quantity for an item (works for both customizable and non-customizable)
  const getItemQuantity = (itemId: string): number => {
    const cartItem = cart[itemId];
    if (!cartItem) return 0;

    if (cartItem.isCustomizable && cartItem.variants) {
      return cartItem.variants.reduce((sum, variant) => sum + variant.quantity, 0);
    }

    return cartItem.quantity || 0;
  };

  // Handle search text updates
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Clear search query when component mounts (ensures fresh state)
  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // Clear search query when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup: Clear search query when component unmounts
      setSearchQuery('');
      setSearchResults([]);
    };
  }, []);

  // Handle back button - clear search before going back
  const handleBack = () => {
    setSearchQuery('');
    setSearchResults([]);
    if (onBack) {
      onBack();
    }
  };

  // Re-compute search results whenever the query or menu items change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const normalizedQuery = searchQuery.toLowerCase();
    const results: MenuItem[] = [];

    menuItems.forEach((section) => {
      section?.items?.forEach((item: MenuItem) => {
        if (
          item.name.toLowerCase().includes(normalizedQuery) ||
          item.description.toLowerCase().includes(normalizedQuery)
        ) {
          results.push(item);
        }
      });
    });

    setSearchResults(results);
  }, [searchQuery, menuItems]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <SearchBar
          onBack={handleBack}
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="Search for dishes..."
          showClearButton={true}
          autoFocus={true}
        />

        {/* Search Results */}
        <ScrollView
          style={styles.resultsContainer}
          showsVerticalScrollIndicator={false}
        >
          {searchQuery.trim() !== '' && searchResults.length > 0 && (
            <View style={styles.menuContent}>
              {searchResults.map((item, index) => {
                const currentQuantity = getItemQuantity(item.id);
                const isAtQuantityLimit = currentQuantity >= MAX_ITEM_QUANTITY;
                const isPreorderAtLimit = item.isPreorderAvailable && currentQuantity >= 1;

                // Check if item is available based on its own timings
                const isItemCurrentlyAvailable = isItemAvailable(item.timings);

                // Item is only available if BOTH restaurant is open AND item timing is available
                const itemAvailable = !isRestaurantClosed && isItemCurrentlyAvailable;

                // Get next available time slot to check if available today
                const nextAvailableTime = getNextAvailableTime(item.timings);

                return (
                  <View key={`${item.id}-${index}`} style={styles.menuItem}>
                    <View style={styles.itemLeft}>
                      {/* Veg/Non-Veg Icon and Spicy Badge */}
                      <View style={styles.itemBadges}>
                        <View style={[
                          styles.vegIconLarge,
                          !item.isVeg && styles.nonVegIconLarge
                        ]}>
                          <View style={[
                            styles.vegDotLarge,
                            !item.isVeg && styles.nonVegDotLarge
                          ]} />
                        </View>
                        {item.isSpicy && (
                          <View style={styles.spicyBadge}>
                            <MaterialIcons name="local-fire-department" size={9} color="#FF0000" />
                            <Text style={styles.spicyText}>Spicy</Text>
                          </View>
                        )}
                      </View>

                      {/* Item Name */}
                      <Text style={styles.itemName}>{item.name}</Text>

                      {/* Best Seller Badge */}
                      {item.isBestSeller && (
                        <View style={styles.bestSellerBadge}>
                          <MaterialIcons name="star" size={8} color="#FFC529" />
                          <Text style={styles.bestSellerText}>Best Seller</Text>
                        </View>
                      )}

                      {/* Price */}
                      {item.isPreorderAvailable && item.preorderCampaign && parseFloat(item.preorderCampaign.discount_amount || '0') > 0 ? (
                        <View style={styles.priceContainer}>
                          <Text style={[styles.itemPrice, styles.strikethroughPrice]}>₹ {item.price.toFixed(2)}</Text>
                          <Text style={[styles.itemPrice, styles.discountedPrice]}>
                            ₹ {(item.price - parseFloat(item.preorderCampaign.discount_amount || '0')).toFixed(2)}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.itemPrice}>₹ {item.price.toFixed(2)}</Text>
                      )}

                      {/* Description */}
                      <View style={styles.descriptionContainer}>
                        <Text style={styles.itemDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>

                      {/* Extra spacing removed now that action icons are hidden */}
                    </View>

                    <View style={styles.itemRight}>
                      {/* Item Image with Shimmer */}
                      <TouchableOpacity
                        style={styles.itemImageContainer}
                        onPress={() => {
                          if (itemAvailable && onImageClick) {
                            onImageClick(item);
                          }
                        }}
                        disabled={!itemAvailable}
                        activeOpacity={itemAvailable ? 0.9 : 1}
                      >
                        <OptimizedImage
                          source={item.image}
                          style={styles.itemImage}
                          contentFit="cover"
                          onLoad={() => onImageLoad && onImageLoad(item.id)}
                          onError={() => {
                            // Mark image as loaded even on error so add to cart button can appear
                            if (onImageLoad) {
                              onImageLoad(item.id);
                            }
                          }}
                          shimmerWidth={166}
                          shimmerHeight={137}
                          shimmerBorderRadius={16}
                          transition={200}
                          priority="normal"
                          cachePolicy="memory-disk"
                        />

                        {/* Gray Overlay for Unavailable Items - Only on image */}
                        {!itemAvailable && (
                          <View style={styles.unavailableOverlay} />
                        )}

                        {/* Preorder Badge Overlay on Image - Top Left */}
                        {item.isPreorderAvailable && (
                          <View style={styles.preorderImageBadge}>
                            <LinearGradient
                              colors={['#00B14F', '#00A048']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.preorderImageBadgeGradient}
                            >
                              <MaterialIcons name="schedule" size={12} color="#FFFFFF" />
                              <Text style={styles.preorderImageBadgeText}>Preorder</Text>
                            </LinearGradient>
                          </View>
                        )}

                        {/* Availability Badge - Bottom Left (like RestaurantScreen design) */}
                        {!itemAvailable && (
                          <View style={styles.availabilityBadge}>
                            {nextAvailableTime?.availableTime ? (
                              // Item will be available today - show timing with AM/PM and "today" on same line
                              <Text style={styles.availabilityTimeTextMain}>
                                Available at {nextAvailableTime.availableTime}
                                <Text style={styles.availabilityTimeTextSub}> today</Text>
                              </Text>
                            ) : (
                              // Not available today - show simple message
                              <Text style={styles.availabilityTimeTextMain}>
                                Not available
                              </Text>
                            )}
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Add Button or Increment/Decrement Controls */}
                      {/* Only show when item is available and image is loaded (or no image) */}
                      {itemAvailable && (loadedImages.has(item.id) || !item.image) && (
                        <>
                          {cart[item.id] ? (
                            // Show increment/decrement controls if item is in cart
                            <View style={styles.quantityControl}>
                              <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => onDecrementItem && onDecrementItem(item.id)}
                                activeOpacity={0.7}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Text style={styles.quantityButtonText}>-</Text>
                              </TouchableOpacity>
                              <Text style={styles.quantityText}>{currentQuantity}</Text>
                              <TouchableOpacity
                                style={[
                                  styles.quantityButton,
                                  (isAtQuantityLimit || isPreorderAtLimit) && styles.quantityButtonDisabled,
                                ]}
                                onPress={() => onIncrementItem && onIncrementItem(item.id)}
                                activeOpacity={0.7}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                disabled={isAtQuantityLimit || isPreorderAtLimit}
                              >
                                <Text style={[
                                  styles.quantityButtonText,
                                  (isAtQuantityLimit || isPreorderAtLimit) && styles.quantityButtonTextDisabled
                                ]}>+</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            // Show Add button
                            <TouchableOpacity
                              style={styles.addButton}
                              onPress={() => {
                                if (item.isCustomizable && onCustomizableItemClick) {
                                  onCustomizableItemClick(item);
                                } else if (onAddToCart) {
                                  onAddToCart(item);
                                }
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.addButtonPlus}>+</Text>
                              <Text style={styles.addButtonText}>Add</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}

                      {/* Customizable Text */}
                      {loadedImages.has(item.id) && item.isCustomizable && (
                        <Text style={styles.customizableText}>Customisable</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {searchQuery.trim() !== '' && searchResults.length === 0 && (
            <View style={styles.noResultsContainer}>
              <MaterialIcons name="search-off" size={48} color="rgba(0, 0, 0, 0.3)" />
              <Text style={styles.noResultsTitle}>No results found</Text>
              <Text style={styles.noResultsMessage}>
                Try searching for something else
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  resultsContainer: {
    flex: 1,
  },
  menuContent: {
    paddingHorizontal: 0,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 9,
  },
  menuItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    height: 192,
  },
  itemLeft: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 12,
    gap: 3,
  },
  itemBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 13,
  },
  vegIconLarge: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDotLarge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00B14F',
  },
  nonVegIconLarge: {
    borderColor: '#FF0000',
  },
  nonVegDotLarge: {
    backgroundColor: '#FF0000',
  },
  spicyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 1,
    height: 13,
    backgroundColor: 'rgba(213, 0, 0, 0.13)',
    borderWidth: 0.5,
    borderColor: '#FF0000',
    borderRadius: 13,
  },
  spicyText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 7,
    lineHeight: 10,
    color: '#FF0000',
    opacity: 0.85,
  },
  itemName: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'left',
    color: '#000000',
    opacity: 0.85,
  },
  bestSellerBadge: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 4,
    gap: 1,
    width: 55,
    height: 16,
    backgroundColor: 'linear-gradient(90deg, #FFF2CF 0%, rgba(255, 255, 255, 0) 100%)',
    borderRadius: 2,
  },
  bestSellerText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 8,
    lineHeight: 12,
    color: '#000000',
    opacity: 0.85,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemPrice: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    opacity: 0.85,
  },
  strikethroughPrice: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  discountedPrice: {
    color: '#00B14F',
    opacity: 1,
  },
  descriptionContainer: {
    width: 165,
  },
  itemDescription: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
  },
  itemRight: {
    width: 166,
    alignItems: 'flex-start',
    gap: 26,
  },
  itemImageContainer: {
    width: 166,
    height: 137,
    borderRadius: 16,
    position: 'relative',
  },
  imageShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  itemImage: {
    width: 166,
    height: 137,
    borderRadius: 16,
  },
  preorderImageBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  preorderImageBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  preorderImageBadgeText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 10,
    lineHeight: 14,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  addButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 13,
    gap: 2,
    width: 76,
    height: 37,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#00B14F',
    borderRadius: 9,
    position: 'absolute',
    top: 115,
    left: 53,
  },
  addButtonPlus: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 18,
    lineHeight: 27,
    color: '#00B14F',
    opacity: 0.85,
  },
  addButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 17,
    lineHeight: 26,
    color: '#00B14F',
    opacity: 0.85,
  },
  quantityControl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    width: 76,
    height: 37,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#00B14F',
    borderRadius: 9,
    position: 'absolute',
    top: 115,
    left: 53,
  },
  quantityButton: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 20,
    color: '#00B14F',
    opacity: 0.85,
    marginTop: -2,
  },
  quantityButtonTextDisabled: {
    opacity: 0.4,
  },
  quantityText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#00B14F',
    minWidth: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  customizableText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
    width: 181,
  },
  unavailableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(120, 120, 120, 0.75)',
    borderRadius: 16,
    zIndex: 5,
  },
  availabilityBadge: {
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
    zIndex: 6,
  },
  availabilityTimeTextMain: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  availabilityTimeTextSub: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  noResultsTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    opacity: 0.85,
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsMessage: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
    textAlign: 'center',
  },
});
