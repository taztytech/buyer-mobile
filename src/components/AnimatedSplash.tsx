import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';

/**
 * Launch splash: the Tazty wordmark writes itself in letter by letter from
 * the left, holds with "Made with ❤️ in Madurai" underneath, then each letter
 * lifts up and fades, left to right, and the app takes over. The letters are
 * slices of the real logo (src/assets/splash-letters).
 */

const LETTERS = [
  { key: 'T', src: require('@/assets/splash-letters/T_cap.png'), w: 85 },
  { key: 'a', src: require('@/assets/splash-letters/a.png'), w: 119 },
  { key: 'z', src: require('@/assets/splash-letters/z.png'), w: 109 },
  { key: 't', src: require('@/assets/splash-letters/t.png'), w: 63 },
  { key: 'y', src: require('@/assets/splash-letters/y.png'), w: 118 },
];
const SRC_H = 251; // slice height in px
const LETTER_H = 84; // on-screen height
const K = LETTER_H / SRC_H;

const IN_STAGGER = 130;
const IN_MS = 420;
const HOLD_MS = 950;
const OUT_STAGGER = 110;
const OUT_MS = 380;

const writeInEnd = IN_STAGGER * (LETTERS.length - 1) + IN_MS;
const eraseStart = writeInEnd + HOLD_MS;
const TOTAL_MS = eraseStart + OUT_STAGGER * (LETTERS.length - 1) + OUT_MS + 120;
// Hard backstop so the app is never stuck behind the splash.
const MAX_SPLASH_MS = TOTAL_MS + 1500;

interface AnimatedSplashProps {
  onAnimationEnd?: () => void;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onAnimationEnd }) => {
  const finishedRef = useRef(false);
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onAnimationEnd?.();
  };

  // One value per letter for writing in (0→1) and erasing (0→1).
  const inVals = useMemo(() => LETTERS.map(() => new Animated.Value(0)), []);
  const outVals = useMemo(() => LETTERS.map(() => new Animated.Value(0)), []);
  const tagline = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Hand off from the native cold-boot splash to this one.
    SplashScreen.hideAsync().catch(() => {});

    const writeIn = Animated.stagger(
      IN_STAGGER,
      inVals.map(v =>
        Animated.timing(v, {
          toValue: 1,
          duration: IN_MS,
          easing: Easing.out(Easing.back(1.6)),
          useNativeDriver: true,
        }),
      ),
    );
    const taglineIn = Animated.timing(tagline, {
      toValue: 1,
      duration: 380,
      delay: writeInEnd - 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    const heartBeat = Animated.sequence([
      Animated.delay(writeInEnd + 100),
      Animated.timing(heart, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(heart, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(heart, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(heart, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]);
    const erase = Animated.sequence([
      Animated.delay(eraseStart),
      Animated.parallel([
        Animated.stagger(
          OUT_STAGGER,
          outVals.map(v =>
            Animated.timing(v, {
              toValue: 1,
              duration: OUT_MS,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
          ),
        ),
        Animated.timing(tagline, {
          toValue: 2,
          duration: 420,
          delay: OUT_STAGGER * 2,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    Animated.parallel([writeIn, taglineIn, heartBeat, erase]).start(({ finished }) => {
      if (finished) setTimeout(finish, 120);
    });
    const backstop = setTimeout(finish, MAX_SPLASH_MS);
    return () => clearTimeout(backstop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.container} testID="animated-splash">
      <StatusBar backgroundColor="#00A651" barStyle="light-content" translucent hidden />
      <LinearGradient
        colors={['#00B14F', '#009A48', '#006B3A']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.word}>
        {LETTERS.map((l, i) => {
          const vin = inVals[i];
          const vout = outVals[i];
          return (
            <Animated.View
              key={l.key}
              style={{
                opacity: Animated.multiply(
                  vin.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
                  vout.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                ),
                transform: [
                  { translateX: vin.interpolate({ inputRange: [0, 1], outputRange: [-36, 0] }) },
                  { translateY: vout.interpolate({ inputRange: [0, 1], outputRange: [0, -64] }) },
                  { scale: vin.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                  { rotate: vout.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-8deg'] }) },
                ],
              }}
            >
              <Image source={l.src} style={{ width: l.w * K, height: LETTER_H }} resizeMode="contain" />
            </Animated.View>
          );
        })}
      </View>

      <Animated.View
        style={[
          styles.taglineRow,
          {
            opacity: tagline.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
            transform: [
              { translateY: tagline.interpolate({ inputRange: [0, 1, 2], outputRange: [12, 0, -24] }) },
            ],
          },
        ]}
      >
        <Text style={styles.tagline}>Made with </Text>
        <Animated.Text
          style={[
            styles.tagline,
            { transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] },
          ]}
        >
          ❤️
        </Animated.Text>
        <Text style={styles.tagline}> in Madurai</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00A651',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  word: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  tagline: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 15,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.92)',
  },
});
