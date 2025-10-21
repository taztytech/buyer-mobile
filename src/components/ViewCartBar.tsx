import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useCart } from '@/context/CartContext';

interface ViewCartBarProps {
  onPress: () => void;
}

export const ViewCartBar: React.FC<ViewCartBarProps> = ({ onPress }) => {
  const { getTotalItems } = useCart();
  const totalCartItems = getTotalItems();

  if (totalCartItems === 0) {
    return null;
  }

  return (
    <View style={styles.cartBar}>
      <TouchableOpacity
        style={styles.cartButton}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.cartItemCount}>
          {totalCartItems} Item{totalCartItems > 1 ? 's' : ''} Added
        </Text>
        <View style={styles.viewCartButton}>
          <Text style={styles.viewCartText}>View Cart</Text>
          <MaterialIcons name="arrow-forward" size={16} color="#181C2E" />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  cartButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    height: 60,
    backgroundColor: '#181C2E',
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 29,
    elevation: 5,
  },
  cartItemCount: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  viewCartButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
  },
  viewCartText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    color: '#181C2E',
    opacity: 0.85,
  },
});
