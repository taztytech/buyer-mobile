import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { RibbonAnimation } from '@/components/RibbonAnimation';

type SplashSuccessModalProps = {
  visible: boolean;
  message: string;
  buttonText?: string;
  onClose: () => void;
};

export const SplashSuccessModal: React.FC<SplashSuccessModalProps> = ({
  visible,
  message,
  buttonText = 'OK',
  onClose,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scaleAnim.setValue(0.9);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacityAnim, scaleAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <BlurView intensity={80} tint="dark" style={styles.overlay}>
        <RibbonAnimation active={visible} />
        <Animated.View style={[styles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconWrap}>
            <MaterialIcons name="check" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Success</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.okButton} activeOpacity={0.85} onPress={onClose}>
            <Text style={styles.okButtonText}>{buttonText}</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00B14F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 10,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: '#181C2E',
    marginBottom: 6,
  },
  message: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  okButton: {
    alignSelf: 'center',
    minWidth: 160,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  okButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
  },
});

