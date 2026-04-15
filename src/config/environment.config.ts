/**
 * Environment Configuration
 * Centralized configuration for environment-specific settings
 * Reads from RN CLI Constants (app.config.js extra field)
 */

import Constants from '@/shims/rn-constants';

/**
 * Environment type definitions
 */
export type Environment = 'development' | 'preview' | 'production';

/**
 * Environment configuration interface
 */
export interface EnvironmentConfig {
  /** Current environment */
  environment: Environment;
  /** API base URL */
  apiBaseUrl: string;
  /** Whether running in development mode */
  isDevelopment: boolean;
  /** Whether running in production mode */
  isProduction: boolean;
  /** Whether running in preview/staging mode */
  isPreview: boolean;
}

/**
 * Get environment configuration from RN CLI Constants
 * Falls back to sensible defaults if not set
 */
const getEnvironmentConfig = (): EnvironmentConfig => {
  // Read from app.config.js extra field (set during EAS build or .env file)
  const extra = Constants.appConfig?.extra || {};
  
  // Get environment (defaults to development)
  const environment = (extra.environment as Environment) || 
                     (process.env.NODE_ENV === 'production' ? 'production' : 'development');
  
  // Get API base URL - check multiple sources in priority order:
  // 1. extra.apiBaseUrl (from app.config.js)
  // 2. extra.API_BASE_URL (runtime config)
  // 3. process.env.API_BASE_URL (fallback)
  // 4. Default to development API
  const apiBaseUrl = extra.apiBaseUrl || 
                    extra.API_BASE_URL ||
                    process.env.API_BASE_URL ||
                    process.env.PUBLIC_API_BASE_URL || 
                    'https://devapi.tazty.in';
  
  // Log in development for debugging
  if (environment === 'development' || process.env.NODE_ENV !== 'production') {
    console.log('[Environment Config]', {
      environment,
      apiBaseUrl,
      source: extra.apiBaseUrl ? 'extra.apiBaseUrl' : 
              extra.API_BASE_URL ? 'extra.API_BASE_URL' :
              process.env.API_BASE_URL ? 'process.env.API_BASE_URL' :
              process.env.PUBLIC_API_BASE_URL ? 'process.env.PUBLIC_API_BASE_URL' : 'default'
    });
  }
  
  return {
    environment,
    apiBaseUrl,
    isDevelopment: environment === 'development',
    isProduction: environment === 'production',
    isPreview: environment === 'preview',
  };
};

/**
 * Environment configuration singleton
 * Access this throughout the app to get environment-specific values
 */
export const envConfig: EnvironmentConfig = getEnvironmentConfig();

/**
 * Helper function to get API base URL
 * @returns The API base URL for the current environment
 */
export const getApiBaseUrl = (): string => {
  return envConfig.apiBaseUrl;
};

/**
 * Helper function to check if running in development
 * @returns True if running in development environment
 */
export const isDevelopment = (): boolean => {
  return envConfig.isDevelopment;
};

/**
 * Helper function to check if running in production
 * @returns True if running in production environment
 */
export const isProduction = (): boolean => {
  return envConfig.isProduction;
};

/**
 * Helper function to check if running in preview/staging
 * @returns True if running in preview environment
 */
export const isPreview = (): boolean => {
  return envConfig.isPreview;
};

/**
 * Get current environment name
 * @returns Current environment name
 */
export const getEnvironment = (): Environment => {
  return envConfig.environment;
};

// Export default for convenience
export default envConfig;

