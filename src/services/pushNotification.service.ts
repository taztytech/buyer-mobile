/**
 * Push Notification Service
 * Handles FCM push notification registration and management
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiService } from './api.service';
import { API_CONFIG } from '@/config/api.config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = '@tazty_push_token';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class PushNotificationService {
  private pushToken: string | null = null;

  /**
   * Register for push notifications
   * Requests permissions, gets token, and sends to backend
   */
  async registerForPushNotifications(): Promise<boolean> {
    try {
      // Check if running in Expo Go
      const isExpoGo = Constants.executionEnvironment === 'storeClient';

      if (isExpoGo) {
        if (__DEV__) {
          console.warn(
            '⚠️  PUSH NOTIFICATIONS DISABLED IN EXPO GO\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            'Push notifications are not supported in Expo Go (SDK 53+).\n' +
            'To test push notifications:\n' +
            '1. Create a development build: npx eas build --profile development\n' +
            '2. Install the development build on your device\n' +
            '3. Test push notifications in the dev build\n' +
            '\nLearn more: https://docs.expo.dev/develop/development-builds/introduction/\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          );
        }
        return false;
      }

      // Only works on physical devices
      if (!Device.isDevice) {
        if (__DEV__) {
          console.warn('Push notifications only work on physical devices, not simulators/emulators');
        }
        return false;
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        if (__DEV__) {
          console.warn('Push notification permissions not granted by user');
        }
        return false;
      }

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '7d65a380-eee0-49b0-9f39-a5cd6eaede5a',
      });

      this.pushToken = tokenData.data;

      // Save token locally
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, this.pushToken);

      if (__DEV__) {
        console.log('✅ Push token registered:', this.pushToken);
      }

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#00B14F',
        });
      }

      // Send token to backend
      await this.sendTokenToBackend(this.pushToken);

      return true;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Push notification registration failed:', error);
        if (error instanceof Error) {
          console.error('Error details:', error.message);
        }
      }
      return false;
    }
  }

  /**
   * Send push token to backend
   */
  private async sendTokenToBackend(token: string): Promise<boolean> {
    try {
      const response = await apiService.post(
        API_CONFIG.ENDPOINTS.BUYER.PUSH_TOKENS,
        {
          token: token,
          device_type: Platform.OS, // 'ios' or 'android'
          device_name: Device.deviceName || 'Unknown Device',
        }
      );

      if (__DEV__) {
        if (response.success) {
          console.log('✅ Push token sent to backend successfully');
        } else {
          console.warn('⚠️  Backend returned success=false for push token registration');
        }
      }

      return response.success;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to send push token to backend:', error);
      }
      return false;
    }
  }

  /**
   * Unregister push token from backend (on logout)
   */
  async unregisterPushToken(): Promise<boolean> {
    try {
      // Get stored token
      const token = this.pushToken || await AsyncStorage.getItem(PUSH_TOKEN_KEY);

      if (!token) {
        if (__DEV__) {
          console.log('No push token to unregister');
        }
        return true; // Nothing to unregister
      }

      if (__DEV__) {
        console.log('Unregistering push token from backend...');
      }

      // Delete from backend
      const response = await apiService.delete(
        API_CONFIG.ENDPOINTS.BUYER.DELETE_PUSH_TOKEN(encodeURIComponent(token))
      );

      // Clear local storage
      this.pushToken = null;
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);

      if (__DEV__) {
        if (response.success) {
          console.log('✅ Push token unregistered successfully');
        } else {
          console.warn('⚠️  Backend returned success=false for push token unregistration');
        }
      }

      return response.success;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to unregister push token from backend:', error);
        console.log('Clearing local token storage anyway...');
      }

      // Still clear local storage even if API fails
      this.pushToken = null;
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
      return false;
    }
  }

  /**
   * Get stored push token
   */
  async getPushToken(): Promise<string | null> {
    if (this.pushToken) {
      return this.pushToken;
    }

    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  }

  /**
   * Add notification received listener
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Add notification response listener (when user taps notification)
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /**
   * Check if push notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
