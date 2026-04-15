import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const appConfig = {
  version: DeviceInfo.getVersion(),
  android: {
    package: DeviceInfo.getBundleId(),
  },
  ios: {
    bundleIdentifier: DeviceInfo.getBundleId(),
  },
  extra: {
    environment: process.env.APP_ENV || process.env.NODE_ENV || 'development',
    apiBaseUrl: process.env.API_BASE_URL || process.env.PUBLIC_API_BASE_URL || 'https://devapi.tazty.in',
    API_BASE_URL: process.env.API_BASE_URL || process.env.PUBLIC_API_BASE_URL || 'https://devapi.tazty.in',
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || process.env.PUBLIC_GOOGLE_MAPS_API_KEY || '',
    DELIVERY_TRACK_BASE_URL:
      process.env.DELIVERY_TRACK_BASE_URL || process.env.PUBLIC_DELIVERY_TRACK_BASE_URL || 'https://delivery.tazty.in',
    TAZTY_SELLER_BASEURL: process.env.TAZTY_SELLER_BASEURL || '',
  },
};

const Constants = {
  appConfig,
  appOwnership: 'standalone',
  executionEnvironment: 'standalone',
  nativeAppVersion: DeviceInfo.getVersion(),
  nativeBuildVersion: DeviceInfo.getBuildNumber(),
  manifest: { extra: appConfig.extra },
  manifest2: { extra: appConfig.extra },
  platform: Platform.OS,
};

export default Constants;
