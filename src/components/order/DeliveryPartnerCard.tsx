import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface DeliveryPartnerCardProps {
  /** Delivery partner name; null/empty until one is assigned. */
  name?: string | null;
  /** True once the order is delivered (changes the greeting). */
  delivered?: boolean;
  restaurantName: string;
  /** Restaurant → customer distance in km; null hides the figure. */
  distanceKm?: number | null;
  onCall?: () => void;
  /** Show the call button (active orders with an assigned partner). */
  showCall?: boolean;
}

const GREEN = '#00B14F';
const GREEN_DEEP = '#0A7A3C';
const GREEN_INK = '#0A6B36';

/**
 * One card for the delivery partner + store distance (Blinkit pattern).
 * Before assignment it reassures ("assigning soon"); once assigned it
 * introduces the partner ("Hi, I'm …" / "Delivered by …"); and it always shows
 * how far the restaurant is from the delivery address.
 */
export const DeliveryPartnerCard: React.FC<DeliveryPartnerCardProps> = ({
  name,
  delivered = false,
  restaurantName,
  distanceKm,
  onCall,
  showCall = false,
}) => {
  const hasPartner = !!name && name.trim().length > 0;
  const initial = hasPartner ? name!.trim().charAt(0).toUpperCase() : '';
  const kmText =
    distanceKm != null && Number.isFinite(distanceKm)
      ? `${distanceKm.toFixed(1)} km`
      : null;

  return (
    <View style={styles.card}>
      {hasPartner ? (
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
            <View style={styles.verified}>
              <MaterialIcons name="check" size={9} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name}>
              {delivered ? `Delivered by ${name}` : `Hi, I'm ${name} 👋`}
            </Text>
            <Text style={styles.sub}>
              {delivered ? 'Thanks for ordering' : 'Your delivery partner'}
            </Text>
          </View>
          {showCall && !delivered && (
            <TouchableOpacity
              style={styles.callBtn}
              onPress={onCall}
              activeOpacity={0.85}
              testID="order-partner-call"
            >
              <MaterialIcons name="call" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.waitIcon}>
            <MaterialIcons name="person-search" size={22} color={GREEN_DEEP} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.waitTitle}>
              We'll assign a delivery partner as soon as your order is packed
            </Text>
            <Text style={styles.sub}>Usually within 2–4 minutes</Text>
          </View>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.distRow}>
        <View style={styles.shield}>
          <MaterialIcons name="verified-user" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.distText}>
          <Text style={styles.distTitle} numberOfLines={1}>
            {restaurantName} is{kmText ? ' ' : ' nearby'}
            {kmText ? <Text style={styles.km}>{kmText}</Text> : null}
            {kmText ? ' away' : ''}
          </Text>
          <Text style={styles.distSub}>From the restaurant to your location</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: GREEN_DEEP,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 19,
    color: '#FFFFFF',
  },
  verified: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: GREEN,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14.5,
    letterSpacing: 0.1,
    color: '#14181B',
  },
  sub: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#566068',
    marginTop: 1,
  },
  waitIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FFF3D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitTitle: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#14181B',
    lineHeight: 18,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#EDF0F3',
    marginVertical: 13,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  shield: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distText: {
    flex: 1,
    minWidth: 0,
  },
  distTitle: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 12.5,
    letterSpacing: 0.1,
    color: '#14181B',
  },
  km: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    color: GREEN_INK,
  },
  distSub: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#8A939B',
    marginTop: 1,
  },
});
