import React, { useState, useEffect } from 'react';
import { Image, ImageSource, ImageStyle, StyleProp } from 'expo-image';
import { View, StyleSheet, Animated } from 'react-native';
import { Shimmer } from '@/components/Shimmer';

interface OptimizedImageProps {
  source: ImageSource | number | string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center' | 'repeat';
  onLoad?: () => void;
  onError?: () => void;
  showShimmer?: boolean;
  shimmerWidth?: number | string;
  shimmerHeight?: number | string;
  shimmerBorderRadius?: number;
  transition?: number;
  priority?: 'low' | 'normal' | 'high';
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scaleDown';
  animatedOpacity?: Animated.AnimatedValue;
  testID?: string;
}

/**
 * OptimizedImage - A wrapper around expo-image with built-in caching,
 * shimmer loading, and performance optimizations for smooth scrolling
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  style,
  resizeMode = 'cover',
  onLoad,
  onError,
  showShimmer = true,
  shimmerWidth,
  shimmerHeight,
  shimmerBorderRadius,
  transition = 200,
  priority = 'normal',
  cachePolicy = 'memory-disk',
  contentFit = 'cover',
  animatedOpacity,
  testID,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [opacity] = useState(() => new Animated.Value(0));

  // Normalize source to expo-image format
  const getImageSource = (): ImageSource => {
    if (typeof source === 'string') {
      return { uri: source };
    } else if (typeof source === 'number') {
      return source;
    }
    return source;
  };

  const handleLoad = () => {
    setIsLoading(false);
    
    // Animate opacity fade-in
    const opacityValue = animatedOpacity || opacity;
    Animated.timing(opacityValue, {
      toValue: 1,
      duration: transition,
      useNativeDriver: true,
    }).start();
    
    if (onLoad) {
      onLoad();
    }
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    
    // Still animate even on error
    const opacityValue = animatedOpacity || opacity;
    Animated.timing(opacityValue, {
      toValue: 1,
      duration: transition,
      useNativeDriver: true,
    }).start();
    
    if (onError) {
      onError();
    }
  };

  // Reset loading state when source changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    const opacityValue = animatedOpacity || opacity;
    opacityValue.setValue(0);
  }, [source, animatedOpacity, opacity]);

  const imageSource = getImageSource();

  // Extract dimensions from style for shimmer
  const extractDimensions = () => {
    const styleObj = StyleSheet.flatten(style || {});
    return {
      width: shimmerWidth || styleObj.width || 100,
      height: shimmerHeight || styleObj.height || 100,
      borderRadius: shimmerBorderRadius || styleObj.borderRadius || 0,
    };
  };

  const dimensions = extractDimensions();
  const opacityValue = animatedOpacity || opacity;

  return (
    <View style={[styles.container, style]}>
      {showShimmer && isLoading && !hasError && (
        <View style={[styles.shimmerContainer, { borderRadius: dimensions.borderRadius }]}>
          <Shimmer
            width={dimensions.width}
            height={dimensions.height}
            borderRadius={dimensions.borderRadius}
            backgroundColor="#E8E8E8"
          />
        </View>
      )}
      
      <Animated.View
        style={[
          styles.imageWrapper,
          { opacity: opacityValue },
        ]}
        pointerEvents="none"
      >
        <Image
          source={imageSource}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={transition}
          priority={priority}
          cachePolicy={cachePolicy}
          onLoad={handleLoad}
          onError={handleError}
          recyclingKey={typeof imageSource === 'object' && imageSource !== null && 'uri' in imageSource ? imageSource.uri : undefined}
          testID={testID}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  imageWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
});

