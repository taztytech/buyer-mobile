import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type CouponBurstAnimationProps = {
  active: boolean;
  width: number;
  height: number;
  /** Animation mode. `fall` runs top→bottom across full page. */
  mode?: 'burst' | 'fall' | 'ribbons';
  /** Where particles originate (px from bottom). */
  originBottomOffset?: number;
  /** Total run time. */
  durationMs?: number;
};

type ParticleKind = 'sparkle' | 'star' | 'ribbon';

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
  /** Ribbons: additional motion/styling parameters */
  ribbonHue?: number;
  waveAmpX?: number;
  waveAmpRot?: number;
  wavePhase?: number;
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
    // Keep mounted long enough to cover per-particle delay + fade.
    // (Otherwise, late-emitting particles can vanish mid-flight.)
    const extraHoldMs = mode === 'ribbons' ? 520 : 220;
    const t = setTimeout(() => setVisible(false), durationMs + extraHoldMs);
    return () => clearTimeout(t);
  }, [active, durationMs, mode]);

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
      mode === 'fall'
        ? clamp(Math.round(width / 22), 18, 34)
        : mode === 'ribbons'
          ? clamp(Math.round(width / 44), 14, 22)
          : clamp(Math.round(width / 34), 10, 18);

    return Array.from({ length: total }, (_, i) => {
      const isRibbonMode = mode === 'ribbons';

      // In ribbon mode, bias emission toward center so it feels anchored to bottom nav area.
      const centerBias = isRibbonMode ? 0.6 + (rand(i + 1) - 0.5) * 0.9 : 1;
      const x = clamp(rand(i + 1) * width * centerBias + width * (1 - centerBias) * 0.5, 0, width);

      // Wider lateral motion for ribbons/stars; subtle drift for sparkles/fall.
      const driftX = (rand(i + 2) - 0.5) * (width * (isRibbonMode ? 0.46 : 0.28));
      const rotateDeg = (rand(i + 3) - 0.5) * 120;
      const delayMs = rand(i + 4) * (isRibbonMode ? 180 : 140);

      // Burst: peakY is negative (upward) relative to origin.
      // Fall: peakY is used as the end Y distance (downward).
      const peakY =
        mode === 'fall'
          ? (0.9 + rand(i + 5) * 0.35) * height
          : mode === 'ribbons'
            ? -((0.62 + rand(i + 5) * 0.22) * height) // reach close to top area
            : -((0.38 + rand(i + 5) * 0.28) * height);

      const size = mode === 'fall' ? 4 + rand(i + 6) * 7 : 6 + rand(i + 6) * 8;
      const sparkleColor = sparkleColors[i % sparkleColors.length];
      const glowOpacity = mode === 'fall' ? 0.05 + rand(i + 7) * 0.1 : 0.08 + rand(i + 7) * 0.12;

      // In ribbon mode, interleave ribbons and stars for density.
      let kind: ParticleKind = 'sparkle';
      if (mode === 'ribbons') {
        // Rough ratio: ~35% ribbons, ~65% stars
        kind = rand(i + 10) < 0.35 ? 'ribbon' : 'star';
      }

      return {
        key: `${seed}-p-${i}`,
        kind,
        x,
        sizeW:
          kind === 'ribbon'
            ? 7 + rand(i + 20) * 8 // 7-15
            : kind === 'star'
              ? 5 + rand(i + 21) * 8 // 5-13
              : size,
        sizeH:
          kind === 'ribbon'
            ? 54 + rand(i + 22) * 56 // 54-110
            : kind === 'star'
              ? 5 + rand(i + 23) * 8
              : size,
        rotateDeg,
        delayMs,
        peakY,
        driftX,
        sparkleColor,
        glowOpacity,
        ribbonHue: kind === 'ribbon' ? Math.round(rand(i + 30) * 360) : undefined,
        waveAmpX: kind === 'ribbon' ? 16 + rand(i + 31) * 26 : 10 + rand(i + 31) * 18,
        waveAmpRot: kind === 'ribbon' ? 14 + rand(i + 32) * 18 : 10 + rand(i + 32) * 14,
        wavePhase: rand(i + 33) * Math.PI * 2,
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
  mode: 'burst' | 'fall' | 'ribbons';
}> = ({ cfg, originY, durationMs, mode }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const twinkle = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    translateY.setValue(0);
    translateX.setValue(0);
    opacity.setValue(1);
    scale.setValue(0.85);
    twinkle.setValue(0);
    wiggle.setValue(0);

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
    const isRibbons = mode === 'ribbons';

    // Add a subtle oscillation so ribbons feel alive and not “linear”.
    const wiggleAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggle, {
          toValue: 1,
          duration: 220,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(wiggle, {
          toValue: 0,
          duration: 220,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
      ,
      // Important: this must eventually finish, otherwise it will block the sequence.
      { iterations: 8 }
    );

    const waveX = cfg.waveAmpX ?? 18;
    const waveRot = cfg.waveAmpRot ?? 14;

    const waveSequence = (duration: number, intensity: number) =>
      Animated.sequence([
        // 2–3 smooth arcs (S-curve-ish), not a straight drift.
        Animated.timing(translateX, {
          toValue: cfg.driftX + waveX * 0.9 * intensity,
          duration: Math.max(80, Math.round(duration * 0.18)),
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: cfg.driftX - waveX * 0.6 * intensity,
          duration: Math.max(80, Math.round(duration * 0.22)),
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: cfg.driftX + waveX * 0.45 * intensity,
          duration: Math.max(80, Math.round(duration * 0.20)),
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: cfg.driftX,
          duration: Math.max(80, Math.round(duration * 0.40)),
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]);

    // Start flutter immediately, but don't block the main sequence.
    if (isRibbons) {
      wiggleAnim.start();
    }

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
              isRibbons ? waveSequence(upMs, 1) : Animated.timing(translateX, { toValue: cfg.driftX, duration: upMs, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.sequence([
                Animated.timing(scale, {
                  toValue: isRibbons ? 1.12 : 1.18,
                  duration: Math.max(140, Math.round(upMs * 0.6)),
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }),
                Animated.timing(scale, {
                  toValue: isRibbons ? 0.98 : 0.96,
                  duration: Math.max(120, Math.round(upMs * 0.4)),
                  easing: Easing.inOut(Easing.quad),
                  useNativeDriver: true,
                }),
              ]),
              twinkleAnim,
            ]),
            // Fall back down to bottom first...
            Animated.parallel([
              Animated.timing(translateY, {
                toValue: isRibbons ? 18 : 12, // come back down past origin slightly
                duration: downMs,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              isRibbons ? waveSequence(downMs, 0.6) : Animated.timing(translateX, { toValue: cfg.driftX * 0.35, duration: downMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
              Animated.timing(scale, {
                toValue: isRibbons ? 0.86 : 0.82,
                duration: downMs,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              // Fade out gradually while coming down, and only reach 0 at the bottom.
              Animated.timing(opacity, {
                toValue: 0,
                duration: downMs,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
          ]);

    anim.start();
    return () => {
      anim.stop();
      twinkleAnim.stop();
      wiggleAnim.stop();
    };
  }, [cfg.delayMs, cfg.driftX, cfg.peakY, cfg.waveAmpRot, cfg.waveAmpX, durationMs, mode, opacity, scale, translateX, translateY, twinkle, wiggle]);

  const left = clamp(cfg.x - cfg.sizeW / 2, 0, 9999);
  const top = originY;

  const isRibbon = cfg.kind === 'ribbon';
  const isStar = cfg.kind === 'star';

  const waveRot = cfg.waveAmpRot ?? (isRibbon ? 16 : 12);
  const rotateWiggle = wiggle.interpolate({
    inputRange: [0, 1],
    outputRange: [`${-waveRot}deg`, `${waveRot}deg`],
  });

  const ribbonTilt = `${cfg.rotateDeg}deg`;

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
            { rotate: isRibbon ? rotateWiggle : ribbonTilt },
            { scale },
          ],
        },
      ]}
    >
      {isRibbon ? (
        <Ribbon
          width={cfg.sizeW}
          height={cfg.sizeH}
          hue={cfg.ribbonHue ?? 128}
          glowOpacity={cfg.glowOpacity}
          wiggle={wiggle}
          waveRot={waveRot}
        />
      ) : isStar ? (
        <Star color={cfg.sparkleColor} glowOpacity={cfg.glowOpacity} />
      ) : (
        <Star color={cfg.sparkleColor} glowOpacity={cfg.glowOpacity} />
      )}
    </Animated.View>
  );
};

const Ribbon: React.FC<{
  width: number;
  height: number;
  hue: number;
  glowOpacity: number;
  wiggle: Animated.Value;
  waveRot: number;
}> = ({
  width,
  height,
  hue,
  glowOpacity,
  wiggle,
  waveRot,
}) => {
  // Use HSL-ish palette via fixed gradient choices (RN doesn't accept hsl everywhere consistently).
  // Map hue into a few pleasing ribbon gradients.
  const gradients = [
    ['#22C55E', '#86EFAC', '#16A34A'], // green
    ['#F97316', '#FDBA74', '#EA580C'], // orange
    ['#3B82F6', '#93C5FD', '#2563EB'], // blue
    ['#A855F7', '#D8B4FE', '#7C3AED'], // purple
    ['#F43F5E', '#FDA4AF', '#E11D48'], // rose
    ['#FACC15', '#FEF08A', '#EAB308'], // yellow
  ];
  const g = gradients[hue % gradients.length];

  // Build a “segmented” ribbon so it looks like it bends in air:
  // 3 segments with slight phase offsets and different rotations.
  const segH = Math.max(16, Math.round(height / 3));
  const segGap = Math.max(2, Math.round(segH * 0.08));

  const segRot = (mult: number) =>
    wiggle.interpolate({
      inputRange: [0, 1],
      outputRange: [`${-waveRot * mult}deg`, `${waveRot * mult}deg`],
    });

  const segX = (mult: number) =>
    wiggle.interpolate({
      inputRange: [0, 1],
      outputRange: [-Math.max(2, Math.round(width * 0.25)) * mult, Math.max(2, Math.round(width * 0.25)) * mult],
    });

  return (
    <View style={[styles.ribbonWrap, { shadowOpacity: glowOpacity * 1.8 }]}>
      <View style={{ width, height }}>
        {[0, 1, 2].map((segIdx) => {
          const top = segIdx * segH - Math.round(segIdx * segGap);
          const rot = segRot(segIdx === 1 ? 0.7 : segIdx === 0 ? 0.5 : 0.9);
          const tx = segX(segIdx === 1 ? 0.55 : segIdx === 0 ? 0.35 : 0.7);

          return (
            <Animated.View
              // eslint-disable-next-line react/no-array-index-key
              key={`seg-${segIdx}`}
              style={[
                styles.ribbonSeg,
                {
                  top,
                  width,
                  height: segH,
                  borderRadius: Math.max(6, Math.round(width * 0.9)),
                  transform: [{ translateX: tx }, { rotate: rot }, { skewX: segIdx === 1 ? '-10deg' : '-14deg' }],
                },
              ]}
            >
              <LinearGradient
                colors={g}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.ribbonFill, { borderRadius: Math.max(6, Math.round(width * 0.9)) }]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.ribbonHighlight,
                  {
                    left: Math.max(1, Math.round(width * 0.18)),
                    width: Math.max(2, Math.round(width * 0.26)),
                    height: Math.max(10, Math.round(segH * 0.92)),
                    borderRadius: 999,
                  },
                ]}
              />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
};

const Star: React.FC<{ color: string; glowOpacity: number }> = ({ color, glowOpacity }) => {
  return (
    <View style={[styles.sparkleWrap, { shadowOpacity: glowOpacity }]}>
      {/* 4-point sparkle: two crossing lines + subtle secondary cross */}
      <View style={[styles.sparkleLine, { backgroundColor: color }]} />
      <View style={[styles.sparkleLine, styles.sparkleLineVertical, { backgroundColor: color }]} />
      <View style={[styles.sparkleLine, styles.sparkleLineThin, styles.sparkleLineDiag45, { backgroundColor: color }]} />
      <View style={[styles.sparkleLine, styles.sparkleLineThin, styles.sparkleLineDiag135, { backgroundColor: color }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
    // Keep low so callers can layer above (e.g. modal card).
    zIndex: 0,
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
  ribbonWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    elevation: 0,
  },
  ribbonSeg: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
    opacity: 0.95,
  },
  ribbonFill: {
    width: '100%',
    height: '100%',
  },
  ribbon: {
    overflow: 'hidden',
    opacity: 0.95,
    transform: [{ rotate: '8deg' }, { skewX: '-12deg' }],
  },
  ribbonHighlight: {
    position: 'absolute',
    top: 2,
    backgroundColor: 'rgba(255,255,255,0.30)',
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

