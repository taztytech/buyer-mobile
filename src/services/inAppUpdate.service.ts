/**
 * In-App Update Service
 * Handles Play Store in-app updates with flexible (non-forced) updates
 * Allows users to skip updates and excludes checkout page
 */

import SpInAppUpdates, {
  IAUUpdateKind,
  StartUpdateOptions,
} from 'sp-react-native-in-app-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import { isExpoGo } from '@/utils/platform.util';

const STORAGE_KEYS = {
  UPDATE_SKIPPED_UNTIL: '@tazty_update_skipped_until',
  UPDATE_LAST_CHECKED: '@tazty_update_last_checked',
};

// Minimum time between update checks (24 hours)
const MIN_CHECK_INTERVAL = 24 * 60 * 60 * 1000;

// Time to wait before showing update again after skip (7 days)
const SKIP_DURATION = 7 * 24 * 60 * 60 * 1000;

interface UpdateCheckOptions {
  currentScreen?: string;
  forceCheck?: boolean;
  checkNetwork?: boolean;
}

class InAppUpdateService {
  private isChecking = false;
  private updateInfo: any = null;
  private statusUpdateListener: any = null;
  private inAppUpdates: SpInAppUpdates;
  
  // Cache for network state to avoid repeated checks
  private cachedNetworkState: boolean | null = null;
  private networkStateCacheTime: number = 0;
  private networkStateCacheTTL: number = 30 * 1000; // 30 seconds cache
  
  // Cache for AsyncStorage values to reduce I/O
  private cachedStorageData: {
    skippedUntil?: number | null;
    lastChecked?: number | null;
    cacheTime?: number;
  } = {};
  private storageCacheTTL: number = 5 * 60 * 1000; // 5 minutes cache
  
  // Request deduplication - share promise for concurrent calls
  private pendingCheckPromise: Promise<boolean> | null = null;
  
  // Debounce timer for rapid calls
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 1000; // 1 second debounce

  constructor() {
    // Initialize the SpInAppUpdates instance
    // false = not in debug mode
    this.inAppUpdates = new SpInAppUpdates(false);
    
    // Setup network state listener once (shared across all checks)
    this.setupNetworkStateListener();
  }

  /**
   * Setup shared network state listener (called once in constructor)
   */
  private setupNetworkStateListener(): void {
    try {
      NetInfo.addEventListener((state) => {
        this.cachedNetworkState = (state.isInternetReachable ?? state.isConnected) ?? false;
        this.networkStateCacheTime = Date.now();
      });
    } catch (error) {
      console.error('[InAppUpdate] Error setting up network listener:', error);
    }
  }

