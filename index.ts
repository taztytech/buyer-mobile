import { AppRegistry } from 'react-native';

import App from './App';

// Background message handler must be imported AFTER registerRootComponent setup
// Import conditionally to avoid errors during development
try {
  require('./src/services/fcmBackgroundHandler');
} catch (error) {
  console.warn('FCM background handler not available:', error);
}

AppRegistry.registerComponent('main', () => App);
