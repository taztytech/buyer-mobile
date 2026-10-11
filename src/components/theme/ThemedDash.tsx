import React from 'react';
import { AccessibilityInfo, AppState, ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { ParticleField } from './ParticleField';
import { GarlandCanvas } from './GarlandCanvas';
import { GlyphParticles, ThemeLayers } from './ThemeLayers';
import { DashEdge, Model3D } from './ThemeExtras';
import { themeHasMotion, type ThemeColors, type ThemeConfig } from './themeTypes';

/**
 * Theme engine for the home top-dash. One UI-thread clock drives every
 * animation; it runs only while the dash is visible, the app is in front
 * and the phone has not asked to reduce motion. The background part sits
 * behind the dash content, the foreground part (garland, front layers,
 * shaped edge) on top of it.
 */

export interface ThemeEngine {
  time: SharedValue<number>;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  bursts: SharedValue<number[]>;
  running: boolean;
  burst: (x: number, y: number) => void;
}

export const useThemeEngine = (cfg: ThemeConfig, visible: boolean): ThemeEngine => {
  const time = useSharedValue(0);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const bursts = useSharedValue<number[]>([]);

  const [appActive, setAppActive] = React.useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', s => setAppActive(s === 'active'));
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const rm = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      sub.remove();
      rm.remove();
    };
  }, []);

  const hasMotion = themeHasMotion(cfg);
  const running = visible && appActive && !reduceMotion && hasMotion;

  const frame = useFrameCallback(info => {
    const dt = info.timeSincePreviousFrame ?? 16;
    time.value += Math.min(dt, 64) / 1000;
  }, false);

  React.useEffect(() => {
    frame.setActive(running);
    // A still, pleasant frame when motion is off (fireworks mid-burst, etc.).
    if (reduceMotion && hasMotion) time.value = 1.4;
  }, [running, reduceMotion, hasMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tilt parallax from the accelerometer, smoothed.
  React.useEffect(() => {
    if (!running || !cfg.interaction.tilt) {
      tiltX.value = 0;
      tiltY.value = 0;
      return;
    }
    let sx = 0;
    let sy = 0;
    Accelerometer.setUpdateInterval(50);
    const sub = Accelerometer.addListener(({ x, y }) => {
      sx = sx * 0.82 + x * 0.18;
      sy = sy * 0.82 + (y + 0.6) * 0.18; // phones are held tilted back
      tiltX.value = Math.max(-1, Math.min(1, -sx * 2));
      tiltY.value = Math.max(-1, Math.min(1, sy * 2));
    });
    return () => sub.remove();
  }, [running, cfg.interaction.tilt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Optional burst sound, loaded once per theme.
  const soundRef = React.useRef<Audio.Sound | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    const url = cfg.interaction.soundUrl;
    if (!url || !cfg.interaction.tapBurst) return;
    Audio.Sound.createAsync({ uri: url }, { volume: 0.6 })
      .then(({ sound }) => {
        if (cancelled) sound.unloadAsync();
        else soundRef.current = sound;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    };
  }, [cfg.interaction.soundUrl, cfg.interaction.tapBurst]);

  const burst = React.useCallback(
    (x: number, y: number) => {
      if (!cfg.interaction.tapBurst) return;
      const keep = bursts.value.slice(-15); // last 5 bursts
      bursts.value = [...keep, x, y, time.value];
      if (cfg.interaction.haptic) {
        Haptics.impactAsync(
          cfg.interaction.burst === 'cracker' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light,
        ).catch(() => undefined);
      }
      soundRef.current?.replayAsync().catch(() => undefined);
    },
    [cfg.interaction.tapBurst, cfg.interaction.haptic, cfg.interaction.burst], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { time, tiltX, tiltY, bursts, running, burst };
};

/* ------------------------------- background ------------------------------- */

const gradientPoints = (dir: ThemeColors['dashDirection']) =>
  dir === 'horizontal'
    ? { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } }
    : dir === 'diagonal'
      ? { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }
      : { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };

export const ThemedDashBackground: React.FC<{
  cfg: ThemeConfig;
  colors: ThemeColors;
  engine: ThemeEngine;
  width: number;
  height: number;
}> = ({ cfg, colors, engine, width, height }) => {
  const { start, end } = gradientPoints(colors.dashDirection);
  const stops = colors.dashVia ? [colors.dashFrom, colors.dashVia, colors.dashTo] : [colors.dashFrom, colors.dashTo];
  const glyphMode = cfg.particles.glyphs.length > 0;
  const parallax = cfg.background.parallax;

  const bgStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: engine.tiltX.value * parallax * 10 },
      { translateY: engine.tiltY.value * parallax * 6 },
      { scale: 1.06 },
    ],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <LinearGradient colors={stops as any} start={start} end={end} style={StyleSheet.absoluteFill} />

      {!!cfg.background.imageUrl && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: cfg.background.opacity }, bgStyle]} pointerEvents="none">
          <ImageBackground
            source={{ uri: cfg.background.imageUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode={cfg.background.repeat ? 'repeat' : 'cover'}
          />
        </Animated.View>
      )}

      {/* Tap empty space on the dash for a burst (content above takes its own taps). */}
      {cfg.interaction.tapBurst && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={e => engine.burst(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          testID="theme-tap-area"
        />
      )}

      <ThemeLayers
        layers={cfg.layers.filter(l => !l.front)}
        width={width}
        height={height}
        active={engine.running}
        time={engine.time}
        tiltX={engine.tiltX}
        tiltY={engine.tiltY}
      />

      <ParticleField
        width={width}
        height={height}
        time={engine.time}
        bursts={engine.bursts}
        burstPreset={cfg.interaction.burst}
        preset={glyphMode && (cfg.particles.preset === 'leaves' || cfg.particles.preset === 'petals') ? 'none' : cfg.particles.preset}
        density={cfg.particles.density}
        speed={cfg.particles.speed}
        size={cfg.particles.size}
        wind={cfg.particles.wind}
        colors={cfg.particles.colors}
        tiltX={engine.tiltX}
        tiltY={engine.tiltY}
      />

      {glyphMode && (
        <GlyphParticles
          glyphs={cfg.particles.glyphs}
          density={cfg.particles.density}
          speed={cfg.particles.speed}
          size={cfg.particles.size}
          wind={cfg.particles.wind}
          width={width}
          height={height}
          time={engine.time}
          tiltX={engine.tiltX}
          tiltY={engine.tiltY}
        />
      )}

      {!!cfg.model3d.url && (
        <Model3D
          url={cfg.model3d.url}
          x={cfg.model3d.x}
          y={cfg.model3d.y}
          size={cfg.model3d.size}
          autoRotate={cfg.model3d.autoRotate}
          rotateSpeed={cfg.model3d.rotateSpeed}
          width={width}
          height={height}
          active={engine.running}
        />
      )}
    </View>
  );
};

/* ------------------------------- foreground ------------------------------- */

export const ThemedDashForeground: React.FC<{
  cfg: ThemeConfig;
  engine: ThemeEngine;
  width: number;
  height: number;
  /** Status-bar height: the garland hangs just below it. */
  topInset: number;
  pageColor: string;
}> = ({ cfg, engine, width, height, topInset, pageColor }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <ThemeLayers
      layers={cfg.layers.filter(l => l.front)}
      width={width}
      height={height}
      active={engine.running}
      time={engine.time}
      tiltX={engine.tiltX}
      tiltY={engine.tiltY}
    />
    <GarlandCanvas
      width={width}
      top={Math.max(0, topInset - 6)}
      preset={cfg.garland.preset}
      colors={cfg.garland.colors}
      sway={cfg.garland.sway}
      time={engine.time}
    />
    <DashEdge preset={cfg.edge.preset} size={cfg.edge.size} width={width} pageColor={pageColor} />
  </View>
);
