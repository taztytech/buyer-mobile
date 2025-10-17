import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RibbonProps {
  delay: number;
  color: string;
  endX: number;
  rotation: number;
  height: number;
  width: number;
  peakHeight: number;
}

const Ribbon: React.FC<RibbonProps> = ({ delay, color, endX, rotation, height, width, peakHeight }) => {
  // Start ribbons higher up (180px above center) to appear behind the PNG
  const startY = -180;
  const translateY = useRef(new Animated.Value(startY)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      // Fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      // Shoot up
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: startY - peakHeight,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: endX,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: rotation / 2,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // Fall down with gravity
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: rotation,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [delay, endX, rotation, peakHeight]);

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

  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT / 2;

  const ribbons = Array.from({ length: 40 }, (_, i) => {
    // Random spread in X direction (left and right from center)
    const spread = (Math.random() - 0.5) * SCREEN_WIDTH * 0.8;
    const endX = spread;

    // Random rotation
    const rotation = Math.random() * 720 - 360;

    // Staggered delays
    const delay = Math.random() * 300;

    // Random color
    const color = ribbonColors[i % ribbonColors.length];

    // Random sizes (much shorter and more varied)
    const height = 12 + Math.random() * 25; // 12-37px height (shorter)
    const width = 3 + Math.random() * 5; // 3-8px width

    // Random peak heights (how high they shoot up)
    const peakHeight = 180 + Math.random() * 220; // 180-400px

    return {
      key: i,
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ribbon: {
    position: 'absolute',
    borderRadius: 3,
  },
});
