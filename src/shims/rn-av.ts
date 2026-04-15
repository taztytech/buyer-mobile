import React from 'react';
import RNVideo from 'react-native-video';

export const ResizeMode = {
  CONTAIN: 'contain',
  COVER: 'cover',
  STRETCH: 'stretch',
} as const;

export const Video: React.FC<any> = (props) => {
  const { useNativeControls, shouldPlay, isLooping, ...rest } = props;
  return React.createElement(RNVideo as any, {
    ...rest,
    controls: useNativeControls ?? true,
    paused: shouldPlay === false,
    repeat: !!isLooping,
  });
};
