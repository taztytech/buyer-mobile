import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { AddAddressFormScreen } from './AddAddressFormScreen';

interface Address {
  id: string;
  type: 'Home' | 'Work' | 'Other';
  fullAddress: string;
  isDefault: boolean;
}

interface MyAddressesScreenProps {
  onBack?: () => void;
  onAddNew?: () => void;
  onEdit?: (addressId: string) => void;
  onDelete?: (addressId: string) => void;
}

export const MyAddressesScreen: React.FC<MyAddressesScreenProps> = ({
  onBack,
  onAddNew,
  onEdit,
  onDelete,
}) => {
  // State for managing addresses
  const [addresses, setAddresses] = useState<Address[]>([
    {
      id: '1',
      type: 'Home',
      fullAddress: 'Vigneshwar Nagar, Nanganallur, Tamilnadu, India',
      isDefault: true,
    },
    {
      id: '2',
      type: 'Work',
      fullAddress: 'Vigneshwar Nagar, Nanganallur, Tamilnadu, India',
      isDefault: false,
    },
  ]);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  // Animate background when modal opens/closes
  useEffect(() => {
    if (showEditModal) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 30,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showEditModal]);

  const getIconForType = (type: 'Home' | 'Work' | 'Other') => {
    switch (type) {
      case 'Home':
        return 'home';
      case 'Work':
        return 'work';
      case 'Other':
        return 'location-on';
      default:
        return 'location-on';
    }
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
  const handleDelete = (addressId: string) => {
    const address = addresses.find(addr => addr.id === addressId);

    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete ${address?.type} address?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setAddresses(prev => prev.filter(addr => addr.id !== addressId));
            if (onDelete) {
              onDelete(addressId);
            }
          },
        },
      ]
    );
  };

  // Handle save from edit modal
  const handleSaveAddress = (addressData: any) => {
    if (editingAddressId) {
      // Update existing address
      setAddresses(prev => prev.map(addr =>
        addr.id === editingAddressId
          ? {
              ...addr,
              fullAddress: addressData.fullAddress || addr.fullAddress,
              type: addressData.tag || addr.type,
              isDefault: addressData.isDefault !== undefined ? addressData.isDefault : addr.isDefault
            }
          : addr
      ));
    }
    setShowEditModal(false);
    setEditingAddressId(null);
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
          <Text style={styles.addressType}>{address.type}</Text>
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
      <Animated.View
        style={[
          styles.animatedContainer,
          {
            transform: [
              { scale: scaleAnim },
              { translateY: translateYAnim },
            ],
          },
        ]}
      >
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
            {addresses.map((address) => renderAddressCard(address))}
          </ScrollView>

          {/* Add New Button - Fixed at bottom */}
          <View style={styles.bottomButtonContainer}>
            <TouchableOpacity
              style={styles.addNewButton}
              onPress={onAddNew}
              activeOpacity={0.8}
            >
              <Text style={styles.addNewText}>Add New</Text>
              <MaterialIcons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* Edit Address Modal */}
      <AddAddressFormScreen
        visible={showEditModal}
        locationName="Edit Address"
        locationAddress={addresses.find(a => a.id === editingAddressId)?.fullAddress || ''}
        latitude={12.9716}
        longitude={80.2425}
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
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  animatedContainer: {
    flex: 1,
    backgroundColor: '#00B14F',
    overflow: 'hidden',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: '#00B14F',
    borderRadius: 10,
  },
  addNewText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
