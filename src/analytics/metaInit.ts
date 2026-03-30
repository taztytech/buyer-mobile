import { Platform } from 'react-native';
import { Settings } from 'react-native-fbsdk-next';
import { getTrackingStatus, requestTrackingPermission } from 'react-native-tracking-transparency';

let initialized = false;

export async function initMeta(): Promise<void> {
  if (initialized) {
    return;
  }

  try {
    if (Platform.OS === 'ios') {
      const currentStatus = await getTrackingStatus();
      const finalStatus =
        currentStatus === 'not-determined'
          ? await requestTrackingPermission()
          : currentStatus;
      await Settings.setAdvertiserTrackingEnabled(finalStatus === 'authorized');
    } else {
      await Settings.setAdvertiserTrackingEnabled(true);
    }
    initialized = true;
  } catch (error) {
    console.warn('Meta init failed', error);
  }
}

