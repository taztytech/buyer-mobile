import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Pressable,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface OrderBillSheetProps {
  visible: boolean;
  onClose: () => void;
  orderData: any;
}

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = Math.round(SCREEN_H * 0.8);
const GREEN_INK = '#0A6B36';

const money = (v: any) => `₹${Number(v || 0).toFixed(2)}`;

/**
 * Bottom sheet with the full order & bill. Slides up to 80% of the screen with
 * a centered close (✕) handle at the top, and scrolls through the items and
 * the bill breakdown.
 */
export const OrderBillSheet: React.FC<OrderBillSheetProps> = ({
  visible,
  onClose,
  orderData,
}) => {
  const translateY = useRef(new Animated.Value(SHEET_H)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : SHEET_H,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  const items: any[] = Array.isArray(orderData?.items) ? orderData.items : [];
  const s = orderData?.summary || {};
  const total = s.total_amount || orderData?.total_amount || 0;

  const rows: Array<{ label: string; value: number; muted?: boolean; positive?: boolean }> = [
    { label: 'Item total', value: Number(s.subtotal || 0) },
    { label: 'Delivery fee', value: Number(s.delivery_fee || 0) },
    { label: 'Platform fee', value: Number(s.platform_fee || 0) },
    { label: 'Delivery partner tip', value: Number(s.tip_amount || 0) },
    { label: 'Taxes & charges', value: Number(s.total_tax_amount || s.tax_amount || 0) },
  ];
  const discount = Number(s.discount_amount || 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        {/* Centered close handle */}
        <View style={styles.handleRow}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.85}
            testID="bill-sheet-close"
            accessibilityLabel="Close"
          >
            <MaterialIcons name="close" size={22} color="#14181B" />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Order summary</Text>
        <Text style={styles.subtitle}>
          {items.length} item{items.length === 1 ? '' : 's'} ·{' '}
          {orderData?.restaurant?.name || 'Restaurant'}
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Items */}
          <View style={styles.block}>
            {items.map((item, i) => (
              <View
                key={`bill-item-${item.id || i}`}
                style={[styles.itemRow, i === items.length - 1 && styles.itemRowLast]}
              >
                <Text style={styles.itemName} numberOfLines={2}>
                  {(item.item_name || item.name || 'Item')} × {item.quantity || 1}
                </Text>
                <Text style={styles.itemPrice}>
                  {money(item.total_price || item.item_total || (item.price || 0) * (item.quantity || 0))}
                </Text>
              </View>
            ))}
          </View>

          {/* Bill */}
          <Text style={styles.blockTitle}>Bill details</Text>
          <View style={styles.block}>
            {rows.map((r) => (
              <View key={r.label} style={styles.billRow}>
                <Text style={styles.billLabel}>{r.label}</Text>
                <Text style={styles.billValue}>{money(r.value)}</Text>
              </View>
            ))}
            {discount > 0 && (
              <View style={styles.billRow}>
                <Text style={[styles.billLabel, styles.discount]}>Discount</Text>
                <Text style={[styles.billValue, styles.discount]}>-{money(discount)}</Text>
              </View>
            )}
            <View style={styles.billDivider} />
            <View style={styles.billRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{money(total)}</Text>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_H,
    backgroundColor: '#F4F6F8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
  },
  handleRow: {
    alignItems: 'center',
    marginTop: -22,
    marginBottom: 6,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  title: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.1,
    color: '#14181B',
    marginTop: 4,
  },
  subtitle: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#8A939B',
    marginTop: 2,
    marginBottom: 12,
  },
  scroll: {
    paddingBottom: 32,
  },
  blockTitle: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 13.5,
    letterSpacing: 0.1,
    color: '#14181B',
    marginTop: 16,
    marginBottom: 8,
  },
  block: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
    gap: 12,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemName: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#14181B',
    lineHeight: 18,
  },
  itemPrice: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 13,
    color: '#14181B',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  billLabel: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12.5,
    letterSpacing: 0.1,
    color: '#566068',
  },
  billValue: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 12.5,
    color: '#14181B',
  },
  discount: {
    color: GREEN_INK,
    fontWeight: '600',
  },
  billDivider: {
    height: 1,
    backgroundColor: '#EDF0F3',
    marginVertical: 6,
  },
  totalLabel: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 15,
    color: '#14181B',
  },
  totalValue: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 16,
    color: '#14181B',
  },
});
