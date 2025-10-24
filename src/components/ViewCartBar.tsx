import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useCart } from '@/context/CartContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

interface ViewCartBarProps {
  onPress: () => void;
  onViewMenu?: () => void;
  restaurantLogo?: any;
  deliveryLocation?: string;
}

export const ViewCartBar: React.FC<ViewCartBarProps> = ({
  onPress,
  onViewMenu,
  restaurantLogo,
  deliveryLocation = "Home"
}) => {
  const { getTotalItems, getTotalPrice, restaurantName, clearCart } = useCart();
  const totalCartItems = getTotalItems();
  const totalPrice = getTotalPrice();
  const insets = useSafeAreaInsets();

  if (totalCartItems === 0) {
    return null;
  }

  const handleDelete = () => {
    clearCart();
  };

  return (
    <View style={styles.cartBarWrapper}>
      <View style={[styles.cartBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.cartContainer}>
        {/* Header Row: Restaurant Info and Checkout Button */}
        <View style={styles.headerRow}>
          <View style={styles.restaurantInfo}>
            {/* Restaurant Logo */}
            <View style={styles.logoContainer}>
              {restaurantLogo ? (
                <Image source={restaurantLogo} style={styles.restaurantLogo} resizeMode="cover" />
              ) : (
                <MaterialIcons name="restaurant" size={24} color="#00B14F" />
              )}
            </View>

            {/* Restaurant Name and View Full Menu */}
            <View style={styles.restaurantTextContainer}>
              <Text style={styles.restaurantName} numberOfLines={1}>
                {restaurantName || 'Restaurant'}
              </Text>
              <TouchableOpacity
                onPress={onViewMenu || onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.viewMenuText}>View full menu</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Checkout Button */}
          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={onPress}
            activeOpacity={0.8}
          >
            <Text style={styles.checkoutButtonText}>Checkout</Text>
            <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Bottom Row: Location, Order Details, and Delete Icon */}
        <View style={styles.bottomRow}>
          {/* Location Section */}
          <View style={styles.locationSection}>
            <MaterialIcons name="location-on" size={18} color="#00B14F" />
            <Text style={styles.locationText} numberOfLines={1}>{deliveryLocation}</Text>
          </View>

          {/* Order Items Details */}
          <View style={styles.orderDetailsRow}>
            <Text style={styles.cartItemCount}>
              {totalCartItems} Item{totalCartItems > 1 ? 's' : ''}
            </Text>
            <Text style={styles.priceSeparator}>|</Text>
            <Text style={styles.cartTotalPrice}>₹{totalPrice}</Text>
          </View>

          {/* Delete Icon */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <MaterialIcons name="delete-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cartBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'visible',
  },
  cartBar: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 30,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  cartContainer: {
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  restaurantLogo: {
    width: '100%',
    height: '100%',
  },
  restaurantTextContainer: {
    flex: 1,
    gap: 2,
  },
  restaurantName: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
  viewMenuText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: '#00B14F',
    textDecorationLine: 'underline',
  },
  checkoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: '#00B14F',
    borderRadius: 10,
    minWidth: 130,
  },
  checkoutButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  locationText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 20,
    color: '#000000',
    opacity: 0.85,
    flexShrink: 1,
  },
  orderDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cartItemCount: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  priceSeparator: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#BDBDBD',
  },
  cartTotalPrice: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 22,
    color: '#000000',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
