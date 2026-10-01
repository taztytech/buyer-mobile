import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { OptimizedImage } from '@/components/OptimizedImage';

const CREAM = '#FFF6EA';
const FOOD_GREEN = '#0A7A3C';
const UNDERLINE = '#FFC93C';
const SIDE = 16;

/* ------------------------------------------------------------------ */
/* Service tabs: "Food" active card, then category cards that overlap */
/* ------------------------------------------------------------------ */

export interface TopDashTab {
  id: string;
  name: string;
  imageUrl?: string;
}

interface ServiceTabsProps {
  tabs: TopDashTab[];
  onTabPress: (tab: TopDashTab) => void;
}

const TAB_W = 104;
const TAB_H = 104;
const FOOD_W = 116;
const FOOD_H = 118;
const OVERLAP = 10;

export const ServiceTabs: React.FC<ServiceTabsProps> = ({ tabs, onTabPress }) => {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const contentW = FOOD_W + tabs.length * (TAB_W - OVERLAP) + SIDE * 2;
  const pages = Math.max(1, Math.ceil(contentW / width));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const max = Math.max(1, contentSize.width - layoutMeasurement.width);
    setPage(Math.min(pages - 1, Math.round((contentOffset.x / max) * (pages - 1))));
  };

  return (
    <View testID="service-tabs">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {/* Food is the screen you are on, so it is the raised card. */}
        <View style={styles.foodTab} testID="service-tab-food">
          <Text style={styles.foodEmoji}>🍔</Text>
          <Text style={styles.foodLabel}>Food</Text>
          <View style={[styles.underline, styles.underlineFood]} />
        </View>

        {tabs.map((tab, i) => (
          <TouchableOpacity
            key={tab.id}
            activeOpacity={0.85}
            onPress={() => onTabPress(tab)}
            style={[styles.tab, { zIndex: tabs.length - i }]}
            testID={`service-tab-${tab.id}`}
          >
            {tab.imageUrl ? (
              <Image source={{ uri: tab.imageUrl }} style={styles.tabImage} resizeMode="cover" />
            ) : (
              <View style={[styles.tabImage, styles.tabImageEmpty]} />
            )}
            <Text style={styles.tabLabel} numberOfLines={2}>
              {tab.name}
            </Text>
            <View style={styles.underline} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {pages > 1 && (
        <View style={styles.dots}>
          {Array.from({ length: pages }).map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
};

/* ------------------------------------------------------------------ */
/* Hero: rounded card rotating the restaurant banners (image / video) */
/* ------------------------------------------------------------------ */

export interface HeroSlide {
  id: string;
  imageUrl?: string;
  videoUrl?: string;
  title?: string;
  backgroundColor?: string;
}

interface HeroCarouselProps {
  slides: HeroSlide[];
  onPress: (slide: HeroSlide) => void;
}

const IMAGE_MS = 3500;
const VIDEO_MS = 10000;

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ slides, onPress }) => {
  const { width } = useWindowDimensions();
  const cardW = width - SIDE * 2;
  const cardH = Math.round(cardW * 0.5);
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  useEffect(() => {
    if (slides.length < 2) return;
    const ms = slides[index]?.videoUrl ? VIDEO_MS : IMAGE_MS;
    const t = setTimeout(() => {
      if (draggingRef.current) return;
      const next = (index + 1) % slides.length;
      ref.current?.scrollTo({ x: next * cardW, animated: true });
      setIndex(next);
    }, ms);
    return () => clearTimeout(t);
  }, [index, slides, cardW]);

  if (!slides.length) return null;

  return (
    <View style={[styles.heroWrap, { width: cardW, height: cardH }]} testID="home-hero">
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => { draggingRef.current = true; }}
        onMomentumScrollEnd={(e) => {
          draggingRef.current = false;
          setIndex(Math.round(e.nativeEvent.contentOffset.x / cardW));
        }}
      >
        {slides.map((s, i) => (
          <TouchableOpacity
            key={s.id}
            activeOpacity={0.92}
            onPress={() => onPress(s)}
            style={{ width: cardW, height: cardH, backgroundColor: s.backgroundColor || FOOD_GREEN }}
            testID={`home-hero-${s.id}`}
          >
            {!!s.imageUrl && (
              <OptimizedImage
                source={s.imageUrl}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                shimmerWidth={cardW}
                shimmerHeight={cardH}
                transition={250}
                priority="high"
                cachePolicy="memory-disk"
              />
            )}
            {/* Only the visible slide decodes video. */}
            {!!s.videoUrl && i === index && (
              <Video
                source={{ uri: s.videoUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted
                useNativeControls={false}
              />
            )}
            {!s.imageUrl && !s.videoUrl && !!s.title && (
              <Text style={styles.heroFallbackTitle} numberOfLines={2}>{s.title}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {slides.length > 1 && (
        <View style={styles.heroDots} pointerEvents="none">
          {slides.map((s, i) => (
            <View key={s.id} style={[styles.heroDot, i === index && styles.heroDotActive]} />
          ))}
        </View>
      )}
    </View>
  );
};

/* ------------------------------------------------------------------ */
/* Org banner cards: the home banners (image or video) as small tiles */
/* ------------------------------------------------------------------ */

export interface OrgCard {
  id: string;
  title?: string;
  imageUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
  backgroundColor?: string;
}

interface OrgCardsProps {
  cards: OrgCard[];
  onPress?: (card: OrgCard) => void;
}

const CARD_GAP = 8;

export const OrgCards: React.FC<OrgCardsProps> = ({ cards, onPress }) => {
  const { width } = useWindowDimensions();
  if (!cards.length) return null;

  // Up to four fill the row; more scroll with the fifth peeking.
  const perRow = Math.min(4, cards.length);
  const avail = width - SIDE * 2 - CARD_GAP * (perRow - 1);
  const cardW = cards.length > 4 ? (width - SIDE * 2 - CARD_GAP * 4) / 4.3 : avail / perRow;
  const cardH = Math.round(Math.max(118, Math.min(150, cardW * 1.15)));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={cards.length > 4}
      contentContainerStyle={styles.orgRow}
      testID="org-cards"
    >
      {cards.map((c, i) => {
        const isVideo = !!c.videoUrl;
        const still = c.imageUrl || c.posterUrl;
        return (
          <TouchableOpacity
            key={c.id}
            activeOpacity={0.9}
            disabled={!onPress}
            onPress={() => onPress?.(c)}
            style={[
              styles.orgCard,
              { width: cardW, height: cardH, backgroundColor: c.backgroundColor || '#FFF4DE' },
              i < cards.length - 1 && { marginRight: CARD_GAP },
            ]}
            testID={`org-card-${c.id}`}
          >
            {!!still && (
              <OptimizedImage
                source={still}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                shimmerWidth={cardW}
                shimmerHeight={cardH}
                transition={200}
                cachePolicy="memory-disk"
              />
            )}
            {isVideo && (
              <Video
                source={{ uri: c.videoUrl as string }}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted
                useNativeControls={false}
              />
            )}
            {!!c.title && (
              <>
                <LinearGradient
                  colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
                  style={styles.orgShade}
                  pointerEvents="none"
                />
                <Text style={styles.orgTitle} numberOfLines={2}>
                  {c.title}
                </Text>
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  /* tabs */
  tabsContent: {
    paddingHorizontal: SIDE,
    paddingTop: 6,
    alignItems: 'flex-end',
  },
  foodTab: {
    width: FOOD_W,
    height: FOOD_H,
    borderRadius: 26,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
    elevation: 6,
    shadowColor: '#003D1C',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  foodEmoji: { fontSize: 46, lineHeight: 56 },
  foodLabel: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: 0.2,
    color: FOOD_GREEN,
    marginTop: -2,
  },
  tab: {
    width: TAB_W,
    height: TAB_H,
    marginLeft: -OVERLAP,
    paddingLeft: OVERLAP + 2,
    paddingRight: 4,
    borderRadius: 22,
    backgroundColor: '#14A653',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#003D1C',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: -2, height: 3 },
  },
  tabImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  tabImageEmpty: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabLabel: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.1,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 4,
  },
  underline: {
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: UNDERLINE,
    marginTop: 3,
  },
  underlineFood: { backgroundColor: FOOD_GREEN, width: 30 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  dot: {
    width: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
    marginHorizontal: 3,
  },
  dotActive: { width: 18, backgroundColor: '#FFFFFF' },

  /* hero */
  heroWrap: {
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 14,
    backgroundColor: FOOD_GREEN,
  },
  heroFallbackTitle: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: 0.2,
    color: '#FFFFFF',
    padding: 18,
  },
  heroDots: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
    marginHorizontal: 3,
  },
  heroDotActive: { width: 16, backgroundColor: '#FFFFFF' },

  /* org cards */
  orgRow: {
    paddingHorizontal: SIDE,
    paddingTop: 12,
    paddingBottom: 16,
  },
  orgCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  orgShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
  },
  orgTitle: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.1,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
