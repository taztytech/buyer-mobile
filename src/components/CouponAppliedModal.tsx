import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import ConfettiCannon from 'react-native-confetti-cannon';
import { MaterialIcons } from '@expo/vector-icons';

type CouponAppliedModalProps = {
  visible: boolean;
  confettiKey: number;
  onClose: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const CouponAppliedModal: React.FC<CouponAppliedModalProps> = ({
  visible,
  confettiKey,
  onClose,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.78)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scaleAnim.setValue(0.78);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        stiffness: 260,
        damping: 22,
        mass: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacityAnim, scaleAnim, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <BlurView intensity={70} tint="dark" style={styles.overlay}>
        {/* Confetti effect (behind the popup card) */}
        <View pointerEvents="none" style={styles.backdropAnim}>
          {visible ? (
            <ConfettiCannon
              // key forces a fresh burst each time modal opens
              key={`coupon-confetti-${confettiKey}`}
              count={300}
              origin={{ x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT - 60 }}
              fadeOut
              fallSpeed={2600}
              explosionSpeed={480}
              autoStart
            />
          ) : null}
        </View>
        <Animated.View style={[styles.popupLayer, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.card}>
            <MaterialIcons name="check-circle" size={64} color="#00B14F" style={styles.tickIcon} />
            <Text style={styles.titleText}>Coupon Applied</Text>
            <TouchableOpacity style={styles.okButton} activeOpacity={0.9} onPress={onClose}>
              <Text style={styles.okButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // paddingHorizontal: 22,
  },
  backdropAnim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  popupLayer: {
    zIndex: 2,
  },
  card: {
    width: Math.min(320, SCREEN_WIDTH - 56),
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  tickIcon: {
    marginBottom: 10,
  },
  titleText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: '#111827',
    marginBottom: 16,
  },
  okButton: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00B14F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  okButtonText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});

