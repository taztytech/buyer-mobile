import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface OrderProgressBarProps {
  /** 0..1 fill fraction for the current order stage. */
  progress: number;
  /** Short stage label shown at the right (e.g. "Preparing", "On the way"). */
  label: string;
}

const GREEN = '#00B14F';
const GREEN_INK = '#0A6B36';
const TRACK = '#EDF0F3';
const BIKE = 26;

/**
 * The order progress strip: a green fill with a bike badge riding on the line
 * at the fill tip, and a stage label. The bike slides forward as the order
 * advances and gently leans while riding.
 */
export const OrderProgressBar: React.FC<OrderProgressBarProps> = ({
  progress,
  label,
}) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const pct = Math.max(0, Math.min(1, progress || 0));
  const lean = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lean, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(lean, {
          toValue: 0,
          duration: 550,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [lean]);

  const rotate = lean.interpolate({
    inputRange: [0, 1],
    outputRange: ['-3deg', '2deg'],
  });

  const bikeLeft = Math.max(0, trackWidth * pct - BIKE / 2);

  return (
    <View style={styles.row}>
      <View
        style={styles.track}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        {trackWidth > 0 && (
          <Animated.View
            style={[styles.bike, { left: bikeLeft, transform: [{ rotate }] }]}
          >
            <MaterialIcons name="delivery-dining" size={15} color="#FFFFFF" />
          </Animated.View>
        )}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: TRACK,
    marginRight: 12,
    justifyContent: 'center',
  },
  fill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: GREEN,
  },
  bike: {
    position: 'absolute',
    top: '50%',
    marginTop: -BIKE / 2,
    width: BIKE,
    height: BIKE,
    borderRadius: BIKE / 2,
    backgroundColor: GREEN,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.1,
    color: GREEN_INK,
  },
});
