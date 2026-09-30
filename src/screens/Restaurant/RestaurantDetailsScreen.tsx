import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Linking,
  ActivityIndicator,
  Dimensions,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { restaurantService, RestaurantDetails } from '@/services/restaurant.service';
import { isExpoGo } from '@/utils/platform.util';
import { exotelService } from '@/services/exotel.service';
import { authService } from '@/services/auth.service';
import { useConfirmation } from '@/context/ConfirmationContext';
import { useSnackbar } from '@/context/SnackbarContext';

// Conditionally import MapView only for standalone builds
let MapView: any;
let Marker: any;
let PROVIDER_GOOGLE: any;

if (!isExpoGo()) {
  try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.warn('react-native-maps not available');
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RestaurantDetailsScreenProps {
  restaurantId: number;
  restaurantName: string;
  latitude: number;
  longitude: number;
  onBack?: () => void;
  onShare?: () => void;
  isGuest?: boolean;
  onNavigateToLogin?: () => void;
}

export const RestaurantDetailsScreen: React.FC<RestaurantDetailsScreenProps> = ({
  restaurantId,
  restaurantName,
  latitude,
  longitude,
  onBack,
  onShare,
  isGuest,
  onNavigateToLogin,
}) => {
  const [restaurantData, setRestaurantData] = useState<RestaurantDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTimingsExpanded, setIsTimingsExpanded] = useState(false);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const { showConfirmation } = useConfirmation();
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    fetchRestaurantDetails();
  }, [restaurantId]);

  const fetchRestaurantDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await restaurantService.getRestaurantDetails(restaurantId, {
        lat: latitude,
        lng: longitude,
        include_items: true,
      });

      if (response.success && response.data) {
        setRestaurantData(response.data);
      } else {
        setError(response.message || 'Failed to load restaurant details');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCall = async () => {
    // Guest mode: navigate to login when pressing phone call
    if (isGuest && onNavigateToLogin) {
      onNavigateToLogin();
      return;
    }

    // Check if phone number is available in restaurant data
    const phoneNumber = (restaurantData as any)?.phone_number || (restaurantData as any)?.contact_number;

    if (!phoneNumber) {
      showConfirmation({
        title: 'Error',
        message: 'Restaurant phone number is not available.',
        confirmText: 'OK',
        cancelText: '',
        confirmButtonColor: '#00B14F',
        onConfirm: () => { },
      });
      return;
    }

    // Get user's phone number
    const currentUser = await authService.getCurrentUser();
    if (!currentUser || !currentUser.phoneNumber) {
      showConfirmation({
        title: 'Error',
        message: 'Unable to get your phone number. Please ensure you are logged in.',
        confirmText: 'OK',
        cancelText: '',
        confirmButtonColor: '#00B14F',
        onConfirm: () => { },
      });
      return;
    }

    // Clean phone numbers (remove spaces, dashes, etc.)
    const userPhone = currentUser.phoneNumber.replace(/\D/g, '');
    const restaurantPhoneClean = phoneNumber.replace(/\D/g, '');

    if (!userPhone || !restaurantPhoneClean) {
      showConfirmation({
        title: 'Error',
        message: 'Invalid phone number format. Please check your phone number.',
        confirmText: 'OK',
        cancelText: '',
        confirmButtonColor: '#00B14F',
        onConfirm: () => { },
      });
      return;
    }

    try {
      setIsInitiatingCall(true);

      // Call Exotel API without order_id (general restaurant call)
      const response = await exotelService.initiateCall({
        from: userPhone,
        to: restaurantPhoneClean,
        // No order_id - this is a general restaurant call, not order-specific
      });

      if (response.success) {
        showSnackbar({
          message: 'Your call to the restaurant is being connected. Please wait for the call.',
          type: 'success',
          duration: 4000,
        });
      } else {
        showConfirmation({
          title: 'Call Failed',
          message: response.error || 'Failed to initiate call. Please try again later.',
          confirmText: 'OK',
          cancelText: '',
          confirmButtonColor: '#DC2626',
          onConfirm: () => { },
        });
      }
    } catch (error: any) {
      showConfirmation({
        title: 'Error',
        message: error.message || 'An unexpected error occurred. Please try again.',
        confirmText: 'OK',
        cancelText: '',
        confirmButtonColor: '#DC2626',
        onConfirm: () => { },
      });
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const handleDirections = () => {
    // Open maps with restaurant location
    if (restaurantData?.locations && restaurantData.locations.length > 0) {
      const location = restaurantData.locations[0];
      const url = `https://maps.google.com/?q=${location.lat},${location.lng}`;
      Linking.openURL(url);
    }
  };

  const handleShare = async () => {
    try {
      if (!restaurantData) return;

      // Build share message with restaurant details
      let message = `Check out ${restaurantData.name} on Tazty!\n\n`;

      if (restaurantData.description) {
        message += `${restaurantData.description}\n\n`;
      }

      // Add rating if available
      if (restaurantData.stats?.average_rating > 0) {
        message += `⭐ ${restaurantData.stats.average_rating.toFixed(1)}\n`;
      }

      // Add delivery info
      if (restaurantData.delivery_time) {
        message += `🚚 Delivery in ${restaurantData.delivery_time}\n`;
      }

      if (restaurantData.min_order_value) {
        message += `💰 Min order ₹${Number(restaurantData.min_order_value).toFixed(0)}\n`;
      }

      // Add address
      if (restaurantData.locations && restaurantData.locations.length > 0) {
        const location = restaurantData.locations[0];
        message += `\n📍 ${location.locality}, ${location.city}\n`;
        message += `https://maps.google.com/?q=${location.lat},${location.lng}`;
      }

      await Share.share({
        message: message,
        title: `${restaurantData.name} - Tazty`,
      });
    } catch (error: any) {
      // Error sharing
    }
  };

  const formatTime = (time: string) => {
    // Format time from "0900" to "9:00 AM"
    const hours = parseInt(time.substring(0, 2));
    const minutes = time.substring(2, 4);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  };

  const getCurrentDayTiming = () => {
    if (!restaurantData?.timings || restaurantData.timings.length === 0) return null;
    // JS getDay(): 0 (Sunday) - 6 (Saturday)
    // API day mapping: 1 (Sunday) - 7 (Saturday)
    const jsDay = new Date().getDay();
    const apiDay = jsDay === 0 ? 1 : jsDay + 1;
    return restaurantData.timings.find(t => t.day === apiDay);
  };

  const getDayName = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  };

  const getAddress = () => {
    if (!restaurantData?.locations || restaurantData.locations.length === 0) return '';
    const loc = restaurantData.locations[0];
    return `${loc.locality}, ${loc.city}`;
  };

  // Get unique images from categories (handle both string URLs and image objects)
  const getRestaurantPhotos = () => {
    if (!restaurantData?.categories) return [];

    const seen = new Set<string>();
    const photos: string[] = [];

    restaurantData.categories.forEach(category => {
      category.items?.forEach((item: any) => {
        const images = item.images;
        if (!images) {
          return;
        }

        // Always consider only the first image from the images collection
        const firstImage = Array.isArray(images) ? images[0] : images;

        let url: string | undefined;

        if (typeof firstImage === 'string') {
          url = firstImage.trim();
        } else if (firstImage) {
          // Support common image field names
          const raw =
            firstImage.url ||
            firstImage.image_url ||
            firstImage.image ||
            firstImage.src;

          if (typeof raw === 'string') {
            url = raw.trim();
          }
        }

        if (url && !seen.has(url)) {
          seen.add(url);
          photos.push(url);
        }
      });
    });

    // Return first 10 unique photos
    return photos.slice(0, 10);
  };

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#001E1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{restaurantName}</Text>
      </View>

      <View style={styles.container}>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00B14F" />
            <Text style={styles.loadingText}>Loading restaurant details...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={64} color="rgba(0, 0, 0, 0.3)" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchRestaurantDetails}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
          >
            {/* Restaurant Info */}
            <View style={styles.titleSection}>
              {/* {restaurantData?.description && (
                <Text style={styles.subtitle}>{restaurantData.description}</Text>
              )} */}
              {/* {restaurantData && (restaurantData.stats?.average_rating > 0 || restaurantData.delivery_time || restaurantData.min_order_value) && (
                <Text style={styles.cuisines}>
                  {restaurantData.stats?.average_rating > 0 && restaurantData.stats?.total_reviews > 0 && (
                    <>⭐ {restaurantData.stats.average_rating.toFixed(1)} ({restaurantData.stats.total_reviews})</>
                  )}
                  {restaurantData.stats?.average_rating > 0 && restaurantData.stats?.total_reviews > 0 && (restaurantData.delivery_time || restaurantData.min_order_value) && ' · '}
                  {restaurantData.delivery_time && `${restaurantData.delivery_time}`}
                  {restaurantData.delivery_time && restaurantData.min_order_value && ' · '}
                  {restaurantData.min_order_value && `Min ₹${parseFloat(restaurantData.min_order_value).toFixed(0)}`}
                </Text>
              )} */}

              {/* Cuisine Tags */}
              {(() => {
                const cuisineTags = (restaurantData as any)?.cuisine_tags;
                let cuisineArray: string[] = [];
                if (Array.isArray(cuisineTags)) {
                  cuisineArray = cuisineTags;
                } else if (typeof cuisineTags === 'string' && cuisineTags.trim()) {
                  cuisineArray = cuisineTags.split(',').map(tag => tag.trim()).filter(tag => tag);
                }

                return cuisineArray.length > 0 && (
                  <View style={styles.cuisineTagsContainer}>
                    {cuisineArray.slice(0, 3).map((cuisine: any, index: number) => {
                      const displayText = typeof cuisine === 'string' ? cuisine : cuisine?.name || cuisine?.tag || '';
                      return (
                        <View key={index} style={styles.cuisineTag}>
                          <Text style={styles.cuisineTagText}>{displayText}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
            </View>

            {/* Map View */}
            {restaurantData?.locations && restaurantData.locations.length > 0 && (
              <View style={styles.mapWrapper}>
                <View style={styles.mapContainer}>
                  {MapView && !isExpoGo() ? (
                    <MapView
                      provider={PROVIDER_GOOGLE}
                      style={styles.map}
                      initialRegion={{
                        latitude: Number(restaurantData.locations[0].lat),
                        longitude: Number(restaurantData.locations[0].lng),
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      pitchEnabled={false}
                      rotateEnabled={false}
                    >
                      <Marker
                        coordinate={{
                          latitude: Number(restaurantData.locations[0].lat),
                          longitude: Number(restaurantData.locations[0].lng),
                        }}
                      />
                    </MapView>
                  ) : (
                    // Fallback view for Expo Go
                    <View style={styles.mapFallback}>
                      <MaterialIcons name="location-on" size={48} color="#00B14F" />
                      <Text style={styles.mapFallbackText}>
                        Location: {restaurantData.locations[0].locality}, {restaurantData.locations[0].city}
                      </Text>
                      <TouchableOpacity
                        style={styles.openMapsButton}
                        onPress={handleDirections}
                      >
                        <MaterialIcons name="directions" size={20} color="#FFFFFF" />
                        <Text style={styles.openMapsButtonText}>Open in Maps</Text>
                      </TouchableOpacity>
                      <Text style={styles.expoGoNote}>
                        📱 Map preview is not available in Expo Go. Use a development build to see the map.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Address with Action Buttons */}
            {getAddress() && (
              <View style={styles.addressSection}>
                <View style={styles.addressRow}>
                  <MaterialIcons name="location-on" size={20} color="#00B14F" style={styles.locationIcon} />
                  <Text style={styles.address}>{getAddress()}</Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, isInitiatingCall && styles.actionButtonDisabled]}
                    onPress={handleCall}
                    disabled={isInitiatingCall}
                    activeOpacity={0.7}
                  >
                    {isInitiatingCall ? (
                      <ActivityIndicator size="small" color="#00B14F" />
                    ) : (
                      <MaterialIcons name="call" size={18} color="#00B14F" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleDirections}
                  >
                    <MaterialIcons name="directions" size={18} color="#00B14F" />
                  </TouchableOpacity>
                  {/* <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleShare}
                  >
                    <MaterialIcons name="share" size={18} color="#00B14F" />
                  </TouchableOpacity> */}
                </View>
              </View>
            )}

          {/* Opening Hours Accordion */}
          {restaurantData && restaurantData.timings && restaurantData.timings.length > 0 && (
            <View>
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => setIsTimingsExpanded(!isTimingsExpanded)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="access-time" size={24} color="#666666" />
                <View style={styles.infoContentColumn}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoTitle}>Timings</Text>
                  </View>
                  <View style={styles.infoContent}>
                    {restaurantData.is_open && getCurrentDayTiming() ? (
                      <>
                        <Text style={styles.openNow}>Open now</Text>
                        <Text style={styles.infoText}>
                          {' • '}Closes {formatTime(getCurrentDayTiming()!.close_time)}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.infoText}>Closed now</Text>
                    )}
                  </View>
                </View>
                <MaterialIcons
                  name={isTimingsExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                  size={24}
                  color="#666666"
                />
              </TouchableOpacity>

              {/* Expanded Timings */}
              {isTimingsExpanded && (
                <View style={styles.timingsExpanded}>
                  {/* Show all 7 days in order (Sunday=0 to Saturday=6) */}
                  {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                    const timing = restaurantData.timings.find(t => t.day === dayNum);
                    // JS getDay(): 0-6, API day: 1-7 (Sunday=1)
                    const jsToday = new Date().getDay();
                    const apiToday = jsToday === 0 ? 1 : jsToday + 1;
                    const isToday = dayNum === apiToday;

                    return (
                      <View key={dayNum} style={styles.timingRow}>
                        <Text style={[
                          styles.timingDay,
                          isToday && styles.timingDayToday
                        ]}>
                          {getDayName(dayNum - 1)}
                        </Text>
                        {timing && timing.open_time && timing.close_time ? (
                          <Text style={styles.timingHours}>
                            {formatTime(timing.open_time)} - {formatTime(timing.close_time)}
                          </Text>
                        ) : (
                          <Text style={styles.timingClosed}>Closed</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

            {/* Delivery Service */}
            {/* {(restaurantData?.delivery_time || restaurantData?.delivery_fee || restaurantData?.min_order_value) && (
            <View style={styles.infoRow}>
              <MaterialIcons name="delivery-dining" size={24} color="#666666" />
              <View style={styles.infoContentColumn}>
                {restaurantData.delivery_time && (
                  <Text style={styles.infoTitle}>
                    Delivery in {restaurantData.delivery_time}
                  </Text>
                )}
                <View style={styles.deliveryDetails}>
                  {restaurantData.delivery_fee !== undefined && (
                    <Text style={styles.infoText}>
                      ₹{restaurantData.delivery_fee} delivery fee
                    </Text>
                  )}
                  {restaurantData.min_order_value && (
                    <Text style={styles.infoText}>
                      {restaurantData.delivery_fee !== undefined && ' · '}Min order ₹{parseFloat(restaurantData.min_order_value).toFixed(0)}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )} */}

            {/* Photos */}
            {getRestaurantPhotos().length > 0 && (
              <View style={styles.photosSection}>
                <View style={styles.photoHeader}>
                  <MaterialIcons name="photo" size={24} color="#666666" />
                  <Text style={styles.photoTitle}>Photos</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photosScroll}
                >
                  {getRestaurantPhotos().map((photo, index) => (
                    <Image
                      key={index}
                      source={{ uri: photo }}
                      style={styles.photo}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Stats Info */}
            {restaurantData?.stats && (restaurantData.stats.total_items > 0 || restaurantData.stats.total_categories > 0) && (
              <View style={styles.infoRow}>
                <MaterialIcons name="restaurant-menu" size={24} color="#666666" />
                <Text style={styles.infoTitle}>
                  {restaurantData.stats.total_items > 0 && `${restaurantData.stats.total_items} item${restaurantData.stats.total_items !== 1 ? 's' : ''}`}
                  {restaurantData.stats.total_items > 0 && restaurantData.stats.total_categories > 0 && ' across '}
                  {restaurantData.stats.total_categories > 0 && `${restaurantData.stats.total_categories} categor${restaurantData.stats.total_categories !== 1 ? 'ies' : 'y'}`}
                </Text>
              </View>
            )}

            {/* Legal Information */}
            <View style={styles.legalSection}>
              {restaurantData?.name && (
                <>
                  <Text style={styles.legalLabel}>Legal Name</Text>
                  <Text style={styles.legalValue}>{restaurantData.name}</Text>
                </>
              )}
              {restaurantData?.gst_number && (
                <>
                  <Text style={styles.legalLabel}>GST Number</Text>
                  <Text style={styles.legalValue}>{restaurantData.gst_number}</Text>
                </>
              )}
              {restaurantData?.fssai_license && (
                <>
                  <Text style={styles.legalLabel}>FSSAI Lic No</Text>
                  <Text style={styles.legalValue}>{restaurantData.fssai_license}</Text>
                </>
              )}
              {/* <Text style={styles.termsText}>
              Please review the terms of service for Tazty{' '}
              <Text style={styles.termsLink}>here</Text>
            </Text> */}
            </View>

          </ScrollView>
        )}
      </View>
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
    backgroundColor: '#F5F5F5',
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
    color: '#FFFFFF',
    opacity: 0.85,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#666666',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: '#666666',
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
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  mapWrapper: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  mapContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  mapFallbackText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#333333',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#00B14F',
    borderRadius: 8,
    marginBottom: 12,
  },
  openMapsButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  expoGoNote: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  addressSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  locationIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  restaurantName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 28,
    lineHeight: 36,
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#666666',
    marginBottom: 4,
  },
  cuisines: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
    marginBottom: 12,
  },
  address: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#333333',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  infoContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoContentColumn: {
    flex: 1,
  },
  deliveryDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  openNow: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#00B14F',
  },
  timingsExpanded: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingLeft: 56,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  timingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  timingDay: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#666666',
  },
  timingDayToday: {
    fontFamily: 'Poppins_600SemiBold',
    color: '#000000',
  },
  timingHours: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#333333',
  },
  timingClosed: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#999999',
  },
  infoText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#333333',
  },
  infoTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#333333',
    flex: 1,
  },
  infoSubtext: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#666666',
    marginTop: 4,
  },
  photosSection: {
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  photoTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: '#333333',
  },
  photosScroll: {
    paddingLeft: 20,
  },
  photo: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#E8E8E8',
  },
  badExperienceSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  badExperienceTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#333333',
    marginBottom: 12,
  },
  hideRestaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  hideRestaurantText: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: '#333333',
  },
  legalSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
  },
  legalLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#666666',
    marginTop: 12,
  },
  legalValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#999999',
    marginTop: 4,
  },
  termsText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: '#666666',
    marginTop: 16,
  },
  termsLink: {
    color: '#FF0000',
    textDecorationLine: 'underline',
  },
  cuisineTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  cuisineTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 177, 79, 0.1)',
    borderRadius: 11,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 177, 79, 0.3)',
  },
  cuisineTagText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#00B14F',
    opacity: 0.85,
  },
});
