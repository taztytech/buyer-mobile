/**
 * Platform Detection Utility
 * Detects if app is running in Expo Go for development purposes
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Check if running in Expo Go
 * In Expo Go, executionEnvironment is 'storeClient'
 */
export const isExpoGo = (): boolean => {
  return Constants.executionEnvironment === 'storeClient';
};

/**
 * Check if running on iOS in Expo Go
 * Useful for conditionally rendering iOS-specific fallbacks
 */
export const isIOSExpoGo = (): boolean => {
  return Platform.OS === 'ios' && isExpoGo();
};

/**
 * Check if running on Android in Expo Go
 */
export const isAndroidExpoGo = (): boolean => {
  return Platform.OS === 'android' && isExpoGo();
};

/**
 * Check if app is a production/development build (not Expo Go)
 */
export const isStandaloneBuild = (): boolean => {
  return !isExpoGo();
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
  isExpoGo,
  isIOSExpoGo,
  isAndroidExpoGo,
  isStandaloneBuild,
  isDevelopment,
  platform: Platform.OS,
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
};
