import React from 'react';
import { StyleSheet } from 'react-native';
import {
  BlurStyle,
  Canvas,
  PaintStyle,
  Picture,
  Skia,
  createPicture,
  type SkCanvas,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { BurstPreset, ParticlePreset } from './themeTypes';

/**
 * GPU particles for the themed top-dash, drawn by Skia in one picture per
 * frame on the UI thread. Every particle's position is a pure function of
 * time and its index (no per-frame state), so this costs no JS work and
 * never drifts. Tap bursts are drawn in the same pass.
 */

export interface ParticleOptions {
  preset: ParticlePreset;
  density: number;
  speed: number;
  size: number;
  wind: number;
  colors: string[];
}

interface Props extends ParticleOptions {
  width: number;
  height: number;
  /** Seconds since the dash started animating (UI-thread clock). */
  time: SharedValue<number>;
  /** Flat [x, y, t0, kind, …] list of recent tap bursts. */
  bursts: SharedValue<number[]>;
  burstPreset: BurstPreset;
  /** Small shift from phone tilt, -1..1 each axis. */
  tiltX?: SharedValue<number>;
  tiltY?: SharedValue<number>;
}

const DEFAULT_COLORS: Record<string, string[]> = {
  snow: ['#FFFFFF'],
  rain: ['#CFEFFF'],
  sparkles: ['#FFF6C9', '#FFFFFF'],
  confetti: ['#FFD166', '#EF476F', '#06D6A0', '#118AB2', '#FFFFFF'],
  fireworks: ['#FFD166', '#FF6B6B', '#7CF5FF', '#C77DFF', '#FFFFFF'],
  embers: ['#FFB703', '#FB8500', '#FF5E00'],
  bubbles: ['#FFFFFF'],
  lanterns: ['#FFB347', '#FF8C42'],
  stars: ['#FFF3C4', '#FFFFFF'],
  leaves: ['#E67E22', '#D35400', '#F1C40F'],
  petals: ['#FFC0CB', '#FFD1DC', '#FFFFFF'],
};

const BURST_COLORS: Record<BurstPreset, string[]> = {
  cracker: ['#FFD166', '#FF6B6B', '#FFFFFF', '#7CF5FF', '#C77DFF'],
  confetti: ['#FFD166', '#EF476F', '#06D6A0', '#118AB2'],
  snow: ['#FFFFFF', '#E6F7FF'],
  hearts: ['#FF4D6D', '#FF8FA3', '#FFFFFF'],
  petals: ['#FFC0CB', '#FFD166', '#FFFFFF'],
};

const BURST_LIFE = 1.4;

export const ParticleField: React.FC<Props> = ({
  width,
  height,
  time,
  bursts,
  burstPreset,
  preset,
  density,
  speed,
  size,
  wind,
  colors,
  tiltX,
  tiltY,
}) => {
  const palette = colors.length ? colors : DEFAULT_COLORS[preset] || ['#FFFFFF'];
  const burstPalette = BURST_COLORS[burstPreset] || BURST_COLORS.confetti;
  const kind = preset;

  const picture = useDerivedValue(() => {
    const t = time.value;
    const W = width;
    const H = height;
    const tx = (tiltX ? tiltX.value : 0) * 10;
    const ty = (tiltY ? tiltY.value : 0) * 6;

    return createPicture(canvas => {
      'worklet';
      if (W <= 0 || H <= 0) return;
      canvas.save();
      canvas.translate(tx, ty);
      drawParticles(canvas, kind, t, W, H, density, speed, size, wind, palette);
      canvas.restore();
      drawBursts(canvas, bursts.value, t, burstPreset, burstPalette, size);
    });
  });

  if (width <= 0 || height <= 0) return null;
  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
};

/* ------------------------------ worklets ------------------------------ */

/** Deterministic 0..1 noise from a number. */
function rnd(n: number) {
  'worklet';
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function mod(a: number, m: number) {
  'worklet';
  return ((a % m) + m) % m;
}

function colorOf(list: string[], i: number) {
  'worklet';
  return Skia.Color(list[Math.floor(rnd(i * 3.7) * list.length) % list.length]);
}

function drawParticles(
  canvas: SkCanvas,
  kind: ParticlePreset,
  t: number,
  W: number,
  H: number,
  density: number,
  speedMul: number,
  sizeMul: number,
  wind: number,
  palette: string[],
) {
  'worklet';
  if (kind === 'none') return;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);

  if (kind === 'fireworks') {
    drawFireworks(canvas, t, W, H, density, speedMul, sizeMul, palette);
    return;
  }

  const base = kind === 'rain' ? 70 : kind === 'sparkles' || kind === 'stars' ? 40 : 46;
  const n = Math.max(6, Math.round(base * (0.25 + density)));

  for (let i = 0; i < n; i++) {
    const r0 = rnd(i + 1);
    const r1 = rnd(i * 7 + 3);
    const r2 = rnd(i * 13 + 5);
    paint.setColor(colorOf(palette, i));

    if (kind === 'snow') {
      const rad = (1.2 + r2 * 2.6) * sizeMul;
      const v = (16 + r1 * 30) * speedMul;
      const y = mod(r0 * (H + 20) + t * v, H + 20) - 10;
      const x = mod(r1 * W + Math.sin(t * 0.9 + i) * 10 + wind * t * 18, W);
      paint.setAlphaf(0.55 + r2 * 0.4);
      canvas.drawCircle(x, y, rad, paint);
    } else if (kind === 'rain') {
      const len = (9 + r2 * 9) * sizeMul;
      const v = (260 + r1 * 160) * speedMul;
      const y = mod(r0 * (H + 40) + t * v, H + 40) - 20;
      const x = mod(r1 * W + wind * t * 60, W);
      paint.setStrokeWidth(1.2 * sizeMul);
      paint.setAlphaf(0.35 + r2 * 0.35);
      canvas.drawLine(x, y, x + wind * len * 0.6, y + len, paint);
    } else if (kind === 'sparkles' || kind === 'stars') {
      const x = r0 * W;
      const y = r1 * H;
      const tw = 0.5 + 0.5 * Math.sin(t * (2 + r2 * 3) * speedMul + i);
      const rad = (kind === 'stars' ? 0.9 : 1.4) * (0.6 + r2) * sizeMul;
      paint.setAlphaf(0.15 + tw * 0.85);
      canvas.drawCircle(x, y, rad, paint);
      if (tw > 0.85) {
        // a small cross flare on the brightest moment
        paint.setStrokeWidth(0.8);
        canvas.drawLine(x - rad * 3, y, x + rad * 3, y, paint);
        canvas.drawLine(x, y - rad * 3, x, y + rad * 3, paint);
      }
    } else if (kind === 'confetti') {
      const v = (40 + r1 * 50) * speedMul;
      const y = mod(r0 * (H + 20) + t * v, H + 20) - 10;
      const x = mod(r1 * W + Math.sin(t * 1.6 + i) * 14 + wind * t * 20, W);
      const w = (3 + r2 * 3) * sizeMul;
      const flip = Math.abs(Math.cos(t * (3 + r2 * 3) + i));
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate((t * 120 + i * 40) % 360, 0, 0);
      paint.setAlphaf(0.9);
      canvas.drawRect(Skia.XYWHRect(-w / 2, (-w * flip) / 2, w, Math.max(0.6, w * flip)), paint);
      canvas.restore();
    } else if (kind === 'embers' || kind === 'lanterns' || kind === 'bubbles') {
      const rising = (kind === 'lanterns' ? 14 : 24 + r1 * 30) * speedMul;
      const y = H - mod(r0 * (H + 30) + t * rising, H + 30) + 15;
      const x = mod(r1 * W + Math.sin(t * 0.7 + i * 2) * 12 + wind * t * 12, W);
      if (kind === 'bubbles') {
        paint.setStyle(PaintStyle.Stroke);
        paint.setStrokeWidth(1);
        paint.setAlphaf(0.5);
        canvas.drawCircle(x, y, (3 + r2 * 5) * sizeMul, paint);
        paint.setStyle(PaintStyle.Fill);
      } else if (kind === 'lanterns') {
        const glow = Skia.Paint();
        glow.setColor(colorOf(palette, i));
        glow.setAlphaf(0.45);
        glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 6, true));
        canvas.drawCircle(x, y, 7 * sizeMul, glow);
        paint.setAlphaf(0.95);
        canvas.drawRect(Skia.XYWHRect(x - 3 * sizeMul, y - 4 * sizeMul, 6 * sizeMul, 8 * sizeMul), paint);
      } else {
        const flick = 0.4 + 0.6 * Math.abs(Math.sin(t * 6 + i));
        paint.setAlphaf(flick);
        canvas.drawCircle(x, y, (0.8 + r2 * 1.6) * sizeMul, paint);
      }
    } else {
      // leaves / petals drawn as small ovals that tumble
      const v = (22 + r1 * 26) * speedMul;
      const y = mod(r0 * (H + 20) + t * v, H + 20) - 10;
      const x = mod(r1 * W + Math.sin(t * 1.1 + i) * 16 + wind * t * 24, W);
      const s = (kind === 'leaves' ? 4.5 : 3.2) * (0.7 + r2 * 0.6) * sizeMul;
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate((t * 90 + i * 57) % 360, 0, 0);
      paint.setAlphaf(0.9);
      canvas.drawOval(Skia.XYWHRect(-s, -s * 0.5, s * 2, s), paint);
      canvas.restore();
    }
  }
}

