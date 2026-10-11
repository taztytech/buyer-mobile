import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import type { ThemeConfig } from './themeTypes';

/* --------------------------------- greeting --------------------------------- */

/**
 * The theme's greeting line ("Happy Deepavali! 🪔"), animated: shimmer
 * (light sweep via opacity), glow (soft pulse) or bounce.
 */
export const ThemeGreeting: React.FC<{
  text: string;
  color: string;
  effect: ThemeConfig['greeting']['effect'];
  time: SharedValue<number>;
}> = ({ text, color, effect, time }) => {
  const style = useAnimatedStyle(() => {
    const t = time.value;
    if (effect === 'bounce') {
      const b = Math.abs(Math.sin(t * 2.2));
      return { transform: [{ translateY: -b * 3 }] };
    }
    if (effect === 'glow') {
      return { opacity: 0.82 + 0.18 * Math.sin(t * 2), transform: [{ scale: 1 + 0.015 * Math.sin(t * 2) }] };
    }
    if (effect === 'shimmer') {
      return { opacity: 0.78 + 0.22 * Math.abs(Math.sin(t * 1.4)) };
    }
    return {};
  });
  if (!text) return null;
  return (
    <Animated.Text
      numberOfLines={1}
      allowFontScaling={false}
      style={[
        styles.greeting,
        { color },
        effect === 'glow' && { textShadowColor: color, textShadowRadius: 8 },
        style,
      ]}
      testID="theme-greeting"
    >
      {text}
    </Animated.Text>
  );
};

/* ------------------------------- bottom edge ------------------------------- */

/**
 * Themed bottom edge of the dash: paints the page colour below a wave,
 * scallop or zigzag line so the dash appears to end in that shape.
 */
export const DashEdge: React.FC<{
  preset: ThemeConfig['edge']['preset'];
  size: number;
  width: number;
  pageColor: string;
}> = ({ preset, size, width, pageColor }) => {
  if (preset === 'round' || preset === 'flat' || width <= 0) return null;
  const e = Math.round(12 * size);
  const pts: string[] = [];
  if (preset === 'wave') {
    const waves = 4;
    for (let x = 0; x <= width; x += 4) {
      const y = e / 2 + Math.sin((x / width) * Math.PI * 2 * waves) * (e / 2 - 1);
      pts.push(`${x},${y.toFixed(1)}`);
    }
  } else if (preset === 'zigzag') {
    const step = 18 * size;
    for (let x = 0, k = 0; x <= width + step; x += step / 2, k++) {
      pts.push(`${Math.min(x, width)},${k % 2 === 0 ? 1 : e - 1}`);
    }
  }
  let d: string;
  if (preset === 'scallop') {
    const r = 11 * size;
    const n = Math.ceil(width / (r * 2));
    d = `M0,${e} L0,0`;
    for (let i = 0; i < n; i++) {
      const x0 = i * r * 2;
      d += ` A${r},${e} 0 0 0 ${Math.min(width, x0 + r * 2)},0`;
    }
    d += ` L${width},${e} Z`;
  } else {
    d = `M0,${e} L${pts.join(' L')} L${width},${e} Z`;
  }
  return (
    <Svg width={width} height={e} style={[styles.edge, { height: e }]} pointerEvents="none">
      <Path d={d} fill={pageColor} />
    </Svg>
  );
};

/* -------------------------------- 3D model -------------------------------- */

/**
 * A real 3D model (GLB) floating in the dash, rendered by Google's
 * <model-viewer> inside a transparent WebView: auto-rotates, no controls,
 * never takes touches.
 */
export const Model3D: React.FC<{
  url: string;
  x: number;
  y: number;
  size: number;
  autoRotate: boolean;
  rotateSpeed: number;
  width: number;
  height: number;
  active: boolean;
}> = ({ url, x, y, size, autoRotate, rotateSpeed, width, height, active }) => {
  const box = Math.round(size * width);
  const left = Math.round(x * width - box / 2);
  const top = Math.round(y * height - box / 2);
  const safeUrl = url.replace(/"/g, '%22');
  const html = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}
model-viewer{width:100vw;height:100vh;background:transparent;--poster-color:transparent}</style>
</head><body>
<model-viewer src="${safeUrl}" ${autoRotate && active ? 'auto-rotate' : ''}
 rotation-per-second="${Math.round(30 * rotateSpeed)}deg" auto-rotate-delay="0"
 interaction-prompt="none" disable-zoom disable-pan disable-tap
 shadow-intensity="0.8" exposure="1.05" environment-image="neutral"></model-viewer>
</body></html>`;
  if (box <= 0) return null;
  return (
    <View pointerEvents="none" style={[styles.model, { left, top, width: box, height: box }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        containerStyle={styles.webview}
        javaScriptEnabled
        scrollEnabled={false}
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        testID="theme-model-3d"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  greeting: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  edge: { position: 'absolute', left: 0, right: 0, bottom: -1 },
  model: { position: 'absolute' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
