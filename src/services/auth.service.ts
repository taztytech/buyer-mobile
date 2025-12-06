/**
 * Authentication Service
 * Handles all authentication-related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_CONFIG } from '@/config/api.config';
import { storageService, UserData } from './storage.service';
import { fcmNotificationService } from './fcmNotification.service';

// Types
export interface SendOtpRequest {
  phoneNumber: string;
  countryCode?: string;
}

export interface SendOtpResponse {
  message: string;
  otpSent: boolean;
  expiresIn?: number;
}

export interface VerifyOtpRequest {
  phoneNumber: string;
  otp: string;
  countryCode?: string;
}

export interface VerifyOtpResponse {
  user?: {
    id: string;
    phoneNumber: string;
    name?: string;
    email?: string;
  };
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  existing_user: boolean;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  phone_number?: number;
  status?: boolean;
}

export interface UpdateProfileResponse {
  user: {
    id: string;
    phoneNumber: string;
    name?: string;
    email?: string;
  };
}

export interface CreateProfileRequest {
  name: string;
  email: string;
  phone_number: number;
  status: boolean;
}

export interface CreateProfileResponse {
  user: {
    id: string;
    phoneNumber: string;
    name: string;
    email: string;
  };
}

class AuthService {
  /**
   * Send OTP to phone number
   */
  async sendOtp(phoneNumber: string): Promise<ApiResponse<SendOtpResponse>> {
    try {
      const response = await apiService.post<SendOtpResponse>(
        API_CONFIG.ENDPOINTS.AUTHENTICATION.GENERATE_OTP,
        {
          phone_number: parseInt(phoneNumber, 10),
        }
      );

      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send OTP',
        message: error.message,
      };
    }
  }

  /**
   * Verify OTP and login
   */
  async verifyOtp(
    phoneNumber: string,
    otp: string
  ): Promise<ApiResponse<VerifyOtpResponse>> {
    try {
      const response = await apiService.post<VerifyOtpResponse>(
        API_CONFIG.ENDPOINTS.AUTHENTICATION.LOGIN,
        {
          phone_number: phoneNumber,
          otp: parseInt(otp, 10),
        }
      );

      // If verification successful, store tokens and user data
      if (response.success && response.data) {
        // 1. Save authentication tokens to storage
        await storageService.saveTokens({
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          expiresIn: response.data.expires_in || 3600, // Default 1 hour
        });

        // 2. Save user data to storage (if provided)
        if (response.data.user) {
          await storageService.saveUser(response.data.user);
        } else {
          // If no user data, create minimal user object from phone number
          await storageService.saveUser({
            id: '', // Will be filled later
            phoneNumber: phoneNumber,
          });
        }

        // 3. Set tokens in API service (in-memory and persist to storage again as backup)
        await apiService.setTokens(
          response.data.access_token,
          response.data.refresh_token,
          response.data.expires_in || 3600
        );

        // 4. Register FCM token after successful login
        // This ensures the token is uploaded to backend after authentication
        fcmNotificationService.registerTokenAfterLogin().catch((error) => {
          console.warn('⚠️  Failed to register FCM token after login:', error);
          // Silent fail - push notifications are optional, but log the error
        });
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to verify OTP',
        message: error.message,
      };
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<ApiResponse> {
    try {
      // Delete FCM token from backend and Firebase (don't block logout if this fails)
      fcmNotificationService.unregisterToken().catch((error) => {
        console.warn('⚠️  Failed to unregister FCM token on logout:', error);
        // Silent fail - continue with logout even if this fails
      });

      // Attempt to call logout API
      const response = await apiService.post(API_CONFIG.ENDPOINTS.AUTHENTICATION.LOGOUT);

      // Clear tokens and user data regardless of API response
      await apiService.clearTokens();

      return response;
    } catch (error: any) {
      // Clear tokens even if API call fails
      await apiService.clearTokens();

      return {
        success: false,
        error: error.message || 'Failed to logout',
        message: error.message,
      };
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return await storageService.isLoggedIn();
  }

  /**
   * Get current user data
   */
  async getCurrentUser(): Promise<UserData | null> {
    return await storageService.getUser();
  }

  /**
   * Get user profile
   */
  async getProfile(): Promise<ApiResponse<any>> {
    try {
      const response = await apiService.get<any>(
        API_CONFIG.ENDPOINTS.USER.PROFILE
      );

      // If fetch successful, update stored user data
      // API returns user data directly in response.data (not response.data.user)
      if (response.success && response.data) {

        const updatedUser = {
          id: response.data.id?.toString() || '',
          phoneNumber: response.data.phone_number?.toString() || '',
          name: response.data.name || '',
          email: response.data.email || '',
          support_email: response.data.support_email || '',
          support_number: response.data.support_number || '',
        };
        await storageService.saveUser(updatedUser);

        // Transform response to match expected format for screens
        return {
          success: true,
          data: {
            user: {
              id: response.data.id?.toString() || '',
              phoneNumber: response.data.phone_number?.toString() || '',
              name: response.data.name || '',
              email: response.data.email || '',
              support_email: response.data.support_email || '',
              support_number: response.data.support_number || '',
            }
          },
          message: response.message,
        };
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch profile',
        message: error.message,
      };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(data: UpdateProfileRequest): Promise<ApiResponse<UpdateProfileResponse>> {
    try {
      const response = await apiService.patch<UpdateProfileResponse>(
        API_CONFIG.ENDPOINTS.USER.PROFILE,
        data
      );

      // If update successful, update stored user data
      if (response.success && response.data?.user) {
        const currentUser = await storageService.getUser();
        const updatedUser = {
          ...currentUser,
          id: response.data.user.id,
          phoneNumber: response.data.user.phoneNumber,
          name: response.data.user.name,
          email: response.data.user.email,
        };
        await storageService.saveUser(updatedUser);
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update profile',
        message: error.message,
      };
    }
  }

  /**
   * Create user profile for new users
   */
  async createProfile(data: CreateProfileRequest): Promise<ApiResponse<CreateProfileResponse>> {
    try {
      const response = await apiService.patch<CreateProfileResponse>(
        API_CONFIG.ENDPOINTS.USER.PROFILE,
        data
      );

      // If creation successful, update stored user data
      if (response.success && response.data?.user) {
        const currentUser = await storageService.getUser();
        const updatedUser = {
          ...currentUser,
          id: response.data.user.id,
          phoneNumber: response.data.user.phoneNumber,
          name: response.data.user.name,
          email: response.data.user.email,
        };
        await storageService.saveUser(updatedUser);
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create profile',
        message: error.message,
      };
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
