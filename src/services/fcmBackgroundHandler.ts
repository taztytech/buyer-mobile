/**
 * FCM Background Message Handler
 * This file must be imported in index.js/ts BEFORE the app component
 * Handles messages when app is in background or quit state
 * 
 * IMPORTANT: This handler runs in a headless JS context (no React, no UI)
 * - Cannot access React Context or Redux store
 * - Cannot navigate or show UI
 * - Can only save data to AsyncStorage for the app to read on next open
 * 
 * Strategy: Save notification data to AsyncStorage, app will read and process on next open
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditionally import Firebase to avoid errors if native modules aren't linked
let messaging: any = null;
let FirebaseMessagingTypes: any = null;

const BACKGROUND_NOTIFICATIONS_KEY = '@tazty_background_notifications';

try {
  // Check if we're in a development build (not RN CLI Go)
  const { NativeModules } = require('react-native');
  if (!NativeModules.RNFBAppModule) {
    throw new Error('Firebase native module not available - rebuild required');
  }
  
  const firebaseMessaging = require('@react-native-firebase/messaging');
  messaging = firebaseMessaging.default;
  FirebaseMessagingTypes = firebaseMessaging.FirebaseMessagingTypes;
  
  /**
   * Background message handler
   * This function runs when the app is in the background or quit state
   * It must be registered before the app component loads
   * 
   * Note: System notifications are automatically shown by native FCMService.kt
   * This handler saves order notification data to AsyncStorage
   * The app will read and process these on next open
   */
  if (messaging && typeof messaging === 'function') {
    messaging().setBackgroundMessageHandler(
      async (remoteMessage: any) => {
        console.log('📨 FCM: Background message received:', remoteMessage.messageId);
        console.log('   Title:', remoteMessage.notification?.title);
        console.log('   Body:', remoteMessage.notification?.body);
        console.log('   Data:', remoteMessage.data);

        // System notification is automatically shown by native FCMService.kt
        // We save order notification data to AsyncStorage for processing when app opens
        
        if (remoteMessage.data && remoteMessage.data.type === 'order') {
          try {
            // Get existing notifications
            const existingData = await AsyncStorage.getItem(BACKGROUND_NOTIFICATIONS_KEY);
            const notifications = existingData ? JSON.parse(existingData) : [];
            
            // Add new notification
            notifications.push({
              messageId: remoteMessage.messageId,
              data: remoteMessage.data,
              timestamp: Date.now(),
            });
            
            // Keep only last 50 notifications
            const trimmed = notifications.slice(-50);
            
            // Save back to storage
            await AsyncStorage.setItem(BACKGROUND_NOTIFICATIONS_KEY, JSON.stringify(trimmed));
            
            console.log('✅ FCM: Background order notification saved to storage');
          } catch (error) {
            console.warn('⚠️  FCM: Failed to save background notification:', error);
          }
        } else {
          console.log('📦 FCM: Non-order notification, skipping storage');
        }
      }
    );
    console.log('✅ FCM: Background message handler registered');
  }
} catch (error) {
  console.warn('⚠️  FCM: Background handler not available (native module not linked):', error);
  console.warn('   This is normal if you haven\'t rebuilt the native app yet.');
  console.warn('   Run: npm run android:dev or npm run ios:dev to rebuild');
}

// Export for use in index file
export default messaging;

