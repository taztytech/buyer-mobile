import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';

// Initialize Facebook tracking; call once on app start
export async function initFacebookAnalytics() {
  try {
    await Settings.setAdvertiserTrackingEnabled(true);
  } catch (e) {
    // Non-fatal; just avoid crashing
    console.warn('Facebook analytics init error', e);
  }
}

// Log standard "app open" event to help with install/campaign tracking
export function logAppOpen() {
  AppEventsLogger.logEvent('fb_mobile_activate_app');
}

// Log a purchase (for ROAS / campaign optimization)
export function logPurchase(amount: number, currency: string = 'INR') {
  AppEventsLogger.logPurchase(amount, currency);
}

// Log any custom event with optional parameters
export function logFacebookEvent(
  name: string,
  params?: Record<string, string | number>,
) {
  AppEventsLogger.logEvent(name, params);
}

