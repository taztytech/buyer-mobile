import { useCallback, useState, useEffect, useRef } from 'react';
import { Platform, NativeModules, DeviceEventEmitter, NativeEventEmitter } from 'react-native';

// Our custom native PiP module (always preferred — correct 9:16 aspect ratio)
const { PipModule } = NativeModules;

// Fallback library if the custom module is somehow unavailable
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PipAndroidModule = Platform.OS === 'android' ? require('react-native-pip-android') : null;
const PipAndroid = PipAndroidModule?.default ?? PipAndroidModule;

/** Normalize native payload to boolean (bridge may send boolean, number 0/1, or object). */
function normalizePipPayload(payload: unknown): boolean {
  if (typeof payload === 'boolean') return payload;
  if (typeof payload === 'number') return payload !== 0;
  if (payload != null && typeof payload === 'object' && 'isInPip' in payload) {
    return Boolean((payload as { isInPip?: unknown }).isInPip);
  }
  return Boolean(payload);
}

/**
 * useAndroidPip
 *
 * Provides reliable Picture-in-Picture support on Android.
 *
 * PiP detection strategy
 * ──────────────────────
 * We listen to the native 'onPictureInPictureModeChanged' event that
 * MainActivity emits via PipModule.notifyPipModeChanged().  This is the ONLY
 * authoritative signal — it comes directly from Android's
 * Activity.onPictureInPictureModeChanged() lifecycle callback.
 *
 * We intentionally do NOT use useWindowDimensions() heuristics because:
 *  • smallestScreenSize must be in configChanges for dimension updates to fire.
 *  • Even with it, there is a timing gap between the native callback and the
 *    first JS render, which can cause a flash of the wrong layout.
 *  • React Native Modals may not propagate dimension changes reliably.
 */
export function useAndroidPip() {
  const canUsePip = Platform.OS === 'android' && !!(PipModule || PipAndroid);

  // Authoritative PiP state — set by the native event, cleared on exit
  const [isInPipMode, setIsInPipMode] = useState(false);
  const lastPipValueRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handler = (payload: unknown) => {
      const isInPip = normalizePipPayload(payload);
      // Only update state when value actually changes to avoid re-render loops
      // (setState inside event listener can cause "Maximum update depth" in some RN builds)
      if (lastPipValueRef.current === isInPip) return;
      lastPipValueRef.current = isInPip;
      setIsInPipMode(isInPip);
    };

    // Native PipModule emits via RCTDeviceEventEmitter (same as DeviceEventEmitter).
    // Also subscribe via NativeEventEmitter(PipModule) for builds where global emitter
    // is not delivered (e.g. some Release/ProGuard cases); then we only use one path.
    const sub1 = DeviceEventEmitter.addListener('onPictureInPictureModeChanged', handler);
    const pipEmitter =
      PipModule && typeof NativeEventEmitter === 'function'
        ? new NativeEventEmitter(PipModule)
        : null;
    const sub2 = pipEmitter
      ? pipEmitter.addListener('onPictureInPictureModeChanged', handler)
      : null;

    return () => {
      sub1.remove();
      sub2?.remove();
    };
  }, []);

  const enterPip = useCallback(async () => {
    if (!canUsePip) {
      console.warn('[useAndroidPip] PiP not available on this device');
      return Promise.reject(new Error('PiP not available'));
    }

    try {
      // Prefer custom PipModule (enforces 9:16 portrait ratio)
      if (PipModule && typeof PipModule.enterPictureInPictureMode === 'function') {
        console.log('[useAndroidPip] Entering PiP via custom PipModule');
        await PipModule.enterPictureInPictureMode();
        return;
      }

      // Fallback: react-native-pip-android
      if (typeof PipAndroid?.enterPictureInPictureMode === 'function') {
        console.log('[useAndroidPip] Entering PiP via PipAndroid library');
        PipAndroid.enterPictureInPictureMode(9, 16);
        return;
      }

      if (typeof PipAndroid?.enterPipMode === 'function') {
        PipAndroid.enterPipMode();
        return;
      }

      console.warn('[useAndroidPip] No PiP entry method found');
      return Promise.reject(new Error('No PiP method available'));
    } catch (error) {
      console.warn('[useAndroidPip] Error entering PiP:', error);
      return Promise.reject(error);
    }
  }, [canUsePip]);

  return {
    canUsePip,
    isInPipMode,
    enterPip,
  };
}
