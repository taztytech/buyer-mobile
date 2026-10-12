import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, BackHandler, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { authService } from '@/services/auth.service';

interface LoginScreenProps {
  onLoginSuccess?: (phoneNumber: string) => void;
  onBack?: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
  initialPhoneNumber?: string;
}

// `onBack` stays in the props type (callers still pass it) but the Skip button
// that used it was removed — login is the only way forward from this screen.
export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onOpenTerms,
  onOpenPrivacy,
  initialPhoneNumber,
}) => {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Intercept Android back here so it never hits App's handler with a stale pre-login screen (e.g. locationSelection).
  // BackHandler invokes listeners LIFO; this mounts after App's listener and runs first.
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  }, []);

  const validatePhoneNumber = (number: string): boolean => {
    // Indian phone numbers: 10 digits, starting with 6-9
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(number);
  };

  const handlePhoneChange = (text: string) => {
    // Only allow digits
    const cleaned = text.replace(/\D/g, '');
    setPhoneNumber(cleaned);

    if (error) {
      setError('');
    }
  };

  const handleLogin = async () => {
    if (!phoneNumber) {
      setError('Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);

    try {
      // Call the send OTP API
      const response = await authService.sendOtp(phoneNumber);

      if (response.success) {
        // OTP sent successfully, navigate to OTP screen
        if (onLoginSuccess) {
          onLoginSuccess(phoneNumber);
        }

        // Clear any previous error on successful login attempt
        setError('');
      } else {
        // Show error message with better context for rate limiting
        const errorMessage = response.error || 'Failed to send OTP. Please try again.';
        const detailedMessage = errorMessage.includes('Failed to generate OTP')
          ? 'Please try again after a minute.'
          : errorMessage;

        setError(detailedMessage);
      }
    } catch (error: any) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const [focused, setFocused] = useState(false);
  const ready = validatePhoneNumber(phoneNumber);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A6B35" translucent={false} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <LinearGradient
            colors={['#0A6B35', '#1E9A45', '#7DC242']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <SafeAreaView edges={['top']}>
              <View style={styles.heroInner}>
                <View style={styles.heroText}>
                  <Wordmark />
                  <Text style={styles.heroTagline}>
                    {"Madurai's favourite food,\nhot at your door."}
                  </Text>
                </View>
                <FoodCluster />
              </View>
            </SafeAreaView>
          </LinearGradient>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.welcome}>Welcome back 👋</Text>
            <Text style={styles.welcomeSub}>Log in or sign up with your mobile number</Text>

            <View
              style={[styles.phoneField, focused && styles.phoneFieldFocused, !!error && styles.phoneFieldError]}
            >
              <View style={styles.cc}>
                <Text style={styles.flag}>🇮🇳</Text>
                <Text style={styles.ccText}>+91</Text>
              </View>
              <View style={styles.ccDivider} />
              <TextInput
                autoCorrect={false}
                style={styles.phoneInput}
                placeholder="Mobile number"
                placeholderTextColor="#9AA39A"
                keyboardType="phone-pad"
                maxLength={10}
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={handleLogin}
                testID="login-phone-input"
              />
              {ready && <MaterialIcons name="check-circle" size={20} color="#1E9A45" />}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={isLoading}
              style={styles.ctaTouch}
              testID="login-continue-button"
            >
              <LinearGradient
                colors={ready ? ['#0A6B35', '#7DC242'] : ['#8FBF9F', '#C2DDA6']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.cta}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.ctaText}>Continue</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.otpHint}>{"We'll send a 4-digit OTP to verify it's you"}</Text>

            <View style={styles.perksDivider}>
              <View style={styles.line} />
              <Text style={styles.perksTitle}>Why foodies love Tazty</Text>
              <View style={styles.line} />
            </View>
            <View style={styles.perks}>
              <Perk emoji="🍛" title="Local favourites" sub="Madurai's best kitchens" />
              <Perk emoji="⚡" title="Quick delivery" sub="Hot and fresh" />
              <Perk emoji="🔒" title="Secure login" sub="OTP, no password" />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SafeAreaView edges={['bottom']} style={styles.bottom}>
        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink} onPress={onOpenTerms} testID="login-terms-link">
            Terms
          </Text>
          {' and '}
          <Text style={styles.termsLink} onPress={onOpenPrivacy} testID="login-privacy-link">
            Privacy Policy
          </Text>
        </Text>
      </SafeAreaView>
    </View>
  );
};

/* The real logo letters; "ty" in lime for a two-tone wordmark. */
const WORD = [
  { src: require('@/assets/splash-letters/T_cap.png'), w: 85, lime: false },
  { src: require('@/assets/splash-letters/a.png'), w: 119, lime: false },
  { src: require('@/assets/splash-letters/z.png'), w: 109, lime: false },
  { src: require('@/assets/splash-letters/t.png'), w: 63, lime: true },
  { src: require('@/assets/splash-letters/y.png'), w: 118, lime: true },
];
const WORD_H = 40;
const LIME = '#D4F55A';

