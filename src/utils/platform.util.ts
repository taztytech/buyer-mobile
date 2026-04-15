/**
 * Platform Detection Utility
 * Detects if app is running in RN CLI Go for development purposes
 */

import Constants from '@/shims/rn-constants';
import { Platform } from 'react-native';

/**
 * Check if running in RN CLI Go
 * In RN CLI Go, executionEnvironment is 'storeClient'
 */
export const isLimitedRuntime = (): boolean => {
  return Constants.executionEnvironment === 'storeClient';
};

/**
 * Check if running on iOS in RN CLI Go
 * Useful for conditionally rendering iOS-specific fallbacks
 */
export const isIOSLimitedRuntime = (): boolean => {
  return Platform.OS === 'ios' && isLimitedRuntime();
};

/**
 * Check if running on Android in RN CLI Go
 */
export const isAndroidLimitedRuntime = (): boolean => {
  return Platform.OS === 'android' && isLimitedRuntime();
};

/**
 * Check if app is a production/development build (not RN CLI Go)
 */
export const isStandaloneBuild = (): boolean => {
  return !isLimitedRuntime();
};

/**
 * Get development mode status
 */
export const isDevelopment = (): boolean => {
  return __DEV__;
};

/**
 * Platform utility object
 */
export const PlatformUtil = {
  isLimitedRuntime,
  isIOSLimitedRuntime,
  isAndroidLimitedRuntime,
  isStandaloneBuild,
  isDevelopment,
  platform: Platform.OS,
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
};
