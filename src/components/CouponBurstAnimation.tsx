import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';

type CouponBurstAnimationProps = {
  active: boolean;
  width: number;
  height: number;
  /** Animation mode. `fall` runs top→bottom across full page. */
  mode?: 'burst' | 'fall';
  /** Where particles originate (px from bottom). */
  originBottomOffset?: number;
  /** Total run time. */
  durationMs?: number;
};

type ParticleKind = 'sparkle';

type ParticleConfig = {
  key: string;
  kind: ParticleKind;
  x: number;
  sizeW: number;
  sizeH: number;
  rotateDeg: number;
  delayMs: number;
  peakY: number;
  driftX: number;
  sparkleColor: string;
  glowOpacity: number;
};

const DEFAULT_DURATION = 1200;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export const CouponBurstAnimation: React.FC<CouponBurstAnimationProps> = ({
  active,
  width,
  height,
  mode = 'burst',
  originBottomOffset = 32,
  durationMs = DEFAULT_DURATION,
}) => {
  const [visible, setVisible] = useState(false);
  const seedRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    seedRef.current += 1;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), durationMs + 80);
    return () => clearTimeout(t);
  }, [active, durationMs]);

  const particles = useMemo<ParticleConfig[]>(() => {
    if (!visible) return [];

    const seed = seedRef.current;
    const rand = (n: number) => {
      const x = Math.sin((seed + 1) * 999 + n * 97.13) * 10000;
      return x - Math.floor(x);
    };

    // Sparkle palette: mostly warm/white with a few cool accents.
    const sparkleColors = ['#FFFFFF', '#FDE68A', '#DCFCE7', '#E0F2FE', '#FEF9C3'];

    // Keep subtle so it doesn't overwhelm the UI.
    const total =
      mode === 'fall' ? clamp(Math.round(width / 22), 18, 34) : clamp(Math.round(width / 34), 10, 18);

    return Array.from({ length: total }, (_, i) => {
      const x = rand(i + 1) * width;
      const driftX = (rand(i + 2) - 0.5) * (width * 0.28);
      const rotateDeg = (rand(i + 3) - 0.5) * 120;
      const delayMs = rand(i + 4) * 140;

      // Burst: peakY is negative (upward) relative to origin.
      // Fall: peakY is used as the end Y distance (downward).
      const peakY =
        mode === 'fall'
          ? (0.9 + rand(i + 5) * 0.35) * height
          : -((0.38 + rand(i + 5) * 0.28) * height);

      const size =
        mode === 'fall'
          ? 4 + rand(i + 6) * 7 // 4-11 (background sparkles)
          : 6 + rand(i + 6) * 8; // 6-14 (popup-sized burst)
      const sparkleColor = sparkleColors[i % sparkleColors.length];
      const glowOpacity = mode === 'fall' ? 0.05 + rand(i + 7) * 0.1 : 0.08 + rand(i + 7) * 0.12;
      return {
        key: `${seed}-p-${i}`,
        kind: 'sparkle',
        x,
        sizeW: size,
        sizeH: size,
        rotateDeg,
        delayMs,
        peakY,
        driftX,
        sparkleColor,
        glowOpacity,
      };
    });
  }, [height, mode, visible, width]);

  if (!visible) return null;

  const originY = mode === 'fall' ? -10 : height - originBottomOffset;

  return (
    <View pointerEvents="none" style={[styles.container, { width, height }]}>
      {particles.map((p, idx) => (
        <Particle
          key={p.key}
          cfg={p}
          originY={originY}
          durationMs={durationMs}
          index={idx}
          mode={mode}
        />
      ))}
    </View>
  );
};

