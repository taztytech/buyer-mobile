/**
 * Microsoft Clarity — session recording + heatmaps for the Tazty buyer app.
 *
 * Project: "tazty buyer App" (clarity.microsoft.com project id yhutjadrj7).
 *
 * Initialized once at app start. Every call is wrapped so a Clarity failure can
 * never crash or block the app — analytics is never worth losing an order over.
 * Clarity masks input fields by default; anything sensitive rendered as plain
 * text still needs the project's masking settings set appropriately.
 *
 * The SDK depends on native code, so it does nothing under Expo Go. Testing has
 * to happen on a dev build or a real release APK.
 */
import {
  initialize,
  setCustomUserId,
  setCustomTag,
  setCurrentScreenName,
  sendCustomEvent,
  LogLevel,
} from 'react-native-clarity';

const CLARITY_PROJECT_ID = 'yhutjadrj7';

let initialized = false;

export const initClarity = (): void => {
  if (initialized) return;
  try {
    initialize(CLARITY_PROJECT_ID, {
      logLevel: __DEV__ ? LogLevel.Verbose : LogLevel.None,
    });
    initialized = true;
  } catch (e) {
    // Never let analytics break the app.
    if (__DEV__) console.warn('Clarity init failed:', e);
  }
};

/**
 * Tie the recording to the signed-in buyer. Call after login.
 *
 * Takes the user id only — never the phone number. Clarity warns against
 * putting personally identifying values in this field.
 */
export const clarityIdentify = (userId?: string | number): void => {
  if (!userId) return;
  const value = String(userId).trim();
  if (!value) return;
  try {
    setCustomUserId(value);
  } catch (e) {
    if (__DEV__) console.warn('Clarity setCustomUserId failed:', e);
  }
};

/** Attach a searchable tag (e.g. city, user type) to the session. */
export const claritySetTag = (key: string, value: string | number): void => {
  try {
    setCustomTag(key, String(value));
  } catch (e) {
    if (__DEV__) console.warn('Clarity setCustomTag failed:', e);
  }
};

/**
 * Name the current screen so Clarity groups views correctly.
 *
 * The app navigates with a hand-rolled switcher rather than react-navigation,
 * so there is no router to observe — this is driven from the currentScreen
 * state in App.tsx. Without it the whole session records as one endless screen.
 */
export const claritySetScreen = (screenName: string): void => {
  if (!screenName) return;
  try {
    setCurrentScreenName(screenName);
  } catch (e) {
    if (__DEV__) console.warn('Clarity setCurrentScreenName failed:', e);
  }
};

/** Mark a point of interest in the replay (e.g. 'order_placed'). */
export const clarityEvent = (name: string): void => {
  if (!name) return;
  try {
    sendCustomEvent(name);
  } catch (e) {
    if (__DEV__) console.warn('Clarity sendCustomEvent failed:', e);
  }
};
