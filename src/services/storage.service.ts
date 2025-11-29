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
};

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
  // Add other user fields as needed
}

class StorageService {
  /**
   * Save authentication tokens
   */
  async saveTokens(tokenData: TokenData): Promise<void> {
    try {
      // Validate tokens are not undefined or null
      if (!tokenData.accessToken || !tokenData.refreshToken) {
        throw new Error('Access token and refresh token are required');
      }

      const expiryTime = Date.now() + tokenData.expiresIn * 1000;

      await AsyncStorage.multiSet([
        [STORAGE_KEYS.ACCESS_TOKEN, tokenData.accessToken],
        [STORAGE_KEYS.REFRESH_TOKEN, tokenData.refreshToken],
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
   * Clear all stored data (logout)
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.TOKEN_EXPIRY,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.IS_LOGGED_IN,
        // Note: Cart data is cleared on logout
        STORAGE_KEYS.CART_DATA,
        STORAGE_KEYS.CART_RESTAURANT,
      ]);
      // Note: VEG_MODE is not cleared on logout - it persists
    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance
export const storageService = new StorageService();
export default storageService;
