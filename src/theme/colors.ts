export const colors = {
  // Primary colors - Based on Tazty brand green
  primary: '#1a9656',
  primaryDark: '#146e40',
  primaryLight: '#4dbc7e',

  // Secondary colors
  secondary: '#5856D6',
  secondaryDark: '#3C3BA4',
  secondaryLight: '#7A79E8',

  // Neutral colors
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  border: '#E0E0E0',

  // Status colors
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#5AC8FA',

  // Grayscale
  white: '#FFFFFF',
  black: '#000000',
  gray100: '#F5F5F5',
  gray200: '#E0E0E0',
  gray300: '#BDBDBD',
  gray400: '#9E9E9E',
  gray500: '#757575',
  gray600: '#616161',
  gray700: '#424242',
  gray800: '#212121',
} as const;

export type Colors = typeof colors;
