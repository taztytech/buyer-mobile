import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@/shims/rn-vector-icons';

interface CustomizationVariant {
  id: string;
  addOns: string[];
  addOnNames?: string[];
  price: number;
  quantity: number;
  isVeg: boolean;
}

interface CustomisationsReviewModalProps {
  visible: boolean;
  itemName: string;
  basePrice: number;
  variants: CustomizationVariant[];
  onClose: () => void;
  onIncrement: (variantId: string) => void;
  onDecrement: (variantId: string) => void;
  onEdit: (variantId: string) => void;
  onAddNewCustomisation: () => void;
  onConfirm: () => void;
  maxQuantityReached?: boolean;
}

export const CustomisationsReviewModal: React.FC<CustomisationsReviewModalProps> = ({
  visible,
  itemName,
  basePrice,
  variants,
  onClose,
  onIncrement,
  onDecrement,
  onEdit,
  onAddNewCustomisation,
  onConfirm,
  maxQuantityReached = false,
}) => {
  const slideAnim = useRef(new Animated.Value(1000)).current;

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

  const getCustomizationDescription = (variant: CustomizationVariant) => {
    if (!variant.addOns || variant.addOns.length === 0) {
      return 'Just the basics. No customisations added';
    }
    return variant.addOnNames?.join(', ') || variant.addOns.join(', ');
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
              <Text style={styles.itemName} numberOfLines={1}>
                {itemName}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={styles.title}>Your customisations</Text>

            {/* Customizations List */}
            <ScrollView
              style={styles.variantsList}
              showsVerticalScrollIndicator={false}
            >
              {variants.map((variant, index) => (
                <View key={variant.id} style={styles.variantItem}>
                  <View style={styles.variantLeft}>
                    {/* Veg/Non-Veg Icon */}
                    <View style={styles.vegIconContainer}>
                      <View style={[
                        styles.vegIcon,
                        !variant.isVeg && styles.nonVegIcon
                      ]}>
                        <View style={[
                          styles.vegDot,
                          !variant.isVeg && styles.nonVegDot
                        ]} />
                      </View>
                    </View>

                    {/* Description and Price */}
                    <View style={styles.variantInfo}>
                      <Text style={styles.variantDescription}>
                        {getCustomizationDescription(variant)}
                      </Text>
                      <Text style={styles.variantPrice}>₹{variant.price}</Text>
                    </View>
                  </View>

                  {/* Quantity Controls */}
                  <View style={styles.quantityControl}>
                    <TouchableOpacity
                      onPress={() => onDecrement(variant.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quantityButton}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{variant.quantity}</Text>
                    <TouchableOpacity
                      onPress={() => onIncrement(variant.id)}
                      activeOpacity={0.7}
                      disabled={maxQuantityReached}
                      style={maxQuantityReached ? styles.quantityButtonDisabled : undefined}
                    >
                      <Text style={styles.quantityButton}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* Add New Customisation Button */}
              <TouchableOpacity
                style={styles.addNewButton}
                onPress={onAddNewCustomisation}
                activeOpacity={0.7}
              >
                <Text style={styles.addNewText}>Add new customisation</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Confirm Button */}
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
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
    marginBottom: 10,
  },
  itemName: {
    flex: 1,
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    opacity: 0.85,
  },
  closeButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    lineHeight: 36,
    color: '#000000',
    marginBottom: 20,
  },
  variantsList: {
    maxHeight: 400,
    marginBottom: 20,
  },
  variantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  variantLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  vegIconContainer: {
    paddingTop: 4,
  },
  vegIcon: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: '#00B14F',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDot: {
    width: 8,
    height: 8,
    backgroundColor: '#00B14F',
    borderRadius: 4,
  },
  nonVegIcon: {
    borderColor: '#FF0000',
  },
  nonVegDot: {
    backgroundColor: '#FF0000',
  },
  variantInfo: {
    flex: 1,
    gap: 6,
  },
  variantDescription: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(0, 0, 0, 0.7)',
  },
  variantPrice: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    opacity: 0.85,
  },
  quantityControl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    width: 100,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 18,
    gap: 8,
  },
  quantityButton: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 20,
    lineHeight: 30,
    color: '#00B14F',
    opacity: 0.85,
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#00B14F',
    minWidth: 20,
    textAlign: 'center',
  },
  addNewButton: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  addNewText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#00B14F',
  },
  confirmButton: {
    backgroundColor: '#00B14F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
