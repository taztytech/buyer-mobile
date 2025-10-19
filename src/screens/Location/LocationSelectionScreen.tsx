import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
  Keyboard,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { AddAddressFormScreen } from './AddAddressFormScreen';

// Dynamic import for MapView to prevent crash in Expo Go
let MapView: any = null;
let PROVIDER_GOOGLE: any = null;
let isMapAvailable = false;

try {
  const MapViewModule = require('react-native-maps');
  MapView = MapViewModule.default;
  PROVIDER_GOOGLE = MapViewModule.PROVIDER_GOOGLE;
  isMapAvailable = true;
  console.log('✅ Google Maps loaded successfully!');
} catch (error) {
  console.log('ℹ️ Maps not available in Expo Go. Build required for maps.');
  isMapAvailable = false;
}

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LocationSelectionScreenProps {
  onBack?: () => void;
  onLocationConfirm?: (location: { name: string; address: string; latitude: number; longitude: number }) => void;
  initialSearchQuery?: string;
}

export const LocationSelectionScreen: React.FC<LocationSelectionScreenProps> = ({
  onBack,
  onLocationConfirm,
  initialSearchQuery = '',
}) => {
  const [region, setRegion] = useState<Region>({
    latitude: 12.9716, // Default to Chennai
    longitude: 80.2425,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const [locationName, setLocationName] = useState('Kannan Nagar');
  const [locationAddress, setLocationAddress] = useState('Vigneshwar Nagar, Nanganallur, Tamilnadu, India');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [searchText, setSearchText] = useState(initialSearchQuery);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const bottomPosition = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<any>(null);

  useEffect(() => {
    // If initial search query is provided, trigger search on mount
    if (initialSearchQuery.trim()) {
      handleSearch();
    }
    // Note: getCurrentLocation() is not called automatically
    // It should only be called when user explicitly requests it (e.g., clicking "Use Current Location" button)

    // Keyboard listeners with animation
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setIsKeyboardVisible(true);
        Animated.timing(bottomPosition, {
          toValue: event.endCoordinates.height,
          duration: Platform.OS === 'ios' ? 250 : 200,
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        Animated.timing(bottomPosition, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? 250 : 200,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });

        // Get address from coordinates
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });

          if (addresses.length > 0) {
            const addr = addresses[0];
            setLocationName(addr.name || addr.street || 'Current Location');
            setLocationAddress(
              `${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}`
            );
          }
        } catch (reverseGeoError) {
          console.log('Reverse geocoding failed for current location');
          setLocationName('Current Location');
          setLocationAddress('Current Location');
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleRegionChangeComplete = async (newRegion: Region) => {
    setRegion(newRegion);

    try {
      // Check and request location permissions before reverse geocoding
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status !== 'granted') {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        if (newStatus !== 'granted') {
          console.log('Location permission denied');
          return;
        }
      }

      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: newRegion.latitude,
          longitude: newRegion.longitude,
        });

        if (addresses.length > 0) {
          const addr = addresses[0];
          setLocationName(addr.name || addr.street || 'Location');
          setLocationAddress(
            `${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}`
          );
        }
      } catch (reverseGeoError) {
        console.log('Reverse geocoding failed on region change');
        // Keep the current location name and address
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    }
  };

  const handleConfirm = () => {
    setShowAddressForm(true);
  };

  const handleAddressSave = (addressData: any) => {
    if (onLocationConfirm) {
      onLocationConfirm({
        name: locationName,
        address: locationAddress,
        latitude: region.latitude,
        longitude: region.longitude,
        ...addressData,
      });
    }
    setShowAddressForm(false);
    if (onBack) {
      onBack();
    }
  };

  const handleSearch = async () => {
    if (!searchText.trim()) return;

    try {
      // Check and request location permissions
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status !== 'granted') {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        if (newStatus !== 'granted') {
          console.log('Location permission denied');
          return;
        }
      }

      // Use geocoding to search for the location
      const results = await Location.geocodeAsync(searchText);

      if (results.length > 0) {
        const result = results[0];
        const newRegion = {
          latitude: result.latitude,
          longitude: result.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };

        setRegion(newRegion);

        // Animate map to new location if map is available
        if (mapRef.current && isMapAvailable) {
          mapRef.current.animateToRegion(newRegion, 1000);
        }

        // Get address details
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude: result.latitude,
            longitude: result.longitude,
          });

          if (addresses.length > 0) {
            const addr = addresses[0];
            setLocationName(addr.name || addr.street || searchText);
            setLocationAddress(
              `${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}`
            );
          }
        } catch (reverseGeoError) {
          console.log('Reverse geocoding failed, using search text as location name');
          setLocationName(searchText);
          setLocationAddress(searchText);
        }

        // Dismiss keyboard
        Keyboard.dismiss();
      } else {
        console.log('No results found for:', searchText);
      }
    } catch (error) {
      console.error('Error searching location:', error);
    }
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Back Button in Safe Area */}
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.container}>
        {/* Google Maps or Placeholder */}
        {isMapAvailable && MapView ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={region}
            onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation={true}
            showsMyLocationButton={false}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <MaterialIcons name="map" size={80} color="#999" />
            <Text style={styles.mapPlaceholderText}>
              Map Preview{'\n'}
              (Requires development build)
            </Text>
            <Text style={styles.coordinatesText}>
              📍 {region.latitude.toFixed(4)}, {region.longitude.toFixed(4)}
            </Text>
            <Text style={styles.mapHintText}>
              Location features still work!{'\n'}
              Run: npx expo run:android
            </Text>
          </View>
        )}

        {/* Center Pin Marker */}
        <View style={styles.centerMarker}>
          <MaterialIcons name="location-on" size={40} color="#001E1F" />
          <View style={styles.pinShadow} />
        </View>

        {/* Tooltip */}
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>Move the pin to change location</Text>
        </View>

        {/* Bottom Section */}
        <Animated.View style={[styles.bottomSection, { bottom: bottomPosition }]}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={24} color="#001E1F" />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search By Street, building,"
              placeholderTextColor="#8E8E8E"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={false}
              returnKeyType="search"
              underlineColorAndroid="transparent"
              onSubmitEditing={handleSearch}
            />
          </View>

          {/* Location Info Card - Hidden when keyboard is visible */}
          {!isKeyboardVisible && (
            <>
              <View style={styles.locationCard}>
                <View style={styles.locationInfo}>
                  <View style={styles.locationHeader}>
                    <MaterialIcons name="location-on" size={28} color="#00B14F" />
                    <Text style={styles.locationName}>{locationName}</Text>
                  </View>
                  <Text style={styles.locationAddress}>{locationAddress}</Text>
                </View>

                {/* Current Location Button */}
                <TouchableOpacity style={styles.currentLocationButton} onPress={getCurrentLocation}>
                  <MaterialIcons name="my-location" size={24} color="#001E1F" />
                </TouchableOpacity>
              </View>

              {/* Confirm Button */}
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>Confirm</Text>
                <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        {/* Address Form Modal */}
        <AddAddressFormScreen
          visible={showAddressForm}
          locationName={locationName}
          locationAddress={locationAddress}
          latitude={region.latitude}
          longitude={region.longitude}
          onBack={() => setShowAddressForm(false)}
          onSave={handleAddressSave}
          onClose={() => setShowAddressForm(false)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#E9E9E9',
  },
  map: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  mapPlaceholder: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#E9E9E9',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  mapPlaceholderText: {
    fontFamily: 'Poppins',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#666',
    lineHeight: 27,
  },
  coordinatesText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '500',
    color: '#00B14F',
  },
  mapHintText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    color: '#999',
    lineHeight: 18,
  },
  centerMarker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -20,
    marginTop: -40,
    alignItems: 'center',
  },
  pinShadow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    marginTop: -5,
  },
  tooltip: {
    position: 'absolute',
    left: (SCREEN_WIDTH - 192) / 2,
    top: (SCREEN_HEIGHT / 2) - 80,
    backgroundColor: '#001E1F',
    borderRadius: 13,
    paddingVertical: 4,
    paddingHorizontal: 15,
  },
  tooltipText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 15,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  headerSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    gap: 21,
    paddingBottom: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 19,
    paddingHorizontal: 20,
    gap: 10,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: 14,
    color: '#001E1F',
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  locationCard: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: 20,
    gap: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 43,
    elevation: 5,
  },
  locationInfo: {
    flex: 1,
    gap: 2,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationName: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 26,
    lineHeight: 39,
    color: '#001E1F',
  },
  locationAddress: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#001E1F',
    opacity: 0.85,
  },
  currentLocationButton: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(0, 128, 74, 0.2)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 19,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: '#00B14F',
    borderRadius: 10,
  },
  confirmButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
