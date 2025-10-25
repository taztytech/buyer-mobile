/**
 * API Service
 * Handles all HTTP requests with proper error handling and authentication
 */

import { API_CONFIG, buildApiUrl } from '@/config/api.config';
import { storageService } from './storage.service';

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

class ApiService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<boolean> | null = null;

  /**
   * Initialize API service - load tokens from storage
   */
  async initialize(): Promise<void> {
    try {
      this.accessToken = await storageService.getAccessToken();
      this.refreshToken = await storageService.getRefreshToken();
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Set authentication tokens (in memory and storage)
   */
  setTokens(accessToken: string, refreshToken?: string) {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
  }

  /**
   * Clear authentication tokens (from memory and storage)
   */
  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    await storageService.clearAll();
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<boolean> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this._performRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async _performRefresh(): Promise<boolean> {
    try {
      const refreshToken = this.refreshToken || await storageService.getRefreshToken();

      if (!refreshToken) {
        await this.clearTokens();
        return false;
      }

      const url = buildApiUrl('/authentication/refresh-token');
      const response = await fetch(url, {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Validate that we received valid tokens (check both camelCase and snake_case)
        const newAccessToken = data.data?.access_token || data.data?.accessToken;
        const newRefreshToken = data.data?.refresh_token || data.data?.refreshToken;

        if (!newAccessToken) {
          await this.clearTokens();
          return false;
        }

        // Save new tokens
        this.accessToken = newAccessToken;
        this.refreshToken = newRefreshToken || refreshToken;

        await storageService.saveTokens({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken || refreshToken,
          expiresIn: data.data?.expires_in || data.data?.expiresIn || 3600,
        });

        return true;
      } else {
        await this.clearTokens();
        return false;
      }
    } catch (error) {
      await this.clearTokens();
      return false;
    }
  }

  /**
   * Build headers for API request
   */
  private buildHeaders(customHeaders?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      ...API_CONFIG.HEADERS,
      ...customHeaders,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  /**
   * Handle API errors
   */
  private handleError(error: any): ApiError {
    if (error.response) {
      // Server responded with error status
      return {
        message: error.response.data?.message || 'An error occurred',
        status: error.response.status,
        code: error.response.data?.code,
      };
    } else if (error.request) {
      // Request made but no response
      return {
        message: 'Network error. Please check your connection.',
        status: 0,
      };
    } else {
      // Something else happened
      return {
        message: error.message || 'An unexpected error occurred',
      };
    }
  }

  /**
   * Make HTTP request
   */
  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    try {
      const url = buildApiUrl(endpoint);
      const headers = this.buildHeaders(customHeaders);

      const config: RequestInit = {
        method,
        headers,
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.body = JSON.stringify(data);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized - attempt token refresh
      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken();

        if (refreshed) {
          // Retry the original request with new token
          return this.request<T>(method, endpoint, data, customHeaders);
        } else {
          // Refresh failed, return unauthorized error
          return {
            success: false,
            error: 'Session expired. Please login again.',
            message: 'Session expired. Please login again.',
          };
        }
      }

      const responseData = await response.json();

      // Log response details for debugging
      if (endpoint.includes('/favorites/all')) {
        console.log('🔍 API Response Details:');
        console.log('  Status:', response.status);
        console.log('  OK:', response.ok);
        console.log('  Response Data:', JSON.stringify(responseData, null, 2));
      }

      if (!response.ok) {
        return {
          success: false,
          error: responseData.message || 'Request failed',
          message: responseData.message,
        };
      }

      return {
        success: true,
        data: responseData.data || responseData,
        message: responseData.message,
      };
    } catch (error: any) {
      const apiError = this.handleError(error);
      return {
        success: false,
        error: apiError.message,
        message: apiError.message,
      };
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, customHeaders?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, null, customHeaders);
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    data?: any,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, data, customHeaders);
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    data?: any,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, data, customHeaders);
  }

  /**
   * PATCH request
   */
  async patch<T>(
    endpoint: string,
    data?: any,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, data, customHeaders);
  }

  /**
   * DELETE request
   */
  async delete<T>(
    endpoint: string,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, null, customHeaders);
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
