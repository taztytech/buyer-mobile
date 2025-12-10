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

const safeStringify = (obj: any, space: number = 2): string => {
  const seen = new WeakSet();
  try {
    return JSON.stringify(obj, (key, value) => {
      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      // Handle undefined values
      if (value === undefined) {
        return '[undefined]';
      }
      // Handle functions
      if (typeof value === 'function') {
        return `[Function: ${value.name || 'anonymous'}]`;
      }
      return value;
    }, space);
  } catch (error) {
    // Fallback if stringify fails
    try {
      return JSON.stringify({
        error: 'Failed to stringify',
        originalError: String(error),
        objectType: typeof obj,
        objectString: String(obj),
      }, null, space);
    } catch {
      return String(obj);
    }
  }
};

class ApiService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<boolean> | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize API service - load tokens from storage
   */
  async initialize(): Promise<void> {
    try {
      this.accessToken = await storageService.getAccessToken();
      this.refreshToken = await storageService.getRefreshToken();
      this.isInitialized = true;
    } catch (error) {
      // Silent fail but mark as initialized
      this.isInitialized = true;
    }
  }

  /**
   * Ensure tokens are loaded from storage (lazy loading fallback)
   */
  private async ensureTokensLoaded(): Promise<void> {
    // If not initialized or tokens are null, try loading from storage
    if (!this.isInitialized || (!this.accessToken && !this.refreshToken)) {
      await this.initialize();
    }
  }

  /**
   * Set authentication tokens (in memory and storage)
   */
  async setTokens(accessToken: string, refreshToken?: string, expiresIn: number = 3600): Promise<void> {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }

    // Also persist to storage to ensure tokens survive app restart
    // Only save if we have both access and refresh tokens
    const tokenToSave = refreshToken || this.refreshToken;
    if (tokenToSave) {
      try {
        await storageService.saveTokens({
          accessToken,
          refreshToken: tokenToSave,
          expiresIn,
        });
      } catch (error) {
        // Silent fail - tokens are still in memory
      }
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
   * Get current access token (with fallback to storage)
   */
  async getAccessToken(): Promise<string | null> {
    // If we have it in memory, return it
    if (this.accessToken) {
      return this.accessToken;
    }

    // Otherwise, try loading from storage
    await this.ensureTokensLoaded();
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
      // Ensure tokens are loaded from storage
      await this.ensureTokensLoaded();

      const refreshToken = this.refreshToken || await storageService.getRefreshToken();

      if (!refreshToken) {
        // No refresh token available - only then clear tokens
        await this.clearTokens();
        return false;
      }

      const url = buildApiUrl('/authentication/refresh-token');
      const requestBody = {
        refresh_token: refreshToken,
      };

      console.log('[API Request]', safeStringify({
        method: 'POST',
        url,
        headers: API_CONFIG.HEADERS,
        body: requestBody,
        timestamp: new Date().toISOString(),
      }));

      const response = await fetch(url, {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      console.log('[API Response]', safeStringify({
        method: 'POST',
        url,
        status: response.status,
        statusText: response.statusText,
        data: data,
        timestamp: new Date().toISOString(),
      }));

      if (response.ok && data.success) {
        // Validate that we received valid tokens (check both camelCase and snake_case)
        const newAccessToken = data.data?.access_token || data.data?.accessToken;
        const newRefreshToken = data.data?.refresh_token || data.data?.refreshToken;

        if (!newAccessToken) {
          // Keep existing tokens - don't clear them
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
        // Check if this is a definitive "invalid token" error
        const errorMessage = data.message || data.error || '';
        const isInvalidToken = response.status === 401 ||
                              errorMessage.toLowerCase().includes('invalid') ||
                              errorMessage.toLowerCase().includes('expired') ||
                              errorMessage.toLowerCase().includes('unauthorized');

        if (isInvalidToken) {
          await this.clearTokens();
        } else {
          // Network/server error - keep tokens and try again later
        }

        return false;
      }
    } catch (error: any) {
      // Network error or other exception - DON'T clear tokens
      // The user might just have temporary connectivity issues
      return false;
    }
  }

  /**
   * Build headers for API request
   * Note: Assumes ensureTokensLoaded() was already called by the request method
   */
  private buildHeaders(customHeaders?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      ...API_CONFIG.HEADERS,
      ...customHeaders,
    };

    // Use in-memory token (should be loaded by ensureTokensLoaded already)
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
    customHeaders?: Record<string, string>,
    retryCount: number = 0
  ): Promise<ApiResponse<T>> {
    try {
      // Ensure tokens are loaded from storage before making request
      await this.ensureTokensLoaded();

      const url = buildApiUrl(endpoint);
      const headers = this.buildHeaders(customHeaders);

      const config: RequestInit = {
        method,
        headers,
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
        config.body = JSON.stringify(data);
      }

      // Centralized request logging for debugging purposes
      const requestBody = config.body ? JSON.parse(config.body as string) : undefined;
      console.log('[apiService][request]', safeStringify({
        method,
        endpoint: url,
        body: requestBody,
        hasBody: Boolean(config.body),
        timestamp: new Date().toISOString(),
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const startTime = Date.now();
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });
      const duration = Date.now() - startTime;

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized - attempt token refresh
      if (response.status === 401) {
        // Only attempt refresh once per request to avoid infinite loops
        if (retryCount < 1) {
          const refreshed = await this.refreshAccessToken();

          if (refreshed) {
            // Retry the original request with new token
            return this.request<T>(method, endpoint, data, customHeaders, retryCount + 1);
          } else {
            // Refresh failed - check if session was cleared
            const stillHasTokens = await storageService.getAccessToken() !== null;
            if (stillHasTokens) {
              // Tokens still exist, refresh just failed temporarily
              return {
                success: false,
                error: 'Unable to refresh session. Please try again.',
                message: 'Unable to refresh session. Please try again.',
              };
            } else {
              // Session was cleared, user needs to login
              return {
                success: false,
                error: 'Session expired. Please login again.',
                message: 'Session expired. Please login again.',
              };
            }
          }
        } else {
          // Already retried, don't try again
          return {
            success: false,
            error: 'Authentication failed. Please login again.',
            message: 'Authentication failed. Please login again.',
          };
        }
      }

      const responseData = await response.json();

      console.log('[apiService][response]', safeStringify({
        method,
        endpoint: url,
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
        fullResponse: responseData,
        data: responseData?.data ?? responseData,
        message: responseData?.message,
        error: responseData?.error,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      }));

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
      console.log('[apiService][response_error]', safeStringify({
        method,
        endpoint,
        error: error,
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        timestamp: new Date().toISOString(),
      }));
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
  async get<T>(endpoint: string, params?: Record<string, any>, customHeaders?: Record<string, string>): Promise<ApiResponse<T>> {
    // Build query string from params if provided
    let url = endpoint;
    if (params && Object.keys(params).length > 0) {
      const queryString = Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

      if (queryString) {
        url = `${endpoint}?${queryString}`;
      }
    }

    return this.request<T>('GET', url, null, customHeaders);
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
    data?: any,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, data, customHeaders);
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
