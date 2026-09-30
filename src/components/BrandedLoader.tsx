import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';
import { apiService } from '@/services/api.service';

interface BrandedLoaderProps {
  /** Fill the parent and centre (default). */
  fullScreen?: boolean;
  /** Override the rotating lines. */
  lines?: string[];
  style?: ViewStyle;
}

const DEFAULT_LINES = [
  'Plating your cravings…',
  'Warming up the kitchen…',
  'Finding the tastiest picks…',
  'Almost served…',
];

// Fetched once per app session (loader config rarely changes).
let cachedLottieUrl: string | null | undefined;
let cachedLines: string[] | undefined;
let inflight: Promise<void> | null = null;

const loadConfig = (): Promise<void> => {
  if (cachedLottieUrl !== undefined) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [urlRes, linesRes] = await Promise.all([
        apiService.get<any>('/app-settings/LOADER_LOTTIE_URL').catch(() => null),
        apiService.get<any>('/app-settings/LOADER_LINES').catch(() => null),
      ]);
      const url = (urlRes?.data as any)?.value;
      cachedLottieUrl = typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
      const rawLines = (linesRes?.data as any)?.value;
      try {
        const arr = rawLines ? JSON.parse(rawLines) : null;
        if (Array.isArray(arr) && arr.length) {
          cachedLines = arr.filter((x) => typeof x === 'string' && x.trim());
        }
      } catch {
        // keep defaults
      }
    } catch {
      cachedLottieUrl = null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
};

/**
 * The one Tazty loader for the whole app. Plays an admin-supplied Lottie
 * (LOADER_LOTTIE_URL) when set, otherwise a clean on-brand bounce, with a
 * rotating line beneath. Replaces the plain green ActivityIndicator.
 */
export const BrandedLoader: React.FC<BrandedLoaderProps> = ({
  fullScreen = true,
  lines,
  style,
}) => {
  const [lottieUrl, setLottieUrl] = useState<string | null | undefined>(cachedLottieUrl);
  const [cfgLines, setCfgLines] = useState<string[] | undefined>(cachedLines);
  const [lineIdx, setLineIdx] = useState(0);

  const bounce = useRef(new Animated.Value(0)).current;
  const lineOpacity = useRef(new Animated.Value(1)).current;

  const effectiveLines = lines && lines.length ? lines : cfgLines && cfgLines.length ? cfgLines : DEFAULT_LINES;

  useEffect(() => {
    let mounted = true;
    loadConfig().then(() => {
      if (!mounted) return;
      setLottieUrl(cachedLottieUrl);
      setCfgLines(cachedLines);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // bounce for the fallback dots
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  // rotate the line every ~1.6s
  useEffect(() => {
    if (effectiveLines.length < 2) return;
    const timer = setInterval(() => {
      Animated.timing(lineOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        setLineIdx((i) => (i + 1) % effectiveLines.length);
        Animated.timing(lineOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      });
    }, 1600);
    return () => clearInterval(timer);
  }, [effectiveLines.length, lineOpacity]);

  const dot = (offset: number, color: string) => {
    const translateY = bounce.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, offset, 0],
    });
    return <Animated.View style={[styles.dot, { backgroundColor: color, transform: [{ translateY }] }]} />;
  };

  return (
    <View style={[fullScreen ? styles.full : styles.inline, style]} testID="branded-loader">
      {lottieUrl ? (
        <LottieView source={{ uri: lottieUrl }} autoPlay loop style={styles.lottie} />
      ) : (
        <View style={styles.dots}>
          {dot(-10, '#00B14F')}
          {dot(-14, '#FFB020')}
          {dot(-10, '#FF6A2B')}
        </View>
      )}
      <Animated.Text style={[styles.line, { opacity: lineOpacity }]} numberOfLines={1}>
        {effectiveLines[lineIdx] || effectiveLines[0]}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  full: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  inline: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  lottie: { width: 120, height: 120 },
  dots: { flexDirection: 'row', gap: 10, height: 30, alignItems: 'flex-end' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  line: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#566068',
    marginTop: 16,
  },
});
