import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, StatusBar, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width: W } = Dimensions.get('window');

const GREEN = '#00B14F';
const INK = '#0A0A0A';
const SUBTLE = '#6B6B6B';

interface OrderPlacedScreenProps {
  /** Address label shown as "Delivering to {label}" (e.g. "Work", "Home"). */
  deliveryLabel?: string;
  /** Full address line under the title. */
  address?: string;
  /** Fired once the celebration finishes and the app should reveal the order page. */
  onDone: () => void;
}

/**
 * Full-screen "Order Placed" celebration shown the moment an order is created,
 * replacing the old inline popup. Light theme (white canvas, brand-green disc,
 * white tick) to match the rest of the app. Runs ~2.3s, fades itself out, then
 * calls onDone — the order details page is already mounted underneath.
 *
 * Uses the built-in Animated API + vector icon (no Lottie/Reanimated installed).
 */
export const OrderPlacedScreen: React.FC<OrderPlacedScreenProps> = ({
  deliveryLabel,
  address,
  onDone,
}) => {
  const root = useRef(new Animated.Value(0)).current;    // container fade
  const disc = useRef(new Animated.Value(0)).current;     // green circle spring
  const tick = useRef(new Animated.Value(0)).current;     // checkmark pop
  const ring = useRef(new Animated.Value(0)).current;     // expanding halo
  const title = useRef(new Animated.Value(0)).current;    // "ORDER PLACED"
  const addr = useRef(new Animated.Value(0)).current;     // delivering-to block

  const finishedRef = useRef(false);
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onDone();
  };

  useEffect(() => {
    Animated.sequence([
      Animated.timing(root, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(disc, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
        Animated.timing(ring, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(tick, { toValue: 1, friction: 4, tension: 110, useNativeDriver: true }),
      Animated.timing(title, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(addr, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(650),
      Animated.timing(root, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(finish);

    // Backstop so a dropped animation frame can never strand the user here.
    const t = setTimeout(finish, 4000);
    return () => clearTimeout(t);
  }, []);

  const discScale = disc.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const tickScale = tick.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.4] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.18, 0] });
  const titleY = title.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const addrY = addr.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View style={[styles.container, { opacity: root }]}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />

      <View style={styles.center}>
        {/* Expanding halo behind the disc */}
        <Animated.View
          style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
          pointerEvents="none"
        />
        {/* Green disc + white tick */}
        <Animated.View style={[styles.disc, { transform: [{ scale: discScale }] }]}>
          <Animated.View style={{ transform: [{ scale: tickScale }] }}>
            <MaterialIcons name="check" size={68} color="#FFFFFF" />
          </Animated.View>
        </Animated.View>

        <Animated.Text
          style={[styles.placed, { opacity: title, transform: [{ translateY: titleY }] }]}
        >
          ORDER PLACED
        </Animated.Text>

        {(deliveryLabel || address) ? (
          <Animated.View style={{ opacity: addr, transform: [{ translateY: addrY }] }}>
            {deliveryLabel ? (
              <Text style={styles.deliverTo}>Delivering to {deliveryLabel}</Text>
            ) : null}
            {address ? (
              <Text style={styles.address} numberOfLines={2}>
                {address}
              </Text>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
};

const DISC = 132;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 10000,
    elevation: 10000,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  ring: {
    position: 'absolute',
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: GREEN,
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  placed: {
    marginTop: 28,
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: 2.5,
    color: INK,
  },
  deliverTo: {
    marginTop: 26,
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 22,
    letterSpacing: 0.2,
    color: INK,
    textAlign: 'center',
  },
  address: {
    marginTop: 8,
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 14,
    letterSpacing: 0.1,
    lineHeight: 21,
    color: SUBTLE,
    textAlign: 'center',
    maxWidth: W - 72,
  },
});

export default OrderPlacedScreen;
