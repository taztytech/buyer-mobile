import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Dimensions, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import ConfettiCannon from 'react-native-confetti-cannon';

type CouponAppliedModalProps = {
  visible: boolean;
  couponCode: string;
  couponTitle: string;
  onClose: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const CouponAppliedModal: React.FC<CouponAppliedModalProps> = ({
  visible,
  couponCode,
  couponTitle,
  onClose,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.78)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const confettiKeyRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    scaleAnim.setValue(0.78);
    opacityAnim.setValue(0);
    confettiKeyRef.current += 1;
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

  const codeLine = useMemo(() => String(couponCode || '').toUpperCase(), [couponCode]);
  const titleLine = useMemo(() => String(couponTitle || '').trim(), [couponTitle]);

  // Template image is portrait; keep consistent aspect ratio.
  // Slightly larger than before, while still fitting smaller phones.
  const cardWidth = Math.min(520, Math.max(400, SCREEN_WIDTH - 44));
  const cardHeight = Math.round(cardWidth * 1.39);
  const horizontalInset = Math.max(18, Math.round(cardWidth * 0.09));

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
              key={`coupon-confetti-${confettiKeyRef.current}`}
              count={90}
              origin={{ x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT - 60 }}
              fadeOut
              fallSpeed={2600}
              explosionSpeed={420}
              autoStart
            />
          ) : null}
        </View>
        <Animated.View style={[styles.popupLayer, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
            <ImageBackground
              source={require('@/assets/coupon-applied-template.png')}
              resizeMode="contain"
              style={styles.template}
            >
              {/* Top green section: "Coupon" / "Applied" (left aligned) */}
              <View style={styles.topAppliedWrap}>
                <Text style={styles.topCoupon}>Coupon</Text>
                <Text style={styles.topApplied}>Applied</Text>
              </View>

              {/* Middle green section: coupon code centered */}
              <Text
                style={[styles.codeCentered, { left: horizontalInset, right: horizontalInset }]}
                numberOfLines={1}
              >
                {codeLine || 'COUPON'}
              </Text>

              {/* White section: coupon title */}
              <Text
                style={[styles.titleInWhite, { left: horizontalInset, right: horizontalInset }]}
                numberOfLines={2}
              >
                {titleLine || 'Coupon applied successfully'}
              </Text>

              {/* OK button: small green centered */}
              <TouchableOpacity
                style={[styles.okButton, { maxWidth: cardWidth - horizontalInset * 2 }]}
                activeOpacity={0.9}
                onPress={onClose}
              >
                <Text style={styles.okButtonText}>OK</Text>
              </TouchableOpacity>
            </ImageBackground>
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
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
  },
  template: {
    width: '100%',
    height: '100%',
  },
  topAppliedWrap: {
    position: 'absolute',
    left: 120,
    top: 160,
  },
  topCoupon: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    lineHeight: 22,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  topApplied: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 32,
    lineHeight: 34,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  codeCentered: {
    position: 'absolute',
    left: 18,
    right: 20,
    top: 282,
    textAlign: 'center',
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    lineHeight: 26,
    color: '#FFFFFF',
    // letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  titleInWhite: {
    position: 'absolute',
    left: 46,
    right: 46,
    top: 367,
    textAlign: 'center',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  okButton: {
    position: 'absolute',
    left: 140,
    right: 0,
    top: 399,
    alignSelf: 'center',
    minWidth: 50,
    width: 120,
    // paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00B14F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    // elevation: 8,
  },
  okButtonText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    lineHeight: 18,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});

