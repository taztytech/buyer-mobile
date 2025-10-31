import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';

interface CustomSplashScreenProps {
  onFinish: () => void;
}

const CustomSplashScreen: React.FC<CustomSplashScreenProps> = ({ onFinish }) => {
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    // Show splash for 1 second then fade out quickly
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Image
        source={require('../../assets/splash.png')}
        style={styles.image}
        resizeMode="cover"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a9656',
    zIndex: 9999,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default CustomSplashScreen;
