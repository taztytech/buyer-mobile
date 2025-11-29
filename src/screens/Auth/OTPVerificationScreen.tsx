import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { authService } from '@/services/auth.service';
import { useConfirmation } from '@/context/ConfirmationContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OTPVerificationScreenProps {
  phoneNumber?: string;
  onBack?: () => void;
  onSuccess?: (isExistingUser: boolean) => void;
}

export const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({
  phoneNumber = '',
  onBack,
  onSuccess
}) => {
  const { showConfirmation } = useConfirmation();
  const [otp, setOtp] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(61);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];
  const autofillTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-focus first input when component mounts
  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
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
      return;
    }

    // Handle single digit input (manual typing)
    const newOtp = [...otp];
    newOtp[index] = cleaned;
    setOtp(newOtp);

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
      showConfirmation({
        title: 'Error',
        message: 'Please enter the complete 4-digit OTP',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
      return;
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

        showConfirmation({
          title: '',
          message: detailedMessage,
          confirmText: 'OK',
          cancelText: 'Close',
          onConfirm: () => {},
        });
        // Clear OTP inputs on error
        setOtp(['', '', '', '']);
        inputRefs[0].current?.focus();
      }
    } catch (error: any) {
      showConfirmation({
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (timer > 0) return;

    try {
      setIsResending(true);

      // Call the resend OTP API
      const response = await authService.sendOtp(phoneNumber);

      if (response.success) {
        // Reset timer and OTP inputs
        setTimer(61);
        setOtp(['', '', '', '']);
        inputRefs[0].current?.focus();

        showConfirmation({
          title: 'Success',
          message: 'OTP has been resent to your phone number.',
          confirmText: 'OK',
          cancelText: 'Close',
          onConfirm: () => {},
        });
      } else {
        // Show error message with better context
        const errorMessage = response.error || 'Failed to resend OTP';
        const detailedMessage = errorMessage.includes('Failed to generate OTP')
          ? 'Please wait a bit longer before requesting a new OTP. Try again in a minute.'
          : errorMessage;

        showConfirmation({
          title: 'Error',
          message: detailedMessage,
          confirmText: 'OK',
          cancelText: 'Close',
          onConfirm: () => {},
        });
      }
    } catch (error: any) {
      showConfirmation({
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleLinkPress = (url: string) => {
    Linking.openURL(url).catch(err => {});
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#00B14F" />

      <View style={styles.mainContainer}>
        {/* Green Background Section */}
        <View style={styles.greenSection}>
          {/* Verification Title */}
          <Text style={styles.title}>Verification</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            We have sent a 4 digit code to your number
          </Text>

          {/* OTP Illustration */}
          <Image
            source={require('@/assets/OTP-asset.png')}
            style={styles.illustrationImage}
            resizeMode="contain"
          />
        </View>

        {/* White Bottom Sheet */}
        <View style={styles.bottomSheet}>
          <View style={styles.formContainer}>
            {/* Verification Code Label */}
            <Text style={styles.inputLabel}>ENTER VERIFICATION CODE</Text>

            {/* OTP Input Row */}
            <View style={styles.otpInputRow}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={inputRefs[index]}
                  style={[
                    styles.otpBox,
                    digit ? styles.otpBoxFilled : null,
                  ]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                  textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                  autoComplete={index === 0 ? 'sms-otp' : 'off'}
                  importantForAutofill={index === 0 ? 'yes' : 'no'}
                />
              ))}
            </View>

            {/* Bottom Action Row - Timer and Resend Code */}
            <View style={styles.resendRow}>
              <View style={styles.resendRightGroup}>
                <TouchableOpacity
                  onPress={handleResendCode}
                  disabled={timer > 0 || isResending}
                >
                  <Text style={[
                    styles.resendText,
                    timer === 0 && !isResending && styles.resendTextActive
                  ]}>
                    {isResending ? 'Sending...' : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.timerText}>0.{timer.toString().padStart(2, '0')} s</Text>
              </View>
            </View>

            {/* VERIFY & PROCEED Button */}
            <TouchableOpacity
              style={[styles.verifyButton, isVerifying && styles.verifyButtonDisabled]}
              onPress={handleVerify}
              activeOpacity={0.8}
              disabled={isVerifying}
            >
              <View style={styles.verifyButtonContent}>
                <Text style={styles.verifyButtonText}>
                  {isVerifying ? 'VERIFYING...' : 'VERIFY & PROCEED'}
                </Text>
                {!isVerifying && <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />}
              </View>
            </TouchableOpacity>
          </View>

          {/* Terms & Privacy */}
          <Text style={styles.termsText}>
            By Clicking, You agree our{' '}
            <Text
              style={styles.termsLink}
              onPress={() => handleLinkPress('https://tazty.in/terms')}
            >
              T&C
            </Text>
            {' and '}
            <Text
              style={styles.termsLink}
              onPress={() => handleLinkPress('https://tazty.in/privacy')}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  mainContainer: {
    flex: 1,
    position: 'relative',
  },
  greenSection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 258,
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
  },
  title: {
    position: 'absolute',
    left: 20,
    top: 64,
    width: 181,
    height: 45,
    fontFamily: 'Poppins_700Bold',
    fontSize: 30,
    lineHeight: 45,
    color: '#FFFFFF',
  },
  subtitle: {
    position: 'absolute',
    left: 20,
    top: 113,
    width: 180,
    height: 52,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 26,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  illustrationImage: {
    position: 'absolute',
    left: 103,
    top: 44,
    width: 339.52,
    height: 255,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 258,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  inputLabel: {
    width: '100%',
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    textTransform: 'uppercase',
    color: '#001E1F',
    marginBottom: 4,
  },
  otpInputRow: {
    flexDirection: 'row',
    width: '100%',
    height: 60,
    gap: 9,
    marginBottom: 8,
  },
  otpBox: {
    flex: 1,
    height: 60,
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#001E1F',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  otpBoxFilled: {
    backgroundColor: '#D8D8D8',
    borderColor: '#515151',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    height: 21,
    marginBottom: 0,
  },
  resendRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: colors.primary,
    width: 60,
    textAlign: 'right',
  },
  resendText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(0, 30, 31, 0.5)',
  },
  resendTextActive: {
    color: colors.primary,
  },
  verifyButton: {
    width: '100%',
    height: 60,
    backgroundColor: '#00B14F',
    borderRadius: 10,
    overflow: 'hidden',
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 19,
    gap: 10,
  },
  verifyButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  termsText: {
    width: '100%',
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'center',
    color: 'rgba(0, 30, 31, 0.5)',
    marginBottom: 30,
  },
  termsLink: {
    fontFamily: 'Poppins_600SemiBold',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
