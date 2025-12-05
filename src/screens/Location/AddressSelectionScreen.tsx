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

  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        // Get current location coordinates
        const location = await Location.getCurrentPositionAsync({
          accuracy: Platform.OS === 'ios'
            ? Location.Accuracy.Balanced
            : Location.Accuracy.High,
        });

        if (onUseCurrentLocation) {
          // Pass coordinates to callback so LocationSelectionScreen can use them
          onUseCurrentLocation(location.coords.latitude, location.coords.longitude);
        }
      } else {
        // Permission denied, still navigate but without coordinates
        if (onUseCurrentLocation) {
          onUseCurrentLocation();
        }
      }
    } catch (error) {
      // Error getting location, still navigate but without coordinates
      if (onUseCurrentLocation) {
        onUseCurrentLocation();
      }
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
          onConfirm: () => {},
        });
      }
    } catch (error: any) {
      showConfirmation({
        title: 'Error',
        message: error.message || 'An unexpected error occurred. Please try again.',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
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

  const handleAddAddressPress = () => {
    if (savedAddresses.length >= MAX_ADDRESSES) {
      showConfirmation({
        title: 'Address limit reached',
        message: `You can save up to ${MAX_ADDRESSES} delivery addresses. Please delete one before adding a new address.`,
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => {},
      });
      return;
    }

    handleUseCurrentLocation();
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

      <View style={styles.container}>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={24} color="#00B14F" />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search for area, street name..."
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={false}
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
            />
          </View>

          {/* Main Options Group */}
          <View style={styles.optionsGroup}>
            {/* Add Address */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleAddAddressPress}
              activeOpacity={0.7}
            >
              <View style={styles.optionLeft}>
                <View style={styles.optionIconContainer}>
                  <MaterialIcons name="add" size={24} color="#00B14F" />
                </View>
                <View>
                  <Text style={styles.optionText}>Add address</Text>
                  <Text style={styles.optionSubtext}>{currentLocationName}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#999" />
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
                  keyExtractor={(item) => item.id}
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
