import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as SplashScreen from 'expo-splash-screen';

// The video is a green-background 3D "Tazty" wordmark animation (~6.6s). We
// paint the same green behind it so any letterbox edge is invisible.
const GREEN = '#0A7A3C';

// The clip runs ~6.63s; give it a small margin as a hard backstop in case the
// player never reports `didJustFinish` (decode hiccup, etc.).
const MAX_SPLASH_MS = 7000;

interface AnimatedSplashProps {
  onAnimationEnd?: () => void;
}

/**
 * Launch splash: plays the bundled Tazty intro video full-screen, then hands
 * off to the app. Muted (no sound by design). Location resolution runs in the
 * app underneath during this window.
 */
export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onAnimationEnd }) => {
  // Fire onAnimationEnd exactly once (video end or safety timeout).
  const finishedRef = useRef(false);
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onAnimationEnd?.();
  };

  useEffect(() => {
    // Hand off from the native cold-boot splash to this JS video splash.
    SplashScreen.hideAsync().catch(() => {});
    const t = setTimeout(finish, MAX_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const handleStatus = (status: AVPlaybackStatus) => {
    if (status.isLoaded && status.didJustFinish) {
      finish();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={GREEN} barStyle="light-content" translucent hidden />
      <Video
        style={StyleSheet.absoluteFill}
        source={require('../../assets/splashscreen.mp4')}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isMuted
        isLooping={false}
        onPlaybackStatusUpdate={handleStatus}
        // If the video fails to load, don't strand the user on a green screen.
        onError={finish}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
});
