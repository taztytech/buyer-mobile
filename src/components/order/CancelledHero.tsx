import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface CancelledHeroProps {
  cancelledAt?: string | null;
  reason?: string | null;
}

const RED = '#E5463B';

/**
 * The cancelled-order hero: a red ✕, a clear "Order cancelled" headline, when
 * it happened, and the reason. Replaces the delivery illustration for
 * cancelled orders.
 */
export const CancelledHero: React.FC<CancelledHeroProps> = ({ cancelledAt, reason }) => {
  const whenText = (() => {
    if (!cancelledAt) return null;
    const d = new Date(cancelledAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  })();

  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <MaterialIcons name="close" size={30} color="#FFFFFF" />
      </View>
      <Text style={styles.title}>Order cancelled</Text>
      <Text style={styles.sub}>
        {whenText
          ? `Your order was cancelled on ${whenText}. We’re sorry for the trouble.`
          : 'This order was cancelled. We’re sorry for the trouble.'}
      </Text>
      {!!reason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonText}>
            <Text style={styles.reasonLabel}>Reason</Text> · {reason}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  icon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 19,
    letterSpacing: 0.1,
    color: '#14181B',
  },
  sub: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12.5,
    letterSpacing: 0.1,
    color: '#566068',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    maxWidth: 300,
  },
  reasonBox: {
    marginTop: 14,
    alignSelf: 'stretch',
    backgroundColor: '#F4F6F8',
    borderWidth: 1,
    borderColor: '#E3E7EB',
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  reasonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#566068',
    lineHeight: 18,
  },
  reasonLabel: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    color: '#14181B',
  },
});
