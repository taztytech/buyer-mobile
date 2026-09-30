import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Ellipse } from 'react-native-svg';

interface CloudsSkyProps {
  style?: ViewStyle;
}

/**
 * A soft sky-with-clouds background, used behind the header when the area is
 * unserviceable ("Coming soon to your neighbourhood" feel). Pure SVG, no asset.
 */
export const CloudsSky: React.FC<CloudsSkyProps> = ({ style }) => {
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#8FC4EE" />
            <Stop offset="0.55" stopColor="#BFE0F5" />
            <Stop offset="1" stopColor="#E7F3FB" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="400" height="240" fill="url(#sky)" />
        {/* soft clouds */}
        <Ellipse cx="70" cy="70" rx="58" ry="26" fill="#FFFFFF" opacity="0.9" />
        <Ellipse cx="120" cy="82" rx="46" ry="22" fill="#FFFFFF" opacity="0.85" />
        <Ellipse cx="300" cy="55" rx="64" ry="28" fill="#FFFFFF" opacity="0.9" />
        <Ellipse cx="350" cy="70" rx="44" ry="20" fill="#FFFFFF" opacity="0.8" />
        <Ellipse cx="210" cy="120" rx="70" ry="26" fill="#FFFFFF" opacity="0.65" />
        <Ellipse cx="40" cy="160" rx="54" ry="22" fill="#FFFFFF" opacity="0.55" />
        <Ellipse cx="360" cy="150" rx="60" ry="24" fill="#FFFFFF" opacity="0.55" />
      </Svg>
    </View>
  );
};
