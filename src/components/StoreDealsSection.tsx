import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DealMedia } from './DealMedia';
import { OptimizedImage } from '@/components/OptimizedImage';
import { isDealOrderable } from '@/services/storeDeal.service';
import type { StoreDeal } from '@/services/storeDeal.service';

const ORANGE = '#F26A1B';
const RED = '#E53935';

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
  /** Kept for callers; the card no longer shows a separate row title. */
  homeTitle?: string;
  /** Optional photo/video shown softly behind the header (set in the panel). */
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

const STATE_LABEL: Record<string, string> = {
  sold_out: 'SOLD OUT',
  limit_reached: 'LIMIT REACHED',
  unavailable: 'CLOSED',
};

/**
 * Home ₹99 Store / Offer Zone: one orange card with the section header
 * (TAZTY · name · tagline · View All) and the deals as small cards inside
 * it - discount badge, round + to add, name, struck menu price and the deal
 * price. Colours and the rolling motion are admin-configurable; renders
 * nothing when there are no deals.
 */
export const StoreDealsSection: React.FC<StoreDealsSectionProps> = ({
  deals,
  onAdd,
  onSeeAll,
  onOpenStore,
  addingDealId = null,
  sectionName = '₹99 Store',
  tagline = 'Great Food. Just ₹99!',
  heroImageUrl = null,
  heroVideoUrl = null,
  bgColor = null,
  accentColor = null,
  animStyle = 'auto-scroll',
  animSpeed = null,
}) => {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const [contentW, setContentW] = useState(0);
  const [viewW, setViewW] = useState(0);

  const count = deals?.length || 0;
  const autoScroll = (animStyle || 'auto-scroll') !== 'none' && count > 4;

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

  if (!count) return null;

  const bg = bgColor || ORANGE;
  const accent = accentColor || bg;
  const hasHeroMedia = !!heroImageUrl || !!heroVideoUrl;

  // Four cards fill the panel, as in the design; more scroll with a peek.
  const inner = width - 32 - 20; // panel width minus its padding
  const cardW = Math.floor(count > 4 ? (inner - 8 * 3) / 3.6 : (inner - 8 * 3) / 4);
  const imgH = Math.round(cardW * 0.86);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetRef.current = e.nativeEvent.contentOffset.x;
  };

  return (
    <View style={styles.container} testID="store-deals-section">
      <View style={[styles.panel, { backgroundColor: bg, shadowColor: bg }]}>
        {/* Light from the top-left, as in the design. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {hasHeroMedia && (
          <View style={styles.heroMedia} pointerEvents="none">
            <DealMedia
              imageUrl={heroImageUrl}
              videoUrl={heroVideoUrl}
              name={sectionName}
              photoSeconds={heroImageUrl ? 2 : 0}
              muted
              loop
              fallback="none"
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: bg, opacity: 0.72 }]} />
          </View>
        )}

        {/* Decorations: crown and offer tag, behind the header text. */}
        <Text style={styles.crown} pointerEvents="none">👑</Text>
        <View style={styles.tagDeco} pointerEvents="none">
          <Text style={styles.tagDecoText}>%</Text>
        </View>

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>TAZTY</Text>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
              {sectionName.toUpperCase()}
            </Text>
            <Text style={styles.tagline} numberOfLines={1}>
              {tagline}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.viewAll}
            onPress={onSeeAll}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`View all ${sectionName} deals`}
            testID="store-deals-view-all"
          >
            <Text style={[styles.viewAllText, { color: accent === bg ? RED : accent }]}>View All</Text>
            <MaterialIcons name="arrow-forward" size={16} color={accent === bg ? RED : accent} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          onLayout={(e) => setViewW(e.nativeEvent.layout.width)}
          onContentSizeChange={(w) => setContentW(w)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            pausedRef.current = true;
          }}
          onScrollEndDrag={() => {
            pausedRef.current = false;
          }}
          onMomentumScrollEnd={() => {
            pausedRef.current = false;
          }}
        >
          {deals.map((deal, i) => {
            const orderable = isDealOrderable(deal);
            const stateLabel = STATE_LABEL[deal.state as string];
            const off = Math.round(Number(deal.discount_percent || 0));
            const adding = addingDealId === deal.id;
            return (
              <TouchableOpacity
                key={deal.id}
                activeOpacity={0.9}
                onPress={() => onOpenStore?.(deal)}
                style={[styles.card, { width: cardW }, i < count - 1 && { marginRight: 8 }]}
                testID={`store-deal-card-${deal.id}`}
              >
                <View style={[styles.imgWrap, { height: imgH }, !orderable && styles.dim]}>
                  {deal.image_url ? (
                    <OptimizedImage
                      source={deal.image_url}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      shimmerWidth={cardW}
                      shimmerHeight={imgH}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <MaterialIcons name="restaurant" size={26} color="#D9B9A6" />
                  )}
                  {(stateLabel || off > 0) && (
                    <View style={[styles.badge, stateLabel && styles.badgeMuted]}>
                      <Text style={styles.badgeText} numberOfLines={1}>
                        {stateLabel || `${off}% OFF`}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.plus, !orderable && styles.plusOff]}
                    disabled={!orderable || adding}
                    onPress={() => onAdd(deal)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${deal.name}`}
                    testID={`store-deal-add-${deal.id}`}
                  >
                    {adding ? (
                      <ActivityIndicator size="small" color={RED} />
                    ) : (
                      <MaterialIcons name="add" size={20} color={orderable ? RED : '#B9B9B9'} />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.body}>
                  <Text style={styles.name} numberOfLines={1}>
                    {deal.name}
                  </Text>
                  <View style={styles.priceRow}>
                    {Number(deal.menu_price) > Number(deal.deal_price) && (
                      <Text style={styles.mrp}>₹{Math.round(Number(deal.menu_price))}</Text>
                    )}
                    <Text style={styles.price}>₹{Math.round(Number(deal.deal_price))}</Text>
                  </View>
                  {!!deal.restaurant?.name && (
                    <View style={styles.storeRow}>
                      <MaterialIcons name="storefront" size={11} color="#1F9D4C" />
                      <Text style={styles.storeName} numberOfLines={1}>
                        {deal.restaurant.name}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 18, marginBottom: 6, paddingHorizontal: 16 },
  panel: {
    borderRadius: 22,
    overflow: 'hidden',
    paddingTop: 14,
    paddingBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 214, 180, 0.9)',
    elevation: 4,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  heroMedia: { position: 'absolute', top: 0, left: 0, right: 0, height: 96 },
  crown: {
    position: 'absolute',
    top: 2,
    right: 118,
    fontSize: 34,
    opacity: 0.85,
    transform: [{ rotate: '14deg' }],
  },
  tagDeco: {
    position: 'absolute',
    top: -8,
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(229, 57, 53, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '18deg' }],
  },
  tagDecoText: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0,
    color: 'rgba(255,255,255,0.9)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  headerText: { flex: 1, minWidth: 0, paddingRight: 8 },
  kicker: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 2.4,
    color: 'rgba(255,255,255,0.92)',
  },
  title: {
    fontFamily: 'Kalam_700Bold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 0.5,
    color: '#FFFFFF',
    fontStyle: 'italic',
    textShadowColor: 'rgba(120, 30, 0, 0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  tagline: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    letterSpacing: 0.1,
    color: 'rgba(255,255,255,0.95)',
    marginTop: -2,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    elevation: 3,
    shadowColor: '#7A2A00',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  viewAllText: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.2,
    color: RED,
  },
  row: { paddingHorizontal: 10 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 236, 222, 1)',
    elevation: 2,
    shadowColor: '#7A2A00',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  imgWrap: {
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: '#FFF1E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.55 },
  badge: {
    position: 'absolute',
    top: 5,
    left: 5,
    maxWidth: '90%',
    backgroundColor: RED,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeMuted: { backgroundColor: '#5B5B5B' },
  badgeText: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 9.5,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  plus: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  plusOff: { backgroundColor: '#F2F2F2' },
  body: { paddingHorizontal: 3, paddingTop: 6, paddingBottom: 2 },
  name: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 11.5,
    letterSpacing: 0,
    color: '#1A1A1A',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  mrp: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 11,
    letterSpacing: 0,
    color: '#8E8E8E',
    textDecorationLine: 'line-through',
  },
  price: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 13.5,
    letterSpacing: 0,
    color: RED,
  },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  storeName: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 10,
    letterSpacing: 0,
    color: '#5F6B66',
  },
});
