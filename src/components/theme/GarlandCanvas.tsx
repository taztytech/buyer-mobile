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
import type { GarlandPreset } from './themeTypes';

/**
 * Festival garland hung across the top of the dash (just under the status
 * bar): toran flags, twinkling string lights, marigolds, temple bells, stars
 * or mango leaves. Drawn by Skia; sways gently.
 */
interface Props {
  width: number;
  /** Where the string hangs from (below the status bar). */
  top: number;
  preset: GarlandPreset;
  colors: string[];
  sway: boolean;
  time: SharedValue<number>;
}

const DEFAULTS: Record<GarlandPreset, string[]> = {
  none: [],
  toran: ['#FF8C00', '#2E7D32', '#FFC300', '#C2185B'],
  lights: ['#FFD700', '#FF3B30', '#34C759', '#0A84FF'],
  marigold: ['#FF8C00', '#FFC300', '#FF5E00'],
  bells: ['#FFD700', '#B8860B'],
  stars: ['#FFD700', '#FFF3C4'],
  mango: ['#2E7D32', '#66BB6A'],
};

const HEIGHT = 46;

export const GarlandCanvas: React.FC<Props> = ({ width, top, preset, colors, sway, time }) => {
  const palette = colors.length ? colors : DEFAULTS[preset];
  const kind = preset;

  const picture = useDerivedValue(() => {
    const t = time.value;
    return createPicture(canvas => {
      'worklet';
      drawGarland(canvas, kind, width, t, palette, sway);
    });
  });

  if (preset === 'none' || width <= 0) return null;
  return (
    <Canvas
      style={[StyleSheet.absoluteFill, { top, height: HEIGHT, width }]}
      pointerEvents="none"
    >
      <Picture picture={picture} />
    </Canvas>
  );
};

function drawGarland(
  canvas: SkCanvas,
  kind: GarlandPreset,
  W: number,
  t: number,
  palette: string[],
  sway: boolean,
) {
  'worklet';
  if (kind === 'none' || !palette.length) return;
  const swings = 2; // two scallops across the width
  const sag = 9;
  const step = kind === 'lights' ? 20 : kind === 'marigold' ? 9 : 24;
  const n = Math.floor(W / step);
  const yAt = (x: number) => {
    'worklet';
    const s = Math.sin((x / W) * Math.PI * swings);
    return 4 + Math.abs(s) * sag;
  };

  // the string
  const cord = Skia.Paint();
  cord.setAntiAlias(true);
  cord.setColor(Skia.Color('rgba(255,255,255,0.55)'));
  cord.setStrokeWidth(1.1);
  cord.setStyle(PaintStyle.Stroke);
  const path = Skia.Path.Make();
  path.moveTo(0, yAt(0));
  for (let x = 4; x <= W; x += 4) path.lineTo(x, yAt(x));
  canvas.drawPath(path, cord);

  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const glow = Skia.Paint();
  glow.setAntiAlias(true);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 4, true));

  for (let i = 0; i <= n; i++) {
    const x = i * step + step / 2;
    if (x > W) break;
    const y = yAt(x);
    const c = Skia.Color(palette[i % palette.length]);
    const swing = sway ? Math.sin(t * 1.6 + i * 0.7) * 5 : 0; // degrees

    canvas.save();
    canvas.translate(x, y);
    canvas.rotate(swing, 0, 0);
    paint.setColor(c);

    if (kind === 'toran') {
      const p = Skia.Path.Make();
      p.moveTo(-8, 0);
      p.lineTo(8, 0);
      p.lineTo(0, 15);
      p.close();
      canvas.drawPath(p, paint);
    } else if (kind === 'lights') {
      const on = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.2 + i * 1.3));
      glow.setColor(c);
      glow.setAlphaf(on * 0.8);
      canvas.drawCircle(0, 7, 6.5, glow);
      paint.setAlphaf(0.6 + on * 0.4);
      canvas.drawOval(Skia.XYWHRect(-2.6, 3, 5.2, 8), paint);
    } else if (kind === 'marigold') {
      canvas.drawCircle(0, 5, 4.2, paint);
      paint.setColor(Skia.Color('rgba(120,40,0,0.35)'));
      canvas.drawCircle(0, 5, 1.4, paint);
      if (i % 4 === 0) {
        // hanging strand
        paint.setColor(c);
        canvas.drawCircle(0, 12, 3.6, paint);
        canvas.drawCircle(0, 19, 3.2, paint);
      }
    } else if (kind === 'bells') {
      paint.setColor(c);
      const p = Skia.Path.Make();
      p.moveTo(-6, 14);
      p.quadTo(-6, 2, 0, 2);
      p.quadTo(6, 2, 6, 14);
      p.close();
      canvas.drawPath(p, paint);
      canvas.drawCircle(0, 15.5, 1.8, paint);
    } else if (kind === 'stars') {
      const tw = 0.6 + 0.4 * Math.abs(Math.sin(t * 2 + i));
      paint.setAlphaf(tw);
      const p = Skia.Path.Make();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 === 0 ? 6 : 2.6;
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        if (k === 0) p.moveTo(Math.cos(a) * r, 9 + Math.sin(a) * r);
        else p.lineTo(Math.cos(a) * r, 9 + Math.sin(a) * r);
      }
      p.close();
      canvas.drawPath(p, paint);
    } else if (kind === 'mango') {
      canvas.drawOval(Skia.XYWHRect(-3.2, 0, 6.4, 16), paint);
      paint.setColor(Skia.Color('rgba(255,255,255,0.35)'));
      paint.setStrokeWidth(0.8);
      canvas.drawLine(0, 1, 0, 15, paint);
    }
    canvas.restore();
  }
}
