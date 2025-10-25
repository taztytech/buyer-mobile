import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AddressResponse } from '@/services/address.service';

interface Address {
  id: string;
  type: 'home' | 'work' | 'other';
  label: string;
  fullAddress: string;
}

interface AddressSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  addresses: AddressResponse[];
  selectedAddressId?: string;
  onSelectAddress: (addressId: string) => void;
  onAddNewAddress: () => void;
}

export const AddressSelectionModal: React.FC<AddressSelectionModalProps> = ({
  visible,
  onClose,
  addresses,
  selectedAddressId,
  onSelectAddress,
  onAddNewAddress,
}) => {
  const slideAnim = useRef(new Animated.Value(1000)).current;
  const [selectedId, setSelectedId] = useState(selectedAddressId);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(1000);
    }
  }, [visible]);

  useEffect(() => {
    setSelectedId(selectedAddressId);
  }, [selectedAddressId]);

  const handleSelectAddress = (addressId: string) => {
    setSelectedId(addressId);
    onSelectAddress(addressId);
  };

  const getIconName = (type: string): keyof typeof MaterialIcons.glyphMap => {
    switch (type) {
      case 'home':
        return 'home';
      case 'work':
        return 'work';
      default:
        return 'location-on';
    }
  };

  const formatAddress = (address: AddressResponse): string => {
    const parts = [
      address.address1,
      address.address2,
      address.address3,
      address.city,
      address.state,
      address.pincode,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const getAddressLabel = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Choose Delivery Address</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <MaterialIcons name="close" size={24} color="#000000" />
                </TouchableOpacity>
              </View>

              {/* Address List */}
              <ScrollView style={styles.addressList} showsVerticalScrollIndicator={false}>
                {addresses.map((address) => (
                  <TouchableOpacity
                    key={address.id}
                    style={styles.addressItem}
                    onPress={() => handleSelectAddress(address.id.toString())}
                    activeOpacity={0.7}
                  >
                    <View style={styles.addressLeft}>
                      <View style={styles.iconContainer}>
                        <MaterialIcons
                          name={getIconName(address.type)}
                          size={24}
                          color="#00B14F"
                        />
                      </View>
                      <View style={styles.addressInfo}>
                        <Text style={styles.addressLabel}>{getAddressLabel(address.type)}</Text>
                        <Text style={styles.addressText}>{formatAddress(address)}</Text>
                      </View>
                    </View>
                    <View style={[
                      styles.radioButton,
                      selectedId === address.id.toString() && styles.radioButtonSelected
                    ]}>
                      {selectedId === address.id.toString() && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Add New Address Button */}
                <TouchableOpacity
                  style={styles.addNewButton}
                  onPress={onAddNewAddress}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addNewText}>+ Add New Address</Text>
                </TouchableOpacity>
              </ScrollView>
            </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 22,
    lineHeight: 33,
    color: '#000000',
    flex: 1,
  },
  closeButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressList: {
    maxHeight: 400,
  },
  addressItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  addressLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginRight: 15,
  },
  iconContainer: {
    width: 50,
    height: 50,
    backgroundColor: '#E8F5E9',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressInfo: {
    flex: 1,
    gap: 5,
  },
  addressLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
  addressText: {
    fontFamily: 'Poppins',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D9D9D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#00B14F',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00B14F',
  },
  addNewButton: {
    paddingVertical: 25,
    alignItems: 'flex-start',
  },
  addNewText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
});
