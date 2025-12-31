/**
 * In-App Update Service
 * Handles Play Store in-app updates with flexible (non-forced) updates
 * Allows users to skip updates and excludes checkout page
 */

// Lazy import to prevent crash if native module is not available
// We'll load the module only when it's actually needed, not during module initialization
let SpInAppUpdates: any = null;
let IAUUpdateKind: any = null;
let StartUpdateOptions: any = null;
let moduleLoadAttempted = false;

/**
 * Lazy load the sp-react-native-in-app-updates module
 * This is called only when the service is actually used, not during module initialization
 */
function loadInAppUpdatesModule(): boolean {
  if (moduleLoadAttempted) {
    return SpInAppUpdates !== null;
  }
  
  moduleLoadAttempted = true;
  
  try {
    const inAppUpdatesModule = require('sp-react-native-in-app-updates');
    SpInAppUpdates = inAppUpdatesModule.default || inAppUpdatesModule;
    IAUUpdateKind = inAppUpdatesModule.IAUUpdateKind;
    StartUpdateOptions = inAppUpdatesModule.StartUpdateOptions;
    return true;
  } catch (error) {
    console.warn('[InAppUpdate] sp-react-native-in-app-updates not available. In-app updates will be disabled.');
    console.warn('[InAppUpdate] This is normal in Expo Go or if native modules are not linked.');
    SpInAppUpdates = null;
    IAUUpdateKind = null;
    StartUpdateOptions = null;
    return false;
  }
}
// Removed AsyncStorage to allow session-based resetting
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import { isExpoGo } from '@/utils/platform.util';

// Minimum time between update checks (1 hour)
const MIN_CHECK_INTERVAL = 1 * 60 * 60 * 1000;

// Time to wait before showing update again after skip (1 day) - Only applies if app stays open!
const SKIP_DURATION = 1 * 24 * 60 * 60 * 1000;

interface UpdateCheckOptions {
  currentScreen?: string;
  forceCheck?: boolean;
  checkNetwork?: boolean;
}

class InAppUpdateService {
  private isChecking = false;
  private updateInfo: any = null;
  private statusUpdateListener: any = null;
  private inAppUpdates: any = null;

  // Cache for network state to avoid repeated checks
  private cachedNetworkState: boolean | null = null;
  private networkStateCacheTime: number = 0;
  private networkStateCacheTTL: number = 30 * 1000; // 30 seconds cache

  // In-memory state (resets on app kill)
  private skippedUntil: number | null = null;
  private lastChecked: number | null = null;

  // Request deduplication - share promise for concurrent calls
  private pendingCheckPromise: Promise<boolean> | null = null;

  // Debounce timer for rapid calls
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 1000; // 1 second debounce

  constructor() {
    // Don't load the module in constructor - load it lazily when needed
    // This prevents the module from being loaded during App.tsx import
    this.inAppUpdates = null;

    // Setup network state listener once (shared across all checks)
    this.setupNetworkStateListener();
  }

  /**
   * Ensure the in-app updates module is loaded
   * Called before any method that needs the module
   */
  private ensureModuleLoaded(): boolean {
    if (this.inAppUpdates !== null) {
      return true;
    }

    // Try to load the module
    if (!loadInAppUpdatesModule()) {
      return false;
    }

    // Initialize the SpInAppUpdates instance
    // false = not in debug mode
    if (SpInAppUpdates) {
      try {
        this.inAppUpdates = new SpInAppUpdates(false);
        return true;
      } catch (error) {
        console.warn('[InAppUpdate] Failed to initialize SpInAppUpdates:', error);
        this.inAppUpdates = null;
        return false;
      }
    }

    return false;
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
   * Mark update as skipped
   * Stores in memory only - resets if app is killed
   */
  private markUpdateSkipped(): void {
    this.skippedUntil = Date.now() + SKIP_DURATION;
    console.log('[InAppUpdate] Update skipped until:', new Date(this.skippedUntil).toISOString());
  }

  /**
   * Mark update check time
   * Stores in memory only - resets if app is killed
   */
  private markUpdateChecked(): void {
    this.lastChecked = Date.now();
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
   * Start flexible (non-forced) update
   */
  private async startFlexibleUpdate(): Promise<void> {
    if (!this.ensureModuleLoaded() || !IAUUpdateKind) {
      console.warn('[InAppUpdate] Cannot start update: Native module not available');
      return;
    }

    try {
      const updateOptions = {
        updateType: IAUUpdateKind.FLEXIBLE,
      };

      await this.inAppUpdates.startUpdate(updateOptions);
      console.log('[InAppUpdate] Flexible update started');

      // Listen for update status changes
      this.setupStatusListener();
    } catch (error: any) {
      // If user cancels or update fails, mark as skipped so we don't spam
      console.log('[InAppUpdate] Update flow cancelled or failed:', error);
      this.markUpdateSkipped();
    }
  }

  /**
   * Setup listener for flexible update status
   */
  private setupStatusListener(): void {
    if (!this.ensureModuleLoaded()) {
      console.warn('[InAppUpdate] Cannot setup status listener: Native module not available');
      return;
    }

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
          // Silently fail or log, don't nag user
        } else if (status?.status === 6) {
          // Update canceled by user
          console.log('[InAppUpdate] Update canceled by user during download');
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

    // Check if update was recently skipped
    if (!forceCheck && this.skippedUntil !== null) {
      if (Date.now() < this.skippedUntil) {
        console.log('[InAppUpdate] Check skipped: User skipped recently (until ' + new Date(this.skippedUntil).toISOString() + ')');
        return false;
      }
    }

    // Check if enough time has passed since last check
    if (!forceCheck && this.lastChecked !== null) {
      if (Date.now() - this.lastChecked < MIN_CHECK_INTERVAL) {
        console.log('[InAppUpdate] Check skipped: Recently checked (at ' + new Date(this.lastChecked).toISOString() + ')');
        return false;
      }
    }

    this.isChecking = true;

    if (!this.ensureModuleLoaded()) {
      console.warn('[InAppUpdate] Cannot check for updates: Native module not available');
      this.isChecking = false;
      return false;
    }

    try {
      // Check for update availability
      const checkResult = await this.inAppUpdates.checkNeedsUpdate();

      // Mark that we checked (In-Memory!)
      this.markUpdateChecked();

      if (checkResult.shouldUpdate) {
        this.updateInfo = checkResult;
        console.log('[InAppUpdate] Update available:', JSON.stringify(checkResult, null, 2));

        // Start flexible update directly (Native UI)
        // This replaces the custom "Update Available" dialog
        this.startFlexibleUpdate();

        this.isChecking = false;
        return true;
      } else {
        console.log('[InAppUpdate] No update available. Store info:', JSON.stringify(checkResult, null, 2));
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
    if (!this.ensureModuleLoaded()) {
      console.warn('[InAppUpdate] Cannot complete update: Native module not available');
      return;
    }

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
   * Resets in-memory state
   */
  async clearSkipStatus(): Promise<void> {
    this.skippedUntil = null;
    this.lastChecked = null;
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
    this.cachedNetworkState = null;
    this.networkStateCacheTime = 0;

    // Clear session state
    this.skippedUntil = null;
    this.lastChecked = null;
  }
}

// Export singleton instance
export const inAppUpdateService = new InAppUpdateService();
export default inAppUpdateService;


