import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface PayOnlineCardProps {
  amount: number;
  /** True once the order is paid — flips the CTA to "Paid". */
  paid: boolean;
  loading?: boolean;
  onPay: () => void;
}

const GREEN_INK = '#0A6B36';

/**
 * COD pay-online card (Blinkit pattern): amount + reassurance on top, a divider,
 * then a centered green "Pay online" link that becomes "✓ Paid" once the order
 * is paid. Rendered only for unpaid Cash-on-Delivery orders.
 */
export const PayOnlineCard: React.FC<PayOnlineCardProps> = ({
  amount,
  paid,
  loading = false,
  onPay,
}) => {
  const amt = `₹${Number(amount || 0).toFixed(2)}`;
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.icon}>
          <MaterialIcons
            name={paid ? 'check-circle' : 'credit-card'}
            size={18}
            color={paid ? GREEN_INK : '#566068'}
          />
        </View>
        <View style={styles.text}>
          {paid ? (
            <>
              <Text style={styles.title}>Payment received</Text>
              <Text style={styles.sub}>{amt} paid online</Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>
                Pay <Text style={styles.amt}>{amt}</Text> before or on delivery
              </Text>
              <Text style={styles.sub}>
                Please keep {amt} change handy, or avoid the hassle by paying online.
              </Text>
            </>
          )}
        </View>
      </View>

      {paid ? (
        <View style={[styles.cta, styles.paidRow]}>
          <MaterialIcons name="check" size={15} color={GREEN_INK} />
          <Text style={styles.ctaText}>Paid</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.cta}
          onPress={onPay}
          disabled={loading}
          activeOpacity={0.7}
          testID="order-pay-online"
        >
          {loading ? (
            <ActivityIndicator size="small" color={GREEN_INK} />
          ) : (
            <Text style={styles.ctaText}>Pay online</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#E3E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#14181B',
  },
  amt: {
    color: GREEN_INK,
  },
  sub: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: '#8A939B',
    marginTop: 2,
    lineHeight: 16,
  },
  cta: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  paidRow: {},
  ctaText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 13.5,
    letterSpacing: 0.1,
    color: GREEN_INK,
  },
});
