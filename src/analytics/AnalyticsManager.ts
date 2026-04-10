import { NativeModules, Platform } from 'react-native';
import { APP_VERSION_CODE, APP_VERSION_NAME } from '@/config/appVersion.generated';
import {
  AnalyticsEvents,
  FirebaseStandardEvents,
  FirebaseStandardParams,
} from './events';
import { AnalyticsUserProperties } from './userProperties';

// Conditionally import Firebase to avoid errors if native modules aren't linked
let analytics: any = null;

try {
  if (NativeModules.RNFBAppModule) {
    analytics = require('@react-native-firebase/analytics').default;
  } else {
    console.warn('⚠️  Analytics: Native module RNFBAppModule not found. Rebuild native app to enable Analytics.');
  }
} catch (error) {
  console.warn('⚠️  Analytics: Firebase Analytics not available. Rebuild native app to enable Analytics.');
}

export class AnalyticsManager {
  private isInitialized: boolean = false;
  private analyticsEnabled: boolean = true;
  private userId: string | null = null;
  private readonly allowedEvents: Set<string> = new Set(Object.values(AnalyticsEvents));
  private readonly piiKeyPatterns: RegExp[] = [
    /phone/i,
    /email/i,
    /full_address/i,
    /street_address/i,
    /(^|_)(lat|latitude)(_|$)/i,
    /(^|_)(lng|long|longitude)(_|$)/i,
    /user_name/i,
    /full_name/i,
    /payment_id/i,
    /razorpay_signature/i,
  ];
  private readonly piiValuePatterns: RegExp[] = [
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /(^|\D)(?:\+91[-\s]?)?[6-9]\d{9}(\D|$)/,
    /\b[a-z0-9._-]{2,}@[a-z]{2,}\b/i,
  ];
  private readonly allowedSensitiveKeys: Set<string> = new Set([
    AnalyticsUserProperties.PLATFORM,
    AnalyticsUserProperties.LATITUDE,
    AnalyticsUserProperties.LONGITUDE,
    AnalyticsUserProperties.USER_ID,
  ]);

  async initialize(): Promise<void> {
    try {
      if (!analytics) {
        console.warn('⚠️  Analytics: Firebase Analytics not available');
        return;
      }

      await analytics().setAnalyticsCollectionEnabled(this.analyticsEnabled);
      this.isInitialized = true;
      await this.setUserProperties({
        [AnalyticsUserProperties.PLATFORM]: Platform.OS,
        [AnalyticsUserProperties.APP_VERSION]: APP_VERSION_NAME,
        [AnalyticsUserProperties.APP_VERSION_CODE]: String(APP_VERSION_CODE),
      });
      console.log('✅ Analytics: Initialized successfully');
    } catch (error) {
      console.warn('⚠️  Analytics: Initialization failed:', error);
      this.isInitialized = false;
    }
  }

  async setUserId(userId: string | null): Promise<void> {
    try {
      if (!this.isInitialized || !analytics) return;

      this.userId = userId;
      if (userId) {
        await analytics().setUserId(userId);
        console.log('✅ Analytics: User ID set:', userId);
      } else {
        await analytics().setUserId(null);
        console.log('✅ Analytics: User ID cleared');
      }
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to set user ID:', error);
    }
  }

  async setUserProperty(name: string, value: string | null): Promise<void> {
    try {
      if (!this.isInitialized || !analytics) return;
      await analytics().setUserProperty(name, value);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to set user property:', error);
    }
  }

  async setUserProperties(properties: Record<string, string | null>): Promise<void> {
    try {
      if (!this.isInitialized || !analytics) return;

      const promises = Object.entries(properties)
        .filter(([name]) => !this.isPIIKey(name))
        .map(([name, value]) => analytics().setUserProperty(name, value));
      await Promise.all(promises);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to set user properties:', error);
    }
  }

  private async logScreenView(screenName: string, screenClass?: string): Promise<void> {
    try {
      if (!this.isInitialized || !analytics) return;

      await analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to log screen view:', error);
    }
  }

