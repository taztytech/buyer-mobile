import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
} from 'react-native';

interface CompactAd {
  id: string;
  imageUrl?: string;
  title?: string;
  description?: string;
  backgroundColor?: string;
  promotionType?: string;
  promotionLink?: string;
}

interface CompactAdsProps {
  ads: CompactAd[];
  onPress: (ad: CompactAd) => void;
  /** Smaller image-only cards for the green header "Food" row. */
  mini?: boolean;
}

/**
 * Restaurant/promo banners rendered as compact cards in a horizontal carousel
 * (multiple visible at once), gently auto-rolling. Sits under the org hero.
 */
export const CompactAds: React.FC<CompactAdsProps> = ({ ads, onPress, mini = false }) => {
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const [contentW, setContentW] = useState(0);
  const [viewW, setViewW] = useState(0);

  useEffect(() => {
    if ((ads?.length || 0) < 2) return;
    const stepMs = 30;
    const stepPx = 1.1; // ~37px/sec, gentle roll
    const timer = setInterval(() => {
      const maxScroll = Math.max(0, contentW - viewW);
      if (pausedRef.current || maxScroll <= 0) return;
      offsetRef.current += stepPx;
      if (offsetRef.current >= maxScroll) offsetRef.current = 0;
      scrollRef.current?.scrollTo({ x: offsetRef.current, animated: false });
    }, stepMs);
    return () => clearInterval(timer);
  }, [ads?.length, contentW, viewW]);

  if (!ads || ads.length === 0) return null;

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={mini ? styles.contentMini : styles.content}
      onLayout={(e) => setViewW(e.nativeEvent.layout.width)}
      onContentSizeChange={(w) => setContentW(w)}
      onScroll={(e) => { offsetRef.current = e.nativeEvent.contentOffset.x; }}
      scrollEventThrottle={16}
      onScrollBeginDrag={() => { pausedRef.current = true; }}
      onScrollEndDrag={() => { pausedRef.current = false; }}
      onMomentumScrollEnd={() => { pausedRef.current = false; }}
    >
      {ads.map((ad) => (
        <TouchableOpacity
          key={ad.id}
          style={mini ? styles.cardMini : styles.card}
          activeOpacity={0.9}
          onPress={() => onPress(ad)}
          testID={`compact-ad-${ad.id}`}
        >
          <ImageBackground
            source={ad.imageUrl ? { uri: ad.imageUrl } : undefined}
            style={[mini ? styles.imgMini : styles.img, { backgroundColor: ad.backgroundColor || '#0A7A3C' }]}
            imageStyle={mini ? styles.imgRadiusMini : styles.imgRadius}
          >
            {!mini && !!ad.title && (
              <View style={styles.titleWrap}>
                <Text style={styles.title} numberOfLines={2}>{ad.title}</Text>
              </View>
            )}
          </ImageBackground>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 },
  card: { marginRight: 12 },
  img: {
    width: 172,
    height: 116,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  imgRadius: { borderRadius: 16 },
  contentMini: { paddingLeft: 10, paddingRight: 14, alignItems: 'center' },
  cardMini: { marginRight: 10 },
  imgMini: {
    width: 104,
    height: 70,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  imgRadiusMini: { borderRadius: 13 },
  titleWrap: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  title: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#FFFFFF',
  },
});
