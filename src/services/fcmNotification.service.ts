/**
 * FCM Notification Service
 * Native Firebase Cloud Messaging implementation for React Native
 * Replaces expo-notifications with native FCM
 */

import { Platform, NativeEventEmitter, NativeModules, PermissionsAndroid } from 'react-native';
import { apiService } from './api.service';
import { API_CONFIG } from '@/config/api.config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { handleOrderNotification, OrdersDispatch } from './orderNotificationHandler';

// Conditionally import Firebase to avoid errors if native modules aren't linked
let messaging: any = null;

try {
  // Check if native module exists before requiring
  const { NativeModules } = require('react-native');
  if (NativeModules.RNFBAppModule) {
    const firebaseMessaging = require('@react-native-firebase/messaging');
    messaging = firebaseMessaging.default;
  } else {
    console.warn('⚠️  FCM: Native module RNFBAppModule not found. Rebuild native app to enable FCM.');
    console.warn('   Run: npm run android:dev or npm run ios:dev');
  }
} catch (error) {
  console.warn('⚠️  FCM: Native module not available. Rebuild native app to enable FCM.');
  console.warn('   Error:', error instanceof Error ? error.message : String(error));
}

const PUSH_TOKEN_KEY = '@tazty_fcm_token';
const DEVICE_ID_KEY = '@tazty_device_id';

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
type BackgroundMessageHandler = (remoteMessage: any) => Promise<void>;

// Navigation callback type for handling notification taps
export interface NotificationNavigationTarget {
  orderId: string;
  target: 'orders' | 'track';
}

export type NotificationNavigationCallback = (payload: NotificationNavigationTarget) => void;

class FCMNotificationService {
  private fcmToken: string | null = null;
  private notificationListeners: Array<() => void> = [];
  private tokenRefreshListener: (() => void) | null = null;
  private messageListener: (() => void) | null = null;
  private notificationOpenedListener: (() => void) | null = null;
  private lastProcessedMessageId: string | null = null;
  private lastProcessedTime: number = 0;
  private processedNotificationIds = new Set<string>();
  private recentMessages: NotificationPayload[] = [];
  private readonly MAX_RECENT_MESSAGES = 50;
  private navigationCallback: NotificationNavigationCallback | null = null;
  private ordersDispatch: OrdersDispatch | null = null;
  private pendingNavigationPayload: NotificationNavigationTarget | null = null;

  /**
   * Set navigation callback for handling notification taps
   * This callback will be called when a notification is tapped
   */
  setNavigationCallback(callback: NotificationNavigationCallback | null): void {
    this.navigationCallback = callback;
    if (callback && this.pendingNavigationPayload) {
      const pendingPayload = this.pendingNavigationPayload;
      this.pendingNavigationPayload = null;
      try {
        callback(pendingPayload);
      } catch (error) {
        console.warn('⚠️  FCM: Failed to process pending navigation callback:', error);
      }
    }
  }

  /**
   * Set orders dispatch for updating orders store from FCM
   */
  setOrdersDispatch(dispatch: OrdersDispatch | null): void {
    this.ordersDispatch = dispatch;
  }

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