function drawFireworks(
  canvas: SkCanvas,
  t: number,
  W: number,
  H: number,
  density: number,
  speedMul: number,
  sizeMul: number,
  palette: string[],
) {
  'worklet';
  const bursts = Math.max(1, Math.round(1 + density * 3));
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const glow = Skia.Paint();
  glow.setAntiAlias(true);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 3, true));

  for (let k = 0; k < bursts; k++) {
    const period = (2.4 + rnd(k * 5 + 1) * 1.8) / speedMul;
    const tt = t + k * 0.83;
    const cycle = Math.floor(tt / period);
    const p = (tt % period) / period; // 0..1 through this firework
    const seed = k * 101 + cycle * 17;
    const cx = (0.12 + 0.76 * rnd(seed)) * W;
    const cy = (0.12 + 0.42 * rnd(seed + 9)) * H;
    const col = Skia.Color(palette[Math.floor(rnd(seed + 3) * palette.length) % palette.length]);
    const col2 = Skia.Color(palette[Math.floor(rnd(seed + 4) * palette.length) % palette.length]);

    if (p < 0.18) {
      // rocket rising with a short trail
      const q = p / 0.18;
      const y = H + 10 - (H + 10 - cy) * q;
      paint.setColor(col);
      paint.setAlphaf(0.9);
      paint.setStrokeWidth(1.6 * sizeMul);
      canvas.drawLine(cx, y, cx, y + 14 * sizeMul, paint);
      glow.setColor(col);
      glow.setAlphaf(0.8);
      canvas.drawCircle(cx, y, 2.2 * sizeMul, glow);
      continue;
    }
    const q = (p - 0.18) / 0.82; // explosion 0..1
    const ease = 1 - (1 - q) * (1 - q);
    const radius = (34 + rnd(seed + 7) * 34) * sizeMul;
    const sparks = 22 + Math.floor(rnd(seed + 11) * 10);
    const fade = Math.max(0, 1 - q);
    for (let i = 0; i < sparks; i++) {
      const a = (i / sparks) * Math.PI * 2 + rnd(seed + i) * 0.2;
      const d = radius * ease * (0.85 + rnd(seed + i * 3) * 0.3);
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d + 26 * q * q; // gravity
      const c = i % 2 === 0 ? col : col2;
      glow.setColor(c);
      glow.setAlphaf(fade * 0.9);
      canvas.drawCircle(x, y, (1.7 - q * 0.8) * sizeMul, glow);
      if (q < 0.55) {
        paint.setColor(c);
        paint.setAlphaf(fade * 0.5);
        paint.setStrokeWidth(0.9 * sizeMul);
        const back = d * 0.82;
        canvas.drawLine(cx + Math.cos(a) * back, cy + Math.sin(a) * back + 26 * q * q, x, y, paint);
      }
    }
    // central flash
    if (q < 0.15) {
      glow.setColor(Skia.Color('#FFFFFF'));
      glow.setAlphaf((0.15 - q) * 5);
      canvas.drawCircle(cx, cy, 10 * sizeMul, glow);
    }
  }
}

