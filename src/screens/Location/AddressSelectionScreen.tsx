import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { addressService, AddressResponse, MAX_ADDRESSES } from '@/services/address.service';
import { useConfirmation } from '@/context/ConfirmationContext';

interface SavedAddress {
  id: string;
  type: 'home' | 'work' | 'other';
  address: string;
  city: string;
  distance?: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  // Full address details for API updates
  address1?: string;
  address2?: string;
  address3?: string;
  state?: string;
  pincode?: string;
  alternate_phone_number?: number;
}

interface AddressSelectionScreenProps {
  onBack?: () => void;
  onAddAddress?: () => void;
  onUseCurrentLocation?: (latitude?: number, longitude?: number) => void;
  onSelectAddress?: (address: SavedAddress) => void;
  onSearch?: (searchQuery: string) => void;
  visible?: boolean; // To track when screen becomes visible
}

export const AddressSelectionScreen: React.FC<AddressSelectionScreenProps> = ({
  onBack,
  onAddAddress,
  onUseCurrentLocation,
  onSelectAddress,
  onSearch,
  visible = true,
}) => {
  const { showConfirmation } = useConfirmation();
  const [searchText, setSearchText] = useState('');
  const [currentLocationName, setCurrentLocationName] = useState('Getting location...');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingAddressId, setUpdatingAddressId] = useState<string | null>(null);
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  // Fetch addresses on initial mount
  useEffect(() => {
    getCurrentLocationName();
    fetchAddresses();
  }, []);

  // Refetch addresses whenever the screen becomes visible
  useEffect(() => {
    if (visible) {
      fetchAddresses();
    }
  }, [visible]);

  const fetchAddresses = async () => {
    setIsLoading(true);
    try {
      const response = await addressService.getAddresses();

      if (response.success && response.data) {
        // Transform API response to SavedAddress format
        const addresses: SavedAddress[] = response.data.map((addr: AddressResponse) => ({
          id: addr.id.toString(),
          type: addr.type,
          address: `${addr.address1}${addr.address2 ? ', ' + addr.address2 : ''}${addr.address3 ? ', ' + addr.address3 : ''}`,
          city: addr.city,
          latitude: addr.latitude,
          longitude: addr.longitude,
          isDefault: addr.is_default,
          // Store full address details for API updates
          address1: addr.address1,
          address2: addr.address2 || undefined,
          address3: addr.address3 || undefined,
          state: addr.state,
          pincode: addr.pincode,
          alternate_phone_number: addr.alternate_phone_number,
        }));

        setSavedAddresses(addresses);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentLocationName = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const addresses = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (addresses.length > 0) {
          const addr = addresses[0];
          const locationName = `${addr.district || addr.city || 'Unknown'}, ${addr.region || ''}`;
          setCurrentLocationName(locationName);
        }
      } else {
        setCurrentLocationName('Location permission required');
      }
    } catch (error) {
      setCurrentLocationName('Unable to get location');
    }
  };

  const handleSearchSubmit = () => {
    if (searchText.trim() && onSearch) {
      const query = searchText.trim();
      onSearch(query);
      // Clear search text after submitting to avoid confusion on next search
      setSearchText('');
    }
  };

  const getIconForType = (type: 'home' | 'work' | 'other') => {
    switch (type) {
      case 'home':
        return 'home';
      case 'work':
        return 'work';
      case 'other':
        return 'location-on';
      default:
        return 'location-on';
    }
  };

  const formatAddressType = (type: 'home' | 'work' | 'other') => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const handleAddressSelect = async (address: SavedAddress) => {
    // If address is already default, just proceed with selection
    if (address.isDefault) {
      if (onSelectAddress) {
        onSelectAddress(address);
      }
      return;
    }

    // Update address to be default
    setUpdatingAddressId(address.id);
    try {
      const response = await addressService.updateAddress(address.id, {
        is_default: true,
      });

      if (response.success) {
        // Refresh addresses to get updated list
        await fetchAddresses();

        // Update the address object to reflect the change
        const updatedAddress = { ...address, isDefault: true };

        // Proceed with address selection
        if (onSelectAddress) {
          onSelectAddress(updatedAddress);
        }
      } else {
        showConfirmation({
          title: 'Error',
          message: response.error || 'Failed to update address. Please try again.',
          confirmText: 'OK',
          cancelText: 'Close',
          onConfirm: () => { },
        });
      }
    } catch (error: any) {
      showConfirmation({
        title: 'Error',
        message: error.message || 'An unexpected error occurred. Please try again.',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => { },
      });
    } finally {
      setUpdatingAddressId(null);
    }
  };

  const renderAddressItem = ({ item }: { item: SavedAddress }) => {
    const isUpdating = updatingAddressId === item.id;

    return (
      <TouchableOpacity
        style={styles.addressItem}
        onPress={() => handleAddressSelect(item)}
        activeOpacity={0.7}
        disabled={isUpdating}
      >
        <View style={styles.addressIconContainer}>
          <MaterialIcons name={getIconForType(item.type)} size={24} color="#00B14F" />
        </View>
        <View style={styles.addressInfo}>
          <View style={styles.addressNameRow}>
            <Text style={styles.addressName}>{formatAddressType(item.type)}</Text>
            {item.isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
            {isUpdating && (
              <ActivityIndicator size="small" color="#00B14F" style={styles.updatingIndicator} />
            )}
          </View>
          <Text style={styles.addressCity}>{item.address}</Text>
        </View>
        {item.distance && (
          <Text style={styles.addressDistance}>{item.distance}</Text>
        )}
      </TouchableOpacity>
    );
  };

  // Helper function to open location settings
  const openLocationSettings = () => {
    try {
      if (Platform.OS === 'android') {
        // Try to open Android location settings directly
        Linking.openURL('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
          // Fallback to app settings if location settings can't be opened
          Linking.openSettings();
        });
      } else {
        // iOS - open app settings (location settings are within app settings)
        Linking.openSettings();
      }
    } catch (error) {
      // Fallback to app settings
      try {
        Linking.openSettings();
      } catch {
        // Ignore errors
      }
    }
  };

  // Helper to show clear, OS-specific steps to enable location
  const getLocationSettingsGuide = () => {
    if (Platform.OS === 'android') {
      return (
        'How to turn on location for Tazty on Android:\n' +
        '1. Tap "Open Settings" below (or open the Settings app).\n' +
        '2. Go to "Apps" → "Tazty".\n' +
        '3. Tap "Permissions" → "Location".\n' +
        '4. Select "Allow only while using the app".\n' +
        '5. Then go back and make sure "Location" is turned ON in the main Settings screen.'
      );
    }

    return (
      'How to turn on location for Tazty on iPhone:\n' +
      '1. Tap "Open Settings" below (or open the Settings app).\n' +
      '2. Scroll down and tap "Tazty".\n' +
      '3. Tap "Location".\n' +
      '4. Choose "While Using the App".\n' +
      '5. Also ensure Location Services are ON in "Settings" → "Privacy & Security" → "Location Services".'
    );
  };

  const handleAddAddressPress = async () => {
    // Prevent duplicate taps
    if (isAddingAddress) {
      return;
    }

    setIsAddingAddress(true);

    if (savedAddresses.length >= MAX_ADDRESSES) {
      showConfirmation({
        title: 'Address limit reached',
        message: `You can save up to ${MAX_ADDRESSES} delivery addresses. Please delete one before adding a new address.`,
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => { },
      });
      setIsAddingAddress(false);
      return;
    }

    // Step 1: Check initial permission status to detect first launch
    // This MUST be done before requesting permission to accurately detect first launch
    let initialStatus: string = 'undetermined';
    let isFirstLaunch = true; // Default to true to be safe

    try {
      const initialPermission = await Location.getForegroundPermissionsAsync();
      initialStatus = initialPermission.status || 'undetermined';
      isFirstLaunch = initialStatus === 'undetermined';
    } catch (error) {
      // If we can't check permission, assume first launch and proceed
      // This ensures first launch users can always access the map
      console.log('Could not check initial permission, assuming first launch:', error);
      isFirstLaunch = true;
    }

    // Step 2: Handle first launch differently - navigate immediately without requesting permission
    // LocationSelectionScreen will handle permission request and location fetching
    if (isFirstLaunch) {
      console.log('First launch detected - navigating immediately, LocationSelectionScreen will handle permission');
      // Navigate immediately without any permission checks
      // LocationSelectionScreen's getCurrentLocation will request permission and fetch location
      try {
        if (onUseCurrentLocation) {
          onUseCurrentLocation();
        } else {
          console.error('onUseCurrentLocation callback is not defined!');
        }
      } finally {
        // Clear loading after navigation decision
        setIsAddingAddress(false);
      }
      return; // Exit early - navigation is done
    }

    // Step 3: NOT first launch - check and request permission
    try {
      let permission = await Location.getForegroundPermissionsAsync();

      // If permission is not granted, request it
      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      // Step 4: Handle permission response
      if (permission.status !== 'granted') {
        // Permission denied - show instructions
        if (!permission.canAskAgain) {
          // Permission is blocked ("Don't ask again") – send user to settings
          Alert.alert(
            'Enable Location Access',
            'To add an address using your current location, please enable location access for Tazty in your device settings.\n\n' +
            getLocationSettingsGuide(),
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  try {
                    openLocationSettings();
                  } catch {
                    // Ignore Linking errors
                  }
                },
              },
            ]
          );
        } else {
          // Permission was denied but can be asked again
          Alert.alert(
            'Location Permission Required',
            'To add an address using your current location, please allow Tazty to access your location. Turn on device location and choose "While using this app" or "Allow all the time" when prompted.\n\n' +
            getLocationSettingsGuide()
          );
        }
        return; // Don't navigate if permission is not granted
      }

      // NOT FIRST LAUNCH: Try to get location first, then navigate
      let locationCoordinates: { latitude: number; longitude: number } | null = null;

      try {
        // Check if location services are enabled
        const isLocationEnabled = await Location.hasServicesEnabledAsync();

        if (!isLocationEnabled) {
          // Permission granted but location services are disabled - show alert
          Alert.alert(
            'Turn on Location',
            'Location permission is granted, but location services are turned off. Please turn on location services in your device settings to add an address using your current location.\n\n' +
            getLocationSettingsGuide(),
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  openLocationSettings();
                },
              },
            ]
          );
          return; // Don't navigate if location services are disabled
        }

        // Location services are enabled - try to get current location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Platform.OS === 'ios'
            ? Location.Accuracy.Balanced
            : Location.Accuracy.High,
        });

        locationCoordinates = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
      } catch (locationError) {
        // Location fetch failed - still navigate, LocationSelectionScreen will handle it
        console.log('Location fetch failed, navigating anyway:', locationError);
      }

      // Navigate to LocationSelectionScreen
      if (onUseCurrentLocation) {
        if (locationCoordinates) {
          // Navigate with current location coordinates
          onUseCurrentLocation(locationCoordinates.latitude, locationCoordinates.longitude);
        } else {
          // Navigate without coordinates - LocationSelectionScreen will handle getting location
          onUseCurrentLocation();
        }
      }
    } catch (error) {
      // ANY error - check if this might be first launch and navigate accordingly
      console.error('Error in permission check:', error);

      // If we couldn't determine first launch status, assume it is and navigate
      // This ensures first launch users can always access the map
      if (isFirstLaunch) {
        // On first launch, always navigate even if there's an error
        // LocationSelectionScreen will handle permission request and location fetching
        console.log('First launch (or assumed first launch) - navigating despite error to ensure user can access map');
        if (onUseCurrentLocation) {
          onUseCurrentLocation();
        } else {
          console.error('onUseCurrentLocation callback is not defined!');
        }
      } else {
        // Not first launch - show error but still allow navigation as fallback
        Alert.alert(
          'Location Error',
          'Unable to access location. You can still manually set your location on the map.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: () => {
                if (onUseCurrentLocation) {
                  onUseCurrentLocation();
                }
              },
            },
          ]
        );
      }
    } finally {
      // Ensure loading is cleared in all non-first-launch flows
      setIsAddingAddress(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#00B14F" />

      {/* Header with Safe Area */}
      <SafeAreaView style={styles.safeAreaHeader} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select a location</Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={24} color="#00B14F" />
              <TextInput autoCorrect={false}
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search for area, street name..."
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoFocus={false}
                returnKeyType="search"
                onSubmitEditing={handleSearchSubmit}
              />
            </View>

            {/* Main Options Group */}
            <View style={styles.optionsGroup}>
              {/* Add Address */}
              <TouchableOpacity
                style={[
                  styles.optionItem,
                  isAddingAddress && { opacity: 0.7 },
                ]}
                onPress={handleAddAddressPress}
                activeOpacity={0.7}
                disabled={isAddingAddress}
              >
                <View style={styles.optionLeft}>
                  <View style={styles.optionIconContainer}>
                    <MaterialIcons name="add" size={24} color="#00B14F" />
                  </View>
                  <View>
                    <Text style={styles.optionText}>
                      {isAddingAddress ? 'Getting location…' : 'Add address'}
                    </Text>
                    <Text style={styles.optionSubtext}>
                      {isAddingAddress ? 'Please wait a moment' : currentLocationName}
                    </Text>
                  </View>
                </View>
                {isAddingAddress ? (
                  <ActivityIndicator size="small" color="#00B14F" />
                ) : (
                  <MaterialIcons name="chevron-right" size={24} color="#999" />
                )}
              </TouchableOpacity>
            </View>

            {/* Saved Addresses */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00B14F" />
                <Text style={styles.loadingText}>Loading addresses...</Text>
              </View>
            ) : savedAddresses.length > 0 ? (
              <View style={styles.recentSection}>
                <Text style={styles.recentTitle}>SAVED ADDRESSES</Text>

                <View style={styles.recentList}>
                  <FlatList
                    data={savedAddresses}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    renderItem={renderAddressItem}
                    scrollEnabled={false}
                    ItemSeparatorComponent={() => <View style={styles.divider} />}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="location-off" size={48} color="#CCC" />
                <Text style={styles.emptyText}>No saved addresses yet</Text>
                <Text style={styles.emptySubtext}>Add a new address to get started</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  safeAreaHeader: {
    backgroundColor: '#00B14F',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#00B14F',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
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
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#001E1F',
    padding: 0,
  },
  optionsGroup: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 177, 79, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '500',
    color: '#001E1F',
  },
  optionSubtext: {
    fontFamily: 'Poppins',
    fontSize: 13,
    fontWeight: '400',
    color: '#666',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  recentSection: {
    marginBottom: 24,
  },
  recentTitle: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  recentList: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  addressIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressInfo: {
    flex: 1,
  },
  addressNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#001E1F',
  },
  defaultBadge: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultBadgeText: {
    fontFamily: 'Poppins',
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 12,
  },
  addressCity: {
    fontFamily: 'Poppins',
    fontSize: 13,
    fontWeight: '400',
    color: '#666',
    marginTop: 2,
  },
  addressDistance: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    color: '#999',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtext: {
    fontFamily: 'Poppins',
    fontSize: 13,
    color: '#999',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#F5F5F5',
  },
  footerText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: '#999',
  },
  footerGoogle: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '600',
    color: '#4285F4',
  },
  updatingIndicator: {
    marginLeft: 8,
  },
});