  /**
   * Get cached storage data or fetch from AsyncStorage
   */
  private async getStorageData(forceRefresh: boolean = false): Promise<{
    skippedUntil: number | null;
    lastChecked: number | null;
  }> {
    const now = Date.now();
    const cacheValid = 
      !forceRefresh && 
      this.cachedStorageData.cacheTime && 
      (now - this.cachedStorageData.cacheTime) < this.storageCacheTTL;

    if (cacheValid) {
      return {
        skippedUntil: this.cachedStorageData.skippedUntil ?? null,
        lastChecked: this.cachedStorageData.lastChecked ?? null,
      };
    }

    try {
      // Batch read both values in parallel
      const [skippedUntil, lastChecked] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.UPDATE_SKIPPED_UNTIL),
        AsyncStorage.getItem(STORAGE_KEYS.UPDATE_LAST_CHECKED),
      ]);

      const skippedUntilTime = skippedUntil ? parseInt(skippedUntil, 10) : null;
      const lastCheckedTime = lastChecked ? parseInt(lastChecked, 10) : null;

      // Update cache
      this.cachedStorageData = {
        skippedUntil: skippedUntilTime,
        lastChecked: lastCheckedTime,
        cacheTime: now,
      };

      return {
        skippedUntil: skippedUntilTime,
        lastChecked: lastCheckedTime,
      };
    } catch (error) {
      console.error('[InAppUpdate] Error reading storage:', error);
      return { skippedUntil: null, lastChecked: null };
    }
  }

  /**
   * Invalidate storage cache (call after writes)
   */
  private invalidateStorageCache(): void {
    this.cachedStorageData = {};
  }


  /**
   * Mark update as skipped
   */
  private async markUpdateSkipped(): Promise<void> {
    try {
      const skipUntilTime = Date.now() + SKIP_DURATION;
      await AsyncStorage.setItem(
        STORAGE_KEYS.UPDATE_SKIPPED_UNTIL,
        skipUntilTime.toString()
      );
      // Invalidate cache after write
      this.invalidateStorageCache();
    } catch (error) {
      console.error('[InAppUpdate] Error marking update as skipped:', error);
    }
  }


  /**
   * Mark update check time
   */
  private async markUpdateChecked(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.UPDATE_LAST_CHECKED,
        Date.now().toString()
      );
      // Invalidate cache after write
      this.invalidateStorageCache();
    } catch (error) {
      console.error('[InAppUpdate] Error marking update check:', error);
    }
  }

  /**
   * Check if current screen is checkout
   */
  private isCheckoutScreen(currentScreen?: string): boolean {
    return currentScreen === 'checkout';
  }

  /**
   * Check if device has network connectivity (uses cached state)
   */
  private isNetworkAvailable(): boolean {
    const now = Date.now();
    
    // Return cached value if still valid
    if (
      this.cachedNetworkState !== null &&
      (now - this.networkStateCacheTime) < this.networkStateCacheTTL
    ) {
      return this.cachedNetworkState;
    }

    // If cache expired or not set, assume network is available
    // (network listener will update cache asynchronously)
    // This prevents blocking on network checks
    return this.cachedNetworkState ?? true;
  }

  /**
   * Show update dialog with skip option
   */
  private showUpdateDialog(): void {
    Alert.alert(
      'Update Available',
      'A new version of the app is available. Would you like to update now?',
      [
        {
          text: 'Skip',
          style: 'cancel',
          onPress: async () => {
            await this.markUpdateSkipped();
            console.log('[InAppUpdate] User skipped update');
          },
        },
        {
          text: 'Update',
          onPress: () => {
            this.startFlexibleUpdate();
          },
        },
      ],
      { cancelable: true }
    );
  }

  /**
   * Start flexible (non-forced) update
   */
  private async startFlexibleUpdate(): Promise<void> {
    try {
      const updateOptions: StartUpdateOptions = {
        updateType: IAUUpdateKind.FLEXIBLE,
      };

      await this.inAppUpdates.startUpdate(updateOptions);
      console.log('[InAppUpdate] Flexible update started');

      // Listen for update status changes
      this.setupStatusListener();
    } catch (error) {
      console.error('[InAppUpdate] Error starting update:', error);
      Alert.alert(
        'Update Error',
        'Failed to start update. Please try updating from the Play Store.',
        [{ text: 'OK' }]
      );
    }
  }

  /**
   * Setup listener for flexible update status
   */
  private setupStatusListener(): void {
    // Remove existing listener if any
    if (this.statusUpdateListener) {
      try {
        this.statusUpdateListener.remove();
      } catch (error) {
        console.error('[InAppUpdate] Error removing status listener:', error);
      }
    }

    try {
      // Add status update listener for flexible updates
      this.statusUpdateListener = this.inAppUpdates.addStatusUpdateListener((status) => {
        console.log('[InAppUpdate] Update status:', status);

        // Status codes from Android In-App Updates API:
        // 0: UNKNOWN
        // 1: PENDING
        // 2: DOWNLOADING
        // 3: INSTALLING
        // 4: INSTALLED
        // 5: FAILED
        // 6: CANCELED
        // 11: DOWNLOADED (flexible updates only)

        // When update is downloaded (status 11), prompt user to restart
        // StatusUpdateEvent has a 'status' property of type AndroidInstallStatus
        if (status?.status === 11) {
          // Update downloaded successfully
          Alert.alert(
            'Update Ready',
            'The update has been downloaded. Restart the app to apply the update.',
            [
              {
                text: 'Later',
                style: 'cancel',
              },
              {
                text: 'Restart Now',
                onPress: () => {
                  this.completeUpdate();
                },
              },
            ]
          );
        } else if (status?.status === 5) {
          // Update failed
          console.error('[InAppUpdate] Update failed');
          Alert.alert(
            'Update Failed',
            'The update could not be downloaded. Please try again later or update from the Play Store.',
            [{ text: 'OK' }]
          );
        }
      });
    } catch (error) {
      console.error('[InAppUpdate] Error setting up status listener:', error);
    }
  }

  /**
   * Cleanup status listener
   */
  private cleanupStatusListener(): void {
    if (this.statusUpdateListener) {
      this.statusUpdateListener.remove();
      this.statusUpdateListener = null;
    }
  }

  /**
   * Check if app is installed from Play Store
   * In-app updates only work when app is installed from Play Store
   */
  private isInstalledFromPlayStore(): boolean {
    // Check if running in Expo Go
    if (isExpoGo()) {
      return false;
    }

    // Check app ownership - only works when installed from Play Store
    // appOwnership can be: 'expo', 'standalone', or undefined
    // For Play Store apps, it should be 'standalone' or undefined
    // In Expo Go, it's 'expo'
    const appOwnership = Constants.appOwnership;
    
    // If appOwnership is 'expo', it's Expo Go (not from Play Store)
    if (appOwnership === 'expo') {
      return false;
    }

    // In development mode, assume not from Play Store
    if (__DEV__) {
      return false;
    }

    // For standalone builds, assume it could be from Play Store
    // The actual check will happen when we try to use the API
    return true;
  }

  /**
   * Check if error is the "app not owned" error (error code -10)
   * This happens when app is not installed from Play Store
   */
  private isAppNotOwnedError(error: any): boolean {
    const errorMessage = error?.message || '';
    const errorCode = error?.code || error?.errorCode;
    
    // Check for error code -10 or error message containing "not owned" or "ERROR_APP_NOT_OWNED"
    return (
      errorCode === -10 ||
      errorMessage.includes('ERROR_APP_NOT_OWNED') ||
      errorMessage.includes('not owned') ||
      errorMessage.includes('app is not owned')
    );
  }

  /**
   * Check for available updates (with deduplication and debouncing)
   */
  async checkForUpdate(
    options: UpdateCheckOptions = {}
  ): Promise<boolean> {
    // Only work on Android
    if (Platform.OS !== 'android') {
      return false;
    }

    const { currentScreen, forceCheck = false, checkNetwork = true } = options;

    // Don't check if on checkout page
    if (this.isCheckoutScreen(currentScreen)) {
      return false;
    }

    // Request deduplication: if a check is already pending, return the same promise
    if (this.pendingCheckPromise) {
      return this.pendingCheckPromise;
    }

    // Debounce rapid calls
    return new Promise<boolean>((resolve) => {
      // Clear existing debounce timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(async () => {
        this.debounceTimer = null;
        
        // Create the actual check promise
        this.pendingCheckPromise = this.performUpdateCheck(
          currentScreen,
          forceCheck,
          checkNetwork
        ).finally(() => {
          // Clear pending promise after completion
          this.pendingCheckPromise = null;
        });

        const result = await this.pendingCheckPromise;
        resolve(result);
      }, this.DEBOUNCE_DELAY);
    });
  }

  /**
   * Perform the actual update check (internal method)
   */
  private async performUpdateCheck(
    _currentScreen?: string,
    forceCheck: boolean = false,
    checkNetwork: boolean = true
  ): Promise<boolean> {
    // Don't check if already checking (safety check)
    if (this.isChecking) {
      return false;
    }

    // Check network connectivity if required (synchronous cached check)
    if (checkNetwork) {
      const isOnline = this.isNetworkAvailable();
      if (!isOnline) {
        return false;
      }
    }

    // Skip if not installed from Play Store (Expo Go, debug builds, etc.)
    if (!this.isInstalledFromPlayStore()) {
      return false;
    }

    // Batch read storage data once
    const storageData = await this.getStorageData();

    // Check if update was recently skipped
    if (!forceCheck && storageData.skippedUntil !== null) {
      if (Date.now() < storageData.skippedUntil) {
        return false;
      }
    }

    // Check if enough time has passed since last check
    if (!forceCheck && storageData.lastChecked !== null) {
      if (Date.now() - storageData.lastChecked < MIN_CHECK_INTERVAL) {
        return false;
      }
    }

    this.isChecking = true;

    try {
      // Check for update availability
      const checkResult = await this.inAppUpdates.checkNeedsUpdate();

      // Mark that we checked
      await this.markUpdateChecked();

      if (checkResult.shouldUpdate) {
        this.updateInfo = checkResult;
        console.log('[InAppUpdate] Update available');

        // Show update dialog
        this.showUpdateDialog();
        this.isChecking = false;
        return true;
      } else {
        // Clear stale update info when app is up to date
        this.updateInfo = null;
        this.isChecking = false;
        return false;
      }
    } catch (error: any) {
      // Handle "app not owned" error gracefully (happens in debug/Expo Go)
      if (this.isAppNotOwnedError(error)) {
        this.isChecking = false;
        return false;
      }

      // For other errors, log but don't break the app
      console.error('[InAppUpdate] Error checking for updates:', error);
      this.isChecking = false;
      return false;
    }
  }

  /**
   * Complete flexible update (call after download completes)
   */
  async completeUpdate(): Promise<void> {
    try {
      await this.inAppUpdates.installUpdate();
      console.log('[InAppUpdate] Update installation completed');
      // Clear update info after installation
      this.updateInfo = null;
    } catch (error) {
      console.error('[InAppUpdate] Error completing update:', error);
    }
  }

  /**
   * Get current update info
   */
  getUpdateInfo(): any {
    return this.updateInfo;
  }

  /**
   * Clear skip status (for testing or force check)
   */
  async clearSkipStatus(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.UPDATE_SKIPPED_UNTIL);
    } catch (error) {
      console.error('[InAppUpdate] Error clearing skip status:', error);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.cleanupStatusListener();
    
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    // Clear pending promise
    this.pendingCheckPromise = null;
    
    // Clear update info on cleanup
    this.updateInfo = null;
    this.isChecking = false;
    
    // Clear caches
    this.cachedStorageData = {};
    this.cachedNetworkState = null;
    this.networkStateCacheTime = 0;
  }
}

// Export singleton instance
export const inAppUpdateService = new InAppUpdateService();
export default inAppUpdateService;