function drawBursts(
  canvas: SkCanvas,
  list: number[],
  t: number,
  preset: BurstPreset,
  palette: string[],
  sizeMul: number,
) {
  'worklet';
  if (!list || !list.length) return;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const glow = Skia.Paint();
  glow.setAntiAlias(true);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 2.5, true));

  for (let b = 0; b + 2 < list.length; b += 3) {
    const bx = list[b];
    const by = list[b + 1];
    const age = t - list[b + 2];
    if (age < 0 || age > BURST_LIFE) continue;
    const q = age / BURST_LIFE;
    const ease = 1 - (1 - q) * (1 - q);
    const fade = 1 - q;
    const n = preset === 'cracker' ? 34 : 26;
    const reach = (preset === 'cracker' ? 70 : 55) * sizeMul;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(b + i) * 0.4;
      const d = reach * ease * (0.6 + rnd(b * 3 + i) * 0.6);
      const x = bx + Math.cos(a) * d;
      const y = by + Math.sin(a) * d + (preset === 'snow' || preset === 'petals' ? 30 : 40) * q * q;
      const c = Skia.Color(palette[i % palette.length]);
      if (preset === 'confetti') {
        paint.setColor(c);
        paint.setAlphaf(fade);
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate((age * 400 + i * 30) % 360, 0, 0);
        canvas.drawRect(Skia.XYWHRect(-2.5 * sizeMul, -1.2 * sizeMul, 5 * sizeMul, 2.4 * sizeMul), paint);
        canvas.restore();
      } else if (preset === 'hearts') {
        paint.setColor(c);
        paint.setAlphaf(fade);
        const s = 2.6 * sizeMul;
        canvas.drawCircle(x - s * 0.5, y, s * 0.6, paint);
        canvas.drawCircle(x + s * 0.5, y, s * 0.6, paint);
        const path = Skia.Path.Make();
        path.moveTo(x - s * 1.05, y + s * 0.15);
        path.lineTo(x, y + s * 1.3);
        path.lineTo(x + s * 1.05, y + s * 0.15);
        path.close();
        canvas.drawPath(path, paint);
      } else if (preset === 'petals') {
        paint.setColor(c);
        paint.setAlphaf(fade);
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate((age * 200 + i * 40) % 360, 0, 0);
        canvas.drawOval(Skia.XYWHRect(-3 * sizeMul, -1.5 * sizeMul, 6 * sizeMul, 3 * sizeMul), paint);
        canvas.restore();
      } else {
        glow.setColor(c);
        glow.setAlphaf(fade);
        canvas.drawCircle(x, y, (preset === 'snow' ? 2.2 : 1.9) * sizeMul * (1 - q * 0.4), glow);
      }
    }
    if (preset === 'cracker' && q < 0.12) {
      glow.setColor(Skia.Color('#FFFFFF'));
      glow.setAlphaf((0.12 - q) * 8);
      canvas.drawCircle(bx, by, 16 * sizeMul, glow);
    }
  }
}

export { BURST_LIFE };