      // Do NOT request permissions here. Permissions are requested after login in App.tsx.
      // This prevents showing the popup on splash/startup.

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
        // Android 13+ (API 33+) requires POST_NOTIFICATIONS runtime permission
        const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : parseInt(Platform.Version, 10);
        if (androidVersion >= 33) {
          try {
            const hasPermission = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );

            if (!hasPermission) {
              console.log('📱 Android 13+: Requesting POST_NOTIFICATIONS permission...');
              const result = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
              );

              if (result === PermissionsAndroid.RESULTS.GRANTED) {
                console.log('✅ FCM: Android POST_NOTIFICATIONS permission granted');
                // Also request FCM permission
                await messaging().requestPermission();
                return true;
              } else {
                console.warn('⚠️  FCM: Android POST_NOTIFICATIONS permission denied');
                return false;
              }
            } else {
              console.log('✅ FCM: Android POST_NOTIFICATIONS already granted');
              // Still request FCM permission to ensure token is available
              await messaging().requestPermission();
              return true;
            }
          } catch (error) {
            console.warn('⚠️  FCM: Error requesting Android permission:', error);
            // Fallback to FCM permission request
            await messaging().requestPermission();
            return true;
          }
        } else {
          // Android 12 and below - FCM handles permissions automatically
          await messaging().requestPermission();
          console.log('✅ FCM: Android permission granted');
          return true;
        }
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
        // Android 13+ (API 33+) requires explicit permission check
        const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : parseInt(Platform.Version, 10);
        if (androidVersion >= 33) {
          try {
            const hasPermission = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            return hasPermission;
          } catch (error) {
            console.warn('⚠️  FCM: Error checking Android permission:', error);
            // Fallback: assume granted for older behavior
            return true;
          }
        } else {
          // Android 12 and below - permissions are granted by default
          return true;
        }
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

      // Firebase on iOS requires explicit device registration before fetching the token
      if (Platform.OS === 'ios') {
        if (!messaging().isDeviceRegisteredForRemoteMessages) {
          try {
            await messaging().registerDeviceForRemoteMessages();
            console.log('✅ FCM: Registered device for remote messages on iOS');
          } catch (regError) {
            console.warn('⚠️ FCM: Failed to register device for remote messages:', regError);
          }
        }
      }

      // Request new token from Firebase
      const token = await messaging().getToken();

      if (token) {
        this.fcmToken = token;
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
        console.log('✅ FCM: Full Token obtained:', token);

        // CRITICAL: Only send token to backend if user is logged in
        // On fresh install, user is not logged in yet, so skip backend registration
        // Token will be registered after login via registerTokenAfterLogin()
        const isLoggedIn = await AsyncStorage.getItem('@tazty_is_logged_in') === 'true';
        if (isLoggedIn) {
          // User is logged in, send token to backend
          await this.sendTokenToBackend(token).catch((error) => {
            // Silent fail - token registration can be retried later
            console.warn('⚠️  FCM: Failed to send token to backend during getToken:', error);
          });
        } else {
          console.log('ℹ️  FCM: User not logged in, skipping backend registration. Token will be registered after login.');
        }

        return token;
      }

      return null;
    } catch (error) {
      console.error('❌ FCM: Failed to get token:', error);
      return null;
    }
  }

  /**
   * Get or create a unique device ID
   */
  private async getDeviceId(): Promise<string> {
    try {
      // Try to get existing device ID from storage
      let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

      if (!deviceId) {
        // Generate a new device ID (UUID format)
        // Using a simple UUID v4-like generator
        deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16).toUpperCase();
        });

        // Store it for future use
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
        console.log('📱 FCM: Generated new device ID:', deviceId);
      }

      return deviceId;
    } catch (error) {
      console.error('❌ FCM: Failed to get device ID:', error);
      // Fallback to a temporary ID if storage fails
      return `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Get app version
   */
  private getAppVersion(): string {
    return Constants.expoConfig?.version || '1.0.0';
  }

  /**
   * Register FCM token after login
   * Call this after successful authentication
   */
  async registerTokenAfterLogin(): Promise<boolean> {
    try {
      // Get or request token
      const token = await this.getToken();
      if (!token) {
        console.warn('⚠️  FCM: No token available to register after login');
        return false;
      }

      // Send token to backend
      const success = await this.sendTokenToBackend(token);
      if (success) {
        console.log('✅ FCM: Token registered successfully after login');
      }
      return success;
    } catch (error) {
      console.error('❌ FCM: Failed to register token after login:', error);
      return false;
    }
  }

  /**
   * Send FCM token to backend
   * Now public so it can be called from test screen
   */
  async sendTokenToBackend(token: string): Promise<boolean> {
    try {
      const deviceId = await this.getDeviceId();
      const appVersion = this.getAppVersion();

      const payload = {
        device_token: token,
        platform: Platform.OS, // 'ios' or 'android'
        device_id: deviceId,
        app_version: appVersion,
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
    // In foreground, FCM doesn't automatically show notifications
    // The native FCMService.kt will handle showing system notifications
    // We just need to handle the data for navigation and order updates
    this.messageListener = messaging().onMessage(async (remoteMessage: any) => {
      console.log('📨 FCM: Foreground message received:', remoteMessage.messageId);
      console.log('   Title:', remoteMessage.notification?.title || 'N/A');
      console.log('   Body:', remoteMessage.notification?.body || 'N/A');
      console.log('   Data:', JSON.stringify(remoteMessage.data || {}, null, 2));

      const payload: NotificationPayload = {
        title: remoteMessage.notification?.title,
        body: remoteMessage.notification?.body,
        data: remoteMessage.data as NotificationData,
        notificationId: remoteMessage.messageId,
      };

      // Store recent message
      this.addRecentMessage(payload);

      // Handle order notification updates if dispatch is available
      if (this.ordersDispatch && remoteMessage.data?.type === 'order') {
        console.log('✅ FCM: Processing order notification update - Status will be updated in all screens');
        handleOrderNotification(remoteMessage, this.ordersDispatch, false).catch((error) => {
          console.warn('⚠️  FCM: Failed to handle order notification:', error);
        });
      } else {
        console.log('⚠️  FCM: Not processing as order notification', {
          hasDispatch: !!this.ordersDispatch,
          notificationType: remoteMessage.data?.type,
        });
      }

      // Note: System notification is shown by native FCMService.kt
      // We handle navigation when user taps the notification
      // No need to manually show notification here - native layer handles it
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

      // Handle order notification updates if dispatch is available
      if (this.ordersDispatch && remoteMessage.data?.type === 'order') {
        console.log('✅ FCM: Processing order notification (initial) - Status will be updated');
        handleOrderNotification(remoteMessage, this.ordersDispatch, true).catch((error) => {
          console.warn('⚠️  FCM: Failed to handle order notification:', error);
        });
      }

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

        eventEmitter.addListener('FCMNotificationOpened', (data: { [key: string]: string }) => {
          console.log('👆 FCM: Notification opened from native intent bridge');
          this.handleNotificationFromIntent(data);
        });
      }
    }
  }

  /**
   * Check if app was opened from a notification
   * This handles both FCM getInitialNotification and Android intent extras
   * Call this when app becomes active
   */
  async checkInitialNotification(): Promise<void> {
    try {
      let remoteMessage: any = null;
      if (messaging) {
        // Check FCM initial notification (works for both iOS and Android)
        remoteMessage = await messaging().getInitialNotification();
      }

      if (remoteMessage) {
        console.log('🚀 FCM: App opened from notification:', remoteMessage.messageId);

        const payload: NotificationPayload = {
          title: remoteMessage.notification?.title,
          body: remoteMessage.notification?.body,
          data: remoteMessage.data as NotificationData,
          notificationId: remoteMessage.messageId,
        };

        // Handle order notification updates if dispatch is available
        if (this.ordersDispatch && remoteMessage.data?.type === 'order') {
          console.log('✅ FCM: Processing order notification (opened) - Status will be updated');
          handleOrderNotification(remoteMessage, this.ordersDispatch, true).catch((error) => {
            console.warn('⚠️  FCM: Failed to handle order notification:', error);
          });
        }

        // Handle navigation immediately; if callback isn't ready yet, it will be queued.
        this.onNotificationOpened(payload);
        return;
      }

      // For Android: fallback to native intent bridge data.
      if (Platform.OS === 'android') {
        const { FCMEventEmitter } = NativeModules;
        if (FCMEventEmitter?.getInitialNotificationData) {
          const intentData = await FCMEventEmitter.getInitialNotificationData();
          if (intentData && typeof intentData === 'object') {
            this.handleNotificationFromIntent(intentData as { [key: string]: string });
          }
        }
      }
    } catch (error) {
      console.error('❌ FCM: Error checking initial notification:', error);
    }
  }

  /**
   * Handle notification data from Android intent extras
   * Call this when app becomes active to check for notification data
   */
  handleNotificationFromIntent(data: { [key: string]: string } | null): void {
    if (!data) {
      return;
    }

    // Extract orderId from various possible field names
    const orderId = data.orderId || data.order_id || data.orderID || data['order-id'];
    const orderNumber = data.order_number || data.orderNumber || data['order-number'];

    if (orderId || orderNumber) {
      console.log('📱 FCM: App opened from notification (intent), orderId/orderNumber:', orderId || orderNumber);

      const payload: NotificationPayload = {
        title: data.title,
        body: data.body,
        data: data as NotificationData,
        notificationId:
          data.messageId ||
          data.notification_id ||
          `${orderId || orderNumber}:${data.status || data.new_status || data.order_status || data.current_status || 'unknown'}`,
      };

      // Handle navigation
      this.onNotificationOpened(payload);
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
    if (payload.notificationId && this.processedNotificationIds.has(payload.notificationId)) {
      console.log('ℹ️  FCM: Notification already consumed, skipping:', payload.notificationId);
      return;
    }

    // Prevent duplicate processing of the same notification within a short window (2 seconds)
    // iOS sometimes triggers both getInitialNotification and onNotificationOpenedApp
    const now = Date.now();
    if (
      payload.notificationId &&
      payload.notificationId === this.lastProcessedMessageId &&
      (now - this.lastProcessedTime) < 2000
    ) {
      console.log('ℹ️  FCM: Notification already processed recently, skipping:', payload.notificationId);
      return;
    }

    this.lastProcessedMessageId = payload.notificationId || null;
    this.lastProcessedTime = now;
    if (payload.notificationId) {
      this.processedNotificationIds.add(payload.notificationId);
      // Keep this bounded to avoid unbounded growth in long sessions.
      if (this.processedNotificationIds.size > 200) {
        const ids = Array.from(this.processedNotificationIds);
        this.processedNotificationIds = new Set(ids.slice(ids.length - 200));
      }
    }

    console.log('👆 FCM: Notification opened:', payload);

    // Handle navigation based on notification data
    if (payload.data) {
      this.handleNotificationNavigation(payload.data);
    }
  }

  /**
   * Handle navigation based on notification data
   * Route ALL order notification taps to My Orders.
   */
  private handleNotificationNavigation(data: NotificationData): void {
    const isOrderNotification =
      (data.type || '').toString().trim().toLowerCase() === 'order' ||
      !!(data.orderId || data.order_id || data.orderID || data['order-id'] || data.order_number || data.orderNumber || data['order-number']);

    if (!isOrderNotification) {
      console.log('ℹ️  FCM: Not an order notification tap. Skipping navigation.');
      return;
    }

    // Extract orderId from notification data
    // Support multiple possible field names: orderId, order_id, orderID, etc.
    let orderId = data.orderId || data.order_id || data.orderID || data['order-id'];

    // If no orderId but we have order_number, try to find it using the lookup function
    if (!orderId) {
      const orderNumber = data.order_number || data.orderNumber || data['order-number'];
      if (orderNumber && this.ordersDispatch) {
        // We can't directly lookup here, but the handler will find it
        // For navigation, we'll use order_number as a fallback identifier
        // The navigation callback should handle both orderId and orderNumber
        console.log('🧭 FCM: No orderId, using order_number for navigation:', orderNumber);
        // Note: The navigation callback expects orderId, but we can pass orderNumber
        // and let the OrdersScreen find it by order_number
        orderId = orderNumber; // Use order_number as identifier
      }
    }

    const rawStatus =
      data.status ||
      data.new_status ||
      data.order_status ||
      data.current_status ||
      '';
    const normalizedStatus = rawStatus.toString().trim().toLowerCase();
    const target: NotificationNavigationTarget['target'] = 'orders';
    const normalizedOrderId = orderId || '';
    const navigationPayload: NotificationNavigationTarget = { orderId: normalizedOrderId, target };

    console.log(`🧭 FCM: Navigating to My Orders for order: ${normalizedOrderId || 'N/A'}, status: ${normalizedStatus || 'unknown'}`);

    // Call navigation callback if set
    if (this.navigationCallback) {
      this.navigationCallback(navigationPayload);
    } else {
      // App may still be initializing; queue navigation and replay once callback is set.
      this.pendingNavigationPayload = navigationPayload;
      console.warn(`⚠️  FCM: Navigation callback not set yet. Queued ${target} navigation.`);
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

      // Clear local storage (tokens are also cleared by storageService.clearAll() on logout)
      this.fcmToken = null;
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
      // Note: Device ID is cleared by storageService.clearAll() on logout
      // We don't clear it here to avoid breaking analytics if unregister is called separately

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
    this.processedNotificationIds.clear();

    console.log('🧹 FCM: Listeners cleaned up');
  }
}

// Export singleton instance
export const fcmNotificationService = new FCMNotificationService();
export default fcmNotificationService;