const Wordmark: React.FC = () => (
  <View style={styles.wordmark} accessibilityLabel="Tazty">
    {WORD.map((l, i) => (
      <Image
        key={i}
        source={l.src}
        style={{ width: (l.w * WORD_H) / 251, height: WORD_H, tintColor: l.lime ? LIME : '#FFFFFF' }}
        resizeMode="contain"
      />
    ))}
    <View style={styles.wordDot} />
  </View>
);

const FOODS = [
  { e: '🍛', size: 50, x: 34, y: 18, d: 0 },
  { e: '🍔', size: 30, x: 0, y: 92, d: 600 },
  { e: '🍕', size: 30, x: 92, y: 96, d: 1200 },
  { e: '🍗', size: 24, x: 100, y: 0, d: 300 },
  { e: '🥤', size: 22, x: 2, y: 8, d: 900 },
];
const BOB_MS = 3200;

/* Food bubbles bobbing gently in the hero. */
const FoodCluster: React.FC = () => {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: BOB_MS, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  const pts = Array.from({ length: 9 }, (_, k) => k / 8);
  return (
    <View style={styles.cluster} pointerEvents="none">
      <View style={styles.blob} />
      {FOODS.map((f, i) => {
        const phase = (f.d / BOB_MS) * 2 * Math.PI;
        const box = f.size + 18;
        return (
          <Animated.View
            key={i}
            style={[
              styles.foodBubble,
              {
                left: f.x,
                top: f.y,
                width: box,
                height: box,
                borderRadius: box / 2,
                transform: [
                  {
                    translateY: t.interpolate({
                      inputRange: pts,
                      outputRange: pts.map(p => Math.sin(p * 2 * Math.PI + phase) * 5),
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={{ fontSize: f.size, lineHeight: Math.round(f.size * 1.25) }}>{f.e}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
};

const Perk: React.FC<{ emoji: string; title: string; sub: string }> = ({ emoji, title, sub }) => (
  <View style={styles.perk}>
    <View style={styles.perkIcon}>
      <Text style={styles.perkEmoji}>{emoji}</Text>
    </View>
    <Text style={styles.perkTitle}>{title}</Text>
    <Text style={styles.perkSub}>{sub}</Text>
  </View>
);

const GREEN = '#0A6B35';
const INK = '#14201A';
const MUTED = '#8A938C';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 26,
    overflow: 'hidden',
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 26,
    minHeight: 190,
  },
  heroText: { flex: 1, paddingRight: 8 },
  wordmark: { flexDirection: 'row', alignItems: 'flex-end' },
  wordDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: LIME,
    marginLeft: 3,
    marginBottom: 4,
  },
  heroTagline: {
    marginTop: 12,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.92)',
  },
  cluster: { width: 140, height: 150 },
  blob: {
    position: 'absolute',
    left: 10,
    top: 16,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212,245,90,0.22)',
  },
  foodBubble: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  form: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 16 },
  welcome: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.2,
    color: INK,
  },
  welcomeSub: {
    marginTop: 4,
    marginBottom: 22,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: '#6B756E',
  },
  phoneField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    borderRadius: 18,
    backgroundColor: '#F3F6EE',
    borderWidth: 1.5,
    borderColor: '#F3F6EE',
    paddingHorizontal: 16,
  },
  phoneFieldFocused: { borderColor: '#1E9A45', backgroundColor: '#FFFFFF' },
  phoneFieldError: { borderColor: '#E53935' },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flag: { fontSize: 18 },
  ccText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.2,
    color: INK,
  },
  ccDivider: { width: 1, height: 26, backgroundColor: '#D5DCD2', marginHorizontal: 12 },
  phoneInput: {
    flex: 1,
    height: 58,
    paddingVertical: 0,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 16,
    letterSpacing: 1,
    color: INK,
  },
  errorText: {
    marginTop: 8,
    marginLeft: 4,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
    color: '#D32F2F',
  },
  ctaTouch: { marginTop: 20, borderRadius: 29, overflow: 'hidden' },
  cta: {
    height: 56,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  otpHint: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    letterSpacing: 0.1,
    color: MUTED,
  },
  perksDivider: { flexDirection: 'row', alignItems: 'center', marginTop: 30, marginBottom: 16 },
  line: { flex: 1, height: 1, backgroundColor: '#E6EAE4' },
  perksTitle: {
    marginHorizontal: 10,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    letterSpacing: 0.3,
    color: MUTED,
  },
  perks: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  perk: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: '#F7FAF3',
  },
  perkIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  perkEmoji: { fontSize: 22 },
  perkTitle: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.1,
    color: INK,
    textAlign: 'center',
  },
  perkSub: {
    marginTop: 2,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 10.5,
    letterSpacing: 0.1,
    color: '#7A847D',
    textAlign: 'center',
  },
  bottom: { backgroundColor: '#FFFFFF' },
  termsText: {
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 12,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.1,
    textAlign: 'center',
    color: MUTED,
  },
  termsLink: { fontFamily: 'Poppins', fontWeight: '600', color: GREEN, textDecorationLine: 'underline' },
});
