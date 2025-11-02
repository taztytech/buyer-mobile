/**
 * Push Notification Service
 * Handles FCM push notification registration and management
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
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
      // Only works on physical devices
      if (!Device.isDevice) {
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
        return false;
      }

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '7d65a380-eee0-49b0-9f39-a5cd6eaede5a',
      });

      this.pushToken = tokenData.data;

      // Save token locally
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, this.pushToken);

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

      return response.success;
    } catch (error) {
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
        return true; // Nothing to unregister
      }

      // Delete from backend
      const response = await apiService.delete(
        API_CONFIG.ENDPOINTS.BUYER.DELETE_PUSH_TOKEN(encodeURIComponent(token))
      );

      // Clear local storage
      this.pushToken = null;
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);

      return response.success;
    } catch (error) {
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
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Add notification response listener (when user taps notification)
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
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
