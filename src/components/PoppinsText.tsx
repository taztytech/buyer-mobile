import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';

/**
 * Custom Text component that applies Poppins font by default
 * All Text components in the app should use this instead of React Native's Text
 */
export const PoppinsText: React.FC<TextProps> = ({ style, ...props }) => {
  return (
    <RNText
      style={[styles.defaultText, style]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  defaultText: {
    fontFamily: 'Poppins',
  },
});

// Export as default Text for convenience
export default PoppinsText;

