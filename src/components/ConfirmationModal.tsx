import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { RibbonAnimation } from './RibbonAnimation';

export interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
  confirmTextColor?: string;
  cancelTextColor?: string;
  showRibbon?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  confirmButtonColor = '#00B14F',
  cancelButtonColor = '#FFFFFF',
  confirmTextColor = '#FFFFFF',
  cancelTextColor = '#000000',
  showRibbon = false,
}) => {
  const slideAnim = useRef(new Animated.Value(500)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Animate modal slide in/out
  useEffect(() => {
    if (visible) {
      slideAnim.setValue(500);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  const handleAnimatedClose = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 500,
        duration: 75,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 75,
        useNativeDriver: true,
      })
    ]).start(() => {
      callback();
      slideAnim.setValue(500);
      opacityAnim.setValue(0);
    });
  };

  const handleConfirmPress = () => {
    handleAnimatedClose(onConfirm);
  };

  const handleCancelPress = () => {
    handleAnimatedClose(onCancel);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={handleCancelPress}
    >
      <BlurView intensity={80} tint="dark" style={styles.overlay}>
        {/* Ribbon Animation */}
        {showRibbon && <RibbonAnimation active={true} />}

        <View style={styles.modalContainer}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ translateY: slideAnim }],
                opacity: opacityAnim
              }
            ]}
          >
            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {/* Confirm Button */}
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: confirmButtonColor }]}
                onPress={handleConfirmPress}
                activeOpacity={0.8}
              >
                <Text style={[styles.confirmButtonText, { color: confirmTextColor }]}>
                  {confirmText}
                </Text>
              </TouchableOpacity>

              {/* Cancel Button - Only show if cancelText is provided */}
              {cancelText && cancelText.trim() !== '' && (
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: cancelButtonColor }]}
                  onPress={handleCancelPress}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelButtonText, { color: cancelTextColor }]}>
                    {cancelText}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontFamily: 'Poppins',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  confirmButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#00B14F',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00B14F',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonText: {
    fontFamily: 'Poppins',
    fontSize: 15,
    lineHeight: 22,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cancelButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    fontFamily: 'Poppins',
    fontSize: 15,
    lineHeight: 22,
    color: '#000000',
    fontWeight: '600',
  },
});
