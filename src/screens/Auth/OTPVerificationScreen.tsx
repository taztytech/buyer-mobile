import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { authService } from '@/services/auth.service';

interface OTPVerificationScreenProps {
  phoneNumber?: string;
  onBack?: () => void;
  onSuccess?: (isExistingUser: boolean) => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

export const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({
  phoneNumber = '',
  onBack,
  onSuccess,
  onOpenTerms,
  onOpenPrivacy,
}) => {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(61);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const inputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];
  // Auto-focus first input when component mounts
  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  useEffect(() => {
    if (timer <= 0) {
      return () => { };
    }

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  const handleOtpChange = (value: string, index: number) => {
    // Only allow digits
    const cleaned = value.replace(/\D/g, '');

    // Handle autofill or paste - when multiple digits are provided in first input
    if (index === 0 && cleaned.length > 1) {
      // Take exactly 4 digits from the autofilled value
      const digits = cleaned.slice(0, 4).split('');
      const newOtp = ['', '', '', ''];

      // Fill in all the digits from the start
      digits.forEach((digit, i) => {
        if (i < 4) {
          newOtp[i] = digit;
        }
      });

      setOtp(newOtp);

      if (error) {
        setError('');
      }
      if (info) {
        setInfo('');
      }

      // Focus the last input if all 4 digits are filled
      if (digits.length === 4) {
        // Small delay to ensure state is updated before blurring
        setTimeout(() => {
          inputRefs[3].current?.blur();
        }, 50);
      } else {
        const nextIndex = Math.min(digits.length, 3);
        inputRefs[nextIndex].current?.focus();
      }
      return;
    }

    // For other inputs, if we get multiple digits, it might be autofill trying to fill each box
    // In this case, just take the first digit
    if (cleaned.length > 1) {
      const newOtp = [...otp];
      newOtp[index] = cleaned.charAt(0);
      setOtp(newOtp);

      if (error) {
        setError('');
      }
      if (info) {
        setInfo('');
      }

      if (index < 3) {
        inputRefs[index + 1].current?.focus();
      }
      return;
    }

    // Handle empty value
    if (cleaned === '') {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);

      if (error) {
        setError('');
      }
      if (info) {
        setInfo('');
      }
      return;
    }

    // Handle single digit input (manual typing)
    const newOtp = [...otp];
    newOtp[index] = cleaned;
    setOtp(newOtp);

    if (error) {
      setError('');
    }
    if (info) {
      setInfo('');
    }

    // Auto-focus next input
    if (cleaned && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 4) {
      setError('Please enter the complete 4-digit OTP');
      return;
    }

    // Clear any previous messages before verifying
    if (error) {
      setError('');
    }
    if (info) {
      setInfo('');
    }

    setIsVerifying(true);

    try {
      // Call the verify OTP API
      const response = await authService.verifyOtp(phoneNumber, otpCode);

      if (response.success && response.data) {
        // OTP verified successfully

        // Navigate based on existing_user status
        if (onSuccess) {
          onSuccess(response.data.existing_user);
        }
      } else {
        // Check if OTP is expired or invalid
        const errorMessage = response.error || response.message || '';
        const isExpired = errorMessage.toLowerCase().includes('expired') ||
          errorMessage.toLowerCase().includes('expire') ||
          errorMessage.toLowerCase().includes('expiration');

        const detailedMessage = isExpired
          ? 'Code expired. Please click on Resend OTP.'
          : 'Incorrect OTP. Please enter the 4-digit code.';

        setError(detailedMessage);
        // Clear OTP inputs on error
        setOtp(['', '', '', '']);
        inputRefs[0].current?.focus();
      }
    } catch (error: any) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (timer > 0) return;

    try {
      setIsResending(true);

      // Clear any previous messages before resending
      if (error) {
        setError('');
      }
      if (info) {
        setInfo('');
      }

      // Call the resend OTP API
      const response = await authService.sendOtp(phoneNumber);

      if (response.success) {
        // Reset timer and OTP inputs
        setTimer(61);
        setOtp(['', '', '', '']);
        inputRefs[0].current?.focus();
        setInfo('OTP has been resent to your phone number.');
      } else {
        // Show error message with better context
        const errorMessage = response.error || 'Failed to resend OTP';
        const detailedMessage = errorMessage.includes('Failed to generate OTP')
          ? 'Please wait a bit longer before requesting a new OTP. Try again in a minute.'
          : errorMessage;

        setError(detailedMessage);
      }
    } catch (error: any) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // All four digits in (typed or SMS autofill): verify straight away.
  const otpCode = otp.join('');
  const lastAutoRef = useRef('');
  useEffect(() => {
    if (otpCode.length === 4 && !isVerifying && lastAutoRef.current !== otpCode) {
      lastAutoRef.current = otpCode;
      handleVerify();
    }
    if (otpCode.length < 4) lastAutoRef.current = '';
  }, [otpCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = otpCode.length === 4;
  const masked = phoneNumber ? `+91 ${phoneNumber.slice(0, 5)} ${phoneNumber.slice(5)}` : 'your number';

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
              {onBack ? (
                <TouchableOpacity onPress={onBack} style={styles.back} hitSlop={12} testID="otp-back-button">
                  <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
              <View style={styles.heroInner}>
                <View style={styles.heroText}>
                  <Text style={styles.heroTitle}>Verify your{'\n'}number</Text>
                  <Text style={styles.heroTagline}>Almost there, your food is waiting!</Text>
                </View>
                <View style={styles.lockWrap}>
                  <View style={styles.lockBlob} />
                  <View style={styles.lockBubble}>
                    <Text style={styles.lockEmoji}>🔐</Text>
                  </View>
                  <View style={[styles.miniBubble, styles.miniA]}>
                    <Text style={styles.miniEmoji}>🍛</Text>
                  </View>
                  <View style={[styles.miniBubble, styles.miniB]}>
                    <Text style={styles.miniEmoji}>💬</Text>
                  </View>
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.welcome}>Enter the 4-digit code</Text>
            <View style={styles.sentRow}>
              <Text style={styles.welcomeSub}>Sent by SMS to </Text>
              <Text style={styles.phone}>{masked}</Text>
              {onBack ? (
                <TouchableOpacity onPress={onBack} hitSlop={8} testID="otp-change-number">
                  <Text style={styles.change}>  Change</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.otpRow}>
              {otp.map((digit, index) => (
                <TextInput
                  autoCorrect={false}
                  key={index}
                  ref={inputRefs[index]}
                  style={[styles.otpBox, digit ? styles.otpBoxFilled : null, !!error && styles.otpBoxError]}
                  value={digit}
                  onChangeText={value => handleOtpChange(value, index)}
                  onKeyPress={e => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                  textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                  autoComplete={index === 0 ? 'sms-otp' : 'off'}
                  importantForAutofill={index === 0 ? 'yes' : 'no'}
                  testID={`otp-input-${index}`}
                />
              ))}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {info ? <Text style={styles.infoText}>{info}</Text> : null}

            <TouchableOpacity
              onPress={handleVerify}
              activeOpacity={0.85}
              disabled={isVerifying}
              style={styles.ctaTouch}
              testID="otp-verify-button"
            >
              <LinearGradient
                colors={complete ? ['#0A6B35', '#7DC242'] : ['#8FBF9F', '#C2DDA6']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.cta}
              >
                {isVerifying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.ctaText}>Verify & continue</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.resendRow}>
              {timer > 0 ? (
                <Text style={styles.resendWait}>
                  {"Didn't get it? Resend in "}
                  <Text style={styles.timer}>{`0:${timer.toString().padStart(2, '0')}`}</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendCode} disabled={isResending} testID="otp-resend-button">
                  <Text style={styles.resendActive}>{isResending ? 'Sending…' : 'Resend code'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SafeAreaView edges={['bottom']} style={styles.bottom}>
        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink} onPress={onOpenTerms} testID="otp-terms-link">
            Terms
          </Text>
          {' and '}
          <Text style={styles.termsLink} onPress={onOpenPrivacy} testID="otp-privacy-link">
            Privacy Policy
          </Text>
        </Text>
      </SafeAreaView>
    </View>
  );
};

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
  back: {
    marginLeft: 14,
    marginTop: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 10,
    minHeight: 160,
  },
  heroText: { flex: 1, paddingRight: 8 },
  heroTitle: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
  heroTagline: {
    marginTop: 10,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.92)',
  },
  lockWrap: { width: 130, height: 130 },
  lockBlob: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: 114,
    height: 114,
    borderRadius: 57,
    backgroundColor: 'rgba(212,245,90,0.22)',
  },
  lockBubble: {
    position: 'absolute',
    left: 28,
    top: 28,
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  lockEmoji: { fontSize: 38, lineHeight: 46 },
  miniBubble: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  miniA: { left: 0, top: 80 },
  miniB: { right: 0, top: 4 },
  miniEmoji: { fontSize: 20, lineHeight: 26 },
  form: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 16 },
  welcome: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.2,
    color: INK,
  },
  sentRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 4, marginBottom: 24 },
  welcomeSub: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: '#6B756E',
  },
  phone: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.3,
    color: INK,
  },
  change: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: '#1E9A45',
  },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  otpBox: {
    flex: 1,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#F3F6EE',
    borderWidth: 1.5,
    borderColor: '#F3F6EE',
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 24,
    letterSpacing: 0,
    color: INK,
  },
  otpBoxFilled: { backgroundColor: '#FFFFFF', borderColor: '#1E9A45' },
  otpBoxError: { borderColor: '#E53935' },
  errorText: {
    marginTop: 10,
    marginLeft: 4,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
    color: '#D32F2F',
  },
  infoText: {
    marginTop: 10,
    marginLeft: 4,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
    color: '#1E9A45',
  },
  ctaTouch: { marginTop: 22, borderRadius: 29, overflow: 'hidden' },
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
  resendRow: { alignItems: 'center', marginTop: 16 },
  resendWait: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    letterSpacing: 0.1,
    color: MUTED,
  },
  timer: { fontFamily: 'Poppins', fontWeight: '700', color: GREEN },
  resendActive: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
    color: GREEN,
    textDecorationLine: 'underline',
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
