import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RibbonProps {
  delay: number;
  colors: [string, string];
  startX: number;
  endX: number;
  rotation: number;
  height: number;
  width: number;
  origin: 'top' | 'bottom';
  durationMs: number;
  fadeOutMs: number;
}

const Ribbon: React.FC<RibbonProps> = ({
  delay,
  colors,
  startX,
  endX,
  rotation,
  height,
  width,
  origin,
  durationMs,
  fadeOutMs,
}) => {
  const startY = origin === 'top' ? -160 : SCREEN_HEIGHT + 160;
  const translateY = useRef(new Animated.Value(startY)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const travelToY = origin === 'top' ? SCREEN_HEIGHT + 140 : -220;
    const travelMs = Math.max(300, durationMs - fadeOutMs);

    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: travelToY,
          duration: durationMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: endX,
          duration: durationMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: rotation,
          duration: durationMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(travelMs),
          Animated.timing(opacity, {
            toValue: 0,
            duration: fadeOutMs,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);

    anim.start();
    return () => {
      anim.stop();
    };
  }, [delay, durationMs, endX, fadeOutMs, opacity, origin, rotation, translateX, translateY]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.ribbon,
        {
          opacity,
          height,
          width,
          top: 0,
          left: 0,
          transform: [
            { translateX },
            { translateY },
            { rotate },
            { skewX: '6deg' },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ribbonGradient}
      />
    </Animated.View>
  );
};

interface RibbonAnimationProps {
  active?: boolean;
  origin?: 'top' | 'bottom';
  durationMs?: number;
  fadeOutMs?: number;
  density?: number;
  style?: any;
}

export const RibbonAnimation: React.FC<RibbonAnimationProps> = ({
  active = true,
  origin = 'top',
  durationMs = 1300,
  fadeOutMs = 420,
  density = 26,
  style,
}) => {
  const [visible, setVisible] = useState(false);
  const seedRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    seedRef.current += 1;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), Math.max(300, durationMs + 50));
    return () => clearTimeout(t);
  }, [active, durationMs]);

  const ribbons = useMemo(() => {
    if (!visible) return [];

    // Muted, infographic-like palette + subtle 3D shading via gradients.
    const palettes: Array<[string, string]> = [
      ['#22C55E', '#0B8F3B'], // green
      ['#06B6D4', '#046C7D'], // cyan
      ['#3B82F6', '#1D4ED8'], // blue
      ['#A855F7', '#6D28D9'], // purple
      ['#F59E0B', '#B45309'], // amber
      ['#F43F5E', '#BE123C'], // rose
    ];

    const count = Math.max(10, Math.min(60, density));
    const localSeed = seedRef.current;

    const rand = (n: number) => {
      // simple deterministic-ish PRNG based on seed + index
      const x = Math.sin((localSeed + 1) * 1000 + n * 97.13) * 10000;
      return x - Math.floor(x);
    };

    return Array.from({ length: count }, (_, i) => {
      const startX = rand(i + 1) * SCREEN_WIDTH;
      const drift = (rand(i + 2) - 0.5) * 120;
      const endX = startX + drift;
      const rotation = (rand(i + 3) - 0.5) * 240;
      const delay = rand(i + 4) * 140;

      const baseWidth = 5 + rand(i + 5) * 7; // 5-12px
      const baseHeight = 14 + rand(i + 6) * 22; // 14-36px
      const colors = palettes[i % palettes.length];

      return {
        key: `${localSeed}-${i}`,
        startX,
        endX,
        rotation,
        delay,
        height: baseHeight,
        width: baseWidth,
        colors: colors as [string, string],
      };
    });
  }, [density, visible]);

  if (!visible) return null;

  return (
    <View style={[styles.container, origin === 'bottom' && styles.containerBottom, style]} pointerEvents="none">
      {ribbons.map((ribbon) => (
        <Ribbon
          key={ribbon.key}
          delay={ribbon.delay}
          colors={ribbon.colors}
          startX={ribbon.startX}
          endX={ribbon.endX}
          rotation={ribbon.rotation}
          height={ribbon.height}
          width={ribbon.width}
          origin={origin}
          durationMs={durationMs}
          fadeOutMs={fadeOutMs}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -180,
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT + 360,
    zIndex: 999,
    overflow: 'visible',
  },
  containerBottom: {
    top: 0,
  },
  ribbon: {
    position: 'absolute',
    borderRadius: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
  },
  ribbonGradient: {
    flex: 1,
  },
});
