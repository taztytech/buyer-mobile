import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '@/services/auth.service';
import { useConfirmation } from '@/context/ConfirmationContext';

interface WelcomeScreenProps {
  onContinue?: (name: string, email: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  const { showConfirmation } = useConfirmation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const nameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);

  // Animated values for smooth, elegant transitions
  const greenSectionOpacity = useRef(new Animated.Value(1)).current;
  const greenSectionTranslateY = useRef(new Animated.Value(0)).current;
  const formContainerTranslateY = useRef(new Animated.Value(0)).current;
  const nameInputScale = useRef(new Animated.Value(1)).current;
  const emailInputScale = useRef(new Animated.Value(1)).current;
  const nameInputBorder = useRef(new Animated.Value(0)).current;
  const emailInputBorder = useRef(new Animated.Value(0)).current;
  const errorOpacity = useRef(new Animated.Value(0)).current;
  const errorTranslateY = useRef(new Animated.Value(-10)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  // State tracking for form animations (set but not read - used for state management)
  const [_focusedField, setFocusedField] = React.useState<'name' | 'email' | null>(null);
  const [isFormMoved, setIsFormMoved] = React.useState(false);

  // Smooth easing function for natural motion
  const smoothEasing = Easing.bezier(0.4, 0.0, 0.2, 1);
  const springConfig = { tension: 100, friction: 8 };

  // Listen to keyboard events - restore form when keyboard hides
  React.useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        const keyboardHeightValue = event.endCoordinates.height;
        setKeyboardHeight(keyboardHeightValue);
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => {
        setKeyboardHeight(0);
        setIsFormMoved(false);
        const animationDuration = Platform.OS === 'ios'
          ? event.duration || 300
          : 300;

        // Restore green section and form position when keyboard hides
        Animated.parallel([
          Animated.timing(greenSectionOpacity, {
            toValue: 1,
            duration: animationDuration,
            easing: smoothEasing,
            useNativeDriver: true,
          }),
          Animated.timing(greenSectionTranslateY, {
            toValue: 0,
            duration: animationDuration,
            easing: smoothEasing,
            useNativeDriver: true,
          }),
          Animated.timing(formContainerTranslateY, {
            toValue: 0,
            duration: animationDuration,
            easing: smoothEasing,
            useNativeDriver: true,
          }),
        ]).start();
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Input focus animations
  const handleInputFocus = (inputType: 'name' | 'email') => {
    setFocusedField(inputType);

    // Animate focused input with subtle scale and border
    if (inputType === 'name') {
      // Keep green section visible; only animate input/form behavior.
      setIsFormMoved(true);
      Animated.parallel([
        Animated.spring(nameInputScale, {
          toValue: 1.01,
          ...springConfig,
          useNativeDriver: true,
        }),
        Animated.timing(nameInputBorder, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(formContainerTranslateY, {
          toValue: -120,
          duration: 350,
          easing: smoothEasing,
          useNativeDriver: true,
        }),
      ]).start();

      // Reset email input
      Animated.parallel([
        Animated.spring(emailInputScale, {
          toValue: 1,
          ...springConfig,
          useNativeDriver: true,
        }),
        Animated.timing(emailInputBorder, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      // Email focused - keep green section visible and move form consistently.
      setIsFormMoved(true);
      Animated.parallel([
        Animated.spring(emailInputScale, {
          toValue: 1.01,
          ...springConfig,
          useNativeDriver: true,
        }),
        Animated.timing(emailInputBorder, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(formContainerTranslateY, {
          toValue: -120,
          duration: 350,
          easing: smoothEasing,
          useNativeDriver: true,
        }),
      ]).start();

      // Reset name input
      Animated.parallel([
        Animated.spring(nameInputScale, {
          toValue: 1,
          ...springConfig,
          useNativeDriver: true,
        }),
        Animated.timing(nameInputBorder, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    }

    // Scroll to ensure input is visible with smooth animation
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: 0,
        animated: true,
      });
    }, 100);
  };

  const handleInputBlur = (inputType: 'name' | 'email') => {
    // Reset input animations with smooth transitions
    if (inputType === 'name') {
      Animated.parallel([
        Animated.spring(nameInputScale, {
          toValue: 1,
          ...springConfig,
          useNativeDriver: true,
        }),
        Animated.timing(nameInputBorder, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(emailInputScale, {
          toValue: 1,
          ...springConfig,
          useNativeDriver: true,
        }),
        Animated.timing(emailInputBorder, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    }

    setFocusedField(null);
  };

  // Show error with animation
  const showError = (errorMessage: string) => {
    setError(errorMessage);
    Animated.parallel([
      Animated.timing(errorOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(errorTranslateY, {
        toValue: 0,
        ...springConfig,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Hide error with animation
  const hideError = () => {
    Animated.parallel([
      Animated.timing(errorOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(errorTranslateY, {
        toValue: -10,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setError('');
    });
  };

  const handleContinue = async () => {
    Keyboard.dismiss();

    // Hide error if exists
    if (error) {
      hideError();
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Validation
    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFullName) {
      showError('Please enter your full name');
      return;
    }

    if (!trimmedEmail) {
      showError('Please enter your email');
      return;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showError('Please enter a valid email address');
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
          onConfirm: () => { },
        });
        setIsLoading(false);
        return;
      }

      // Call the create profile API with the exact format required
      const response = await authService.createProfile({
        name: trimmedFullName,
        email: trimmedEmail,
        phone_number: parseInt(phoneNumber, 10),
        status: true,
      });

      if (response.success) {
        // Navigate to home screen
        if (onContinue) {
          onContinue(trimmedFullName, trimmedEmail);
        }
      } else {
        // Show error message
        showConfirmation({
          title: 'Error',
          message: 'Email already exist',
          confirmText: 'OK',
          cancelText: 'Close',
          onConfirm: () => { },
        });
      }
    } catch (error: any) {
      showConfirmation({
        title: 'Error',
        message: 'Email already exist',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => { },
      });
    } finally {
      setIsLoading(false);
    }
  };


  // Interpolate border color for smooth transition
  const nameBorderColor = nameInputBorder.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', '#00B14F'],
  });

  const emailBorderColor = emailInputBorder.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', '#00B14F'],
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            keyboardHeight > 0 && { paddingBottom: keyboardHeight + 20 },
            isFormMoved && { flexGrow: 0 }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          keyboardDismissMode="interactive"
          scrollEnabled={!isFormMoved}
        >
          {/* Green Background Section with Elegant Animation */}
          <Animated.View
            style={[
              styles.greenSection,
              {
                opacity: greenSectionOpacity,
                transform: [
                  { translateY: greenSectionTranslateY },
                ],
              },
            ]}
          >
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
          </Animated.View>

          {/* White Bottom Sheet with Smooth Animation */}
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                transform: [{ translateY: formContainerTranslateY }],
              },
            ]}
          >
            <View style={styles.formContainer}>
              {/* Title */}
              <Text style={styles.title}>Whats your name</Text>
              <Text style={styles.subtitle}>Lets get to know you better</Text>

              {/* Full Name Input with Focus Animation */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <Animated.View
                  style={[
                    styles.inputWrapper,
                    {
                      borderColor: nameBorderColor,
                    },
                  ]}
                >
                  <Animated.View
                    style={{
                      transform: [{ scale: nameInputScale }],
                    }}
                  >
                    <TextInput autoCorrect={false}
                      ref={nameInputRef}
                      style={styles.input}
                      placeholder="Enter your full name"
                      placeholderTextColor="rgba(0, 30, 31, 0.3)"
                      value={fullName}
                      onChangeText={(text) => {
                        setFullName(text);
                        if (error) {
                          hideError();
                        }
                      }}
                      autoCapitalize="words"
                      maxLength={18}
                      returnKeyType="next"
                      onSubmitEditing={() => {
                        emailInputRef.current?.focus();
                      }}
                      onFocus={() => handleInputFocus('name')}
                      onBlur={() => handleInputBlur('name')}
                    />
                  </Animated.View>
                </Animated.View>
              </View>

              {/* Email Input with Focus Animation */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <Animated.View
                  style={[
                    styles.inputWrapper,
                    {
                      borderColor: emailBorderColor,
                    },
                  ]}
                >
                  <Animated.View
                    style={{
                      transform: [{ scale: emailInputScale }],
                    }}
                  >
                    <TextInput autoCorrect={false}
                      ref={emailInputRef}
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor="rgba(0, 30, 31, 0.3)"
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (error) {
                          hideError();
                        }
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      maxLength={30}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        Keyboard.dismiss();
                      }}
                      onFocus={() => handleInputFocus('email')}
                      onBlur={() => handleInputBlur('email')}
                    />
                  </Animated.View>
                </Animated.View>
              </View>

              {/* Animated Error Message */}
              {error ? (
                <Animated.View
                  style={[
                    styles.errorContainer,
                    {
                      opacity: errorOpacity,
                      transform: [{ translateY: errorTranslateY }],
                    },
                  ]}
                >
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              ) : null}

              {/* Continue Button with Animation */}
              <Animated.View
                style={{
                  transform: [{ scale: buttonScale }],
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.continueButton,
                    isLoading && styles.continueButtonDisabled,
                    (!fullName.trim() || !email.trim()) && styles.continueButtonInactive,
                  ]}
                  onPress={handleContinue}
                  activeOpacity={0.85}
                  disabled={isLoading || !fullName.trim() || !email.trim()}
                  onPressIn={() => {
                    if (!isLoading && fullName.trim() && email.trim()) {
                      Animated.spring(buttonScale, {
                        toValue: 0.98,
                        ...springConfig,
                        useNativeDriver: true,
                      }).start();
                    }
                  }}
                  onPressOut={() => {
                    Animated.spring(buttonScale, {
                      toValue: 1,
                      ...springConfig,
                      useNativeDriver: true,
                    }).start();
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.continueButtonText}>CONTINUE</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    // Keep root background white so keyboard/layout shifts never expose green at the bottom.
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 0,
  },
  formContainer: {
    width: '100%',
    gap: 16,
    paddingBottom: 40,
    flex: 1,
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
  inputWrapper: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
  },
  input: {
    width: '100%',
    height: 60,
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 16,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#001E1F',
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
  errorContainer: {
    width: '100%',
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#D32F2F',
  },
  errorText: {
    width: '100%',
    fontFamily: 'Poppins',
    fontSize: 13,
    lineHeight: 18,
    color: '#D32F2F',
  },
  continueButtonInactive: {
    opacity: 0.5,
  },
});