  private async logEvent(eventName: string, parameters?: Record<string, any>): Promise<void> {
    try {
      if (!this.isInitialized || !analytics || !this.analyticsEnabled) return;
      if (!this.isValidEventName(eventName)) {
        console.warn(`⚠️  Analytics: invalid event name "${eventName}"`);
        return;
      }
      if (!this.allowedEvents.has(eventName)) {
        console.warn(`⚠️  Analytics: unregistered event "${eventName}"`);
      }

      const cleanParams = this.cleanParameters(parameters);
      await analytics().logEvent(eventName, cleanParams);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to log event:', error);
    }
  }

  async logSelectContent(contentType: string, itemId?: string, itemName?: string): Promise<void> {
    try {
      if (!this.isInitialized || !analytics || !this.analyticsEnabled) return;

      const params: Record<string, any> = {
        [FirebaseStandardParams.CONTENT_TYPE]: contentType,
      };

      if (itemId) params[FirebaseStandardParams.ITEM_ID] = itemId;
      if (itemName) params[FirebaseStandardParams.ITEM_NAME] = itemName;

      await analytics().logEvent(FirebaseStandardEvents.SELECT_CONTENT, params);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to log select content:', error);
    }
  }

  async logViewItem(
    itemId: string,
    itemName: string,
    itemCategory?: string,
    price?: number,
    currency?: string
  ): Promise<void> {
    try {
      if (!this.isInitialized || !analytics || !this.analyticsEnabled) return;

      const params: Record<string, any> = {
        [FirebaseStandardParams.ITEM_ID]: itemId,
        [FirebaseStandardParams.ITEM_NAME]: itemName,
      };

      if (itemCategory) params[FirebaseStandardParams.ITEM_CATEGORY] = itemCategory;
      if (price !== undefined) params[FirebaseStandardParams.PRICE] = price;
      if (currency) params[FirebaseStandardParams.CURRENCY] = currency;

      await analytics().logEvent(FirebaseStandardEvents.VIEW_ITEM, params);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to log view item:', error);
    }
  }

  async logAddToCart(
    itemId: string,
    itemName: string,
    itemCategory?: string,
    price?: number,
    quantity?: number,
    currency?: string
  ): Promise<void> {
    try {
      if (!this.isInitialized || !analytics || !this.analyticsEnabled) return;

      const params: Record<string, any> = {
        [FirebaseStandardParams.ITEM_ID]: itemId,
        [FirebaseStandardParams.ITEM_NAME]: itemName,
      };

      if (itemCategory) params[FirebaseStandardParams.ITEM_CATEGORY] = itemCategory;
      if (price !== undefined) params[FirebaseStandardParams.PRICE] = price;
      if (quantity !== undefined) params[FirebaseStandardParams.QUANTITY] = quantity;
      if (currency) params[FirebaseStandardParams.CURRENCY] = currency;

      await analytics().logEvent(FirebaseStandardEvents.ADD_TO_CART, params);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to log add to cart:', error);
    }
  }

  async logBeginCheckout(
    value?: number,
    currency?: string,
    items?: Array<{ item_id: string; item_name: string; price?: number; quantity?: number }>
  ): Promise<void> {
    try {
      if (!this.isInitialized || !analytics || !this.analyticsEnabled) return;

      const params: Record<string, any> = {};
      if (value !== undefined) params[FirebaseStandardParams.VALUE] = value;
      if (currency) params[FirebaseStandardParams.CURRENCY] = currency;
      if (items && items.length > 0) params.items = items;

      await analytics().logEvent(FirebaseStandardEvents.BEGIN_CHECKOUT, params);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to log begin checkout:', error);
    }
  }

