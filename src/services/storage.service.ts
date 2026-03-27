/**
 * Storage Service
 * Handles secure storage of authentication tokens and user data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: '@tazty_access_token',
  REFRESH_TOKEN: '@tazty_refresh_token',
  TOKEN_EXPIRY: '@tazty_token_expiry',
  USER_DATA: '@tazty_user_data',
  IS_LOGGED_IN: '@tazty_is_logged_in',
  VEG_MODE: '@tazty_veg_mode',
  CART_DATA: '@tazty_cart_data',
  CART_RESTAURANT: '@tazty_cart_restaurant',
  // FCM and notification related keys
  FCM_TOKEN: '@tazty_fcm_token',
  PUSH_TOKEN: '@tazty_push_token',
  DEVICE_ID: '@tazty_device_id',
  IDENTITY_TOKEN: '@tazty_identity_token',
  BACKGROUND_NOTIFICATIONS: '@tazty_background_notifications',
  // App version tracking for cache clearing
  APP_VERSION_CODE: '@tazty_app_version_code',
};

/** AsyncStorage key for guest-persisted delivery location (synced to user addresses after login). */
export const GUEST_SELECTED_LOCATION_KEY = 'selectedLocation';

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Expiry time in seconds
}

export interface UserData {
  id: string;
  phoneNumber: string;
  name?: string;
  email?: string;
  support_email?: string;
  support_number?: string;
  user_type?: 'new' | 'returning' | 'guest';
  // Add other user fields as needed
}

