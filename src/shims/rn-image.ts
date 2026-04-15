import React from 'react';
import { Image as RNImage, ImageProps } from 'react-native';

export type ImageSource = ImageProps['source'];
export type ImageStyle = NonNullable<ImageProps['style']>;
export type StyleProp<T> = T | T[] | null | undefined;

type Props = ImageProps & {
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  transition?: number;
  priority?: 'low' | 'normal' | 'high';
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  recyclingKey?: string;
};

const mapContentFit = (contentFit?: Props['contentFit']) => {
  if (contentFit === 'fill') return 'stretch';
  if (contentFit === 'none' || contentFit === 'scale-down') return 'contain';
  return contentFit || 'cover';
};

export const Image: React.FC<Props> = ({ contentFit, ...props }) => {
  return React.createElement(RNImage, { ...props, resizeMode: mapContentFit(contentFit) });
};