  async logPurchase(
    transactionId: string,
    value: number,
    currency: string,
    items?: Array<{ item_id: string; item_name: string; price?: number; quantity?: number }>
  ): Promise<void> {
    try {
      if (!this.isInitialized || !analytics || !this.analyticsEnabled) return;

      const params: Record<string, any> = {
        transaction_id: transactionId,
        [FirebaseStandardParams.VALUE]: value,
        [FirebaseStandardParams.CURRENCY]: currency,
      };

      if (items && items.length > 0) params.items = items;

      await analytics().logEvent(FirebaseStandardEvents.PURCHASE, params);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to log purchase:', error);
    }
  }

  async logSearch(searchTerm: string): Promise<void> {
    try {
      if (!this.isInitialized || !analytics || !this.analyticsEnabled) return;
      await analytics().logEvent(FirebaseStandardEvents.SEARCH, {
        [FirebaseStandardParams.SEARCH_TERM]: searchTerm,
      });
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to log search:', error);
    }
  }

  async logSignUp(method?: string): Promise<void> {
    try {
      if (!this.isInitialized || !analytics || !this.analyticsEnabled) return;
      const params: Record<string, any> = {};
      if (method) params[FirebaseStandardParams.METHOD] = method;
      await analytics().logEvent(FirebaseStandardEvents.SIGN_UP, params);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to log sign up:', error);
    }
  }

  async logLogin(method?: string): Promise<void> {
    try {
      if (!this.isInitialized || !analytics || !this.analyticsEnabled) return;
      const params: Record<string, any> = {};
      if (method) params[FirebaseStandardParams.METHOD] = method;
      await analytics().logEvent(FirebaseStandardEvents.LOGIN, params);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to log login:', error);
    }
  }

  private cleanParameters(parameters?: Record<string, any>): Record<string, any> {
    if (!parameters) return {};

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(parameters)) {
      if (this.isPIIKey(key)) continue;
      if (value === undefined || value === null) continue;

      if (
        typeof value === 'boolean' ||
        typeof value === 'number' ||
        Array.isArray(value)
      ) {
        cleaned[key] = value;
      } else if (typeof value === 'string') {
        if (this.isPIIValue(value)) continue;
        cleaned[key] = value;
      } else if (typeof value === 'object') {
        cleaned[key] = JSON.stringify(value);
      }
    }

    return cleaned;
  }

  private isPIIKey(key: string): boolean {
    if (this.allowedSensitiveKeys.has(key)) return false;
    return this.piiKeyPatterns.some((pattern) => pattern.test(key));
  }

  private isPIIValue(value: string): boolean {
    const trimmedValue = value.trim();
    if (!trimmedValue) return false;
    return this.piiValuePatterns.some((pattern) => pattern.test(trimmedValue));
  }

  private isValidEventName(eventName: string): boolean {
    if (eventName.length > 40) return false;
    return /^[a-z]+(_[a-z0-9]+)*$/.test(eventName);
  }

  /**
   * Public API per integration spec §7.3 — all app-originated events must use this entrypoint.
   */
  async trackEvent(eventName: string, params?: Record<string, any>): Promise<void> {
    await this.logEvent(eventName, params);
  }

  async trackScreen(screenName: string): Promise<void> {
    await this.logScreenView(screenName);
  }

  async reset(): Promise<void> {
    await this.resetAnalyticsData();
    await this.setUserId(null);
    await this.setUserProperties({
      [AnalyticsUserProperties.LOGIN_STATE]: 'guest',
      [AnalyticsUserProperties.USER_TYPE]: null,
      [AnalyticsUserProperties.USER_ID]: null,
    });
  }

  async setAnalyticsEnabled(enabled: boolean): Promise<void> {
    try {
      if (!analytics) return;
      this.analyticsEnabled = enabled;
      await analytics().setAnalyticsCollectionEnabled(enabled);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to set analytics enabled:', error);
    }
  }

  async resetAnalyticsData(): Promise<void> {
    try {
      if (!this.isInitialized || !analytics) return;
      await analytics().resetAnalyticsData();
      this.userId = null;
      console.log('✅ Analytics: Data reset');
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to reset analytics data:', error);
    }
  }

  getUserId(): string | null {
    return this.userId;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const analyticsService = new AnalyticsManager();
