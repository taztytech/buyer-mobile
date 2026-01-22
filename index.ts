import { registerRootComponent } from 'expo';

import App from './App';

// Background message handler must be imported AFTER registerRootComponent setup
// Import conditionally to avoid errors during development
try {
  require('./src/services/fcmBackgroundHandler');
} catch (error) {
  console.warn('FCM background handler not available:', error);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
