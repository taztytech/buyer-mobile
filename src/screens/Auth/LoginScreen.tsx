import React, { useState } from 'react';
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { authService } from '@/services/auth.service';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LoginScreenProps {
  onLoginSuccess?: (phoneNumber: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
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

    if (cleaned.length > 0 && cleaned.length < 10) {
      setError('Phone number must be 10 digits');
    } else if (cleaned.length === 10 && !validatePhoneNumber(cleaned)) {
      setError('Invalid phone number');
    } else {
      setError('');
    }
  };

  const handleLogin = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid 10-digit Indian phone number');
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
      } else {
        // Show error message
        Alert.alert('Error', response.error || 'Failed to send OTP. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // TODO: Implement Google login
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
          {/* Log In Title */}
          <Text style={styles.title}>Log In</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>Login with Your Mobile Number</Text>

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
                style={styles.phoneInput}
                placeholder="Mobile Number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                maxLength={10}
                value={phoneNumber}
                onChangeText={handlePhoneChange}
              />
            </View>

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

            {/* Social Section */}
            <View style={styles.socialSection}>
              {/* Or Text */}
              <Text style={styles.orText}>Or</Text>

              {/* Google Sign In Button */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleLogin}
                activeOpacity={0.8}
              >
                <Image
                  source={require('@/assets/google-icon.png')}
                  style={styles.googleIcon}
                  resizeMode="contain"
                />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>
            </View>
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
    width: 90,
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
    left: 100,
    top: 40,
    width: 378,
    height: 252,
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
    gap: 24,
  },
  inputLabel: {
    width: '100%',
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    textTransform: 'uppercase',
    color: '#001E1F',
    marginBottom: 9,
  },
  phoneInputRow: {
    flexDirection: 'row',
    width: '100%',
    height: 60,
    gap: 9,
    marginBottom: 24,
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
  },
  termsLink: {
    fontFamily: 'Poppins_600SemiBold',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
