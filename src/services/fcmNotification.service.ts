/**
 * FCM Notification Service
 * Native Firebase Cloud Messaging implementation for React Native
 * Replaces expo-notifications with native FCM
 */

import { Platform, AppState, NativeEventEmitter, NativeModules } from 'react-native';
import { apiService } from './api.service';
import { API_CONFIG } from '@/config/api.config';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditionally import Firebase to avoid errors if native modules aren't linked
let messaging: any = null;
let FirebaseMessagingTypes: any = null;

try {
  const firebaseMessaging = require('@react-native-firebase/messaging');
  messaging = firebaseMessaging.default;
  FirebaseMessagingTypes = firebaseMessaging.FirebaseMessagingTypes;
} catch (error) {
  console.warn('⚠️  FCM: Native module not available. Rebuild native app to enable FCM.');
}

const PUSH_TOKEN_KEY = '@tazty_fcm_token';

// Notification data interface
export interface NotificationData {
  [key: string]: string;
}

export interface NotificationPayload {
  title?: string;
  body?: string;
  data?: NotificationData;
  notificationId?: string;
  timestamp?: string;
  receivedAt?: number;
}

// Background message handler type
type BackgroundMessageHandler = (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => Promise<void>;

class FCMNotificationService {
  private fcmToken: string | null = null;
  private notificationListeners: Array<() => void> = [];
  private tokenRefreshListener: (() => void) | null = null;
  private messageListener: (() => void) | null = null;
  private notificationOpenedListener: (() => void) | null = null;
  private backgroundMessageHandler: BackgroundMessageHandler | null = null;
  private recentMessages: NotificationPayload[] = [];
  private readonly MAX_RECENT_MESSAGES = 50;

  /**
   * Initialize FCM service
   * Call this on app startup
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if Firebase messaging is available
      if (!messaging) {
        console.warn('⚠️  FCM: Native module not available. Rebuild native app to enable FCM.');
        console.warn('   Run: npm run android:dev or npm run ios:dev');
        return false;
      }

      // Request permissions
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn('⚠️  FCM: Notification permissions not granted');
        return false;
      }

      // Get FCM token
      await this.getToken();

      // Set up listeners
      this.setupListeners();

      // Check if app was opened from notification
      this.checkInitialNotification();

      console.log('✅ FCM: Service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ FCM: Initialization failed:', error);
      // Don't throw - allow app to continue without FCM
      return false;
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (!messaging) {
        return false;
      }

      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          console.log('✅ FCM: iOS Authorization status:', authStatus);
          return true;
        } else {
          console.warn('⚠️  FCM: iOS Authorization status:', authStatus);
          return false;
        }
      } else {
        // Android 13+ requires runtime permission
        const authStatus = await messaging().requestPermission();
        console.log('✅ FCM: Android permission granted');
        return true;
      }
    } catch (error) {
      console.error('❌ FCM: Permission request failed:', error);
      return false;
    }
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    try {
      if (!messaging) {
        return false;
      }

      if (Platform.OS === 'ios') {
        const authStatus = await messaging().hasPermission();
        return (
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL
        );
      } else {
        return true; // Android doesn't have a direct check
      }
    } catch (error) {
      console.error('❌ FCM: Error checking notification status:', error);
      return false;
    }
  }

  /**
   * Get FCM token
   */
  async getToken(): Promise<string | null> {
    try {
      if (!messaging) {
        return null;
      }

      // Check if we already have a token
      if (this.fcmToken) {
        return this.fcmToken;
      }

      // Get token from storage
      const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
      if (storedToken) {
        this.fcmToken = storedToken;
        return storedToken;
      }

      // Request new token from Firebase
      const token = await messaging().getToken();
      
      if (token) {
        this.fcmToken = token;
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
        console.log('✅ FCM: Token obtained:', token.substring(0, 20) + '...');
        
        // Send token to backend
        await this.sendTokenToBackend(token);
        
        return token;
      }

      return null;
    } catch (error) {
      console.error('❌ FCM: Failed to get token:', error);
      return null;
    }
  }

  /**
   * Send FCM token to backend
   */
  private async sendTokenToBackend(token: string): Promise<boolean> {
    try {
      const payload = {
        device_token: token,
        platform: Platform.OS, // 'ios' or 'android'
      };

      console.log('📤 FCM: Sending token to backend:', API_CONFIG.ENDPOINTS.BUYER.PUSH_TOKENS);
      console.log('   Payload:', JSON.stringify(payload, null, 2));

      const response = await apiService.post(
        API_CONFIG.ENDPOINTS.BUYER.PUSH_TOKENS,
        payload
      );

      if (response.success) {
        console.log('✅ FCM: Token sent to backend successfully');
        console.log('   Response:', JSON.stringify(response, null, 2));
        return true;
      } else {
        console.warn('⚠️  FCM: Backend returned success=false');
        console.warn('   Error:', response.error);
        console.warn('   Full response:', JSON.stringify(response, null, 2));
        return false;
      }
    } catch (error) {
      console.error('❌ FCM: Failed to send token to backend:', error);
      if (error instanceof Error) {
        console.error('   Error message:', error.message);
        console.error('   Error stack:', error.stack);
      }
      return false;
    }
  }

  /**
   * Set up FCM listeners
   */
  private setupListeners(): void {
    if (!messaging) {
      return;
    }

    // Token refresh listener
    this.tokenRefreshListener = messaging().onTokenRefresh(async (token: string) => {
      console.log('🔄 FCM: Token refreshed:', token.substring(0, 20) + '...');
      this.fcmToken = token;
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      await this.sendTokenToBackend(token);
    });

    // Foreground message listener
    this.messageListener = messaging().onMessage(async (remoteMessage: any) => {
      console.log('📨 FCM: Foreground message received:', remoteMessage.messageId);
      console.log('   Title:', remoteMessage.notification?.title || 'N/A');
      console.log('   Body:', remoteMessage.notification?.body || 'N/A');
      console.log('   Data:', JSON.stringify(remoteMessage.data || {}, null, 2));
      console.log('   Full message:', JSON.stringify(remoteMessage, null, 2));
      
      const payload: NotificationPayload = {
        title: remoteMessage.notification?.title,
        body: remoteMessage.notification?.body,
        data: remoteMessage.data as NotificationData,
        notificationId: remoteMessage.messageId,
      };

      // Store recent message
      this.addRecentMessage(payload);

      // Emit event for app to handle
      this.onForegroundMessage(payload);
    });

    // Notification opened listener (when user taps notification)
    this.notificationOpenedListener = messaging().onNotificationOpenedApp((remoteMessage: any) => {
      console.log('👆 FCM: Notification opened:', remoteMessage.messageId);
      
      const payload: NotificationPayload = {
        title: remoteMessage.notification?.title,
        body: remoteMessage.notification?.body,
        data: remoteMessage.data as NotificationData,
        notificationId: remoteMessage.messageId,
      };

      this.onNotificationOpened(payload);
    });

    // Listen for Android native events (if using custom service)
    if (Platform.OS === 'android') {
      const { FCMEventEmitter } = NativeModules;
      if (FCMEventEmitter) {
        const eventEmitter = new NativeEventEmitter(FCMEventEmitter);
        eventEmitter.addListener('FCMessageReceived', (payload: NotificationPayload) => {
          console.log('📨 FCM: Message received from native:', payload);
          this.onForegroundMessage(payload);
        });
        
        eventEmitter.addListener('FCMTokenRefreshed', (data: { token: string }) => {
          console.log('🔄 FCM: Token refreshed from native');
          this.fcmToken = data.token;
          AsyncStorage.setItem(PUSH_TOKEN_KEY, data.token);
          this.sendTokenToBackend(data.token);
        });
      }
    }
  }

  /**
   * Check if app was opened from a notification
   */
  private async checkInitialNotification(): Promise<void> {
    try {
      if (!messaging) {
        return;
      }

      const remoteMessage = await messaging().getInitialNotification();
      
      if (remoteMessage) {
        console.log('🚀 FCM: App opened from notification:', remoteMessage.messageId);
        
        const payload: NotificationPayload = {
          title: remoteMessage.notification?.title,
          body: remoteMessage.notification?.body,
          data: remoteMessage.data as NotificationData,
          notificationId: remoteMessage.messageId,
        };

        // Wait a bit for app to initialize
        setTimeout(() => {
          this.onNotificationOpened(payload);
        }, 1000);
      }
    } catch (error) {
      console.error('❌ FCM: Error checking initial notification:', error);
    }
  }

  /**
   * Set background message handler
   * This must be called outside of React component lifecycle
   */
  setBackgroundMessageHandler(handler: BackgroundMessageHandler): void {
    if (!messaging) {
      console.warn('⚠️  FCM: Cannot set background handler - native module not available');
      return;
    }
    this.backgroundMessageHandler = handler;
    messaging().setBackgroundMessageHandler(handler);
    console.log('✅ FCM: Background message handler set');
  }

  /**
   * Handle foreground message
   * Override this or listen to events
   */
  private onForegroundMessage(payload: NotificationPayload): void {
    // This can be overridden or you can listen to events
    console.log('📨 FCM: Foreground message handler called');
    console.log('   Payload:', JSON.stringify(payload, null, 2));
    
    // Emit custom event if needed
    // You can use EventEmitter or any state management solution
  }

  /**
   * Add message to recent messages list
   */
  private addRecentMessage(payload: NotificationPayload): void {
    const messageWithTimestamp = {
      ...payload,
      timestamp: new Date().toISOString(),
      receivedAt: Date.now(),
    };
    
    this.recentMessages.unshift(messageWithTimestamp);
    
    // Keep only the most recent messages
    if (this.recentMessages.length > this.MAX_RECENT_MESSAGES) {
      this.recentMessages = this.recentMessages.slice(0, this.MAX_RECENT_MESSAGES);
    }
  }

  /**
   * Get recent foreground messages
   */
  getRecentMessages(): NotificationPayload[] {
    return [...this.recentMessages];
  }

  /**
   * Clear recent messages
   */
  clearRecentMessages(): void {
    this.recentMessages = [];
    console.log('🧹 FCM: Recent messages cleared');
  }

  /**
   * Handle notification opened
   * Override this or listen to events
   */
  private onNotificationOpened(payload: NotificationPayload): void {
    console.log('👆 FCM: Notification opened:', payload);
    
    // Handle navigation based on notification data
    if (payload.data) {
      this.handleNotificationNavigation(payload.data);
    }
  }

  /**
   * Handle navigation based on notification data
   */
  private handleNotificationNavigation(data: NotificationData): void {
    // Example navigation handling
    // You can integrate with your navigation library here
    
    if (data.screen) {
      console.log('🧭 FCM: Navigate to screen:', data.screen);
      // Example: navigation.navigate(data.screen, data.params ? JSON.parse(data.params) : {});
    }
    
    if (data.orderId) {
      console.log('🧭 FCM: Navigate to order:', data.orderId);
      // Example: navigation.navigate('OrderDetails', { orderId: data.orderId });
    }
  }

  /**
   * Unregister FCM token from backend
   */
  async unregisterToken(): Promise<boolean> {
    try {
      const token = this.fcmToken || await AsyncStorage.getItem(PUSH_TOKEN_KEY);

      if (!token) {
        console.log('ℹ️  FCM: No token to unregister');
        return true; // Nothing to unregister
      }

      // URL encode the token for the path parameter
      const encodedToken = encodeURIComponent(token);
      const deleteEndpoint = API_CONFIG.ENDPOINTS.BUYER.DELETE_PUSH_TOKEN(encodedToken);
      const fullUrl = `${API_CONFIG.BASE_URL}${deleteEndpoint}`;

      console.log('🗑️  FCM: Deleting token from backend');
      console.log('   Endpoint:', deleteEndpoint);
      console.log('   Full URL:', fullUrl);
      console.log('   Token (first 50 chars):', token.substring(0, 50) + '...');

      // Delete token from Firebase (optional)
      if (messaging) {
        try {
          await messaging().deleteToken();
          console.log('✅ FCM: Token deleted from Firebase');
        } catch (error) {
          console.warn('⚠️  FCM: Failed to delete token from Firebase:', error);
        }
      }

      // Delete from backend
      const response = await apiService.delete(deleteEndpoint);

      console.log('📥 FCM: Delete token response:', JSON.stringify(response, null, 2));

      // Clear local storage
      this.fcmToken = null;
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);

      if (response.success) {
        console.log('✅ FCM: Token deleted from backend successfully');
        return true;
      } else {
        console.warn('⚠️  FCM: Backend returned success=false for token unregistration');
        console.warn('   Error:', response.error);
        return false;
      }
    } catch (error) {
      console.error('❌ FCM: Failed to unregister token:', error);
      if (error instanceof Error) {
        console.error('   Error message:', error.message);
        console.error('   Error stack:', error.stack);
      }
      
      // Still clear local storage even if API fails
      this.fcmToken = null;
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
      return false;
    }
  }

  /**
   * Get stored FCM token
   */
  async getStoredToken(): Promise<string | null> {
    if (this.fcmToken) {
      return this.fcmToken;
    }
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    if (this.tokenRefreshListener) {
      this.tokenRefreshListener();
      this.tokenRefreshListener = null;
    }

    if (this.messageListener) {
      this.messageListener();
      this.messageListener = null;
    }

    if (this.notificationOpenedListener) {
      this.notificationOpenedListener();
      this.notificationOpenedListener = null;
    }

    this.notificationListeners.forEach((unsubscribe) => unsubscribe());
    this.notificationListeners = [];

    console.log('🧹 FCM: Listeners cleaned up');
  }
}

// Export singleton instance
export const fcmNotificationService = new FCMNotificationService();
export default fcmNotificationService;

