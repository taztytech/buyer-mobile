import React from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Alert, Modal, Image, ImageBackground, TextInput, ScrollView, FlatList, Dimensions, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { authService } from '@/services/auth.service';
import { homeService, BannerItem } from '@/services/home.service';
import { storageService } from '@/services/storage.service';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HomeScreenProps {
  onLogout?: () => void;
}

interface CarouselItem {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  imageUrl?: string;
}

// Fallback carousel data if API fails
const fallbackCarouselData: CarouselItem[] = [
  {
    id: '1',
    title: 'Craving Something Delicious?',
    description: 'Get your favorite meals delivered hot & fast—right to your doorstep.',
    buttonText: 'Order Now!',
  },
  {
    id: '2',
    title: 'Special Offers Today!',
    description: 'Get up to 50% off on selected restaurants near you.',
    buttonText: 'View Offers',
  },
  {
    id: '3',
    title: 'Fast & Fresh Delivery',
    description: 'Your food delivered in 30 minutes or less, guaranteed fresh.',
    buttonText: 'Order Now!',
  },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ onLogout }) => {
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [showLocationPopup, setShowLocationPopup] = React.useState(true);
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [carouselData, setCarouselData] = React.useState<CarouselItem[]>([]);
  const [isLoadingBanners, setIsLoadingBanners] = React.useState(true);
  const flatListRef = React.useRef<FlatList>(null);

  const handleAllowLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        console.log('Location granted:', location);
        setShowLocationPopup(false);
      } else {
        Alert.alert('Permission Denied', 'Location permission is required to show nearby restaurants.');
      }
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get location permission.');
    }
  };

  const handleDenyLocation = () => {
    setShowLocationPopup(false);
    Alert.alert('Location Disabled', 'You can enable location access later from settings.');
  };

  // Fetch home data on component mount
  React.useEffect(() => {
    const fetchHomeData = async () => {
      try {
        setIsLoadingBanners(true);

        // Log token for Postman testing
        const token = await storageService.getAccessToken();
        console.log('='.repeat(80));
        console.log('FOR POSTMAN TESTING:');
        console.log('URL: https://devapi.tazty.in/api/buyer/home');
        console.log('Method: GET');
        console.log('Authorization Header: Bearer ' + token);
        console.log('='.repeat(80));

        const response = await homeService.getHomeData();

        console.log('[HomeScreen] Full API response:', JSON.stringify(response, null, 2));

        if (response.success && response.data) {
          // The API returns data nested as: { data: { data: { promotional_banner: {...} } } }
          // So response.data is already pointing to the inner 'data' object
          const actualData = response.data.data || response.data;
          const promotionalBanner = actualData.promotional_banner;
          console.log('[HomeScreen] Promotional banner:', JSON.stringify(promotionalBanner, null, 2));

          if (promotionalBanner) {
            // Handle if it's a single object or array
            const bannerArray = Array.isArray(promotionalBanner) ? promotionalBanner : [promotionalBanner];

            // Transform API data to carousel format
            const transformedBanners: CarouselItem[] = bannerArray.map((banner: BannerItem, index: number) => ({
              id: banner.id || `banner-${index}`,
              title: banner.title || 'Special Offer',
              description: banner.subtitle || banner.description || 'Check out our latest deals!',
              buttonText: banner.cta_button || banner.button_text || 'Order Now!',
              imageUrl: banner.image_url || banner.banner_url,
            }));

            console.log('[HomeScreen] Transformed banners count:', transformedBanners.length);
            console.log('[HomeScreen] Transformed banners:', JSON.stringify(transformedBanners, null, 2));

            if (transformedBanners.length > 0) {
              console.log('[HomeScreen] Setting carousel data with', transformedBanners.length, 'banner(s)');
              setCarouselData(transformedBanners);
            } else {
              console.log('[HomeScreen] No banners after transformation, using fallback data');
              setCarouselData(fallbackCarouselData);
            }
          } else {
            console.log('[HomeScreen] No promotional_banner in response, using fallback data');
            setCarouselData(fallbackCarouselData);
          }
        } else {
          console.log('[HomeScreen] Failed to fetch banners, using fallback data');
          setCarouselData(fallbackCarouselData);
        }
      } catch (error) {
        console.error('[HomeScreen] Error fetching home data:', error);
        setCarouselData(fallbackCarouselData);
      } finally {
        setIsLoadingBanners(false);
      }
    };

    fetchHomeData();
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await authService.logout();
              console.log('Logged out successfully');
              if (onLogout) {
                onLogout();
              }
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const onViewRef = React.useRef((viewableItems: any) => {
    if (viewableItems.viewableItems.length > 0) {
      setCurrentSlide(viewableItems.viewableItems[0].index || 0);
    }
  });

  const viewConfigRef = React.useRef({ viewAreaCoveragePercentThreshold: 50 });

  const renderCarouselItem = ({ item }: { item: CarouselItem }) => {
    console.log('[HomeScreen] Rendering banner:', item.title, 'Image URL:', item.imageUrl);
    console.log('[HomeScreen] Current carouselData length in state:', carouselData.length);

    return (
      <View style={styles.carouselSlide}>
        <View style={styles.adBanner}>
          {/* Blob with masked image */}
          {item.imageUrl ? (
            <View style={styles.blobContainer}>
              {/* Blob background with image masked inside */}
              <View style={styles.adImageBlob}>
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.adImageMasked}
                  resizeMode="cover"
                  onError={(error) => console.log('[HomeScreen] Image load error:', error.nativeEvent.error)}
                  onLoad={() => console.log('[HomeScreen] Image loaded successfully:', item.imageUrl)}
                />
              </View>
            </View>
          ) : (
            console.log('[HomeScreen] No image URL for banner:', item.title)
          )}

          <View style={styles.adContent}>
            <Text style={styles.adTitle}>{item.title}</Text>
            <Text style={styles.adDescription}>{item.description}</Text>
            <TouchableOpacity style={styles.adButton}>
              <Text style={styles.adButtonText}>{item.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00B14F" />

      {/* Header with Background Image */}
      <ImageBackground
        source={require('@/assets/home_app_bar.png')}
        style={styles.headerBackground}
        imageStyle={styles.headerBackgroundImage}
      >
        {/* Location Section */}
        <View style={styles.locationSection}>
          <View style={styles.locationInfo}>
            {/* City Name with Icon */}
            <View style={styles.cityRow}>
              <MaterialIcons name="location-on" size={20} color="#FFFFFF" />
              <Text style={styles.cityName}>Chennai</Text>
              <MaterialIcons name="keyboard-arrow-down" size={16} color="#FFFFFF" />
            </View>
            {/* Address */}
            <Text style={styles.addressText}>
              Vigneshwar Nagar, Nanganallur, Tamilnadu,...
            </Text>
          </View>

          {/* Profile Avatar */}
          <TouchableOpacity style={styles.profileButton} onPress={handleLogout}>
            <View style={styles.profileAvatar}>
              <MaterialIcons name="person" size={24} color="#00B14F" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Bar and VEG Mode Toggle */}
        <View style={styles.searchSection}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.2)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.searchBar}
          >
            <MaterialIcons name="search" size={24} color="#FFFFFF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Restaurants & foods.."
              placeholderTextColor="rgba(255, 255, 255, 0.7)"
            />
          </LinearGradient>

          {/* VEG Mode Toggle */}
          <View style={styles.vegModeContainer}>
            <Text style={styles.vegModeLabel}>VEG{'\n'}MODE</Text>
            <View style={styles.vegToggle}>
              <View style={styles.vegToggleThumb} />
            </View>
          </View>
        </View>
      </ImageBackground>

      {/* Ad Banner Carousel */}
      <View style={styles.carouselContainer}>
        {isLoadingBanners ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={carouselData}
              renderItem={renderCarouselItem}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewRef.current}
              viewabilityConfig={viewConfigRef.current}
              decelerationRate="fast"
              snapToAlignment="center"
              snapToInterval={SCREEN_WIDTH}
            />

            {/* Pagination Indicators - only show if more than 1 banner */}
            {carouselData.length > 1 && (
              <View style={styles.paginationContainer}>
                {carouselData.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      currentSlide === index && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </View>

      {/* Content Area */}
      <View style={styles.content}>
        <Text style={styles.message}>
          Home Content Goes Here
        </Text>
      </View>

      {/* Location Permission Modal */}
      <Modal
        visible={showLocationPopup}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLocationPopup(false)}
      >
        <BlurView intensity={80} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Location Illustration */}
            <View style={styles.illustrationContainer}>
              <Image
                source={require('@/assets/location-illustration.png')}
                style={styles.locationIllustration}
                resizeMode="contain"
              />
            </View>

            {/* Title */}
            <Text style={styles.modalTitle}>Location Access</Text>

            {/* Description */}
            <Text style={styles.modalDescription}>
              Give the access to fetch accurate location that will ease to delivery
            </Text>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.allowButton}
                onPress={handleAllowLocation}
                activeOpacity={0.8}
              >
                <Text style={styles.allowButtonText}>Allow Access</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.notNowButton}
                onPress={handleDenyLocation}
                activeOpacity={0.8}
              >
                <Text style={styles.notNowButtonText}>Not Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header styles
  headerBackground: {
    width: '100%',
    height: 252,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    gap: 18,
  },
  headerBackgroundImage: {
    width: '120%',
    height: 252,
    left: 0,
  },
  // Location section
  locationSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    height: 50,
  },
  locationInfo: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: 0,
    gap: 2,
    width: 326,
    height: 44,
    flex: 1,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 0,
    gap: 4,
    width: 114,
    height: 24,
  },
  cityName: {
    width: 70,
    height: 24,
    fontFamily: 'Poppins_700Bold',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  addressText: {
    width: 271,
    height: 18,
    fontFamily: 'Poppins_400Regular',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  profileButton: {
    width: 50,
    height: 50,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F7F7F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Search section
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 60,
    gap: 11,
  },
  searchBar: {
    flex: 1,
    height: 60,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    paddingVertical: 0,
    paddingTop: 8,
  },
  vegModeContainer: {
    width: 46,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  vegModeLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: '#FFFFFF',
    fontWeight: '600',
    opacity: 0.85,
  },
  vegToggle: {
    width: 46,
    height: 21,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  vegToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  // Carousel Container
  carouselContainer: {
    marginTop: -44,
    marginBottom: 16,
    overflow: 'hidden',
  },
  loadingContainer: {
    width: '100%',
    height: 149,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
  },
  carouselSlide: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  // Ad Banner
  adBanner: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 14,
    width: '100%',
    height: 149,
    backgroundColor: '#00BEC8',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  adContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 11,
    position: 'relative',
    zIndex: 2,
  },
  blobContainer: {
    position: 'absolute',
    right: -15,
    bottom: -35,
    width: 180,
    height: 160,
  },
  adImageBlob: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FF6B6B',
    borderTopLeftRadius: 120,
    borderTopRightRadius: 55,
    borderBottomLeftRadius: 75,
    borderBottomRightRadius: 95,
    transform: [
      { rotate: '-18deg' },
      { scaleX: 1.2 },
      { scaleY: 0.88 },
      { skewX: '5deg' },
    ],
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adImageMasked: {
    width: '120%',
    height: '120%',
    transform: [{ rotate: '18deg' }],
  },
  adTitle: {
    width: 294,
    height: 29,
    fontFamily: 'Poppins_700Bold',
    fontWeight: '700',
    fontSize: 19,
    lineHeight: 28,
    color: '#FFFFFF',
  },
  adDescription: {
    width: 239,
    height: 42,
    fontFamily: 'Poppins_600SemiBold',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
  },
  adButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 15,
    minWidth: 103,
    height: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
  },
  adButtonText: {
    fontFamily: 'Poppins_400Regular',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: '#000000',
    opacity: 0.85,
    textAlign: 'center',
  },
  // Pagination
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D9D9D9',
  },
  paginationDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00B14F',
  },
  // Content area
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  illustrationContainer: {
    width: '100%',
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationIllustration: {
    width: '100%',
    height: '100%',
  },
  modalTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    lineHeight: 32,
    color: '#000000',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '700',
  },
  modalDescription: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#9E9E9E',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 0,
  },
  modalButtons: {
    width: '100%',
    gap: 10,
  },
  allowButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#00B14F',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allowButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  notNowButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notNowButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    fontWeight: '600',
  },
});
