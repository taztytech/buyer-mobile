import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, StatusBar } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

interface AnimatedSplashProps {
  onAnimationEnd?: () => void;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onAnimationEnd }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🎬 [AnimatedSplash] Component mounted, hiding native splash...');

    // Hide native splash immediately when our AnimatedSplash is mounted
    SplashScreen.hideAsync().catch(() => {});

    // Start animation immediately after hiding native splash
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.delay(1500), // Hold for 1.5 seconds
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      console.log('✅ [AnimatedSplash] Animation completed');
      if (onAnimationEnd) {
        onAnimationEnd();
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="#00B14F"
        barStyle="light-content"
        translucent={true}
      />
      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim }]}>
        <Animated.Image
          source={require('../../assets/splash-tazty-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 30,
  },
  logo: {
    width: 250,
    height: 250,
  },
});
