import Constants from '@/shims/rn-constants';
import { envConfig, getEnvironment, isDevelopment, isProduction, isPreview } from '@/config/environment.config';

interface Config {
  apiUrl: string;
  apiKey: string;
  environment: 'development' | 'preview' | 'production';
  appName: string;
  appVersion: string;
}

export const config: Config = {
  // Use environment config for API URL and environment
  apiUrl: envConfig.apiBaseUrl,
  apiKey: Constants.appConfig?.extra?.GOOGLE_MAPS_API_KEY || '',
  environment: getEnvironment(),
  appName: 'Tazty',
  appVersion: Constants.appConfig?.version || '1.0.0',
};

// Export environment checks from environment config for consistency
export { isDevelopment, isProduction, isPreview };
export const isStaging = isPreview; // Alias for backward compatibility
