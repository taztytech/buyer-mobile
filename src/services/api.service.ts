/**
 * API Service
 * Handles all HTTP requests with proper error handling and authentication
 */

import Constants from '@/shims/rn-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_VERSION_CODE, APP_VERSION_NAME } from '@/config/appVersion.generated';
import { API_CONFIG, buildApiUrl } from '@/config/api.config';
import { storageService } from './storage.service';
import { analyticsService, AnalyticsEvents } from './analytics.service';
import { crashlyticsService } from './crashlytics.service';

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  statusCode?: number;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

const safeStringify = (obj: any, space: number = 2): string => {
  const seen = new WeakSet();
  try {
    return JSON.stringify(obj, (_key, value) => {
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
  private tokenExpiry: number | null = null; // Timestamp when access token expires
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<'success' | 'hard_fail' | 'soft_fail'> | null = null;
  private isInitialized: boolean = false;
  private onUserDeletedCallback: (() => void) | null = null;
  private onSessionExpiredCallback: (() => void) | null = null;
  private guestLoginRetryCallback: (() => Promise<boolean>) | null = null;
  private lastProfileCheckTime: number = 0; // Timestamp of last profile check
  private profileCheckInProgress: boolean = false; // Prevent multiple simultaneous profile checks
  private readonly PROFILE_CHECK_INTERVAL_MS = 60 * 1000; // Check profile every 60 seconds max (reduced frequency)
  private readonly crashlyticsBlockedKeyPatterns: RegExp[] = [
    /authorization/i,
    /token/i,
    /password/i,
    /secret/i,
    /signature/i,
    /cookie/i,
    /session/i,
    /api[_-]?key/i,
    /otp/i,
    /phone/i,
    /email/i,
    /address/i,
    /lat/i,
    /lng/i,
    /long/i,
    /name/i,
  ];

  /**
   * Set callback to be called when user deletion is detected
   * This allows the app to handle navigation to login screen
   */
  setUserDeletedCallback(callback: () => void): void {
    this.onUserDeletedCallback = callback;
  }

  /**
   * Set callback to be called when session expires (refresh token invalid/expired)
   * This allows the app to handle navigation to login screen
   */
  setSessionExpiredCallback(callback: () => void): void {
    this.onSessionExpiredCallback = callback;
  }

  /**
   * Set callback for guest login retry on 401. When in guest mode with identity_token,
   * this is called to get fresh tokens before retrying the failed request.
   */
  setGuestLoginRetryCallback(callback: () => Promise<boolean>): void {
    this.guestLoginRetryCallback = callback;
  }

  /**
   * Build version headers using generated app version (single source of truth)
   * with safe fallback to native/RN CLI config in dev or if file missing.
   * These are sent with every API request and also logged.
   */
  private getVersionHeaders(): Record<string, string> {
    // 1) Primary source: generated config (kept in sync with android/version.properties)
    let versionName: string | undefined =
      typeof APP_VERSION_NAME === 'string' && APP_VERSION_NAME.length > 0
        ? APP_VERSION_NAME
        : undefined;

    let versionCode: string | undefined;

    const appVersionCodeAny: any = APP_VERSION_CODE;
    if (typeof appVersionCodeAny === 'number' && appVersionCodeAny > 0) {
      versionCode = String(appVersionCodeAny);
    } else if (typeof appVersionCodeAny === 'string' && appVersionCodeAny.length > 0) {
      versionCode = appVersionCodeAny;
    }

    // 2) Fallback: native/RN CLI config (mainly for dev / RN CLI Go)
    if (!versionName || !versionCode) {
      const appConfig: any = (Constants as any).appConfig ?? {};

      if (!versionName) {
        const versionNameFallback =
          Constants.nativeAppVersion ??
          appConfig.version ??
          appConfig.runtimeVersion ??
          undefined;

        if (versionNameFallback !== undefined) {
          versionName = String(versionNameFallback);
        }
      }

      if (!versionCode) {
        const versionCodeFallback =
          Constants.nativeBuildVersion ??
          appConfig.android?.versionCode ??
          appConfig.ios?.buildNumber ??
          undefined;

        if (versionCodeFallback !== undefined) {
          versionCode = String(versionCodeFallback);
        }
      }
    }

    // 3) Final safety defaults
    if (!versionName) versionName = 'unknown';
    if (!versionCode) versionCode = '0';

    return {
      'X-App-Version-Name': versionName,
      'X-App-Version-Code': versionCode,
    };
  }

  private isCrashlyticsBlockedKey(key: string): boolean {
    return this.crashlyticsBlockedKeyPatterns.some((pattern) => pattern.test(key));
  }

  private sanitizeForCrashlytics(value: any, depth: number = 0): any {
    if (depth > 5) {
      return '[truncated-depth]';
    }
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'string') {
      return value.length > 400 ? `${value.slice(0, 400)}...[truncated]` : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      const trimmed = value.slice(0, 25).map((item) => this.sanitizeForCrashlytics(item, depth + 1));
      if (value.length > 25) {
        trimmed.push('[truncated-items]');
      }
      return trimmed;
    }
    if (typeof value === 'object') {
      const output: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        if (this.isCrashlyticsBlockedKey(k)) {
          output[k] = '[redacted]';
          continue;
        }
        output[k] = this.sanitizeForCrashlytics(v, depth + 1);
      }
      return output;
    }
    return String(value);
  }

  private toBreadcrumbString(label: string, payload: any): string {
    const serialized = safeStringify(payload, 0);
    const compact = serialized.replace(/\s+/g, ' ').trim();
    const maxLen = 850;
    const truncated = compact.length > maxLen ? `${compact.slice(0, maxLen)}...[truncated]` : compact;
    return `${label}: ${truncated}`;
  }

  private async logApiErrorToCrashlytics(params: {
    method: string;
    url: string;
    status?: number;
    request?: any;
    response?: any;
    reason?: string;
    source: string;
  }): Promise<void> {
    const sanitizedReq = this.sanitizeForCrashlytics(params.request);
    const sanitizedResponse = this.sanitizeForCrashlytics(params.response);
    const apiStatus = typeof params.status === 'number' ? params.status : 0;

    await crashlyticsService.log(
      this.toBreadcrumbString('api_error_context', {
        api_method: params.method,
        api_url: params.url,
        api_status: apiStatus,
        source: params.source,
        reason: params.reason || 'unknown_api_error',
        req: sanitizedReq,
        response: sanitizedResponse,
      }),
    );

    await crashlyticsService.recordError(new Error('API Call Error'), {
      source: params.source,
      api_method: params.method,
      api_url: params.url,
      api_status: apiStatus,
      error_reason: params.reason || 'unknown_api_error',
      req: sanitizedReq,
      response: sanitizedResponse,
    });
  }

  private async logTokenRefreshFailureToCrashlytics(params: {
    reason: string;
    status?: number;
    request?: any;
    response?: any;
  }): Promise<void> {
    await this.logApiErrorToCrashlytics({
      method: 'POST',
      url: buildApiUrl('/authentication/refresh-token'),
      status: typeof params.status === 'number' ? params.status : 0,
      request: params.request,
      response: params.response,
      reason: params.reason,
      source: 'token_refresh_failure',
    });
  }

  /**
   * Initialize API service - load tokens from storage
   * Also checks for app version changes to clear cache
   */
  async initialize(): Promise<void> {
    try {
      this.accessToken = await storageService.getAccessToken();
      this.refreshToken = await storageService.getRefreshToken();
      
      // Check if app version changed (for cache clearing on update)
      // This fixes the issue where old cached 426 responses persist after app update
      try {
        const versionChanged = await storageService.hasVersionChanged(APP_VERSION_CODE);
        if (versionChanged) {
          console.log('[apiService] App version changed, cache will be bypassed for home API');
          // Version change is tracked, home API will use cache-busting headers
        }
      } catch (versionError) {
        // Silent fail - version check is not critical
        console.warn('[apiService] Error checking version change:', versionError);
      }
      
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
    
    // Also load expiry if not set
    if (this.tokenExpiry === null) {
      try {
        const expiryTimeStr = await AsyncStorage.getItem('@tazty_token_expiry');
        this.tokenExpiry = expiryTimeStr ? parseInt(expiryTimeStr, 10) : null;
      } catch (error) {
        // Silent fail
      }
    }
  }

  /**
   * Check profile API in background to detect user deletion
   * This is called after successful authenticated API calls (except profile itself)
   * Uses throttling to avoid performance issues
   * CRITICAL: Always makes a fresh API call (no cache) to detect user deletion immediately
   * Skip for guest mode - guests don't have profiles and would get 403
   */
  private async checkProfileInBackground(): Promise<void> {
    // Skip for guest mode - profile API requires a registered user
    const isLoggedIn = await storageService.isLoggedIn();
    if (!isLoggedIn) {
      return;
    }

    // Throttle: Only check if enough time has passed since last check
    const now = Date.now();
    if (now - this.lastProfileCheckTime < this.PROFILE_CHECK_INTERVAL_MS) {
      return; // Too soon, skip check
    }

    // Prevent multiple simultaneous profile checks
    if (this.profileCheckInProgress) {
      return; // Already checking, skip
    }

    // Update last check time immediately to prevent rapid checks
    this.lastProfileCheckTime = now;
    this.profileCheckInProgress = true;

    try {
      // CRITICAL: Make a fresh GET request to profile endpoint with cache-busting headers
      // This ensures we always get the latest data from server, not cached responses
      // Add timestamp query param and cache-control headers to bypass any caching
      const cacheBustingParams = {
        _t: Date.now(), // Timestamp to ensure fresh request
      };
      
      // Add cache-control headers to ensure no caching
      const cacheBustingHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      };

      // Make a fresh API call with cache-busting
      // This will trigger the user deletion detection logic if user is deleted
      // The user deletion check happens in the request() method
      // If user is deleted, it will call onUserDeletedCallback automatically
      await this.get('/user/profile', cacheBustingParams, cacheBustingHeaders);
    } catch (error) {
      // Silent fail - this is a background check, don't disrupt user flow
      // The error handling in request() will handle user deletion detection
    } finally {
      this.profileCheckInProgress = false;
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
    
    // Calculate and store expiry timestamp
    this.tokenExpiry = Date.now() + (expiresIn * 1000);

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
        // Update expiry timestamp in storage (already saved by saveTokens, but ensure it's set)
        await AsyncStorage.setItem('@tazty_token_expiry', this.tokenExpiry.toString());
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
    this.tokenExpiry = null;
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
   * Refresh access token using refresh token.
   * Returns: 'success' | 'hard_fail' | 'soft_fail'
   *  - success    : new tokens saved, caller should retry the original request
   *  - hard_fail  : token is definitively invalid, caller should log the user out
   *  - soft_fail  : temporary error (network/server), caller should NOT log out
   */
  private async refreshAccessToken(): Promise<'success' | 'hard_fail' | 'soft_fail'> {
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
   * Perform the actual token refresh.
   * Returns 'success', 'hard_fail', or 'soft_fail'.
   */
  private async _performRefresh(): Promise<'success' | 'hard_fail' | 'soft_fail'> {
    try {
      await this.ensureTokensLoaded();

      const refreshToken = this.refreshToken || await storageService.getRefreshToken();

      if (!refreshToken || refreshToken.trim() === '') {
        console.warn('[apiService] No refresh token available for refresh');
        await this.logTokenRefreshFailureToCrashlytics({
          reason: 'missing_refresh_token',
          status: 0,
          request: { refresh_token: null },
          response: {
            success: false,
            message: 'No refresh token available for refresh',
          },
        });
        await this.clearTokens();
        return 'hard_fail';
      }

      const url = buildApiUrl('/authentication/refresh-token');
      
      // Build request body and sanitize to ensure no null/undefined values
      const requestBody = {
        refresh_token: refreshToken,
      };
      const sanitizedBody = this.sanitizePayload(requestBody);

      // Build headers with version info (but NO Authorization header for refresh token endpoint)
      const versionHeaders = this.getVersionHeaders();
      const headers: Record<string, string> = {
        ...API_CONFIG.HEADERS,
        ...versionHeaders,
      };

      // Log request for debugging
      console.log('[apiService][refresh-token-request]', safeStringify({
        method: 'POST',
        endpoint: url,
        body: sanitizedBody,
        hasBody: true,
        headers: {
          'X-App-Version-Name': headers['X-App-Version-Name'],
          'X-App-Version-Code': headers['X-App-Version-Code'],
        },
        timestamp: new Date().toISOString(),
      }));

      // Add timeout handling like main request method
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(sanitizedBody),
        signal: controller.signal,
      });
      const duration = Date.now() - startTime;

      clearTimeout(timeoutId);

      const data = await response.json();

      // Log response for debugging
      console.log('[apiService][refresh-token-response]', safeStringify({
        method: 'POST',
        endpoint: url,
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
        fullResponse: data,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      }));

      if (response.ok && data.success) {
        // Validate that we received valid tokens (check both camelCase and snake_case)
        const newAccessToken = data.data?.access_token || data.data?.accessToken;
        const newRefreshToken = data.data?.refresh_token || data.data?.refreshToken;

        if (!newAccessToken || newAccessToken.trim() === '') {
          console.warn('[apiService] Refresh token response missing access token');
          await this.logTokenRefreshFailureToCrashlytics({
            reason: 'missing_access_token_in_refresh_response',
            status: response.status,
            request: sanitizedBody,
            response: {
              success: false,
              status: response.status,
              data,
            },
          });
          // Keep existing tokens - don't clear them (might be temporary backend issue)
          return 'soft_fail';
        }

        // Save new tokens
        this.accessToken = newAccessToken;
        // Use new refresh token if provided, otherwise keep the old one
        const finalRefreshToken = (newRefreshToken && newRefreshToken.trim() !== '') 
          ? newRefreshToken 
          : refreshToken;
        this.refreshToken = finalRefreshToken;
        
        // Update expiry timestamp
        const expiresIn = data.data?.expires_in || data.data?.expiresIn || 3600;
        this.tokenExpiry = Date.now() + (expiresIn * 1000);

        await storageService.saveTokens({
          accessToken: newAccessToken,
          refreshToken: finalRefreshToken,
          expiresIn,
        });

        console.log('[apiService] Token refresh successful');
        return 'success';
      } else {
        // Check if this is a definitive "invalid / expired token" error.
        // Use token-specific phrases only — bare words like "invalid" or "expired" are
        // far too broad and can match non-auth business errors (e.g. "Invalid address",
        // "Expired promotion"), which would incorrectly clear a valid session.
        const errorMessage = (data.message || data.error || '').toLowerCase();
        const isInvalidToken =
          response.status === 401 ||
          response.status === 403 ||
          errorMessage.includes('invalid token') ||
          errorMessage.includes('token invalid') ||
          errorMessage.includes('token expired') ||
          errorMessage.includes('refresh token expired') ||
          errorMessage.includes('token not found') ||
          errorMessage.includes('unauthorized');

        if (isInvalidToken) {
          console.warn('[apiService] Refresh token is invalid/expired, clearing session');
          await this.logTokenRefreshFailureToCrashlytics({
            reason: 'invalid_or_expired_refresh_token',
            status: response.status,
            request: sanitizedBody,
            response: {
              success: false,
              status: response.status,
              data,
            },
          });
          await this.clearTokens();
          return 'hard_fail';
        }

        // Server returned a non-auth error (e.g. 500, 502) — keep tokens, try again later
        console.warn('[apiService] Refresh token failed (non-auth error), keeping tokens');
        await this.logTokenRefreshFailureToCrashlytics({
          reason: 'refresh_non_auth_http_error',
          status: response.status,
          request: sanitizedBody,
          response: {
            success: false,
            status: response.status,
            data,
          },
        });
        return 'soft_fail';
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('[apiService] Refresh token request timed out');
        await this.logTokenRefreshFailureToCrashlytics({
          reason: 'refresh_request_timeout',
          status: 0,
          request: { endpoint: '/authentication/refresh-token' },
          response: {
            success: false,
            message: error?.message || 'refresh_request_timeout',
          },
        });
        return 'soft_fail';
      }

      // Network error — keep tokens, user might just have temporary connectivity issues
      console.error('[apiService] Refresh token error:', error);
      await this.logTokenRefreshFailureToCrashlytics({
        reason: 'refresh_request_exception',
        status: error?.status || error?.statusCode || 0,
        request: { endpoint: '/authentication/refresh-token' },
        response: {
          success: false,
          name: error?.name || null,
          message: error?.message || 'refresh_request_exception',
        },
      });
      return 'soft_fail';
    }
  }

  /**
   * Build headers for API request
   * Note: Assumes ensureTokensLoaded() was already called by the request method
   */
  private buildHeaders(customHeaders?: Record<string, string>): HeadersInit {
    const versionHeaders = this.getVersionHeaders();

    const headers: Record<string, string> = {
      ...API_CONFIG.HEADERS,
      ...versionHeaders,
      ...customHeaders,
    };

    // Use in-memory token (should be loaded by ensureTokensLoaded already)
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  /**
   * Recursively sanitize request payloads by removing null and undefined values.
   * This ensures we don't send fields like `item_id: null` to the backend.
   */
  private sanitizePayload<T>(data: T): T {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data
        .map((item) => this.sanitizePayload(item))
        .filter((item) => item !== null && item !== undefined) as any;
    }

    if (typeof data === 'object') {
      const result: any = {};
      Object.entries(data as any).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          return;
        }
        result[key] = this.sanitizePayload(value as any);
      });
      return result;
    }

    return data;
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
    const shouldHaveBody =
      method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
    const sanitizedRequestPayload = data && shouldHaveBody ? this.sanitizePayload(data) : undefined;

    try {
      // Ensure tokens are loaded from storage
      await this.ensureTokensLoaded();

      const url = buildApiUrl(endpoint);
      const headers = this.buildHeaders(customHeaders);

      const config: RequestInit = {
        method,
        headers,
      };
      
      // Sanitize payload to avoid sending null/undefined values to the API
      if (sanitizedRequestPayload !== undefined) {
        config.body = JSON.stringify(sanitizedRequestPayload);
      }

      // Centralized request logging for debugging purposes
      const requestBody = config.body ? JSON.parse(config.body as string) : undefined;
      console.log(
        '[apiService][request]',
        safeStringify({
          method,
          endpoint: url,
          body: requestBody,
          hasBody: Boolean(config.body),
          headers: {
            'X-App-Version-Name': (headers as Record<string, string>)['X-App-Version-Name'],
            'X-App-Version-Code': (headers as Record<string, string>)['X-App-Version-Code'],
          },
          timestamp: new Date().toISOString(),
        }),
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const startTime = Date.now();
      // CRITICAL: For background profile checks, ensure no caching
      // Check if cache-control header is set to bypass cache
      const fetchOptions: RequestInit = {
        ...config,
        signal: controller.signal,
      };
      
      // CRITICAL: Always bypass cache for home API to prevent stale 426 responses
      // This fixes the issue where old cached 426 responses persist after app update/reinstall
      const isHomeEndpoint = endpoint.includes('/api/buyer/home');
      
      // If cache-control header indicates no-cache, use no-store cache option
      // OR if this is the home endpoint, always bypass cache
      if (customHeaders?.['Cache-Control']?.includes('no-cache') || isHomeEndpoint) {
        fetchOptions.cache = 'no-store';
      }
      
      const response = await fetch(url, fetchOptions);
      const duration = Date.now() - startTime;

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized - attempt token refresh (REACTIVE REFRESH)
      // Only refresh when API fails with 401, not proactively
      if (response.status === 401) {
        if (retryCount < 1) {
          console.log('[apiService] 🔄 REACTIVE REFRESH: API returned 401, attempting token refresh...');
          const refreshResult = await this.refreshAccessToken();

          if (refreshResult === 'success') {
            console.log('[apiService] ✅ Token refresh successful, retrying original request...');
            return this.request<T>(method, endpoint, data, customHeaders, retryCount + 1);
          }

          // Refresh failed. In guest mode with identity_token, try guest_login to get fresh tokens
          const isGuest = !(await storageService.isLoggedIn());
          const hasIdentityToken = !!(await storageService.getIdentityToken());
          if (isGuest && hasIdentityToken && this.guestLoginRetryCallback) {
            console.log('[apiService] Guest mode + identity_token: attempting guest_login retry...');
            try {
              const guestLoginOk = await this.guestLoginRetryCallback();
              if (guestLoginOk) {
                console.log('[apiService] ✅ Guest login retry successful, retrying original request...');
                return this.request<T>(method, endpoint, data, customHeaders, retryCount + 1);
              }
            } catch (guestErr: any) {
              console.warn('[apiService] Guest login retry failed:', guestErr?.message ?? guestErr);
            }
          }

          if (refreshResult === 'soft_fail') {
            // Temporary error (network/server) — do NOT logout.
            // Return a generic error so the feature layer can retry or show an error.
            console.warn('[apiService] ⚠️ Token refresh soft-failed (temporary error), NOT logging out');
            return {
              success: false,
              error: 'Temporary error. Please try again.',
              message: 'Temporary error. Please try again.',
            };
          }

          // hard_fail — token is definitively invalid, force logout
          console.warn('[apiService] ⚠️ Token refresh hard-failed, logging out user...');
          await this.clearTokens();
          if (this.onSessionExpiredCallback) {
            try { this.onSessionExpiredCallback(); } catch { /* ignore */ }
          }
          return {
            success: false,
            error: 'Session expired. Please login again.',
            message: 'Session expired. Please login again.',
          };
        } else {
          // Already retried with a fresh token and still got 401 — session is dead
          console.warn('[apiService] ⚠️ Already retried after 401, still failing - logging out...');
          await this.clearTokens();
          if (this.onSessionExpiredCallback) {
            try { this.onSessionExpiredCallback(); } catch { /* ignore */ }
          }
          return {
            success: false,
            error: 'Session expired. Please login again.',
            message: 'Session expired. Please login again.',
          };
        }
      }

      const responseData = await response.json();

      // Dedicated logging for home API responses to debug home screen issues
      if (isHomeEndpoint) {
        console.log(
          '[apiService][home][response]--------========',
          responseData?.data?.data?.cod_settings
        );
      }

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

      // Check for user deletion indicators
      // IMPORTANT: Only trust:
      // - The dedicated `/user/profile` endpoint with specific status codes, OR
      // - Explicit user/account/session error messages from the backend.
      //
      // Other APIs (like cart/add, cart/update, orders, etc.) can legitimately return 4xx
      // (for example, "Cart item not found" when user updates quantity quickly) and MUST NOT
      // be treated as user deletion or forced logout.
      if (!response.ok) {
        const statusCode = response.status;
        analyticsService.logEvent(AnalyticsEvents.API_ERROR, {
          endpoint,
          http_code: statusCode,
        });
        if (statusCode !== 401) {
          await this.logApiErrorToCrashlytics({
            method,
            url,
            status: statusCode,
            request: {
              endpoint,
              payload: requestBody,
            },
            response: {
              success: false,
              status: response.status,
              statusText: response.statusText,
              data: responseData,
            },
            reason: responseData?.error || responseData?.message || `http_${statusCode}`,
            source: 'api_http_error',
          });
        }

        const isProfileEndpoint = endpoint.includes('/user/profile');
        // Only treat `/user/profile` returning status 401 with the exact deletion
        // message as a hard deletion signal. Both conditions must match — status 401
        // alone is not enough (could be auth failure), and the message alone
        // is not checked on other endpoints to avoid false logouts.
        const profileErrorMessage = (responseData.message || responseData.error || '').toLowerCase();
        const isUserDeleted =
          isProfileEndpoint &&
          statusCode === 401 

        // If user deletion is detected, clear tokens and notify callback
        if (isUserDeleted) {
          console.warn('[apiService] User deletion detected, clearing session...', {
            endpoint,
            method,
            statusCode,
            errorMessage: responseData.message || responseData.error,
          });
          await this.clearTokens();
          
          // Notify callback if set (allows App.tsx to navigate to login)
          if (this.onUserDeletedCallback) {
            try {
              this.onUserDeletedCallback();
            } catch (callbackError) {
              console.error('[apiService] Error in user deleted callback:', callbackError);
            }
          }
        }

        return {
          success: false,
          error: responseData.message || 'Request failed',
          message: responseData.message,
          statusCode: responseData.statusCode || response.status,
        };
      }

      // CRITICAL: After successful authenticated API call, check profile API in background
      // This detects user deletion even when other APIs still work
      // Only check for important endpoints and with throttling to reduce API calls
      // Only check if:
      // 1. This is an authenticated endpoint (not login/OTP)
      // 2. The current request was successful
      // 3. We haven't checked profile recently (throttle to avoid performance issues)
      // 4. This is NOT the profile endpoint itself (avoid recursive check)
      // 5. This is an important endpoint (home, cart, orders) - not every endpoint
      const isAuthenticatedEndpoint = 
        this.accessToken !== null &&
        !endpoint.includes('/authentication/generate-otp') &&
        !endpoint.includes('/authentication/login') &&
        !endpoint.includes('/authentication/guest-login') &&
        !endpoint.includes('/authentication/refresh-token');
      
      // Only check profile for important endpoints - exclude cart to keep checkout fast
      const isImportantEndpoint = 
        endpoint.includes('/api/buyer/home') ||
        endpoint.includes('/api/buyer/orders') ||
        endpoint.includes('/api/buyer/favorites');
      
      // Skip profile check for guests - they don't have profiles (would get 403)
      const isLoggedIn = await storageService.isLoggedIn();
      if (
        response.ok &&
        isLoggedIn &&
        isAuthenticatedEndpoint &&
        !endpoint.includes('/user/profile') &&
        isImportantEndpoint
      ) {
        this.checkProfileInBackground().catch((error) => {
          // Silent fail - profile check is fire-and-forget
          console.warn('[apiService] Background profile check failed:', error);
        });
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
      analyticsService.logEvent(AnalyticsEvents.API_ERROR, {
        endpoint,
        http_code: apiError.status || 0,
      });
      const errorStatus = apiError.status || 0;
      if (errorStatus !== 401) {
        await this.logApiErrorToCrashlytics({
          method,
          url: buildApiUrl(endpoint),
          status: errorStatus,
          request: {
            endpoint,
            payload: sanitizedRequestPayload,
          },
          response: {
            success: false,
            name: error?.name || null,
            message: error?.message || apiError.message,
            status: errorStatus,
          },
          reason: apiError.message || error?.message || 'network_or_runtime_error',
          source: 'api_network_or_runtime_error',
        });
      }
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
