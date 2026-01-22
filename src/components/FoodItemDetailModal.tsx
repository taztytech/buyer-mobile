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
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { OptimizedImage } from '@/components/OptimizedImage';
import { ItemTiming, formatItemTiming, isItemAvailable } from '@/utils/timing.utils';
import { MAX_ITEM_QUANTITY } from '@/constants/cart.constants';

interface PreorderCampaign {
  id: string;
  title: string;
  available_slots: number;
  delivery_date: string;
  discount_amount: string;
  free_delivery: boolean;
}

interface FoodItemDetailModalProps {
  visible: boolean;
  item: {
    id: string;
    name: string;
    price: number;
    description: string;
    image: any | null;
    isVeg: boolean;
    isSpicy: boolean;
    isBestSeller: boolean;
    isCustomizable: boolean;
    timings?: ItemTiming[];
    isPreorderAvailable?: boolean;
    preorderCampaign?: PreorderCampaign;
  } | null;
  initialQuantity?: number;
  isAvailable?: boolean;
  onClose: () => void;
  onAddToCart: (itemId: string, quantity: number) => void;
  maxQuantity?: number;
}

export const FoodItemDetailModal: React.FC<FoodItemDetailModalProps> = ({
  visible,
  item,
  initialQuantity,
  isAvailable = true,
  onClose,
  onAddToCart,
  maxQuantity = MAX_ITEM_QUANTITY,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const slideAnim = useRef(new Animated.Value(1000)).current;
  const resolvedMaxQuantity = Math.max(1, maxQuantity);
  const insets = useSafeAreaInsets();
  const isUserInteractionRef = useRef(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();

      // Initialize quantity from initialQuantity (e.g. current cart quantity)
      // Fallback to 1 when there is no existing quantity
      // For preorder items, cap at 1
      if (typeof initialQuantity === 'number' && initialQuantity > 0) {
        const maxQty = item?.isPreorderAvailable ? 1 : resolvedMaxQuantity;
        setQuantity(Math.min(initialQuantity, maxQty));
      } else {
        setQuantity(1);
      }
      setIsAdding(false);
    } else {
      slideAnim.setValue(1000);
      setIsAdding(false);
    }
  }, [visible, slideAnim, initialQuantity, resolvedMaxQuantity, item?.isPreorderAvailable]);

  // Sync quantity when initialQuantity changes (cart updates from API)
  // Only sync if the change came from outside (not from user interaction)
  useEffect(() => {
    if (visible && typeof initialQuantity === 'number' && initialQuantity >= 0) {
      // Only sync if it wasn't a user interaction (to avoid resetting user's input)
      if (!isUserInteractionRef.current) {
        const maxQty = item?.isPreorderAvailable ? 1 : resolvedMaxQuantity;
        const newQuantity = Math.min(initialQuantity, maxQty);
        if (newQuantity !== quantity) {
          setQuantity(newQuantity);
        }
      }
      // Reset the flag after a short delay
      setTimeout(() => {
        isUserInteractionRef.current = false;
      }, 100);
    }
  }, [initialQuantity, visible, item?.isPreorderAvailable, resolvedMaxQuantity]);

  if (!item) return null;

  const handleIncrement = () => {
    // For preorder items, limit quantity to 1
    if (item.isPreorderAvailable) {
      if (quantity >= 1) {
        return; // Don't allow incrementing beyond 1 for preorder items
      }
      const next = 1;
      // Mark as user interaction to prevent useEffect from resetting
      isUserInteractionRef.current = true;
      // Update local state first for immediate UI feedback
      setQuantity(next);
      // Then sync with cart / backend API
      onAddToCart(item.id, next);
      return;
    }

    setQuantity(prev => {
      const next = Math.min(prev + 1, resolvedMaxQuantity);

      // Only proceed if quantity actually changed
      if (next !== prev) {
        // Mark as user interaction to prevent useEffect from resetting
        isUserInteractionRef.current = true;
        // Sync quantity with cart / backend API on every increment
        onAddToCart(item.id, next);
      }

      return next;
    });
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(prev => {
        const next = prev - 1;

        // Sync quantity with cart / backend on every decrement
        if (next > 0 && next !== prev) {
          // Mark as user interaction to prevent useEffect from resetting
          isUserInteractionRef.current = true;
          // Sync with backend API
          onAddToCart(item.id, next);
        }

        return next;
      });
    }
  };

  const handleAddItem = () => {
    // Prevent multiple rapid clicks
    if (isAdding) return;
    
    setIsAdding(true);

    // If item is not in cart (initialQuantity is 0 or undefined), call onAddToCart to trigger replace confirmation
    // This ensures the replace confirmation appears when adding from a different store
    // If item is already in cart, quantity is already synced via + / - handlers, but we still need to ensure it's added
    if (!initialQuantity || initialQuantity === 0) {
      // This will trigger the replace confirmation if needed (when cart has items from different restaurant)
      onAddToCart(item.id, quantity);
    } else if (quantity !== initialQuantity) {
      // If quantity changed, ensure it's synced (though increment/decrement should have already handled this)
      onAddToCart(item.id, quantity);
    }

    // Close the modal
    onClose();

    // Reset adding state after a short delay to allow modal to close
    setTimeout(() => {
      setIsAdding(false);
    }, 300);
  };

  // Calculate total price with preorder discount if applicable
  const calculateTotalPrice = () => {
    const basePrice = item.price;
    const discountAmount = item.isPreorderAvailable && item.preorderCampaign 
      ? parseFloat(item.preorderCampaign.discount_amount || '0') 
      : 0;
    const finalPrice = basePrice - discountAmount;
    return finalPrice * quantity;
  };

  const totalPrice = calculateTotalPrice();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlayContainer}>
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
                paddingBottom: Math.max(insets.bottom, 0),
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
            {/* Food Image or No Image Available */}
            <View style={styles.imageContainer}>
              {item.image ? (
                <OptimizedImage
                  source={item.image}
                  style={styles.foodImage}
                  contentFit="cover"
                  shimmerWidth="100%"
                  shimmerHeight={300}
                  transition={300}
                  priority="high"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={styles.noImageContainer}>
                  <Text style={styles.noImageText}>No Image Available</Text>
                </View>
              )}
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
              {/* Preorder Badge */}
              {item.isPreorderAvailable && (
                <View style={styles.preorderBadge}>
                  <MaterialIcons name="schedule" size={12} color="#FFFFFF" />
                  <Text style={styles.preorderBadgeText}>Preorder</Text>
                </View>
              )}
              <Text style={styles.itemDescription}>{item.description}</Text>
              {/* Price with discount if preorder */}
              {item.isPreorderAvailable && item.preorderCampaign && parseFloat(item.preorderCampaign.discount_amount || '0') > 0 ? (
                <View style={styles.priceContainer}>
                  <Text style={styles.originalPrice}>₹ {item.price.toFixed(2)}</Text>
                  <Text style={styles.discountedPrice}>
                    ₹ {(item.price - parseFloat(item.preorderCampaign.discount_amount || '0')).toFixed(2)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.itemPrice}>₹ {item.price.toFixed(2)}</Text>
              )}
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
                  disabled={!isAvailable || quantity <= 1}
                  style={(!isAvailable || quantity <= 1) ? styles.quantityButtonDisabled : undefined}
                >
                  <Text style={[
                    styles.quantityButton,
                    (!isAvailable || quantity <= 1) && styles.quantityButtonTextDisabled
                  ]}>-</Text>
                </TouchableOpacity>
                <Text style={[
                  styles.quantityText,
                  !isAvailable && styles.quantityTextDisabled
                ]}>{quantity}</Text>
                <TouchableOpacity
                  onPress={handleIncrement}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  disabled={!isAvailable || quantity >= resolvedMaxQuantity || (item.isPreorderAvailable && quantity >= 1)}
                  style={(!isAvailable || quantity >= resolvedMaxQuantity || (item.isPreorderAvailable && quantity >= 1)) ? styles.quantityButtonDisabled : undefined}
                >
                  <Text style={[
                    styles.quantityButton,
                    (!isAvailable || quantity >= resolvedMaxQuantity || (item.isPreorderAvailable && quantity >= 1)) && styles.quantityButtonTextDisabled
                  ]}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Add Item Button */}
              <TouchableOpacity
                style={[
                  styles.addItemButton,
                  (!isAvailable || isAdding) && styles.addItemButtonDisabled
                ]}
                onPress={handleAddItem}
                activeOpacity={0.8}
                disabled={!isAvailable || isAdding}
              >
                <Text style={[
                  styles.addItemText,
                  !isAvailable && styles.addItemTextDisabled
                ]}>
                  Add Item ₹{totalPrice}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    zIndex: 9999,
    elevation: 9999,
  },
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
    zIndex: 10000,
    elevation: 10000,
    ...Platform.select({
      android: {
        elevation: 10000,
      },
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
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
  noImageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'solid',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  noImageText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#9E9E9E',
    textAlign: 'center',
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
  preorderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00B14F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  preorderBadgeText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 10,
    lineHeight: 14,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  itemPrice: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    opacity: 0.85,
    marginTop: 8,
  },
  originalPrice: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(0, 0, 0, 0.45)',
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
  },
  discountedPrice: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    lineHeight: 24,
    color: '#00B14F',
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
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityButtonTextDisabled: {
    opacity: 0.4,
  },
  quantityText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    opacity: 0.85,
  },
  quantityTextDisabled: {
    opacity: 0.4,
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
  addItemButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  addItemText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  addItemTextDisabled: {
    color: '#666666',
    opacity: 0.8,
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
