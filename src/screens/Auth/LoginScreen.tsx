import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { authService } from '@/services/auth.service';

interface LoginScreenProps {
  onLoginSuccess?: (phoneNumber: string) => void;
  onBack?: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
  initialPhoneNumber?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onBack,
  onOpenTerms,
  onOpenPrivacy,
  initialPhoneNumber,
}) => {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#00B14F" />

      <View style={styles.whiteBackgroundWrapper}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.mainContainer}>
              {/* Green Background Section */}
              <View style={styles.greenSection}>
                {/* Skip at top-right */}
                {onBack ? (
                  <View style={styles.skipTopRow}>
                    <View style={styles.skipSpacer} />
                    <TouchableOpacity
                      style={styles.skipButton}
                      onPress={onBack}
                      activeOpacity={0.7}
                      hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel="Skip login"
                    >
                      <Text style={styles.skipButtonText}>Skip</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {/* Header: Title + Subtitle */}
                <View style={styles.headerRow}>
                  <View>
                    <Text style={styles.title}>Log In</Text>
                    <Text style={styles.subtitle}>Login with Your Mobile Number</Text>
                  </View>
                </View>

                {/* Delivery Illustration */}
                <Image
                  source={require('@/assets/login-illustration.png')}
                  style={styles.illustrationImage}
                  resizeMode="contain"
                />
              </View>

              {/* White Bottom Sheet */}
              <View style={styles.bottomSheet}>
                <View style={styles.formContainer}>
                  {/* Mobile Number Label */}
                  <Text style={styles.inputLabel}>MOBILE NUMBER</Text>

                  {/* Phone Input Row */}
                  <View style={styles.phoneInputRow}>
                    {/* Country Code Box */}
                    <View style={styles.countryCodeBox}>
                      <Text style={styles.flagEmoji}>🇮🇳</Text>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>

                    {/* Phone Number Input */}
                    <TextInput
                      autoCorrect={false}
                      style={styles.phoneInput}
                      placeholder="Mobile Number"
                      placeholderTextColor="#999"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={phoneNumber}
                      onChangeText={handlePhoneChange}
                    />
                  </View>

                  {/* Inline Error Message */}
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  {/* LOG IN Button */}
                  <TouchableOpacity
                    style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                    onPress={handleLogin}
                    activeOpacity={0.8}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.loginButtonText}>LOG IN</Text>
                        <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Terms & Privacy anchored above system nav area */}
        <SafeAreaView style={styles.bottomSafeArea} edges={['bottom']}>
          <View style={styles.bottomTermsContainer}>
            <Text style={styles.termsText}>
              By Clicking, You agree our{' '}
              <Text
                style={styles.termsLink}
                onPress={onOpenTerms}
              >
                T&C
              </Text>
              {' and '}
              <Text
                style={styles.termsLink}
                onPress={onOpenPrivacy}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  whiteBackgroundWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainContainer: {
    flex: 1,
  },
  bottomSafeArea: {
    backgroundColor: '#FFFFFF',
  },
  bottomTermsContainer: {
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  greenSection: {
    height: 258,
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  skipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    zIndex: 10,
    elevation: 10,
  },
  skipSpacer: {
    flex: 1,
  },
  headerRow: {
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 30,
    lineHeight: 45,
    color: '#FFFFFF',
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 20,
  },
  skipButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 4,
    width: 180,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 26,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  illustrationImage: {
    position: 'absolute',
    left: 100,
    top: 40,
    width: 378,
    height: 252,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    minHeight: 400,
    justifyContent: 'space-between',
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
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
  phoneInputRow: {
    flexDirection: 'row',
    width: '100%',
    height: 60,
    gap: 9,
    marginBottom: 8,
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 91,
    height: 60,
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
    paddingHorizontal: 15,
    gap: 8,
  },
  flagEmoji: {
    fontSize: 20,
    textAlign: 'center',
  },
  countryCodeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
    color: '#001E1F',
    textAlign: 'center',
  },
  phoneInput: {
    flex: 1,
    height: 60,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 0,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#001E1F',
    textAlignVertical: 'center',
  },
  errorText: {
    width: '100%',
    marginTop: 4,
    marginBottom: 4,
    fontFamily: 'Poppins',
    fontSize: 13,
    lineHeight: 18,
    color: '#D32F2F',
  },
  loginButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: 60,
    backgroundColor: '#00B14F',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 19,
    gap: 10,
  },
  loginButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  socialSection: {
    flexDirection: 'column',
    alignItems: 'center',
    width: 217,
    gap: 20,
  },
  orText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#646982',
  },
  googleButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: 60,
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 19,
    gap: 10,
  },
  googleIcon: {
    width: 16,
    height: 16,
  },
  googleButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#001E1F',
  },
  termsText: {
    width: '100%',
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'center',
    color: 'rgba(0, 30, 31, 0.5)',
    marginBottom: 8,
  },
  termsLink: {
    fontFamily: 'Poppins_600SemiBold',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
