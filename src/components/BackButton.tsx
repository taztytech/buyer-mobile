import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface BackButtonProps {
  onPress?: () => void;
  /** Icon colour. Defaults to ink; pass white on coloured headers. */
  color?: string;
  size?: number;
  style?: ViewStyle;
  testID?: string;
}

/**
 * The app-wide back control: a plain left arrow, no circle. Use it on every
 * screen so back navigation looks and behaves the same everywhere. On a
 * coloured header pass color="#FFFFFF"; on a light screen the default ink
 * colour reads correctly.
 */
export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  color = '#14181B',
  size = 24,
  style,
  testID = 'back-button',
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, style]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      testID={testID}
    >
      <MaterialIcons name="arrow-back" size={size} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
