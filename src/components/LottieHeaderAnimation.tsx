import React from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_HEIGHT = 325; // Header background image height

interface LottieHeaderAnimationProps {
  isActive: boolean;
  source?: string | number; // Path to animation file (local require or URL)
}

/**
 * New Year Lottie/GIF Header Animation Component
 * Displays a Lottie animation or GIF overlay on the header background
 * Controlled by API response - shows when new_year header image is active
 * 
 * Supports:
 * - GIF files (using React Native Image component)
 * - Lottie .json files (using lottie-react-native)
 * - DotLottie .lottie files (using @lottiefiles/dotlottie-react)
 */
export const LottieHeaderAnimation: React.FC<LottieHeaderAnimationProps> = ({ 
  isActive, 
  source 
}) => {
  if (!isActive) return null;

  // Try to load the "Confetti Effects Lottie Animation" file from assets
  let animationSource = source;
  
  if (!animationSource) {
    // Try exact filename first: Confetti-Effects-Lottie-Animation.json
    try {
      animationSource = require('@/assets/Confetti-Effects-Lottie-Animation.json');
      console.log('✅ Animation: Loaded Confetti-Effects-Lottie-Animation.json');
    } catch {
      // Try GIF version if it exists
      try {
        animationSource = require('@/assets/Confetti-Effects-Lottie-Animation.gif');
        console.log('✅ Animation: Loaded Confetti-Effects-Lottie-Animation.gif');
      } catch {
        // Try shorter name variations
        try {
          animationSource = require('@/assets/Confetti-Effects.gif');
          console.log('✅ Animation: Loaded Confetti-Effects.gif');
        } catch {
          try {
            animationSource = require('@/assets/Confetti-Effects.json');
            console.log('✅ Animation: Loaded Confetti-Effects.json');
          } catch {
            // Try lowercase versions
            try {
              animationSource = require('@/assets/confetti-effects-lottie-animation.json');
              console.log('✅ Animation: Loaded confetti-effects-lottie-animation.json');
            } catch {
              console.warn('⚠️  Animation: File "Confetti-Effects-Lottie-Animation.json" not found in assets.');
              console.warn('   Tried the following filenames:');
              console.warn('   - Confetti-Effects-Lottie-Animation.json');
              console.warn('   - Confetti-Effects-Lottie-Animation.gif');
              console.warn('   - Confetti-Effects.gif');
              console.warn('   - Confetti-Effects.json');
              console.warn('   - confetti-effects-lottie-animation.json');
              console.warn('   Please ensure the file exists in src/assets/ with one of these names.');
              console.warn('   Note: File is currently in root assets/ folder, may need to move to src/assets/');
              return null;
            }
          }
        }
      }
    }
  }

  // Determine if it's a JSON Lottie file or GIF
  // If source is a number (local require), we can't easily determine the type
  // So we'll try Lottie first (for JSON files), then fall back to Image (for GIFs)
  
  // Try lottie-react-native first (standard for React Native, works with .json files)
  try {
    const LottieView = require('lottie-react-native').default;
    
    return (
      <View style={styles.container} pointerEvents="none">
        <LottieView
          source={animationSource}
          autoPlay={true}
          loop={true}
          style={styles.animation}
          resizeMode="cover"
        />
      </View>
    );
  } catch (lottieRNError) {
    // If Lottie fails, try Image component for GIF files
    try {
      return (
        <View style={styles.container} pointerEvents="none">
          <Image
            source={animationSource}
            style={styles.animation}
            resizeMode="cover"
          />
        </View>
      );
    } catch (gifError) {
      // Continue to next fallback
    }
    // Fallback: Try @lottiefiles/dotlottie-react (for .lottie files)
    try {
      const { DotLottieReact } = require('@lottiefiles/dotlottie-react');
      
      return (
        <View style={styles.container} pointerEvents="none">
          <DotLottieReact
            src={typeof animationSource === 'number' ? animationSource : animationSource}
            loop={true}
            autoplay={true}
            style={styles.animation}
          />
        </View>
      );
    } catch (dotLottieError) {
      // Last resort: Try as GIF with Image component
      try {
        return (
          <View style={styles.container} pointerEvents="none">
            <Image
              source={animationSource}
              style={styles.animation}
              resizeMode="cover"
            />
          </View>
        );
      } catch (imageError) {
        console.warn('⚠️  Animation: Failed to load animation file.');
        console.warn('   Tried: Lottie, DotLottie, and GIF formats');
        console.warn('   Error:', imageError);
        return null;
      }
    }
  }
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    zIndex: 1001,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: {
    width: SCREEN_WIDTH,
    height: HEADER_HEIGHT,
  },
});
