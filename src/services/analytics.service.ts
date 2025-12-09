/**
 * Analytics Service
 * Firebase Analytics implementation for tracking user events and app usage
 */

import analytics from '@react-native-firebase/analytics';
import { Platform } from 'react-native';

// Firebase Analytics Standard Events (from Firebase documentation)
export const FirebaseStandardEvents = {
  SELECT_CONTENT: 'select_content',
  VIEW_ITEM: 'view_item',
  VIEW_ITEM_LIST: 'view_item_list',
  ADD_TO_CART: 'add_to_cart',
  REMOVE_FROM_CART: 'remove_from_cart',
  BEGIN_CHECKOUT: 'begin_checkout',
  ADD_PAYMENT_INFO: 'add_payment_info',
  PURCHASE: 'purchase',
  VIEW_CART: 'view_cart',
  SEARCH: 'search',
  SIGN_UP: 'sign_up',
  LOGIN: 'login',
  SHARE: 'share',
  APP_OPEN: 'app_open',
} as const;

// Firebase Analytics Standard Parameters (from Firebase documentation)
export const FirebaseStandardParams = {
  ITEM_ID: 'item_id',
  ITEM_NAME: 'item_name',
  ITEM_CATEGORY: 'item_category',
  ITEM_LIST_ID: 'item_list_id',
  ITEM_LIST_NAME: 'item_list_name',
  ITEM_VARIANT: 'item_variant',
  ITEM_BRAND: 'item_brand',
  PRICE: 'price',
  QUANTITY: 'quantity',
  CURRENCY: 'currency',
  VALUE: 'value',
  CONTENT_TYPE: 'content_type',
  CONTENT_ID: 'content_id',
  SEARCH_TERM: 'search_term',
  METHOD: 'method',
  SUCCESS: 'success',
} as const;

// Event names constants
export const AnalyticsEvents = {
  // Authentication
  LOGIN_START: 'login_start',
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  LOGOUT: 'logout',
  SIGNUP_START: 'signup_start',
  SIGNUP_SUCCESS: 'signup_success',
  
  // Navigation
  SCREEN_VIEW: 'screen_view',
  
  // Home & Discovery
  RESTAURANT_VIEW: 'restaurant_view',
  RESTAURANT_SELECT: 'restaurant_select',
  CATEGORY_VIEW: 'category_view',
  CATEGORY_SELECT: 'category_select',
  SEARCH_START: 'search_start',
  SEARCH_RESULT_SELECT: 'search_result_select',
  
  // Cart & Checkout
  ADD_TO_CART: 'add_to_cart',
  REMOVE_FROM_CART: 'remove_from_cart',
  CART_VIEW: 'cart_view',
  CHECKOUT_START: 'checkout_start',
  CHECKOUT_STEP: 'checkout_step',
  
  // Orders
  ORDER_PLACE_START: 'order_place_start',
  ORDER_PLACE_SUCCESS: 'order_place_success',
  ORDER_PLACE_FAILURE: 'order_place_failure',
  ORDER_VIEW: 'order_view',
  ORDER_DETAIL_VIEW: 'order_detail_view',
  ORDER_REORDER: 'order_reorder',
  ORDER_CANCEL: 'order_cancel',
  ORDER_TRACK: 'order_track',
  ORDER_RATE: 'order_rate',
  
  // Address & Location
  ADDRESS_SELECT: 'address_select',
  ADDRESS_ADD: 'address_add',
  ADDRESS_EDIT: 'address_edit',
  ADDRESS_DELETE: 'address_delete',
  LOCATION_SELECT: 'location_select',
  
  // Profile
  PROFILE_VIEW: 'profile_view',
  PROFILE_EDIT: 'profile_edit',
  PROFILE_UPDATE: 'profile_update',
  
  // Favorites
  FAVORITE_ADD: 'favorite_add',
  FAVORITE_REMOVE: 'favorite_remove',
  FAVORITES_VIEW: 'favorites_view',
  
  // Help & Support
  HELP_VIEW: 'help_view',
  CONTACT_US: 'contact_us',
  FAQ_VIEW: 'faq_view',
  
  // Payment
  PAYMENT_START: 'payment_start',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILURE: 'payment_failure',
  
  // App Events
  APP_OPEN: 'app_open',
  APP_BACKGROUND: 'app_background',
  APP_FOREGROUND: 'app_foreground',
} as const;

// Screen names constants
export const AnalyticsScreens = {
  LOGIN: 'Login',
  OTP_VERIFICATION: 'OTP Verification',
  WELCOME: 'Welcome',
  HOME: 'Home',
  PROFILE: 'Profile',
  EDIT_PROFILE: 'Edit Profile',
  ORDERS: 'My Orders',
  ORDER_DETAIL: 'Order Detail',
  ORDER_TRACKING: 'Order Tracking',
  RATE_ORDER: 'Rate Order',
  SEARCH: 'Search',
  ADDRESS_SELECTION: 'Address Selection',
  LOCATION_SELECTION: 'Location Selection',
  MY_ADDRESSES: 'My Addresses',
  CATEGORY_RESULTS: 'Category Results',
  RESTAURANT: 'Restaurant',
  RESTAURANT_DETAILS: 'Restaurant Details',
  CHECKOUT: 'Checkout',
  EXPLORE_DISHES: 'Explore Dishes',
  PRIVACY_POLICY: 'Privacy Policy',
  TERMS_CONDITIONS: 'Terms & Conditions',
  HELP: 'Help',
  CONTACT_US: 'Contact Us',
  FAQ: 'FAQ',
} as const;

class AnalyticsService {
  private isInitialized: boolean = false;
  private analyticsEnabled: boolean = true;
  private userId: string | null = null;

