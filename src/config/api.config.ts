/**
 * API Configuration
 * Centralizes all API-related configuration
 */

// In Expo, environment variables prefixed with EXPO_PUBLIC_ are available
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  // @ts-ignore - process.env is available in Expo
  return process.env[key] || defaultValue;
};

export const API_CONFIG = {
  // Base URL for API requests
  BASE_URL: getEnvVar('EXPO_PUBLIC_API_BASE_URL', 'https://devapi.tazty.in'),

  // Request timeout in milliseconds
  TIMEOUT: parseInt(getEnvVar('EXPO_PUBLIC_API_TIMEOUT', '30000'), 10),

  // API Endpoints
  ENDPOINTS: {
    // Auth endpoints (Authentication API)
    AUTHENTICATION: {
      GENERATE_OTP: '/authentication/generate-otp',
      LOGIN: '/authentication/login',
      REFRESH_TOKEN: '/authentication/refresh-token',
      LOGOUT: '/authentication/logout',
    },
    // User endpoints
    USER: {
      PROFILE: '/user/profile',
      UPDATE_PROFILE: '/user/update',
      ADDRESS: '/user/address',
    },
    // Buyer endpoints
    BUYER: {
      HOME: '/api/buyer/home',
      SEARCH: '/api/buyer/search',
      FAVORITES_RESTAURANTS: '/api/buyer/favorites/restaurants',
      FAVORITES_ITEMS: '/api/buyer/favorites/items',
      FAVORITES_ALL: '/api/buyer/favorites/all',
      PUSH_TOKENS: '/api/buyer/push-tokens',
      DELETE_PUSH_TOKEN: (token: string) => `/api/buyer/push-tokens/${token}`,
    },
    // Add more endpoint groups as needed
  },

  // API Headers
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

export const APP_CONFIG = {
  // Environment
  ENV: getEnvVar('NODE_ENV', 'development'),
  IS_DEV: getEnvVar('NODE_ENV', 'development') === 'development',
  IS_PROD: getEnvVar('NODE_ENV', 'development') === 'production',

  // App Info
  APP_NAME: 'Tazty',
  APP_VERSION: '1.0.0',
};

// Helper to build full API URL
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};
