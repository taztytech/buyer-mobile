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
import { addressService, AddressResponse } from '@/services/address.service';
import { useConfirmation } from '@/context/ConfirmationContext';

interface MyAddressesScreenProps {
  onBack?: () => void;
  onAddNew?: () => void;
  onEditAddress?: (address: AddressResponse) => void;
  visible?: boolean;
}

export const MyAddressesScreen: React.FC<MyAddressesScreenProps> = ({
  onBack,
  onAddNew,
  onEditAddress,
  visible = false,
}) => {
  const { showConfirmation } = useConfirmation();
  const [addresses, setAddresses] = useState<AddressResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch addresses when component mounts
  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    setIsLoading(true);
    try {
      const response = await addressService.getAddresses();
      if (response.success && response.data) {
        setAddresses(response.data);
      }
    } catch (error) {
      showConfirmation({
        title: 'Error',
        message: 'Failed to load addresses',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (addressId: number) => {
    showConfirmation({
      title: 'Delete Address',
      message: 'Are you sure you want to delete this address?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmButtonColor: '#FF0000',
      onConfirm: async () => {
        try {
          const response = await addressService.deleteAddress(addressId.toString());
          if (response.success) {
            await loadAddresses();
            showConfirmation({
              title: 'Success',
              message: 'Address deleted successfully',
              confirmText: 'OK',
              cancelText: 'Close',
              onConfirm: () => {},
            });
          } else {
            showConfirmation({
              title: 'Error',
              message: response.error || 'Failed to delete address',
              confirmText: 'OK',
              cancelText: 'Close',
              onConfirm: () => {},
            });
          }
        } catch (error) {
          showConfirmation({
            title: 'Error',
            message: 'Failed to delete address',
            confirmText: 'OK',
            cancelText: 'Close',
            onConfirm: () => {},
          });
        }
      },
    });
  };

  const formatAddress = (addr: AddressResponse): string => {
    const parts = [
      addr.address1,
      addr.address2,
      addr.address3,
      addr.city,
      `${addr.state} - ${addr.pincode}`,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'home': return 'home';
      case 'work': return 'work';
      default: return 'location-on';
    }
  };

  const formatType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
      </View>

      <SafeAreaView style={styles.content} edges={['bottom']}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#00B14F" />
            <Text style={styles.loadingText}>Loading addresses...</Text>
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="location-off" size={64} color="rgba(0, 0, 0, 0.2)" />
            <Text style={styles.emptyTitle}>No Saved Addresses</Text>
            <Text style={styles.emptyText}>Add your first address to get started</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.addressList}>
              {addresses.map((address, index) => (
                <View key={address.id}>
                  <View style={styles.addressCard}>
                    <View style={styles.addressContent}>
                      <View style={styles.iconContainer}>
                        <MaterialIcons
                          name={getIconForType(address.type)}
                          size={24}
                          color="#00B14F"
                        />
                      </View>

                      <View style={styles.addressInfo}>
                        <View style={styles.addressHeader}>
                          <Text style={styles.addressType}>{formatType(address.type)}</Text>
                          {address.is_default && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultText}>Default</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.addressText}>{formatAddress(address)}</Text>

                        {/* Edit and Delete buttons */}
                        <View style={styles.actionButtons}>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                              if (onEditAddress) {
                                onEditAddress(address);
                              }
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text style={styles.editText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleDelete(address.id)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text style={styles.deleteText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                  {index < addresses.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Add New Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={onAddNew}
          >
            <Text style={styles.addButtonText}>Add New</Text>
            <MaterialIcons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  safeAreaTop: {
    backgroundColor: '#00B14F',
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
  content: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#001E1F',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    marginTop: 8,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 24,
  },
  addressList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  addressCard: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  addressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressInfo: {
    flex: 1,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  addressType: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#001E1F',
  },
  defaultBadge: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  defaultText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    color: '#FFFFFF',
    lineHeight: 12,
  },
  addressText: {
    fontFamily: 'Poppins',
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  actionButton: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  editText: {
    fontFamily: 'Poppins',
    fontSize: 13,
    color: '#00B14F',
  },
  deleteText: {
    fontFamily: 'Poppins',
    fontSize: 13,
    color: '#FF0000',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#F5F5F5',
  },
  addButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 19,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: '#00B14F',
    borderRadius: 10,
  },
  addButtonText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
