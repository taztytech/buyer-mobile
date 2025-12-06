/**
 * FCM Background Message Handler
 * This file must be imported in index.js/ts BEFORE the app component
 * Handles messages when app is in background or quit state
 */

// Conditionally import Firebase to avoid errors if native modules aren't linked
let messaging: any = null;
let FirebaseMessagingTypes: any = null;

try {
  const firebaseMessaging = require('@react-native-firebase/messaging');
  messaging = firebaseMessaging.default;
  FirebaseMessagingTypes = firebaseMessaging.FirebaseMessagingTypes;
  
  /**
   * Background message handler
   * This function runs when the app is in the background or quit state
   * It must be registered before the app component loads
   * 
   * Note: System notifications are automatically shown by native FCMService.kt
   * This handler is for processing data-only messages or updating local storage
   */
  if (messaging) {
    messaging().setBackgroundMessageHandler(
      async (remoteMessage: any) => {
        console.log('📨 FCM: Background message received:', remoteMessage.messageId);
        console.log('   Title:', remoteMessage.notification?.title);
        console.log('   Body:', remoteMessage.notification?.body);
        console.log('   Data:', remoteMessage.data);

        // System notification is automatically shown by native FCMService.kt
        // This handler can be used for:
        // - Processing data-only messages
        // - Updating local storage
        // - Syncing data in background
        
        if (remoteMessage.data) {
          // Process notification data if needed
          // Navigation will be handled when user taps the notification
          console.log('📦 FCM: Processing background message data');
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

