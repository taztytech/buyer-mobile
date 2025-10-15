import Constants from 'expo-constants';

interface Config {
  apiUrl: string;
  apiKey: string;
  environment: 'development' | 'staging' | 'production';
  appName: string;
  appVersion: string;
}

export const config: Config = {
  apiUrl: Constants.expoConfig?.extra?.apiUrl || 'https://api.tazty.com',
  apiKey: Constants.expoConfig?.extra?.apiKey || '',
  environment: (Constants.expoConfig?.extra?.environment as Config['environment']) || 'development',
  appName: 'Tazty',
  appVersion: Constants.expoConfig?.version || '1.0.0',
};

export const isDevelopment = config.environment === 'development';
export const isProduction = config.environment === 'production';
export const isStaging = config.environment === 'staging';
