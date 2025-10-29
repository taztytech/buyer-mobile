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
import { ItemTiming, formatItemTiming, isItemAvailable } from '@/utils/timing.utils';

interface FoodItemDetailModalProps {
  visible: boolean;
  item: {
    id: string;
    name: string;
    price: number;
    description: string;
    image: any;
    isVeg: boolean;
    isSpicy: boolean;
    isBestSeller: boolean;
    isCustomizable: boolean;
    timings?: ItemTiming[];
  } | null;
  initialQuantity?: number;
  onClose: () => void;
  onAddToCart: (itemId: string, quantity: number) => void;
}

export const FoodItemDetailModal: React.FC<FoodItemDetailModalProps> = ({
  visible,
  item,
  initialQuantity,
  onClose,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);
  const slideAnim = useRef(new Animated.Value(1000)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();

      // Initialize quantity
      setQuantity(initialQuantity || 1);
    } else {
      slideAnim.setValue(1000);
    }
  }, [visible, initialQuantity]);

  if (!item) return null;

  const handleIncrement = () => {
    setQuantity(prev => prev + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const handleAddItem = () => {
    onAddToCart(item.id, quantity);
    setQuantity(1);
    onClose();
  };

  const totalPrice = item.price * quantity;

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
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <MaterialIcons name="close" size={14} color="#000000" />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Food Image */}
            <View style={styles.imageContainer}>
              <Image source={item.image} style={styles.foodImage} resizeMode="cover" />
            </View>

            {/* Badges Row */}
            <View style={styles.badgesRow}>
              {/* Veg/Non-veg and Spicy */}
              <View style={styles.leftBadges}>
                <View style={[
                  styles.vegIconLarge,
                  !item.isVeg && styles.nonVegIconLarge
                ]}>
                  <View style={[
                    styles.vegDotLarge,
                    !item.isVeg && styles.nonVegDotLarge
                  ]} />
                </View>
                {item.isSpicy && (
                  <View style={styles.spicyBadge}>
                    <MaterialIcons name="local-fire-department" size={12} color="#000000" />
                    <Text style={styles.spicyText}>Spicy</Text>
                  </View>
                )}
              </View>

              {/* Best Seller Badge */}
              {item.isBestSeller && (
                <View style={styles.bestSellerBadge}>
                  <MaterialIcons name="star" size={11} color="#000000" />
                  <Text style={styles.bestSellerText}>Bestseller</Text>
                </View>
              )}
            </View>

            {/* Item Name and Description */}
            <View style={styles.infoSection}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDescription}>{item.description}</Text>
            </View>

            {/* Timing Information - Only show for unavailable items */}
            {item.timings && item.timings.length > 0 && !isItemAvailable(item.timings) && (
              <View style={styles.timingSection}>
                <View style={styles.timingHeader}>
                  <MaterialIcons name="access-time" size={16} color="#00B14F" />
                  <Text style={styles.timingTitle}>Available</Text>
                </View>
                {item.timings.map((timing, index) => (
                  <View key={index} style={styles.timingRow}>
                    <Text style={[
                      styles.timingText,
                      timing.is_available_now && styles.timingTextAvailable
                    ]}>
                      {formatItemTiming(timing)}
                    </Text>
                    {timing.is_available_now && (
                      <View style={styles.availableBadge}>
                        <Text style={styles.availableText}>Now</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Bottom Action Bar */}
            <View style={styles.bottomBar}>
              {/* Quantity Control */}
              <View style={styles.quantityControl}>
                <TouchableOpacity
                  onPress={handleDecrement}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.quantityButton}>-</Text>
                </TouchableOpacity>
                <Text style={styles.quantityText}>{quantity}</Text>
                <TouchableOpacity
                  onPress={handleIncrement}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.quantityButton}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Add Item Button */}
              <TouchableOpacity
                style={styles.addItemButton}
                onPress={handleAddItem}
                activeOpacity={0.8}
              >
                <Text style={styles.addItemText}>Add Item ₹{totalPrice}</Text>
              </TouchableOpacity>
            </View>
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
    maxHeight: '85%',
  },
  scrollContent: {
    padding: 20,
    gap: 10,
  },
  imageContainer: {
    width: '100%',
    height: 253,
    borderRadius: 20,
    overflow: 'hidden',
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 16,
  },
  leftBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  vegIconLarge: {
    width: 16,
    height: 16,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDotLarge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00B14F',
  },
  nonVegIconLarge: {
    borderColor: '#FF0000',
  },
  nonVegDotLarge: {
    backgroundColor: '#FF0000',
  },
  spicyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 1,
    height: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.13)',
    borderRadius: 13,
  },
  spicyText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 7,
    lineHeight: 10,
    color: '#000000',
    opacity: 0.85,
  },
  bestSellerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 1,
    height: 16,
    borderRadius: 2,
  },
  bestSellerText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    opacity: 0.85,
  },
  infoSection: {
    gap: 0,
  },
  itemName: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    opacity: 0.85,
  },
  itemDescription: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 15,
    color: 'rgba(0, 0, 0, 0.5)',
    opacity: 0.85,
    marginTop: 5,
  },
  closeButton: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    top: -36,
    left: '50%',
    marginLeft: -13,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    height: 40,
    marginTop: 10,
  },
  quantityControl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 9,
    width: 78,
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
    fontFamily: 'Poppins',
    fontWeight: '500',
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
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  timingSection: {
    backgroundColor: '#F5FFF5',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    gap: 8,
  },
  timingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timingTitle: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 18,
    color: '#00B14F',
  },
  timingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timingText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(0, 0, 0, 0.6)',
    flex: 1,
  },
  timingTextAvailable: {
    color: '#00B14F',
    fontWeight: '500',
  },
  availableBadge: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  availableText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 9,
    lineHeight: 13,
    color: '#FFFFFF',
  },
});
