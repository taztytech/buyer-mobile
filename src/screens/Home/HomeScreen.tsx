import React from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Alert, Modal, Image, ImageBackground, TextInput, ScrollView, FlatList, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { authService } from '@/services/auth.service';
import { homeService, BannerItem, CategoryItem, Restaurant } from '@/services/home.service';
import { RestaurantCard } from '@/components/RestaurantCard';
import { AddressSelectionScreen } from '@/screens/Location/AddressSelectionScreen';
import { LocationSelectionScreen } from '@/screens/Location/LocationSelectionScreen';
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

// Fallback category data if API fails or returns empty
const fallbackCategoryData: CategoryItem[] = [
  {
    id: 1,
    name: 'Biryani',
    description: 'Aromatic rice dish with spices',
    icon: require('@/assets/biriyani.png'),
  },
  {
    id: 2,
    name: 'South Indian',
    description: 'Traditional South Indian dishes',
    icon: require('@/assets/idlies.png'),
  },
  {
    id: 3,
    name: 'Pizza',
    description: 'Italian style pizzas',
    icon: require('@/assets/pizza.png'),
  },
  {
    id: 4,
    name: 'Burger',
    description: 'Delicious burgers',
    icon: require('@/assets/burger.png'),
  },
  {
    id: 5,
    name: 'Cakes',
    description: 'Sweet desserts',
    icon: require('@/assets/cake.png'),
  },
];

