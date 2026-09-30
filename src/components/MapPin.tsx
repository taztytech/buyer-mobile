import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, Easing, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface MapPinProps {
  /** Admin-configurable pin icon URL; falls back to the default marker. */
  iconUrl?: string | null;
  size?: number;
  color?: string;
}

/**
 * The location-picker pin: a gently bobbing marker with a pulsing ground
 * shadow, so the map feels alive as you move it. The icon can be set from the
 * admin panel (MAP_PIN_ICON_URL); otherwise a default green marker is used.
 */
export const MapPin: React.FC<MapPinProps> = ({ iconUrl, size = 46, color = '#00B14F' }) => {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const shadowScale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] });
  const shadowOpacity = bob.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.14] });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={{ transform: [{ translateY }] }}>
        {iconUrl ? (
          // Taller box so 3D landmark pins (Eiffel Tower, Burj Khalifa, etc.)
          // render upright and un-squished; the image is bottom-anchored.
          <Image
            source={{ uri: iconUrl }}
            style={{ width: Math.round(size * 1.05), height: Math.round(size * 1.5) }}
            resizeMode="contain"
          />
        ) : (
          <MaterialIcons name="location-on" size={size} color={color} />
        )}
      </Animated.View>
      <Animated.View
        style={[styles.shadow, { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  shadow: {
    width: 18,
    height: 6,
    borderRadius: 9,
    backgroundColor: '#000000',
    marginTop: 1,
  },
});
