import React from 'react';
import { BlurView as RNBlurView } from '@react-native-community/blur';

export const BlurView: React.FC<any> = ({ intensity, tint, ...props }) => {
  const blurType = tint === 'light' ? 'light' : 'dark';
  const blurAmount = typeof intensity === 'number' ? Math.max(1, Math.min(32, Math.round(intensity / 3))) : 10;
  return React.createElement(RNBlurView as any, {
    ...props,
    blurType,
    blurAmount,
  });
};
