import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { OptimizedImage } from '@/components/OptimizedImage';

const FOOD_GREEN = '#0A7A3C';
const SIDE = 16;

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
  const cardH = Math.round(cardW * 0.34);
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
  const cardH = 76;

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
  /* hero */
  heroWrap: {
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 10,
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
    paddingTop: 10,
    paddingBottom: 14,
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
    height: 44,
  },
  orgTitle: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.1,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
