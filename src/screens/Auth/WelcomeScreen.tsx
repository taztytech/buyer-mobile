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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { authService } from '@/services/auth.service';
import { useConfirmation } from '@/context/ConfirmationContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WelcomeScreenProps {
  onContinue?: (name: string, email: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  const { showConfirmation } = useConfirmation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Listen to keyboard events
  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const handleContinue = async () => {
    // Validation
    if (!fullName.trim()) {
      showConfirmation({
        title: 'Required',
        message: 'Please enter your full name',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
      return;
    }

    if (!email.trim()) {
      showConfirmation({
        title: 'Required',
        message: 'Please enter your email address',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showConfirmation({
        title: 'Invalid Email',
        message: 'Please enter a valid email address',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get current user to retrieve phone number
      const currentUser = await authService.getCurrentUser();
      const phoneNumber = currentUser?.phoneNumber;

      if (!phoneNumber) {
        showConfirmation({
          title: 'Error',
          message: 'Phone number not found. Please login again.',
          confirmText: 'OK',
          cancelText: 'Close',
          onConfirm: () => {},
        });
        setIsLoading(false);
        return;
      }

      // Call the create profile API with the exact format required
      const response = await authService.createProfile({
        name: fullName,
        email: email,
        phone_number: parseInt(phoneNumber, 10),
        status: true,
      });

      if (response.success) {
        // Navigate to home screen
        if (onContinue) {
          onContinue(fullName, email);
        }
      } else {
        // Show error message
        showConfirmation({
          title: 'Error',
          message: response.error || 'Failed to create profile. Please try again.',
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
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Green Background Section */}
          <View style={styles.greenSection}>
            {/* Welcome Title */}
            <Text style={styles.welcomeTitle}>Welcome</Text>

            {/* Subtitle */}
            <Text style={styles.welcomeSubtitle}>Enter your name to{'\n'}continue</Text>

            {/* Welcome Illustration */}
            <Image
              source={require('@/assets/welcome-screen.png')}
              style={styles.illustrationImage}
              resizeMode="contain"
            />
          </View>

          {/* White Bottom Sheet */}
          <View style={styles.bottomSheet}>
            <View style={styles.formContainer}>
              {/* Title */}
              <Text style={styles.title}>Whats your name</Text>
              <Text style={styles.subtitle}>Lets get to know you better</Text>

              {/* Full Name Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="rgba(0, 30, 31, 0.3)"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="rgba(0, 30, 31, 0.3)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => {
                    // Scroll to bottom when email input is focused to ensure it's visible
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }}
                />
              </View>

              {/* Continue Button */}
              <TouchableOpacity
                style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
                onPress={handleContinue}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.continueButtonText}>CONTINUE</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  greenSection: {
    height: 258,
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
    position: 'relative',
  },
  welcomeTitle: {
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
  welcomeSubtitle: {
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
    right: -30,
    bottom: -23,
    width: 271.62,
    height: 204,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: 500,
  },
  formContainer: {
    width: '100%',
    gap: 24,
  },
  title: {
    width: '100%',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 24,
    lineHeight: 36,
    color: '#001E1F',
  },
  subtitle: {
    width: '100%',
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(0, 30, 31, 0.6)',
  },
  inputContainer: {
    width: '100%',
  },
  inputLabel: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#001E1F',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    height: 60,
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#001E1F',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  continueButton: {
    width: '100%',
    height: 60,
    backgroundColor: '#00B14F',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
