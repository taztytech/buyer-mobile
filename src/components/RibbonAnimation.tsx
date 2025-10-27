import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, Easing } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RibbonProps {
  delay: number;
  color: string;
  startX: number;
  endX: number;
  rotation: number;
  height: number;
  width: number;
  peakHeight: number;
}

const Ribbon: React.FC<RibbonProps> = ({ delay, color, startX, endX, rotation, height, width, peakHeight }) => {
  // Start ribbons from ABOVE the screen (negative Y position)
  const startY = -200; // Start well above the screen top
  const translateY = useRef(new Animated.Value(startY)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current; // Start fully visible

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      // Fall down from top to bottom
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT + 200, // Go past the bottom
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: endX,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: rotation,
          duration: 3000,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [delay, startX, endX, rotation, peakHeight]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.ribbon,
        {
          backgroundColor: color,
          opacity,
          height,
          width,
          top: 0,
          left: 0,
          transform: [
            { translateX },
            { translateY },
            { rotate },
          ],
        },
      ]}
    />
  );
};

interface RibbonAnimationProps {
  active?: boolean;
}

export const RibbonAnimation: React.FC<RibbonAnimationProps> = ({ active = true }) => {
  if (!active) return null;

  const ribbonColors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#F8B739', // Orange
    '#85C1E2', // Sky Blue
    '#F06292', // Pink
    '#AED581', // Light Green
    '#FFD54F', // Amber
  ];

  const ribbons = Array.from({ length: 80 }, (_, i) => {
    // Random starting X position across the full screen width
    const startX = Math.random() * SCREEN_WIDTH;

    // Random ending X position with slight drift
    const drift = (Math.random() - 0.5) * 150; // -75 to +75 pixels drift
    const endX = startX + drift;

    // Random rotation
    const rotation = Math.random() * 1080 - 540; // More rotation variation

    // Staggered delays - minimal delay for immediate start
    const delay = Math.random() * 200;

    // Random color
    const color = ribbonColors[i % ribbonColors.length];

    // Random sizes - varied ribbon dimensions
    const height = 15 + Math.random() * 30; // 15-45px height
    const width = 4 + Math.random() * 6; // 4-10px width

    // Random peak heights (not used in fall animation but kept for compatibility)
    const peakHeight = 180 + Math.random() * 220; // 180-400px

    return {
      key: i,
      startX,
      endX,
      rotation,
      delay,
      color,
      height,
      width,
      peakHeight,
    };
  });

  return (
    <View style={styles.container} pointerEvents="none">
      {ribbons.map((ribbon) => (
        <Ribbon
          key={ribbon.key}
          delay={ribbon.delay}
          color={ribbon.color}
          startX={ribbon.startX}
          endX={ribbon.endX}
          rotation={ribbon.rotation}
          height={ribbon.height}
          width={ribbon.width}
          peakHeight={ribbon.peakHeight}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -200, // Extend above screen to allow ribbons to start from above
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT + 400, // Extra height to accommodate starting position
    zIndex: 999,
    overflow: 'visible',
  },
  ribbon: {
    position: 'absolute',
    borderRadius: 3,
  },
});