// Fallback restaurant data if API fails or returns empty
const fallbackRestaurantData: Restaurant[] = [
  {
    id: 1,
    name: 'A2B',
    cuisine: 'South Indian, Traditional, Meals.',
    rating: 4.5,
    deliveryTime: '10 - 15 mins',
    location: 'Keelkattalai',
    distance: '0.5Kms',
    image: require('@/assets/biriyani.png'),
    isFavorite: false,
  },
  {
    id: 2,
    name: 'Dinidigul Thalapakatti',
    cuisine: 'Burgers, Pizza, Chicken Wings Rolls & Wrap',
    rating: 4.5,
    deliveryTime: '10 - 15 mins',
    location: 'Pallavaram',
    distance: '1.2Kms',
    image: require('@/assets/burger.png'),
    isFavorite: false,
  },
  {
    id: 3,
    name: 'Pizza Hut',
    cuisine: 'Italian, Pizza, Fast Food',
    rating: 4.2,
    deliveryTime: '15 - 20 mins',
    location: 'Chrompet',
    distance: '2.5Kms',
    image: require('@/assets/pizza.png'),
    isFavorite: false,
  },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ onLogout }) => {
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [showLocationPopup, setShowLocationPopup] = React.useState(true);
  const [showVegModePopup, setShowVegModePopup] = React.useState(false);
  const [showLocationSelection, setShowLocationSelection] = React.useState(false);
  const [showAddAddressMap, setShowAddAddressMap] = React.useState(false);
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [carouselData, setCarouselData] = React.useState<CarouselItem[]>([]);
  const [categoryData, setCategoryData] = React.useState<CategoryItem[]>([]);
  const [restaurantData, setRestaurantData] = React.useState<Restaurant[]>([]);
  const [isLoadingBanners, setIsLoadingBanners] = React.useState(true);
  const [isVegMode, setIsVegMode] = React.useState(false);
  const [tempVegSelection, setTempVegSelection] = React.useState<'all' | 'veg'>('all');
  const [selectedLocation, setSelectedLocation] = React.useState({ name: 'Chennai', address: 'Vigneshwar Nagar, Nanganallur, Tamilnadu,...' });
  const flatListRef = React.useRef<FlatList>(null);

  const handleAllowLocation = async () => {
    try {
      console.log('[Location] Starting permission request...');

      // First check current permission status
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      console.log('[Location] Existing permission status:', existingStatus);

      let finalStatus = existingStatus;

      // Only request permission if not already granted
      if (existingStatus !== 'granted') {
        console.log('[Location] Requesting foreground permission...');
        const { status } = await Location.requestForegroundPermissionsAsync();
        finalStatus = status;
        console.log('[Location] Permission request result:', status);
      }

      if (finalStatus === 'granted') {
        console.log('[Location] Permission granted, getting current position...');
        const location = await Location.getCurrentPositionAsync({});
        console.log('[Location] Current location:', location);
        setShowLocationPopup(false);
      } else {
        console.log('[Location] Permission denied or not granted:', finalStatus);
        Alert.alert(
          'Permission Denied',
          'Location permission is required to show nearby restaurants. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Location.requestForegroundPermissionsAsync() }
          ]
        );
      }
    } catch (error) {
      console.error('[Location] Error requesting permission:', error);
      Alert.alert('Error', 'Failed to get location permission. Please try again.');
    }
  };

  const handleDenyLocation = () => {
    setShowLocationPopup(false);
    Alert.alert('Location Disabled', 'You can enable location access later from settings.');
  };

  const handleVegModeToggle = () => {
    setTempVegSelection(isVegMode ? 'veg' : 'all');
    setShowVegModePopup(true);
  };

  const handleApplyVegMode = () => {
    setIsVegMode(tempVegSelection === 'veg');
    setShowVegModePopup(false);
  };

  // Fetch home data on component mount
  React.useEffect(() => {
    const fetchHomeData = async () => {
      try {
        setIsLoadingBanners(true);

        const response = await homeService.getHomeData();

        if (response.success && response.data) {
          // The API returns data nested as: { data: { data: { promotional_banner: {...} } } }
          const actualData = response.data.data || response.data;
          const promotionalBanner = actualData.promotional_banner;
          const whatsOnYourMind = actualData.whats_on_your_mind;
          const nearbyRestaurants = actualData.nearby_restaurants;

          // Handle promotional banners
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

            if (transformedBanners.length > 0) {
              setCarouselData(transformedBanners);
            } else {
              setCarouselData(fallbackCarouselData);
            }
          } else {
            setCarouselData(fallbackCarouselData);
          }

          // Handle categories - use fallback if empty or undefined
          if (whatsOnYourMind && Array.isArray(whatsOnYourMind) && whatsOnYourMind.length > 0) {
            setCategoryData(whatsOnYourMind);
          } else {
            setCategoryData(fallbackCategoryData);
          }

          // Handle restaurants - use fallback if empty or undefined
          if (nearbyRestaurants && Array.isArray(nearbyRestaurants) && nearbyRestaurants.length > 0) {
            console.log('[HomeScreen] Restaurant data from API:', nearbyRestaurants);

            // Transform API data to match our Restaurant interface
            const transformedRestaurants = nearbyRestaurants.map((restaurant: any) => ({
              id: restaurant.id,
              name: restaurant.name,
              cuisine: restaurant.description || 'Restaurant',
              rating: restaurant.rating || 0,
              deliveryTime: restaurant.delivery_time || '25-30 mins',
              location: restaurant.location,
              distance: restaurant.distance ? `${restaurant.distance}Kms` : '0Kms',
              image: restaurant.logo_url || restaurant.image,
              isFavorite: false,
            }));

            console.log('[HomeScreen] Transformed restaurant data:', transformedRestaurants);
            setRestaurantData(transformedRestaurants);
          } else {
            console.log('[HomeScreen] Using fallback restaurant data');
            setRestaurantData(fallbackRestaurantData);
          }
        } else {
          setCarouselData(fallbackCarouselData);
          setCategoryData(fallbackCategoryData);
          setRestaurantData(fallbackRestaurantData);
        }
      } catch (error) {
        console.error('[HomeScreen] Error fetching home data:', error);
        setCarouselData(fallbackCarouselData);
        setCategoryData(fallbackCategoryData);
        setRestaurantData(fallbackRestaurantData);
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
              if (onLogout) {
                onLogout();
              }
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            } finally {
              setIsLoadingBanners(false);
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

  const renderCarouselItem = React.useCallback(({ item }: { item: CarouselItem }) => {
    return (
      <View style={styles.carouselSlide} testID={`carousel-slide-${item.id}`}>
        <View style={styles.adBanner} testID={`banner-${item.id}`}>
          {/* Blob with masked image */}
          {item.imageUrl ? (
            <View style={styles.blobContainer} testID={`blob-container-${item.id}`}>
              {/* Blob background with image masked inside */}
              <View style={styles.adImageBlob}>
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.adImageMasked}
                  resizeMode="cover"
                  testID={`banner-image-${item.id}`}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.adContent} testID={`banner-content-${item.id}`}>
            <Text style={styles.adTitle} testID={`banner-title-${item.id}`}>{item.title}</Text>
            <Text style={styles.adDescription} testID={`banner-description-${item.id}`}>{item.description}</Text>
            <TouchableOpacity style={styles.adButton} testID={`banner-button-${item.id}`}>
              <Text style={styles.adButtonText}>{item.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, []);

  const renderCategoryItem = React.useCallback(({ item }: { item: CategoryItem }) => {
    const imageSource = typeof item.icon === 'string' ? { uri: item.icon } : item.icon;

    return (
      <TouchableOpacity style={styles.categoryItem} testID={`category-${item.id}`}>
        <View style={styles.categoryImageContainer}>
          <Image
            source={imageSource}
            style={styles.categoryImage}
            resizeMode="contain"
            testID={`category-image-${item.id}`}
          />
        </View>
        <Text style={styles.categoryName} testID={`category-name-${item.id}`}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      <ScrollView style={styles.container} stickyHeaderIndices={[3]} testID="home-screen">

      {/* Header with Background Image */}
      <ImageBackground
        source={require('@/assets/home_app_bar.png')}
        style={styles.headerBackground}
        imageStyle={styles.headerBackgroundImage}
        testID="header-background"
      >
        {/* Location Section */}
        <View style={styles.locationSection} testID="location-section">
          <TouchableOpacity
            style={styles.locationInfo}
            onPress={() => setShowLocationSelection(true)}
            activeOpacity={0.7}
          >
            {/* City Name with Icon */}
            <View style={styles.cityRow}>
              <MaterialIcons name="location-on" size={20} color="#FFFFFF" />
              <Text style={styles.cityName} testID="city-name">{selectedLocation.name}</Text>
              <MaterialIcons name="keyboard-arrow-down" size={16} color="#FFFFFF" />
            </View>
            {/* Address */}
            <Text style={styles.addressText} testID="address-text">
              {selectedLocation.address}
            </Text>
          </TouchableOpacity>

          {/* Profile Avatar */}
          <TouchableOpacity
            style={styles.profileButton}
            onPress={handleLogout}
            testID="profile-button"
          >
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
          <TouchableOpacity
            style={styles.vegModeContainer}
            onPress={handleVegModeToggle}
            testID="veg-mode-toggle"
          >
            <Text style={styles.vegModeLabel}>VEG{'\n'}MODE</Text>
            <View style={[styles.vegToggle, isVegMode && styles.vegToggleActive]}>
              <View style={[styles.vegToggleThumb, isVegMode && styles.vegToggleThumbActive]} />
            </View>
          </TouchableOpacity>
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

      {/* What's On Your Mind Section */}
      <View style={[
        styles.sectionTitleContainer,
        carouselData.length <= 1 && styles.sectionTitleContainerCompact
      ]}>
        <LinearGradient
          colors={['rgba(0, 0, 0, 0)', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionTitleLine}
        />
        <Text style={styles.sectionTitle}>What's On Your Mind?</Text>
        <LinearGradient
          colors={['#000000', 'rgba(0, 0, 0, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionTitleLine}
        />
      </View>

      {/* Category List */}
      <View style={styles.categoryListContainer}>
        <FlatList
          data={categoryData}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryListContent}
          testID="category-list"
        />
      </View>

      {/* Restaurants Near You Section */}
      <View style={styles.restaurantsSectionTitleContainer}>
        <LinearGradient
          colors={['rgba(0, 0, 0, 0)', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.restaurantsTitleLine}
        />
        <Text style={styles.restaurantsTitle}>Restaurants Near You</Text>
        <LinearGradient
          colors={['#000000', 'rgba(0, 0, 0, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.restaurantsTitleLine}
        />
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity style={styles.filterButtonActive} testID="filter-filters">
            <MaterialIcons name="filter-list" size={16} color="#00B14F" />
            <Text style={styles.filterTextActive}>Filters</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButtonInactive} testID="filter-sort">
            <Text style={styles.filterTextInactive}>Sort By</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButtonInactive} testID="filter-price">
            <Text style={styles.filterTextInactive}>Price</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButtonInactive} testID="filter-veg">
            <Text style={styles.filterTextInactive}>Veg</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButtonInactive} testID="filter-delivery">
            <Text style={styles.filterTextInactive}>10 Mins Delivery</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Restaurant List */}
      <View style={styles.restaurantListContainer}>
        {restaurantData.map((restaurant) => (
          <View key={restaurant.id} style={styles.restaurantCardWrapper}>
            <RestaurantCard
              restaurant={restaurant}
              onPress={() => {
                // Handle restaurant card press
                console.log('Restaurant pressed:', restaurant.name);
              }}
              onFavoriteToggle={() => {
                // Handle favorite toggle
                setRestaurantData(prev =>
                  prev.map(r =>
                    r.id === restaurant.id
                      ? { ...r, isFavorite: !r.isFavorite }
                      : r
                  )
                );
              }}
            />
          </View>
        ))}
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

      {/* VEG Mode Selection Modal */}
      <Modal
        visible={showVegModePopup}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowVegModePopup(false)}
      >
        <TouchableOpacity
          style={styles.vegModalOverlay}
          activeOpacity={1}
          onPress={() => setShowVegModePopup(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.vegModalContent}>
              {/* All Restaurants Option */}
              <TouchableOpacity
                style={styles.vegOption}
                onPress={() => setTempVegSelection('all')}
                testID="veg-option-all"
              >
                <View style={styles.radioButton}>
                  {tempVegSelection === 'all' && <View style={styles.radioButtonSelected} />}
                </View>
                <Text style={styles.vegOptionText}>All Restaurants</Text>
              </TouchableOpacity>

              {/* Pure Veg Option */}
              <TouchableOpacity
                style={styles.vegOption}
                onPress={() => setTempVegSelection('veg')}
                testID="veg-option-veg"
              >
                <View style={styles.radioButton}>
                  {tempVegSelection === 'veg' && <View style={styles.radioButtonSelected} />}
                </View>
                <Text style={styles.vegOptionText}>Pure Veg</Text>
              </TouchableOpacity>

              {/* Apply Button */}
              <TouchableOpacity
                style={styles.vegApplyButton}
                onPress={handleApplyVegMode}
                testID="veg-apply-button"
              >
                <Text style={styles.vegApplyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Address Selection Modal */}
      <Modal
        visible={showLocationSelection}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowLocationSelection(false)}
      >
        <AddressSelectionScreen
          onBack={() => setShowLocationSelection(false)}
          onAddAddress={() => {
            // Will be implemented with new page instructions
            console.log('Add address clicked - awaiting new page implementation');
          }}
          onUseCurrentLocation={() => {
            setShowLocationSelection(false);
            setShowAddAddressMap(true);
          }}
          onSelectAddress={(address) => {
            setSelectedLocation({
              name: address.name,
              address: `${address.address}, ${address.city}`,
            });
            setShowLocationSelection(false);
          }}
        />
      </Modal>

      {/* Add Address Map Modal */}
      <Modal
        visible={showAddAddressMap}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowAddAddressMap(false)}
      >
        <LocationSelectionScreen
          onBack={() => {
            setShowAddAddressMap(false);
            setShowLocationSelection(true);
          }}
          onLocationConfirm={async (location) => {
            console.log('Complete address data:', {
              tag: location.name,
              locationName: location.locationName,
              locationAddress: location.locationAddress,
              houseNo: location.houseNo,
              building: location.building,
              locality: location.locality,
              alternateMobile: location.alternateMobile,
              isDefault: location.isDefault,
              latitude: location.latitude,
              longitude: location.longitude,
            });

            // Update selected location for display
            setSelectedLocation({
              name: location.name || location.locationName,
              address: location.locationAddress,
            });

            // TODO: Save complete address to backend
            // Example API call structure:
            // try {
            //   const response = await fetch('YOUR_API_ENDPOINT/addresses', {
            //     method: 'POST',
            //     headers: {
            //       'Content-Type': 'application/json',
            //       'Authorization': `Bearer ${userToken}`,
            //     },
            //     body: JSON.stringify({
            //       tag: location.name,
            //       locationName: location.locationName,
            //       locationAddress: location.locationAddress,
            //       houseNo: location.houseNo,
            //       building: location.building,
            //       locality: location.locality,
            //       alternateMobile: location.alternateMobile,
            //       isDefault: location.isDefault,
            //       latitude: location.latitude,
            //       longitude: location.longitude,
            //     }),
            //   });
            //   const data = await response.json();
            //   console.log('Address saved to backend:', data);
            // } catch (error) {
            //   console.error('Error saving address:', error);
            // }

            setShowAddAddressMap(false);
          }}
        />
      </Modal>
    </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header styles
  headerBackground: {
    width: '100%',
    height: 212,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 18,
  },
  headerBackgroundImage: {
    width: '120%',
    height: 212,
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
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    letterSpacing: 0,
    textAlignVertical: 'center',
  },
  addressText: {
    width: 271,
    height: 18,
    fontFamily: 'Poppins',
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
    fontFamily: 'Poppins',
    fontWeight: '400',
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
    fontFamily: 'Poppins',
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
  vegToggleActive: {
    backgroundColor: '#00B14F',
    justifyContent: 'flex-end',
  },
  vegToggleThumbActive: {
    alignSelf: 'flex-end',
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
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 19,
    lineHeight: 28,
    color: '#FFFFFF',
  },
  adDescription: {
    width: 239,
    height: 42,
    fontFamily: 'Poppins',
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
    fontFamily: 'Poppins',
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
  // Section Title
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 15,
  },
  sectionTitleContainerCompact: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  sectionTitleLine: {
    width: 35,
    height: 1,
  },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 0,
    textAlign: 'center',
    color: '#000000',
  },
  // Category List
  categoryListContainer: {
    width: '100%',
    minHeight: 100,
    paddingLeft: 20,
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingBottom: 12,
  },
  categoryListContent: {
    paddingRight: 20,
    alignItems: 'flex-start',
  },
  categoryItem: {
    width: 74,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  categoryImageContainer: {
    width: 74,
    height: 59,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    shadowColor: '#000000',
    shadowOffset: {
      width: -6,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  categoryName: {
    width: 74,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 12,
    letterSpacing: 0,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
    flexWrap: 'wrap',
  },
  // Restaurants Near You Section
  restaurantsSectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 15,
  },
  restaurantsTitleLine: {
    width: 35,
    height: 1,
  },
  restaurantsTitle: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 0,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  // Filter buttons
  filterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  filterScrollContent: {
    gap: 10,
  },
  filterButtonActive: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 4,
    height: 29,
    borderWidth: 1,
    borderColor: 'rgba(0, 128, 74, 0.25)',
    borderRadius: 13,
  },
  filterTextActive: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 0,
    color: '#00B14F',
  },
  filterButtonInactive: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 4,
    height: 29,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 13,
  },
  filterTextInactive: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 0,
    color: '#000000',
  },
  // Restaurant List
  restaurantListContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 10,
    backgroundColor: '#F5F5F5',
  },
  restaurantCardWrapper: {
    marginBottom: 10,
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
    fontFamily: 'Poppins',
    fontSize: 24,
    lineHeight: 32,
    color: '#000000',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '700',
  },
  modalDescription: {
    fontFamily: 'Poppins',
    fontWeight: '400',
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
    fontFamily: 'Poppins',
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
    fontFamily: 'Poppins',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    fontWeight: '600',
  },
  // VEG Mode Modal
  vegModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegModalContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    gap: 12,
    width: 192,
    minHeight: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  vegOption: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 20,
    width: '100%',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D9D9D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00B14F',
  },
  vegOptionText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 20,
    color: '#000000',
    opacity: 0.85,
  },
  vegApplyButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    backgroundColor: '#00B14F',
    borderRadius: 6,
  },
  vegApplyButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    opacity: 0.85,
  },
});
