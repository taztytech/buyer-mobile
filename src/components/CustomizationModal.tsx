import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface AddOn {
  id: string;
  name: string;
  price: number;
  isVeg: boolean;
  discount?: string;
}

interface CustomizationModalProps {
  visible: boolean;
  item: {
    id: string;
    name: string;
    price: number;
    image: any;
    addOns?: AddOn[];
  } | null;
  onClose: () => void;
  onAddToCart: (itemId: string, quantity: number, selectedAddOns: string[]) => void;
}

export const CustomizationModal: React.FC<CustomizationModalProps> = ({
  visible,
  item,
  onClose,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());
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

  if (!item) return null;

  const handleIncrement = () => {
    setQuantity(prev => prev + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const toggleAddOn = (addOnId: string) => {
    setSelectedAddOns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(addOnId)) {
        newSet.delete(addOnId);
      } else {
        newSet.add(addOnId);
      }
      return newSet;
    });
  };

  const calculateTotalPrice = () => {
    let total = item.price * quantity;
    if (item.addOns) {
      item.addOns.forEach(addOn => {
        if (selectedAddOns.has(addOn.id)) {
          total += addOn.price * quantity;
        }
      });
    }
    return total;
  };

  const handleAddItem = () => {
    onAddToCart(item.id, quantity, Array.from(selectedAddOns));
    setQuantity(1);
    setSelectedAddOns(new Set());
    onClose();
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
          {/* Header with Item Name and Close Button */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Image source={item.image} style={styles.itemImage} />
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={16} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Add Ons Section */}
          <View style={styles.addOnsSection}>
            {/* Title and Subtitle */}
            <View style={styles.addOnsHeader}>
              <Text style={styles.addOnsTitle}>Add Ons:</Text>
              <Text style={styles.addOnsSubtitle}>
                Choose your favorite items with you foods
              </Text>
            </View>

            {/* Dashed Divider */}
            <View style={styles.dashedDivider} />

            {/* Add-ons List */}
            <ScrollView style={styles.addOnsList} showsVerticalScrollIndicator={false}>
              {item.addOns?.map((addOn) => (
                <TouchableOpacity
                  key={addOn.id}
                  style={styles.addOnItem}
                  onPress={() => toggleAddOn(addOn.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.addOnLeft}>
                    {/* Veg Icon */}
                    <View style={styles.vegIconSmall}>
                      <View style={styles.vegDotSmall} />
                    </View>

                    {/* Add-on Name */}
                    <Text style={styles.addOnName}>{addOn.name}</Text>

                    {/* Discount Badge (if applicable) */}
                    {addOn.discount && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>{addOn.discount}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.addOnRight}>
                    {/* Price */}
                    <Text style={styles.addOnPrice}>+ ₹{addOn.price}</Text>

                    {/* Checkbox */}
                    <View style={styles.checkbox}>
                      {selectedAddOns.has(addOn.id) && (
                        <MaterialIcons name="check" size={16} color="#000000" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Bottom Section - Quantity and Add Button */}
          <View style={styles.bottomSection}>
            {/* Quantity Control */}
            <View style={styles.quantityControl}>
              <TouchableOpacity onPress={handleDecrement} activeOpacity={0.7}>
                <Text style={styles.quantityButton}>-</Text>
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity onPress={handleIncrement} activeOpacity={0.7}>
                <Text style={styles.quantityButton}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Add Item Button */}
            <TouchableOpacity
              style={styles.addItemButton}
              onPress={handleAddItem}
              activeOpacity={0.8}
            >
              <Text style={styles.addItemText}>Add Item ₹{calculateTotalPrice()}</Text>
            </TouchableOpacity>
          </View>
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
    maxHeight: '95%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    height: 38,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  itemImage: {
    width: 38,
    height: 38,
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  itemName: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    opacity: 0.85,
  },
  closeButton: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addOnsSection: {
    backgroundColor: '#EBFFE0',
    borderRadius: 10,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 18,
    maxHeight: 250,
    marginTop: 30,
    marginBottom: 30,
  },
  addOnsHeader: {
    gap: 3,
  },
  addOnsTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
  addOnsSubtitle: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  dashedDivider: {
    width: '100%',
    height: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  addOnsList: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  addOnItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 21,
    marginBottom: 18,
  },
  addOnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  vegIconSmall: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: '#00B14F',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDotSmall: {
    width: 6,
    height: 6,
    backgroundColor: '#00B14F',
    borderRadius: 3,
  },
  addOnName: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  discountBadge: {
    backgroundColor: '#00B14F',
    borderRadius: 13,
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 7,
    lineHeight: 10,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  addOnRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addOnPrice: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  checkbox: {
    width: 21,
    height: 21,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    height: 40,
  },
  quantityControl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 2,
    gap: 9,
    width: 105,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 5,
  },
  quantityButton: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    opacity: 0.85,
  },
  quantityText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    opacity: 0.85,
  },
  addItemButton: {
    flex: 1,
    backgroundColor: '#001E1F',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
  },
  addItemText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    opacity: 0.85,
  },
});