class StorageService {
  /**
   * Save authentication tokens
   */
  async saveTokens(tokenData: TokenData): Promise<void> {
    try {
      if (!tokenData.accessToken) {
        throw new Error('Access token is required');
      }
      const refreshToken = tokenData.refreshToken || tokenData.accessToken;

      const expiryTime = Date.now() + tokenData.expiresIn * 1000;

      await AsyncStorage.multiSet([
        [STORAGE_KEYS.ACCESS_TOKEN, tokenData.accessToken],
        [STORAGE_KEYS.REFRESH_TOKEN, refreshToken],
        [STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString()],
      ]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      return token;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      return null;
    }
  }

  /**
   * Save identity token for guest session linking (persisted across app restarts)
   */
  async saveIdentityToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IDENTITY_TOKEN, token);
    } catch (error) {
      console.warn('[Storage] Failed to save identity token:', error);
    }
  }

  /**
   * Get stored identity token for guest login
   */
  async getIdentityToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.IDENTITY_TOKEN);
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear identity token (called when guest logs in via OTP)
   */
  async clearIdentityToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.IDENTITY_TOKEN);
    } catch (error) {
      console.warn('[Storage] Failed to clear identity token:', error);
    }
  }

  /**
   * Get or create device ID for guest login and analytics
   * Preserved across logout so the same device keeps its identity
   */
  async getOrCreateDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
      if (!deviceId) {
        deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16).toUpperCase();
        });
        await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
      }
      return deviceId;
    } catch (error) {
      return `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Check if access token is expired
   */
  async isTokenExpired(): Promise<boolean> {
    try {
      const expiryTime = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
      if (!expiryTime) return true;

      return Date.now() >= parseInt(expiryTime, 10);
    } catch (error) {
      return true;
    }
  }

  /**
   * Save user data
   */
  async saveUser(userData: UserData): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.USER_DATA, JSON.stringify(userData)],
        [STORAGE_KEYS.IS_LOGGED_IN, 'true'],
      ]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user data
   */
  async getUser(): Promise<UserData | null> {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      const isLoggedIn = await AsyncStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN);
      const accessToken = await this.getAccessToken();

      const result = isLoggedIn === 'true' && accessToken !== null;
      return result;
    } catch (error) {
      return false;
    }
  }

  /**
   * Save veg mode preference
   */
  async saveVegMode(mode: 'off' | 'pure' | 'all'): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VEG_MODE, mode);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get veg mode preference
   */
  async getVegMode(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.VEG_MODE);
    } catch (error) {
      return null;
    }
  }

  /**
   * Save cart data
   */
  async saveCartData(cartData: {
    cart: { [key: string]: any };
    restaurantId: number | null;
    restaurantName: string;
    restaurantLogo?: any;
  }): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.CART_DATA, JSON.stringify(cartData.cart)],
        [STORAGE_KEYS.CART_RESTAURANT, JSON.stringify({
          id: cartData.restaurantId,
          name: cartData.restaurantName,
          logo: cartData.restaurantLogo,
        })],
      ]);
    } catch (error) {
      console.error('[StorageService] Error saving cart data:', error);
    }
  }

  /**
   * Get cart data
   */
  async getCartData(): Promise<{
    cart: { [key: string]: any } | null;
    restaurantId: number | null;
    restaurantName: string;
    restaurantLogo: any;
  } | null> {
    try {
      const [cartData, restaurantData] = await AsyncStorage.multiGet([
        STORAGE_KEYS.CART_DATA,
        STORAGE_KEYS.CART_RESTAURANT,
      ]);

      const cart = cartData[1] ? JSON.parse(cartData[1]) : null;
      const restaurant = restaurantData[1] ? JSON.parse(restaurantData[1]) : null;

      if (!cart && !restaurant) {
        return null;
      }

      return {
        cart: cart || {},
        restaurantId: restaurant?.id || null,
        restaurantName: restaurant?.name || '',
        restaurantLogo: restaurant?.logo || null,
      };
    } catch (error) {
      console.error('[StorageService] Error getting cart data:', error);
      return null;
    }
  }

  /**
   * Clear cart data
   */
  async clearCartData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.CART_DATA,
        STORAGE_KEYS.CART_RESTAURANT,
      ]);
    } catch (error) {
      console.error('[StorageService] Error clearing cart data:', error);
    }
  }

  /**
   * Save app version code for tracking version changes
   */
  async saveAppVersionCode(versionCode: number | string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.APP_VERSION_CODE, String(versionCode));
    } catch (error) {
      console.error('[StorageService] Error saving app version code:', error);
    }
  }

  /**
   * Get stored app version code
   */
  async getAppVersionCode(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.APP_VERSION_CODE);
    } catch (error) {
      console.error('[StorageService] Error getting app version code:', error);
      return null;
    }
  }

  /**
   * Check if app version has changed (for cache clearing on update)
   */
  async hasVersionChanged(currentVersionCode: number | string): Promise<boolean> {
    try {
      const storedVersion = await this.getAppVersionCode();
      const currentVersionStr = String(currentVersionCode);
      
      // If no stored version, this is first run or fresh install
      if (!storedVersion) {
        // Save current version for next check
        await this.saveAppVersionCode(currentVersionCode);
        return false; // Don't treat first run as version change
      }
      
      // Check if version changed
      if (storedVersion !== currentVersionStr) {
        // Update stored version
        await this.saveAppVersionCode(currentVersionCode);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[StorageService] Error checking version change:', error);
      return false;
    }
  }

  /**
   * Clear all stored data (logout)
   * This clears all user-specific data including authentication tokens,
   * user data, cart data, FCM tokens, guest identity token, background notifications, and chat history.
   * Note: VEG_MODE preference is preserved as it's a device-level preference.
   * Note: DEVICE_ID is preserved for guest login and analytics identity.
   */
  async clearAll(): Promise<void> {
    try {
      // Import chat history service dynamically to avoid circular dependencies
      const { chatHistoryService } = await import('./chatHistory.service');
      
      // Clear chat history first
      await chatHistoryService.clearAllChatHistory();
      
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.TOKEN_EXPIRY,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.IS_LOGGED_IN,
        // Cart data is cleared on logout
        STORAGE_KEYS.CART_DATA,
        STORAGE_KEYS.CART_RESTAURANT,
        // FCM and notification data is cleared on logout
        STORAGE_KEYS.FCM_TOKEN,
        STORAGE_KEYS.PUSH_TOKEN,
        STORAGE_KEYS.IDENTITY_TOKEN,
        // DEVICE_ID preserved for guest login and analytics identity
        STORAGE_KEYS.BACKGROUND_NOTIFICATIONS,
      ]);
      // Note: VEG_MODE is not cleared on logout - it persists as a device preference
      // Note: APP_VERSION_CODE is not cleared on logout - it persists for version tracking
    } catch (error) {
      console.error('[StorageService] Error clearing all data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const storageService = new StorageService();
export default storageService;
