import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, BackHandler, Platform, Linking } from 'react-native';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';

export interface ForcedUpdateModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  updateButtonText?: string;
}

/**
 * Forced Update Modal Component
 * 
 * This modal cannot be dismissed by the user. It blocks all app interaction
 * until the user updates the app. The modal:
 * - Prevents Android back button from closing it
 * - Blocks all touch interactions outside the modal
 * - Opens app store when "Update" button is pressed
 * - Cannot be closed by any user action
 */
export const ForcedUpdateModal: React.FC<ForcedUpdateModalProps> = ({
  visible,
  title = 'Update Available',
  message = 'A new version of the app is available. Please update to continue using the app.',
  updateButtonText = 'Update Now',
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
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  // Block Android back button when modal is visible
  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Prevent back button from closing the modal
      return true; // Return true to prevent default behavior
    });

    return () => backHandler.remove();
  }, [visible]);

  /**
   * Open app store based on platform
   */
  const handleUpdatePress = async () => {
    try {
      const packageName = Constants.expoConfig?.android?.package || 'in.tazty.buyer';
      const bundleId = Constants.expoConfig?.ios?.bundleIdentifier || 'in.tazty.buyer';
      
      let storeUrl: string;
      
      if (Platform.OS === 'android') {
        // Google Play Store URL
        storeUrl = `https://play.google.com/store/apps/details?id=${packageName}`;
      } else if (Platform.OS === 'ios') {
        // App Store URL
        storeUrl = `https://apps.apple.com/app/id${bundleId}`;
        // If we have an App Store ID, use it instead
        // For now, using bundle identifier as fallback
      } else {
        // Fallback for other platforms
        storeUrl = `https://play.google.com/store/apps/details?id=${packageName}`;
      }

      const canOpen = await Linking.canOpenURL(storeUrl);
      if (canOpen) {
        await Linking.openURL(storeUrl);
      } else {
        // Fallback: try to open with market:// or itms-apps://
        if (Platform.OS === 'android') {
          const marketUrl = `market://details?id=${packageName}`;
          try {
            await Linking.openURL(marketUrl);
          } catch {
            // If market:// fails, the https:// URL should have been tried
            console.warn('Could not open Play Store');
          }
        } else if (Platform.OS === 'ios') {
          // iOS doesn't have a direct market:// equivalent, use App Store URL
          console.warn('Could not open App Store');
        }
      }
    } catch (error) {
      console.error('Error opening app store:', error);
    }
  };

  // Prevent modal from being dismissed
  const handleRequestClose = () => {
    // Do nothing - modal cannot be closed
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={handleRequestClose}
      hardwareAccelerated={true}
    >
      <BlurView intensity={60} tint="dark" style={styles.overlay}>
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
            {/* Icon Container */}
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>🔄</Text>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Update Button */}
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleUpdatePress}
              activeOpacity={0.8}
            >
              <Text 
                style={styles.updateButtonText}
                numberOfLines={1}
              >
                {updateButtonText}
              </Text>
            </TouchableOpacity>

            {/* Footer Note */}
            <Text style={styles.footerNote}>
              This update is required to continue using the app
            </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
  },
  iconContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#00B14F',
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontFamily: 'Poppins',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  updateButton: {
    width: '100%',
    minHeight: 52,
    backgroundColor: '#00B14F',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#00B14F',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  updateButtonText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  footerNote: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});

