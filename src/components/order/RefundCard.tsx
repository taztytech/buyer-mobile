import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface RefundInfo {
  amount?: number | string;
  destination?: string | null;
  status?: string | null;
  refund_type?: string | null;
  speed?: string | null;
}

interface RefundCardProps {
  refund?: RefundInfo | null;
}

const GREEN_INK = '#0A6B36';

/**
 * Shows the refund for a cancelled/refunded order, driven entirely by the
 * order's refund object (the seller admin decides wallet vs source, instant vs
 * normal). Renders nothing when there is no refund to show.
 */
export const RefundCard: React.FC<RefundCardProps> = ({ refund }) => {
  const amount = Number(refund?.amount || 0);
  if (!refund || !Number.isFinite(amount) || amount <= 0) return null;

  const destination = (refund.destination || '').toString().trim();
  const destLabel = destination
    ? /wallet/i.test(destination)
      ? 'your Tazty Wallet'
      : destination
    : 'your original payment method';

  const status = (refund.status || '').toString().toLowerCase();
  const done = ['done', 'completed', 'success', 'refunded', 'processed'].includes(status);

  const speed = (refund.speed || '').toString().toLowerCase();
  const speedText = /wallet/i.test(destination)
    ? 'Added instantly · use it on your next order'
    : speed.includes('instant')
      ? 'Instant refund to your account'
      : 'Usually lands in 3–5 business days';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headIcon}>
          <MaterialIcons name="autorenew" size={16} color={GREEN_INK} />
        </View>
        <Text style={styles.headTitle}>Refund</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.amount}>₹{amount.toFixed(2)}</Text>
        <View style={styles.rowText}>
          <Text style={styles.dest}>Refunded to {destLabel}</Text>
          <Text style={styles.speed}>{speedText}</Text>
        </View>
        <View style={[styles.pill, !done && styles.pillPending]}>
          <Text style={[styles.pillText, !done && styles.pillTextPending]}>
            {done ? '✓ Done' : 'Processing'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#E7F7EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitle: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14.5,
    letterSpacing: 0.1,
    color: '#14181B',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amount: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 17,
    color: GREEN_INK,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  dest: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#14181B',
  },
  speed: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: '#8A939B',
    marginTop: 1,
  },
  pill: {
    backgroundColor: '#E7F7EE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillPending: {
    backgroundColor: '#FFF3D6',
  },
  pillText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 11.5,
    color: GREEN_INK,
  },
  pillTextPending: {
    color: '#8a5a00',
  },
});