  /**
   * Initialize analytics service
   * Call this on app startup
   */
  async initialize(): Promise<void> {
    try {
      // Check if analytics is available
      if (!analytics) {
        console.warn('⚠️  Analytics: Firebase Analytics not available');
        return;
      }

      // Set analytics collection enabled (defaults to true)
      await analytics().setAnalyticsCollectionEnabled(this.analyticsEnabled);
      
      this.isInitialized = true;
      console.log('✅ Analytics: Initialized successfully');
    } catch (error) {
      console.warn('⚠️  Analytics: Initialization failed:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Set user ID for analytics
   * Call this after user logs in
   */
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

  /**
   * Set user properties
   */
  async setUserProperty(name: string, value: string | null): Promise<void> {
    try {
      if (!this.isInitialized || !analytics) return;
      
      await analytics().setUserProperty(name, value);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to set user property:', error);
    }
  }

  /**
   * Set multiple user properties
   */
  async setUserProperties(properties: Record<string, string | null>): Promise<void> {
    try {
      if (!this.isInitialized || !analytics) return;
      
      const promises = Object.entries(properties).map(([name, value]) =>
        analytics().setUserProperty(name, value)
      );
      await Promise.all(promises);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to set user properties:', error);
    }
  }

  /**
   * Log a screen view
   */
  async logScreenView(screenName: string, screenClass?: string): Promise<void> {
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

  /**
   * Log an event
   */
  async logEvent(eventName: string, parameters?: Record<string, any>): Promise<void> {
    try {
      if (!this.isInitialized || !analytics || !this.analyticsEnabled) return;
      
      // Clean parameters (remove undefined values and convert to proper types)
      const cleanParams = this.cleanParameters(parameters);
      
      await analytics().logEvent(eventName, cleanParams);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to log event:', error);
    }
  }

  /**
   * Log a standard Firebase SELECT_CONTENT event
   * Use this when a user selects content in your app
   */
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

  /**
   * Log a standard Firebase VIEW_ITEM event
   * Use this when a user views an item
   */
  async logViewItem(itemId: string, itemName: string, itemCategory?: string, price?: number, currency?: string): Promise<void> {
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

  /**
   * Log a standard Firebase ADD_TO_CART event
   * Use this when a user adds an item to cart
   */
  async logAddToCart(itemId: string, itemName: string, itemCategory?: string, price?: number, quantity?: number, currency?: string): Promise<void> {
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

  /**
   * Log a standard Firebase BEGIN_CHECKOUT event
   * Use this when a user begins checkout
   */
  async logBeginCheckout(value?: number, currency?: string, items?: Array<{item_id: string; item_name: string; price?: number; quantity?: number}>): Promise<void> {
    try {
      if (!this.isInitialized || !analytics || !this.analyticsEnabled) return;
      
      const params: Record<string, any> = {};
      
      if (value !== undefined) params[FirebaseStandardParams.VALUE] = value;
      if (currency) params[FirebaseStandardParams.CURRENCY] = currency;
      if (items && items.length > 0) {
        params.items = items;
      }
      
      await analytics().logEvent(FirebaseStandardEvents.BEGIN_CHECKOUT, params);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to log begin checkout:', error);
    }
  }

  /**
   * Log a standard Firebase PURCHASE event
   * Use this when a user completes a purchase
   */
  async logPurchase(transactionId: string, value: number, currency: string, items?: Array<{item_id: string; item_name: string; price?: number; quantity?: number}>): Promise<void> {
    try {
      if (!this.isInitialized || !analytics || !this.analyticsEnabled) return;
      
      const params: Record<string, any> = {
        transaction_id: transactionId,
        [FirebaseStandardParams.VALUE]: value,
        [FirebaseStandardParams.CURRENCY]: currency,
      };
      
      if (items && items.length > 0) {
        params.items = items;
      }
      
      await analytics().logEvent(FirebaseStandardEvents.PURCHASE, params);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to log purchase:', error);
    }
  }

  /**
   * Log a standard Firebase SEARCH event
   * Use this when a user performs a search
   */
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

  /**
   * Log a standard Firebase SIGN_UP event
   * Use this when a user signs up
   */
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

  /**
   * Log a standard Firebase LOGIN event
   * Use this when a user logs in
   */
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

  /**
   * Clean parameters for analytics
   * Removes undefined values and ensures proper types
   */
  private cleanParameters(parameters?: Record<string, any>): Record<string, any> {
    if (!parameters) return {};
    
    const cleaned: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(parameters)) {
      // Skip undefined and null values
      if (value === undefined || value === null) continue;
      
      // Convert to appropriate type
      if (typeof value === 'boolean') {
        cleaned[key] = value;
      } else if (typeof value === 'number') {
        cleaned[key] = value;
      } else if (typeof value === 'string') {
        cleaned[key] = value;
      } else if (Array.isArray(value)) {
        // Firebase Analytics supports arrays
        cleaned[key] = value;
      } else if (typeof value === 'object') {
        // Convert objects to strings (Firebase Analytics limitation)
        cleaned[key] = JSON.stringify(value);
      }
    }
    
    return cleaned;
  }

  /**
   * Enable or disable analytics collection
   */
  async setAnalyticsEnabled(enabled: boolean): Promise<void> {
    try {
      if (!analytics) return;
      
      this.analyticsEnabled = enabled;
      await analytics().setAnalyticsCollectionEnabled(enabled);
    } catch (error) {
      console.warn('⚠️  Analytics: Failed to set analytics enabled:', error);
    }
  }

  /**
   * Reset analytics data (useful for testing or logout)
   */
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

  /**
   * Get current user ID
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * Check if analytics is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
