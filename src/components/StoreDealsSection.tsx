import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { StoreDealCard } from './StoreDealCard';
import { DealMedia } from './DealMedia';
import type { StoreDeal } from '@/services/storeDeal.service';

const ORANGE = '#E8501C';

interface StoreDealsSectionProps {
  deals: StoreDeal[];
  onAdd: (deal: StoreDeal) => void;
  onSeeAll: () => void;
  /** Tap a deal card → open its store. */
  onOpenStore?: (deal: StoreDeal) => void;
  addingDealId?: number | null;
  /** Editable labels from the server; fall back to the ₹99 wording. */
  sectionName?: string;
  tagline?: string;
  homeTitle?: string;
  /** Optional photo/video played inside the hero card (set in the panel). */
  heroImageUrl?: string | null;
  heroVideoUrl?: string | null;
  /** Admin-configurable look & motion (from store_deal_section). */
  bgColor?: string | null;
  accentColor?: string | null;
  /** 'auto-scroll' (default) rolls the cards; 'none' disables motion. */
  animStyle?: string | null;
  /** Auto-scroll speed in px/sec (default 40). */
  animSpeed?: number | null;
}

/**
 * Home: the ₹99 Store banner and the deals row. Colours and the auto-rolling
 * motion are admin-configurable; renders nothing when there are no deals.
 */
export const StoreDealsSection: React.FC<StoreDealsSectionProps> = ({
  deals,
  onAdd,
  onSeeAll,
  onOpenStore,
  addingDealId = null,
  sectionName = '₹99 Store',
  tagline = 'Great Food. Just ₹99!',
  homeTitle = "Today's deals",
  heroImageUrl = null,
  heroVideoUrl = null,
  bgColor = null,
  accentColor = null,
  animStyle = 'auto-scroll',
  animSpeed = null,
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const [contentW, setContentW] = useState(0);
  const [viewW, setViewW] = useState(0);

  const autoScroll = (animStyle || 'auto-scroll') !== 'none' && (deals?.length || 0) > 2;

  useEffect(() => {
    if (!autoScroll) return;
    const pxPerSec = animSpeed && animSpeed > 0 ? animSpeed : 40;
    const stepMs = 30;
    const stepPx = (pxPerSec * stepMs) / 1000;
    const maxScroll = Math.max(0, contentW - viewW);
    const timer = setInterval(() => {
      if (pausedRef.current || maxScroll <= 0) return;
      offsetRef.current += stepPx;
      if (offsetRef.current >= maxScroll) offsetRef.current = 0;
      scrollRef.current?.scrollTo({ x: offsetRef.current, animated: false });
    }, stepMs);
    return () => clearInterval(timer);
  }, [autoScroll, animSpeed, contentW, viewW]);

  if (!deals?.length) return null;

  const bg = bgColor || ORANGE;
  const accent = accentColor || bg;
  const hasHeroMedia = !!heroImageUrl || !!heroVideoUrl;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetRef.current = e.nativeEvent.contentOffset.x;
  };

  return (
    <View style={styles.container} testID="store-deals-section">
      <TouchableOpacity
        style={[styles.hero, { backgroundColor: bg }]}
        onPress={onSeeAll}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="Explore the deals store"
        testID="store-deals-hero"
      >
        {hasHeroMedia ? (
          <>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <DealMedia
                imageUrl={heroImageUrl}
                videoUrl={heroVideoUrl}
                name={sectionName}
                photoSeconds={heroImageUrl ? 2 : 0}
                muted
                loop
                fallback="none"
              />
            </View>
            <View style={[styles.heroTint, { backgroundColor: bg, opacity: 0.55 }]} pointerEvents="none" />
          </>
        ) : null}
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroKicker}>TAZTY</Text>
          <Text style={styles.heroTitle}>{sectionName.toUpperCase()}</Text>
          <Text style={styles.heroSubtitle}>{tagline}</Text>
        </View>
        <View style={styles.heroButton}>
          <Text style={[styles.heroButtonText, { color: accent }]}>Explore →</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>{homeTitle}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onLayout={(e) => setViewW(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentW(w)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => { pausedRef.current = true; }}
        onScrollEndDrag={() => { pausedRef.current = false; }}
        onMomentumScrollEnd={() => { pausedRef.current = false; }}
      >
        {deals.map((deal) => (
          <View key={deal.id} style={styles.cardWrapper}>
            <StoreDealCard
              deal={deal}
              variant="home"
              onAdd={onAdd}
              onOpenStore={onOpenStore}
              adding={addingDealId === deal.id}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 18, marginBottom: 4 },
  hero: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: ORANGE,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTint: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTextWrap: { flex: 1 },
  heroKicker: {
    fontFamily: 'CooperBlack',
    fontSize: 13,
    letterSpacing: 1.2,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  heroTitle: {
    fontFamily: 'Kalam_700Bold',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0,
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    letterSpacing: 0.1,
    color: 'rgba(255, 255, 255, 0.92)',
  },
  heroButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.2,
    color: ORANGE,
  },
  headerRow: {
    marginTop: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0,
    color: '#1A1A1A',
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  cardWrapper: { marginRight: 12 },
});
