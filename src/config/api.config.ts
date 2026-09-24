/**
 * API Configuration
 * Centralizes all API-related configuration
 */

import { getApiBaseUrl, envConfig } from './environment.config';

// Helper to get environment variable with fallback
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  // @ts-ignore - process.env is available in Expo
  return process.env[key] || defaultValue;
};

export const API_CONFIG = {
  // Base URL for API requests (from environment config)
  BASE_URL: getApiBaseUrl(),

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
      GUEST_LOGIN: '/authentication/guest-login',
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
      // Cart endpoints
      CART_ADD: '/api/buyer/cart/add',
      CART_GET: '/api/buyer/cart',
      CART_UPDATE: '/api/buyer/cart/update',
      CART_REMOVE: '/api/buyer/cart/remove',
      CART_CLEAR: '/api/buyer/cart/clear',
      CART_TIP: '/api/buyer/cart/tip',
      CART_APPLY_COUPON: '/api/buyer/cart/apply-coupon',
      CART_REMOVE_COUPON: '/api/buyer/cart/remove-coupon',
      // Promo Offer endpoints (combo offers with limited slots — not coupons)
      OFFERS_ACTIVE: '/api/buyer/offers/active',
      OFFER_DETAIL: (id: number | string) => `/api/buyer/offers/${id}`,
      OFFER_RESERVE: (id: number | string) => `/api/buyer/offers/${id}/reserve`,
      OFFER_CONFIRM: (id: number | string) => `/api/buyer/offers/${id}/confirm`,
      OFFER_CANCEL: (id: number | string) => `/api/buyer/offers/${id}/cancel`,
      // 99 Store deals (Tazty-funded prices on real menu items)
      STORE_DEALS: '/api/buyer/store-deals',
      // Tazty Wallet (balance + history)
      WALLET: '/api/buyer/wallet',
      WALLET_TRANSACTIONS: '/api/buyer/wallet/transactions',
      WALLET_TOPUPS: '/api/buyer/wallet/topups',
      WALLET_TOPUP_LIMITS: '/api/buyer/wallet/topups/limits',
      WALLET_TOPUP_VERIFY: (id: number | string) => `/api/buyer/wallet/topups/${id}/verify`,
      WALLET_REDEEM: '/api/buyer/wallet/redeem',
      WALLET_REFERRAL: '/api/buyer/wallet/referral',
      WALLET_REFERRAL_APPLY: '/api/buyer/wallet/referral/apply',
      // Dish endpoint
      DISH: '/dish',
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
  // Environment (from environment config)
  ENV: envConfig.environment,
  IS_DEV: envConfig.isDevelopment,
  IS_PROD: envConfig.isProduction,
  IS_PREVIEW: envConfig.isPreview,

  // App Info
  APP_NAME: 'Tazty',
  APP_VERSION: '1.0.4',
};

// Helper to build full API URL
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};
