import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { OptimizedImage } from '@/components/OptimizedImage';
import type { ThemeLayer } from './themeTypes';

/**
 * Decor layers on the themed dash: emoji sprites, images and Lottie
 * animations, each with a gentle motion and a parallax shift from phone
 * tilt (deeper layers move less). Plus falling emoji particles (leaves,
 * petals, …) when a theme uses glyphs.
 */

interface Clock {
  time: SharedValue<number>;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
}

function mod(a: number, m: number) {
  'worklet';
  return ((a % m) + m) % m;
}

function rnd(n: number) {
  'worklet';
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const LayerItem: React.FC<
  Clock & { layer: ThemeLayer; width: number; height: number; index: number; active: boolean }
> = ({ layer, width, height, index, time, tiltX, tiltY, active }) => {
  const size = Math.max(8, layer.w * width);
  const left = layer.x * width - size / 2;
  const top = layer.y * height - size / 2;
  const lottieRef = React.useRef<LottieView>(null);

  // Replay a play-once Lottie every N seconds.
  React.useEffect(() => {
    if (layer.type !== 'lottie' || layer.loop || !layer.every || !active) return;
    const id = setInterval(() => lottieRef.current?.play(), layer.every * 1000);
    return () => clearInterval(id);
  }, [layer.type, layer.loop, layer.every, active]);

  React.useEffect(() => {
    if (layer.type !== 'lottie') return;
    if (active) lottieRef.current?.resume?.();
    else lottieRef.current?.pause?.();
  }, [active, layer.type]);

  const motion = layer.motion;
  const speed = layer.speed || 1;
  const depth = layer.depth;
  const every = layer.every > 0 ? layer.every : 12;
  const phase = index * 1.7;
  const baseOpacity = layer.opacity;

  const style = useAnimatedStyle(() => {
    const t = time.value;
    let tx = tiltX.value * depth * 14;
    let ty = tiltY.value * depth * 8;
    let rotate = 0;
    let scale = 1;
    let opacity = baseOpacity;
    if (motion === 'float') ty += Math.sin(t * 1.2 * speed + phase) * 4;
    else if (motion === 'sway') rotate = Math.sin(t * 1.5 * speed + phase) * 8;
    else if (motion === 'spin') rotate = (t * 30 * speed) % 360;
    else if (motion === 'pulse') {
      const s = Math.sin(t * 2.4 * speed + phase);
      scale = 1 + 0.07 * s;
      opacity = baseOpacity * (0.8 + 0.2 * (s + 1) / 2);
    } else if (motion === 'flyby') {
      const flight = 3.2 / speed;
      const p = mod(t + phase, every) / flight;
      if (p > 1) opacity = 0;
      else {
        // across the dash on a gentle arc, from off the left edge
        tx = -left - size + p * (width + size * 2);
        ty += -Math.sin(p * Math.PI) * 18;
        rotate = -6 + p * 12;
      }
    }
    return {
      opacity,
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${rotate}deg` }, { scale }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.layer, { left, top, width: size, height: size }, style]}
    >
      {layer.type === 'emoji' ? (
        <Text style={{ fontSize: size * 0.82, lineHeight: size, textAlign: 'center' }} allowFontScaling={false}>
          {layer.src}
        </Text>
      ) : layer.type === 'image' ? (
        <OptimizedImage
          source={layer.src}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          showShimmer={false}
          cachePolicy="memory-disk"
        />
      ) : (
        <LottieView
          ref={lottieRef}
          source={{ uri: layer.src }}
          autoPlay={active}
          loop={layer.loop}
          speed={speed}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      )}
    </Animated.View>
  );
};

export const ThemeLayers: React.FC<
  Clock & { layers: ThemeLayer[]; width: number; height: number; active: boolean }
> = ({ layers, width, height, ...clock }) => {
  if (!layers.length || width <= 0 || height <= 0) return null;
  return (
    <>
      {layers.map((l, i) => (
        <LayerItem key={`${l.id}-${i}`} layer={l} index={i} width={width} height={height} {...clock} />
      ))}
    </>
  );
};

/* ------------------------- falling emoji particles ------------------------- */

const GlyphItem: React.FC<
  Clock & {
    glyph: string;
    i: number;
    width: number;
    height: number;
    speedMul: number;
    sizeMul: number;
    wind: number;
  }
> = ({ glyph, i, width, height, speedMul, sizeMul, wind, time, tiltX }) => {
  const r0 = rnd(i + 1);
  const r1 = rnd(i * 7 + 3);
  const r2 = rnd(i * 13 + 5);
  const fs = (11 + r2 * 9) * sizeMul;
  const style = useAnimatedStyle(() => {
    const t = time.value;
    const v = (20 + r1 * 24) * speedMul;
    const y = mod(r0 * (height + 30) + t * v, height + 30) - 15;
    const x = mod(r1 * width + Math.sin(t * 1.1 + i) * 16 + wind * t * 24, width) + tiltX.value * 8;
    return {
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${(t * 70 + i * 47) % 360}deg` }],
    };
  });
  return (
    <Animated.Text
      allowFontScaling={false}
      pointerEvents="none"
      style={[styles.glyph, { fontSize: fs, opacity: 0.75 + r2 * 0.25 }, style]}
    >
      {glyph}
    </Animated.Text>
  );
};

export const GlyphParticles: React.FC<
  Clock & {
    glyphs: string[];
    density: number;
    speed: number;
    size: number;
    wind: number;
    width: number;
    height: number;
  }
> = ({ glyphs, density, speed, size, wind, width, height, ...clock }) => {
  if (!glyphs.length || width <= 0) return null;
  const count = Math.round(6 + density * 16);
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <GlyphItem
          key={i}
          glyph={glyphs[i % glyphs.length]}
          i={i}
          width={width}
          height={height}
          speedMul={speed}
          sizeMul={size}
          wind={wind}
          {...clock}
        />
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  layer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  glyph: { position: 'absolute', left: 0, top: 0 },
});
