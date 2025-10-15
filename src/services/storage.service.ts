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
      const expiryTime = Date.now() + tokenData.expiresIn * 1000;

      await AsyncStorage.multiSet([
        [STORAGE_KEYS.ACCESS_TOKEN, tokenData.accessToken],
        [STORAGE_KEYS.REFRESH_TOKEN, tokenData.refreshToken],
        [STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString()],
      ]);

      console.log('[StorageService] Tokens saved successfully');
    } catch (error) {
      console.error('[StorageService] Error saving tokens:', error);
      throw error;
    }
  }

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('[StorageService] Error getting access token:', error);
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
      console.error('[StorageService] Error getting refresh token:', error);
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
      console.error('[StorageService] Error checking token expiry:', error);
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

      console.log('[StorageService] User data saved successfully');
    } catch (error) {
      console.error('[StorageService] Error saving user data:', error);
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
      console.error('[StorageService] Error getting user data:', error);
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

      return isLoggedIn === 'true' && accessToken !== null;
    } catch (error) {
      console.error('[StorageService] Error checking login status:', error);
      return false;
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
      ]);

      console.log('[StorageService] All data cleared successfully');
    } catch (error) {
      console.error('[StorageService] Error clearing data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const storageService = new StorageService();
export default storageService;
