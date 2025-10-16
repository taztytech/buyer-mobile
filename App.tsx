import React from 'react';
import { LoginScreen } from '@/screens/Auth/LoginScreen';
import { OTPVerificationScreen } from '@/screens/Auth/OTPVerificationScreen';
import { HomeScreen } from '@/screens/Home/HomeScreen';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authService } from '@/services/auth.service';
import { apiService } from '@/services/api.service';

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [currentScreen, setCurrentScreen] = React.useState<'login' | 'otp' | 'home'>('login');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);

  const [fontsLoaded] = useFonts({
    'Poppins': Poppins_400Regular,
    'Poppins_400Regular': Poppins_400Regular,
    'Poppins_500Medium': Poppins_500Medium,
    'Poppins_600SemiBold': Poppins_600SemiBold,
    'Poppins_700Bold': Poppins_700Bold,
  });

  // Check if user is already logged in on app startup
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        // Initialize API service with stored tokens
        await apiService.initialize();

        // Check if user is authenticated
        const isLoggedIn = await authService.isAuthenticated();

        if (isLoggedIn) {
          setCurrentScreen('home');
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  React.useEffect(() => {
    if (fontsLoaded && !isCheckingAuth) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isCheckingAuth]);

  const handleLoginSuccess = (phone: string) => {
    setPhoneNumber(phone);
    setCurrentScreen('otp');
  };

  const handleOtpSuccess = () => {
    setCurrentScreen('home');
  };

  const handleLogout = () => {
    setCurrentScreen('login');
    setPhoneNumber('');
  };

  const handleBackToLogin = () => {
    setCurrentScreen('login');
  };

  if (!fontsLoaded || isCheckingAuth) {
    return null;
  }

  return (
    <SafeAreaProvider>
      {currentScreen === 'login' ? (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      ) : currentScreen === 'otp' ? (
        <OTPVerificationScreen
          phoneNumber={phoneNumber}
          onBack={handleBackToLogin}
          onSuccess={handleOtpSuccess}
        />
      ) : (
        <HomeScreen onLogout={handleLogout} />
      )}
    </SafeAreaProvider>
  );
}
