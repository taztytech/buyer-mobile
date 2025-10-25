import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { AddAddressFormScreen } from './AddAddressFormScreen';
import { LocationSelectionScreen } from './LocationSelectionScreen';
import { addressService, AddressResponse } from '@/services/address.service';

interface Address {
  id: string;
  type: 'home' | 'work' | 'other';
  fullAddress: string;
  isDefault: boolean;
  // Individual address components
  address1: string;
  address2?: string;
  address3?: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  alternate_phone_number?: number;
}

interface MyAddressesScreenProps {
  onBack?: () => void;
  onAddNew?: () => void;
  onEdit?: (addressId: string) => void;
  onDelete?: (addressId: string) => void;
  visible?: boolean; // To track when screen becomes visible
}

export const MyAddressesScreen: React.FC<MyAddressesScreenProps> = ({
  onBack,
  onAddNew,
  onEdit,
  onDelete,
  visible = true,
}) => {
  // State for managing addresses
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showLocationSelection, setShowLocationSelection] = useState(false);
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  // Fetch addresses on initial mount
  useEffect(() => {
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
        // Transform API response to Address format
        const addressList: Address[] = response.data.map((addr: AddressResponse) => ({
          id: addr.id.toString(),
          type: addr.type,
          fullAddress: `${addr.address1}${addr.address2 ? ', ' + addr.address2 : ''}${addr.address3 ? ', ' + addr.address3 : ''}, ${addr.city}, ${addr.state} - ${addr.pincode}`,
          isDefault: addr.is_default,
          // Store individual components for editing
          address1: addr.address1,
          address2: addr.address2,
          address3: addr.address3,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          latitude: addr.latitude,
          longitude: addr.longitude,
          alternate_phone_number: addr.alternate_phone_number,
        }));

        setAddresses(addressList);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
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

  // Handle edit address
  const handleEdit = (addressId: string) => {
    setEditingAddressId(addressId);
    setShowEditModal(true);
    if (onEdit) {
      onEdit(addressId);
    }
  };

  // Handle delete address
  const handleDelete = async (addressId: string) => {
    const address = addresses.find(addr => addr.id === addressId);

    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete ${formatAddressType(address?.type || 'other')} address?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await addressService.deleteAddress(addressId);

              if (response.success) {
                // Refresh the address list after deletion
                await fetchAddresses();
                Alert.alert('Success', 'Address deleted successfully');
                if (onDelete) {
                  onDelete(addressId);
                }
              } else {
                Alert.alert('Error', response.error || 'Failed to delete address');
              }
            } catch (error) {
              Alert.alert('Error', 'An unexpected error occurred while deleting the address');
            }
          },
        },
      ]
    );
  };

  // Handle Add New button click
  const handleAddNew = () => {
    setShowLocationSelection(true);
    if (onAddNew) {
      onAddNew();
    }
  };

  // Handle location confirmation from LocationSelectionScreen
  const handleLocationConfirm = (location: { name: string; address: string; latitude: number; longitude: number }) => {
    setSelectedLocation(location);
    setShowLocationSelection(false);
    setShowAddAddressForm(true);
  };

  // Handle save from edit modal
  const handleSaveAddress = async (addressData: any) => {
    // Refresh the address list from API
    await fetchAddresses();
    setShowEditModal(false);
    setEditingAddressId(null);
  };

  // Handle save from add address form
  const handleSaveNewAddress = async (addressData: any) => {
    // Refresh the address list from API
    await fetchAddresses();
    setShowAddAddressForm(false);
    setSelectedLocation(null);
  };

  const renderAddressCard = (address: Address) => (
    <View key={address.id} style={styles.addressCard}>
      {address.isDefault && (
        <View style={styles.defaultBadge}>
          <Text style={styles.defaultBadgeText}>Default</Text>
        </View>
      )}

      {/* Address Info Row */}
      <View style={styles.addressInfoRow}>
        <View style={styles.iconContainer}>
          <MaterialIcons
            name={getIconForType(address.type)}
            size={24}
            color="#00B14F"
          />
        </View>
        <View style={styles.addressTextContainer}>
          <Text style={styles.addressType}>{formatAddressType(address.type)}</Text>
          <Text style={styles.addressText}>{address.fullAddress}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Action Buttons Row */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEdit(address.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>EDIT</Text>
        </TouchableOpacity>
        <View style={styles.verticalDivider} />
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(address.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Address</Text>
      </View>

      <SafeAreaView style={styles.container} edges={['bottom']}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00B14F" />
                <Text style={styles.loadingText}>Loading addresses...</Text>
              </View>
            ) : addresses.length > 0 ? (
              addresses.map((address) => renderAddressCard(address))
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="location-off" size={64} color="#CCC" />
                <Text style={styles.emptyText}>No saved addresses yet</Text>
                <Text style={styles.emptySubtext}>Add your first address to get started</Text>
              </View>
            )}
          </ScrollView>

          {/* Add New Button - Fixed at bottom */}
          <View style={styles.bottomButtonContainer}>
            <TouchableOpacity
              style={styles.addNewButton}
              onPress={handleAddNew}
              activeOpacity={0.8}
            >
              <Text style={styles.addNewText}>Add New</Text>
              <MaterialIcons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

      {/* Location Selection Screen for Add New - Full screen overlay */}
      {showLocationSelection && (
        <View style={styles.fullScreenOverlay}>
          <LocationSelectionScreen
            onBack={() => setShowLocationSelection(false)}
            onLocationConfirm={handleLocationConfirm}
          />
        </View>
      )}

      {/* Edit Address Modal */}
      {editingAddressId && (() => {
        const editAddress = addresses.find(a => a.id === editingAddressId);
        return (
          <AddAddressFormScreen
            visible={showEditModal}
            editMode={true}
            addressId={editingAddressId}
            locationName="Edit Address"
            locationAddress={editAddress?.fullAddress || ''}
            latitude={editAddress?.latitude || 0}
            longitude={editAddress?.longitude || 0}
            initialData={{
              houseNo: editAddress?.address1 || '',
              building: editAddress?.address2 || '',
              locality: editAddress?.address3 || '',
              city: editAddress?.city || '',
              state: editAddress?.state || '',
              pincode: editAddress?.pincode?.toString() || '',
              alternateMobile: editAddress?.alternate_phone_number?.toString() || '',
              isDefault: editAddress?.isDefault || false,
              tag: editAddress?.type || 'home',
            }}
            onBack={() => {
              setShowEditModal(false);
              setEditingAddressId(null);
            }}
            onClose={() => {
              setShowEditModal(false);
              setEditingAddressId(null);
            }}
            onSave={handleSaveAddress}
          />
        );
      })()}

      {/* Add Address Form Modal */}
      {showAddAddressForm && selectedLocation && (
        <AddAddressFormScreen
          visible={showAddAddressForm}
          locationName={selectedLocation.name}
          locationAddress={selectedLocation.address}
          latitude={selectedLocation.latitude}
          longitude={selectedLocation.longitude}
          onBack={() => {
            setShowAddAddressForm(false);
            setShowLocationSelection(true);
          }}
          onClose={() => {
            setShowAddAddressForm(false);
            setSelectedLocation(null);
          }}
          onSave={handleSaveNewAddress}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: '#FFFFFF',
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
    color: '#FFFFFF',
    lineHeight: 27,
    opacity: 0.85,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 14,
    paddingBottom: 24,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 10,
    position: 'relative',
  },
  defaultBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: '#00B14F',
    paddingHorizontal: 7,
    paddingVertical: 8,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 20,
    zIndex: 3,
  },
  defaultBadgeText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    color: '#FFFFFF',
    opacity: 0.85,
  },
  addressInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0, 128, 74, 0.1)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressTextContainer: {
    flex: 1,
    gap: 2,
  },
  addressType: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
    color: '#001E1F',
  },
  addressText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 30, 31, 0.6)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 21,
  },
  editButton: {
    flex: 1,
    alignItems: 'center',
  },
  deleteButton: {
    flex: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#001E1F',
    opacity: 0.85,
  },
  verticalDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  bottomButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#F5F5F5',
  },
  addNewButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 19,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: '#00B14F',
    borderRadius: 10,
  },
  addNewText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#666',
  },
  emptySubtext: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
