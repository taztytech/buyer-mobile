/**
 * OrderDeliveredOverlay
 * Full-screen "Your order has been delivered" view with smooth animations.
 * Shown when order status becomes delivered while in PiP tracking; user taps Done to close.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OrderDeliveredOverlayProps {
  onDone: () => void;
  restaurantName?: string;
  orderNumber?: string;
  /** Auto-call onDone after this many ms; 0 = no auto-close */
  autoCloseMs?: number;
}

export const OrderDeliveredOverlay: React.FC<OrderDeliveredOverlayProps> = ({
  onDone,
  restaurantName,
  orderNumber,
  autoCloseMs = 4500,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = 320;
    const delay = 120;

    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: duration + 80,
        useNativeDriver: true,
      }),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: duration,
        useNativeDriver: true,
        delay: delay,
      }),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: duration,
        useNativeDriver: true,
        delay: delay,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, titleOpacity, subtitleOpacity, buttonOpacity]);

  useEffect(() => {
    if (autoCloseMs <= 0) return;
    const t = setTimeout(onDone, autoCloseMs);
    return () => clearTimeout(t);
  }, [autoCloseMs, onDone]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.iconWrap,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <MaterialIcons name="check-circle" size={72} color={colors.primaryLight} />
      </Animated.View>

      <Animated.Text style={[styles.title, { opacity: titleOpacity }]}>
        Your order has been delivered
      </Animated.Text>

      {(restaurantName || orderNumber) && (
        <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
          {[restaurantName, orderNumber].filter(Boolean).join(' · ')}
        </Animated.Text>
      )}

      <Animated.View style={{ opacity: buttonOpacity }}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={onDone}
          activeOpacity={0.85}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a1a0f',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 1100,
    elevation: 11,
  },
  iconWrap: {
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: Math.min(22, SCREEN_WIDTH * 0.058),
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  doneButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  doneButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});

export default OrderDeliveredOverlay;