const Particle: React.FC<{
  cfg: ParticleConfig;
  originY: number;
  durationMs: number;
  index: number;
  mode: 'burst' | 'fall';
}> = ({ cfg, originY, durationMs, index, mode }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const twinkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    translateY.setValue(0);
    translateX.setValue(0);
    opacity.setValue(1);
    scale.setValue(0.85);
    twinkle.setValue(0);

    const upMs = Math.round(durationMs * 0.46);
    const downMs = Math.round(durationMs * 0.54);

    const twinkleAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      { iterations: 3 }
    );

    const fallMs = Math.round(durationMs * 0.95);
    const anim =
      mode === 'fall'
        ? Animated.sequence([
            Animated.delay(cfg.delayMs),
            Animated.parallel([
              Animated.timing(translateY, {
                toValue: cfg.peakY,
                duration: fallMs,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(translateX, {
                toValue: cfg.driftX * 0.6,
                duration: fallMs,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.sequence([
                Animated.timing(scale, {
                  toValue: 1.05,
                  duration: Math.max(200, Math.round(fallMs * 0.35)),
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }),
                Animated.timing(scale, {
                  toValue: 0.9,
                  duration: Math.max(200, Math.round(fallMs * 0.65)),
                  easing: Easing.inOut(Easing.quad),
                  useNativeDriver: true,
                }),
              ]),
              twinkleAnim,
              Animated.sequence([
                Animated.delay(Math.max(0, fallMs - 260)),
                Animated.timing(opacity, {
                  toValue: 0,
                  duration: 240,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }),
              ]),
            ]),
          ])
        : Animated.sequence([
            Animated.delay(cfg.delayMs),
            Animated.parallel([
              Animated.timing(translateY, {
                toValue: cfg.peakY,
                duration: upMs,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(translateX, {
                toValue: cfg.driftX,
                duration: upMs,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.sequence([
                Animated.timing(scale, {
                  toValue: 1.18,
                  duration: Math.max(140, Math.round(upMs * 0.6)),
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }),
                Animated.timing(scale, {
                  toValue: 0.96,
                  duration: Math.max(120, Math.round(upMs * 0.4)),
                  easing: Easing.inOut(Easing.quad),
                  useNativeDriver: true,
                }),
              ]),
              twinkleAnim,
            ]),
            Animated.parallel([
              Animated.timing(translateY, {
                toValue: 12, // come back down past the origin slightly
                duration: downMs,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(translateX, {
                toValue: cfg.driftX * 0.35,
                duration: downMs,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(scale, {
                toValue: 0.82,
                duration: downMs,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.sequence([
                Animated.delay(Math.max(0, downMs - 260)),
                Animated.timing(opacity, {
                  toValue: 0,
                  duration: 240,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }),
              ]),
            ]),
          ]);

    anim.start();
    return () => {
      anim.stop();
      twinkleAnim.stop();
    };
  }, [cfg.delayMs, cfg.driftX, cfg.peakY, durationMs, mode, opacity, scale, translateX, translateY, twinkle]);

  const left = clamp(cfg.x - cfg.sizeW / 2, 0, 9999);
  const top = originY;

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left,
          top,
          opacity: Animated.multiply(opacity, Animated.add(0.55, Animated.multiply(twinkle, 0.45))),
          width: cfg.sizeW,
          height: cfg.sizeH,
          transform: [
            { translateX },
            { translateY },
            { rotate: `${cfg.rotateDeg}deg` },
            { scale },
          ],
        },
      ]}
    >
      <View style={[styles.sparkleWrap, { shadowOpacity: cfg.glowOpacity }]}>
        {/* 4-point sparkle: two crossing lines + subtle secondary cross */}
        <View style={[styles.sparkleLine, { backgroundColor: cfg.sparkleColor }]} />
        <View
          style={[
            styles.sparkleLine,
            styles.sparkleLineVertical,
            { backgroundColor: cfg.sparkleColor },
          ]}
        />
        <View
          style={[
            styles.sparkleLine,
            styles.sparkleLineThin,
            styles.sparkleLineDiag45,
            { backgroundColor: cfg.sparkleColor },
          ]}
        />
        <View
          style={[
            styles.sparkleLine,
            styles.sparkleLineThin,
            styles.sparkleLineDiag135,
            { backgroundColor: cfg.sparkleColor },
          ]}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
    zIndex: 50,
  },
  particle: {
    position: 'absolute',
    overflow: 'visible',
  },
  sparkleWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 0,
  },
  sparkleLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    borderRadius: 999,
  },
  sparkleLineVertical: {
    transform: [{ rotate: '90deg' }],
  },
  sparkleLineDiag45: {
    transform: [{ rotate: '45deg' }],
  },
  sparkleLineDiag135: {
    transform: [{ rotate: '-45deg' }],
  },
  sparkleLineThin: {
    height: 1,
    opacity: 0.7,
  },
});

