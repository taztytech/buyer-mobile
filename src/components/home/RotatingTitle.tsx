import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleProp, TextStyle } from 'react-native';

interface RotatingTitleProps {
  titles: string[];
  /** Applied to the text — keep it the same as the static title's style. */
  textStyle?: StyleProp<TextStyle>;
  intervalMs?: number;
}

const shuffle = (arr: string[]): string[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * A section title that shuffles through a list of names and cross-fades to the
 * next one every few seconds. Same font/size as the static title (pass the
 * same textStyle). Falls back gracefully to a single title.
 */
export const RotatingTitle: React.FC<RotatingTitleProps> = ({
  titles,
  textStyle,
  intervalMs = 3000,
}) => {
  const list = useMemo(
    () => shuffle((titles && titles.length ? titles : ['Restaurants near you']).filter(Boolean)),
    [titles],
  );
  const [idx, setIdx] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setIdx(0);
    opacity.setValue(1);
    if (list.length < 2) return;
    const timer = setInterval(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setIdx((i) => (i + 1) % list.length);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }).start();
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [list, intervalMs, opacity]);

  return (
    <Animated.Text style={[textStyle, { opacity }]} numberOfLines={1} testID="rotating-section-title">
      {list[idx] || 'Restaurants near you'}
    </Animated.Text>
  );
};
