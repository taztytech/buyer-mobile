import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type ToastType = 'success' | 'error';

interface ToastProps {
  visible: boolean;
  message: string;
  type: ToastType;
  onHide: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type,
  onHide,
  duration = 3000,
}) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Reset animations
      slideAnim.setValue(-100);
      opacityAnim.setValue(0);

      // Entry animation: slide down from top
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide after duration
      timeoutRef.current = setTimeout(() => {
        // Exit animation: bounce/jump back up
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: -100,
            useNativeDriver: true,
            tension: 50,
            friction: 6,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onHide();
        });
      }, duration);
    } else {
      // Reset when hidden
      slideAnim.setValue(-100);
      opacityAnim.setValue(0);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, duration, slideAnim, opacityAnim, onHide]);

  if (!visible) {
    return null;
  }

  const isSuccess = type === 'success';
  const backgroundColor = isSuccess ? '#00B14F' : '#DC2626';
  const textColor = '#FFFFFF'; // White text for both success and error
  const borderColor = isSuccess ? '#00B14F' : '#DC2626';
  const iconName = isSuccess ? 'check-circle' : 'close';
  const iconColor = '#FFFFFF'; // White icon for both success and error

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor,
            borderColor,
          },
        ]}
      >
        {/* Icon - Left side for error, Right side for success */}
        {!isSuccess && (
          <MaterialIcons name={iconName} size={28} color={iconColor} style={styles.iconLeft} />
        )}
        
        {/* Message - Center aligned */}
        <Text style={[styles.message, { color: textColor }]} numberOfLines={2}>
          {message}
        </Text>

        {/* Icon - Right side for success */}
        {isSuccess && (
          <MaterialIcons name={iconName} size={28} color={iconColor} style={styles.iconRight} />
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
    paddingTop: 50,
  },
  toast: {
    width: SCREEN_WIDTH - 40,
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: 12,
  },
  iconRight: {
    marginLeft: 12,
  },
});

