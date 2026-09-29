import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

interface OrderAd {
  id: number | string;
  title?: string;
  subtitle?: string;
  cta_button?: string;
  image_url?: string;
  background_color?: string;
  promotion_type?: string;
  promotion_link?: string;
}

interface SponsoredAdSlotProps {
  ads: OrderAd[];
}

const CARD_HEIGHT = 132;

/**
 * The sponsored slot on the live order screen. Admin-managed banners
 * (placement = order_tracking): image, CTA label and a CTA link. Tapping the
 * card or its CTA opens an http(s) link; other promotion types are inert here.
 * Renders nothing when there are no ads, so the screen is unaffected without
 * campaigns.
 */
export const SponsoredAdSlot: React.FC<SponsoredAdSlotProps> = ({ ads }) => {
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
    }, 3500);
    return () => clearInterval(timer);
  }, [ads.length, width]);

  if (!ads || ads.length === 0) return null;

  const openAd = (ad: OrderAd) => {
    const link = ad.promotion_link;
    if (link && /^https?:\/\//i.test(link)) {
      Linking.openURL(link).catch(() => {
        // A dead promo link should never surface as a crash.
      });
    }
  };

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
            onPress={() => openAd(ad)}
            style={[width ? { width } : undefined]}
            testID={`order-ad-${ad.id}`}
          >
            <ImageBackground
              source={ad.image_url ? { uri: ad.image_url } : undefined}
              style={[
                styles.card,
                { backgroundColor: ad.background_color || '#14233F' },
              ]}
              imageStyle={styles.cardImage}
            >
              <View style={styles.tag}>
                <Text style={styles.tagText}>SPONSORED</Text>
              </View>
              <View style={styles.content}>
                {!!ad.title && (
                  <Text style={styles.title} numberOfLines={2}>
                    {ad.title}
                  </Text>
                )}
                {!!ad.subtitle && (
                  <Text style={styles.subtitle} numberOfLines={2}>
                    {ad.subtitle}
                  </Text>
                )}
                {!!ad.cta_button && (
                  <View style={styles.cta}>
                    <Text style={styles.ctaText}>{ad.cta_button}</Text>
                  </View>
                )}
              </View>
            </ImageBackground>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {ads.length > 1 && (
        <View style={styles.dots}>
          {ads.map((ad, i) => (
            <View
              key={`dot-${ad.id}`}
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
  },
  card: {
    height: CARD_HEIGHT,
    justifyContent: 'center',
  },
  cardImage: {
    borderRadius: 18,
    resizeMode: 'cover',
  },
  tag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.1,
    color: '#FFFFFF',
  },
  subtitle: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 3,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 9,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  ctaText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: '#14181B',
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
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    width: 16,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
});
