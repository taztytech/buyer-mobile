/**
 * Crashlytics Service
 * Firebase Crashlytics implementation for capturing crashes and non-fatal errors
 */

import { NativeModules, Platform } from 'react-native';
import { APP_VERSION_NAME } from '@/config/appVersion.generated';

// Conditionally import Firebase Crashlytics to avoid errors if native modules aren't linked
let crashlytics: any = null;

try {
  if (NativeModules.RNFBAppModule) {
    crashlytics = require('@react-native-firebase/crashlytics').default;
  } else {
    console.warn(
      '⚠️  Crashlytics: Native module RNFBAppModule not found. Rebuild native app to enable Crashlytics.',
    );
  }
} catch (error) {
  console.warn(
    '⚠️  Crashlytics: Firebase Crashlytics not available. Rebuild native app to enable Crashlytics.',
  );
}

class CrashlyticsService {
  private isInitialized: boolean = false;
  private enabled: boolean = true;
  private readonly baselineContext: Record<string, string> = {
    app_version: APP_VERSION_NAME,
    platform: Platform.OS,
    login_state: 'guest',
    current_screen: 'unknown',
    user_type: 'unknown',
    endpoint: 'unknown',
    method: 'unknown',
    order_id: 'unknown',
    payment_method: 'unknown',
    gateway: 'unknown',
    http_code: 'unknown',
    source: 'unknown',
    error_type: 'unknown',
  };
  private readonly piiKeyPatterns: RegExp[] = [
    /phone/i,
    /email/i,
    /address/i,
    /lat/i,
    /lng/i,
    /long/i,
    /payment_id/i,
    /razorpay_signature/i,
    /name/i,
  ];

  /**
   * Initialize Crashlytics service
   * Call this on app startup
   */
  async initialize(): Promise<void> {
    try {
      if (!crashlytics) {
        console.warn('⚠️  Crashlytics: Not available');
        return;
      }

      await crashlytics().setCrashlyticsCollectionEnabled(this.enabled);
      this.isInitialized = true;
      await this.setGlobalContext(this.baselineContext);
      console.log('✅ Crashlytics: Initialized successfully');
    } catch (error) {
      console.warn('⚠️  Crashlytics: Initialization failed:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Enable or disable Crashlytics collection
   */
  async setEnabled(enabled: boolean): Promise<void> {
    try {
      if (!crashlytics) {
        return;
      }

      this.enabled = enabled;
      await crashlytics().setCrashlyticsCollectionEnabled(enabled);
    } catch (error) {
      console.warn('⚠️  Crashlytics: Failed to set enabled state:', error);
    }
  }

  /**
   * Set current user identifier for Crashlytics
   */
  async setUserId(userId: string | null): Promise<void> {
    try {
      if (!this.isInitialized || !crashlytics) {
        return;
      }

      if (userId) {
        await crashlytics().setUserId(userId);
        console.log('✅ Crashlytics: User ID set:', userId);
      } else {
        // There is no explicit "clear user" API, so set to an empty string
        await crashlytics().setUserId('');
        console.log('✅ Crashlytics: User ID cleared');
      }
    } catch (error) {
      console.warn('⚠️  Crashlytics: Failed to set user ID:', error);
    }
  }

  /**
   * Set multiple custom attributes for the current user/session
   */
  async setAttributes(attributes: Record<string, string | number | boolean | null | undefined>): Promise<void> {
    try {
      if (!this.isInitialized || !crashlytics) {
        return;
      }

      const cleanedEntries = Object.entries(attributes).filter(
        ([key, value]) => value !== undefined && value !== null && !this.isPIIKey(key),
      ) as Array<[string, string | number | boolean]>;

      for (const [key, value] of cleanedEntries) {
        await crashlytics().setAttribute(key, String(value));
      }
    } catch (error) {
      console.warn('⚠️  Crashlytics: Failed to set attributes:', error);
    }
  }

  /**
   * Set a single custom attribute
   */
  async setAttribute(key: string, value: string | number | boolean | null | undefined): Promise<void> {
    if (value === undefined || value === null || this.isPIIKey(key)) {
      return;
    }
    await this.setAttributes({ [key]: value });
  }

  /**
   * Alias for business-level context setup
   */
  async setGlobalContext(attributes: Record<string, string | number | boolean | null | undefined>): Promise<void> {
    await this.setAttributes(attributes);
  }

  /**
   * Log a message to Crashlytics
   * Useful for breadcrumbs around crashes
   */
  async log(message: string): Promise<void> {
    try {
      if (!this.isInitialized || !crashlytics) {
        return;
      }

      await crashlytics().log(message);
    } catch (error) {
      console.warn('⚠️  Crashlytics: Failed to log message:', error);
    }
  }

  /**
   * Record a non-fatal error with optional context
   */
  async recordError(error: unknown, context?: Record<string, any>): Promise<void> {
    try {
      if (!this.isInitialized || !crashlytics) {
        return;
      }

      const err =
        error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');

      const mergedContext = this.mergeWithBaselineContext(context);
      await this.setAttributes(
        Object.fromEntries(
          Object.entries(mergedContext).map(([key, value]) => [key, this.serializeContextValue(value)]),
        ),
      );

      await crashlytics().recordError(err);
    } catch (e) {
      console.warn('⚠️  Crashlytics: Failed to record error:', e);
    }
  }

  /**
   * Force a crash for QA validation.
   * Use this only in test/staging builds and remove/disable from production UI.
   */
  async triggerTestCrash(): Promise<void> {
    try {
      if (!this.isInitialized || !crashlytics) {
        return;
      }
      crashlytics().crash();
    } catch (error) {
      console.warn('⚠️  Crashlytics: Failed to trigger test crash:', error);
    }
  }

  /**
   * Create a deterministic non-fatal error for QA validation.
   */
  async simulateNonFatal(
    label: string = 'qa_non_fatal_test',
    context?: Record<string, string | number | boolean | null | undefined>
  ): Promise<void> {
    await this.recordError(new Error(label), {
      source: 'qa_non_fatal_simulation',
      ...context,
    });
  }

  /**
   * Helper to know if Crashlytics is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  private isPIIKey(key: string): boolean {
    return this.piiKeyPatterns.some((pattern) => pattern.test(key));
  }

  private serializeContextValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private mergeWithBaselineContext(
    context?: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...this.baselineContext };
    if (!context) {
      return merged;
    }
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined && value !== null) {
        merged[key] = value;
      }
    }
    return merged;
  }
}

// Export singleton instance
export const crashlyticsService = new CrashlyticsService();


