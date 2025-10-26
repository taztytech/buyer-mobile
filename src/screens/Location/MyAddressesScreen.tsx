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

interface MyAddressesScreenProps {
  onBack?: () => void;
  onAddNew?: () => void;
  visible?: boolean;
}

export const MyAddressesScreen: React.FC<MyAddressesScreenProps> = ({
  onBack,
  onAddNew,
  visible = false,
}) => {
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
      Alert.alert('Error', 'Failed to load addresses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (addressId: number) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await addressService.deleteAddress(addressId.toString());
              if (response.success) {
                await loadAddresses();
                Alert.alert('Success', 'Address deleted successfully');
              } else {
                Alert.alert('Error', response.error || 'Failed to delete address');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete address');
            }
          },
        },
      ]
    );
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
          <View style={styles.centerContainer}>
            <MaterialIcons name="location-off" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>No saved addresses</Text>
            <Text style={styles.emptySubtitle}>Add your first address to get started</Text>
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
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(address.id)}
                    >
                      <MaterialIcons name="delete-outline" size={24} color="#FF0000" />
                    </TouchableOpacity>

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
            onPress={() => {
              console.log('🟢 Add New button pressed');
              console.log('🟢 onAddNew function:', onAddNew);
              if (onAddNew) {
                onAddNew();
              } else {
                console.log('🔴 onAddNew is undefined!');
              }
            }}
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
  emptyTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#999',
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
    position: 'relative',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  deleteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 1,
  },
  addressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingRight: 32,
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
