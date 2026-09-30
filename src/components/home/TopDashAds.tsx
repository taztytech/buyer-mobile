import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

interface TopDashAd {
  id: number | string;
  image_url?: string;
  title?: string;
  subtitle?: string;
  cta_button?: string;
  background_color?: string;
  promotion_type?: string;
  promotion_link?: string;
}

interface TopDashAdsProps {
  ads: TopDashAd[];
  onPressAd: (ad: TopDashAd) => void;
}

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * Admin-uploadable rolling ad cards shown right under the home header
 * (placement=home_top_dash). Auto-advances every 3s; tapping an ad routes via
 * the home's banner handler. Renders nothing without ads.
 */
export const TopDashAds: React.FC<TopDashAdsProps> = ({ ads, onPressAd }) => {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (ads.length < 2 || width === 0) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % ads.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [ads.length, width]);

  if (!ads || ads.length === 0) return null;

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEnabled={ads.length > 1}
      >
        {ads.map((ad) => (
          <TouchableOpacity
            key={String(ad.id)}
            activeOpacity={0.9}
            onPress={() => onPressAd(ad)}
            style={width ? { width } : undefined}
            testID={`top-dash-ad-${ad.id}`}
          >
            <ImageBackground
              source={ad.image_url ? { uri: ad.image_url } : undefined}
              style={[
                styles.card,
                { backgroundColor: ad.background_color || '#0A7A3C' },
              ]}
              imageStyle={styles.cardImage}
            >
              {(ad.title || ad.cta_button) && (
                <View style={styles.content}>
                  {!!ad.title && (
                    <Text style={styles.title} numberOfLines={2}>
                      {ad.title}
                    </Text>
                  )}
                  {!!ad.subtitle && (
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {ad.subtitle}
                    </Text>
                  )}
                  {!!ad.cta_button && (
                    <View style={styles.cta}>
                      <Text style={styles.ctaText}>{ad.cta_button}</Text>
                    </View>
                  )}
                </View>
              )}
            </ImageBackground>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {ads.length > 1 && (
        <View style={styles.dots}>
          {ads.map((ad, i) => (
            <View
              key={`tdot-${ad.id}`}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    overflow: 'hidden',
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 2,
  },
  card: {
    height: 150,
    justifyContent: 'flex-end',
  },
  cardImage: {
    borderRadius: 18,
    resizeMode: 'cover',
  },
  content: {
    padding: 16,
  },
  title: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.1,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    letterSpacing: 0.1,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 2,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 9,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  ctaText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#0A6B36',
  },
  dots: {
    position: 'absolute',
    bottom: 9,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    width: 16,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
});
