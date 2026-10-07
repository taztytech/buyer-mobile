import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { OptimizedImage } from '@/components/OptimizedImage';

export interface GalleryCardData {
  id: string | number;
  name: string;
  cuisine?: string;
  rating?: number;
  reviewCount?: number;
  deliveryTime?: string;
  distance?: string;
  locality?: string;
  image?: string;
  gallery?: string[];
  offerLabel?: string | null;
  isVeg?: boolean;
}

interface Props {
  restaurant: GalleryCardData;
  isOpen: boolean;
  closedNote?: string | null;
  isFavorite: boolean;
  togglingFavorite?: boolean;
  onPress?: () => void;
  onToggleFavorite: () => void;
  onOpenMenu: () => void;
}

const ORANGE = '#F26A1B';
const BORDER = '#F7B98C';
const CREAM = '#FFF6EE';
const CARD_H = 172;
const GAP = 6;
const ROLL_MS = 2800;

/** "25-30 mins" → 30, for the quick-delivery chip. */
const maxMins = (t?: string) => {
  const n = String(t ?? '').match(/\d+/g);
  return n?.length ? Number(n[n.length - 1]) : Infinity;
};

/** "0.82Kms" → "0.82 Km". */
const prettyDistance = (d?: string) => {
  const n = parseFloat(String(d ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? `${n.toFixed(2).replace(/\.?0+$/, '')} Km` : null;
};

/**
 * Home restaurant card: details on a cream panel on the left, and on the
 * right the restaurant's photos rolling one by one (small gap between
 * them) behind a curved orange edge, with favourite / menu buttons, the
 * delivery time and page dots.
 */
export const RestaurantGalleryCard: React.FC<Props> = ({
  restaurant: r,
  isOpen,
  closedNote,
  isFavorite,
  togglingFavorite,
  onPress,
  onToggleFavorite,
  onOpenMenu,
}) => {
  const { width } = useWindowDimensions();
  // Real width from layout (lists use different side padding).
  const [cardW, setCardW] = React.useState(width - 40);
  const leftW = Math.round(cardW * 0.5);
  const imgLeft = Math.round(cardW * 0.42); // photos start under the curve
  const imgW = cardW - imgLeft;

  const photos = React.useMemo(() => {
    const list = (r.gallery?.length ? r.gallery : r.image ? [r.image] : []).filter(Boolean);
    return list.slice(0, 4);
  }, [r.gallery, r.image]);

  const scrollRef = React.useRef<ScrollView>(null);
  const [index, setIndex] = React.useState(0);
  const dragging = React.useRef(false);

  // Roll one photo at a time while the card is on screen.
  React.useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => {
      if (dragging.current) return;
      setIndex(prev => {
        const next = (prev + 1) % photos.length;
        scrollRef.current?.scrollTo({ x: next * (imgW + GAP), animated: true });
        return next;
      });
    }, ROLL_MS);
    return () => clearInterval(t);
  }, [photos.length, imgW]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    dragging.current = false;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / (imgW + GAP)));
  };

  // Cream panel with an S-curved right edge, and the orange line on it.
  const H = CARD_H;
  const L = leftW;
  const edge = `M${L - 6},0 C${L + 22},${H * 0.32} ${L - 30},${H * 0.62} ${L - 2},${H}`;
  const panel = `M0,0 L${L - 6},0 C${L + 22},${H * 0.32} ${L - 30},${H * 0.62} ${L - 2},${H} L0,${H} Z`;

  const dist = prettyDistance(r.distance);
  const quick = maxMins(r.deliveryTime) <= 30;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[styles.card, { height: CARD_H }]}
      onLayout={e => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && Math.abs(w - cardW) > 1) setCardW(w);
      }}
      testID={`restaurant-card-${r.id}`}
    >
      {/* Photos, rolling one by one with a small gap. */}
      <View style={[styles.photos, { left: imgLeft, width: imgW }]}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={imgW + GAP}
          decelerationRate="fast"
          disableIntervalMomentum
          onScrollBeginDrag={() => {
            dragging.current = true;
          }}
          onMomentumScrollEnd={onMomentumEnd}
          scrollEnabled={photos.length > 1}
        >
          {photos.length ? (
            photos.map((uri, i) => (
              <View
                key={`${uri}-${i}`}
                style={{ width: imgW, height: CARD_H, marginRight: i < photos.length - 1 ? GAP : 0 }}
              >
                <OptimizedImage
                  source={uri}
                  style={[StyleSheet.absoluteFill, !isOpen && styles.closedImg]}
                  contentFit="cover"
                  shimmerWidth={imgW}
                  shimmerHeight={CARD_H}
                  cachePolicy="memory-disk"
                  priority={i === 0 ? 'high' : 'normal'}
                />
              </View>
            ))
          ) : (
            <View style={[styles.noPhoto, { width: imgW, height: CARD_H }]}>
              <MaterialIcons name="storefront" size={34} color="#E4C3AC" />
            </View>
          )}
        </ScrollView>
        {!isOpen && <View style={styles.closedTint} pointerEvents="none" />}
      </View>

      {/* Cream panel + curved orange edge over the photos. */}
      <Svg width={L + 30} height={H} style={styles.panelSvg} pointerEvents="none">
        <Path d={panel} fill={CREAM} />
        <Path d={edge} stroke={ORANGE} strokeWidth={3} fill="none" strokeLinecap="round" />
      </Svg>

      {/* Details */}
      <View style={[styles.left, { width: L - 22 }]} pointerEvents="box-none">
        {!!r.offerLabel && (
          <View style={styles.offerPill}>
            <MaterialIcons name="discount" size={14} color="#FFFFFF" />
            <Text style={styles.offerText} numberOfLines={1}>
              {r.offerLabel}
            </Text>
          </View>
        )}
        <Text style={styles.name} numberOfLines={2}>
          {r.name.toUpperCase()}
        </Text>
        {!!r.rating && r.rating > 0 && (
          <View style={styles.ratingRow}>
            <View style={styles.ratePill}>
              <MaterialIcons name="star" size={13} color="#FFFFFF" />
              <Text style={styles.rateText}>{r.rating.toFixed(1)}</Text>
            </View>
            {!!r.reviewCount && <Text style={styles.reviews}>({r.reviewCount})</Text>}
          </View>
        )}
        {(!!dist || !!r.locality) && (
          <View style={styles.metaRow}>
            <MaterialIcons name="place" size={14} color="#6F6F6F" />
            <Text style={styles.meta} numberOfLines={1}>
              {[dist, r.locality].filter(Boolean).join(' • ')}
            </Text>
          </View>
        )}
        {!!r.cuisine && (
          <Text style={styles.cuisine} numberOfLines={1}>
            {r.cuisine}
          </Text>
        )}
        {!isOpen && closedNote ? (
          <Text style={styles.closedNote} numberOfLines={1}>
            {closedNote}
          </Text>
        ) : (
          (r.isVeg || quick) && (
            <View style={styles.chips}>
              {r.isVeg && (
                <View style={styles.chip}>
                  <MaterialIcons name="eco" size={13} color="#1F9D4C" />
                  <Text style={styles.chipText}>Pure Veg</Text>
                </View>
              )}
              {quick && (
                <View style={styles.chip}>
                  <MaterialIcons name="bolt" size={14} color={ORANGE} />
                  <Text style={styles.chipText}>Quick Bites</Text>
                </View>
              )}
            </View>
          )
        )}
      </View>

      {/* Top-right actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.circle}
          onPress={onToggleFavorite}
          disabled={togglingFavorite}
          testID={`favorite-button-${r.id}`}
        >
          {togglingFavorite ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <MaterialIcons
              name={isFavorite ? 'favorite' : 'favorite-border'}
              size={19}
              color={isFavorite ? '#FF3B30' : '#1A1A1A'}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.circle} onPress={onOpenMenu} testID={`restaurant-menu-${r.id}`}>
          <MaterialIcons name="more-vert" size={19} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* Bottom-right time pill, or CLOSED */}
      {isOpen ? (
        !!r.deliveryTime && (
          <View style={styles.timePill}>
            <MaterialIcons name="schedule" size={15} color={ORANGE} />
            <Text style={styles.timeText}>{r.deliveryTime}</Text>
          </View>
        )
      ) : (
        <View style={[styles.timePill, styles.closedPill]}>
          <Text style={styles.closedPillText}>CLOSED</Text>
        </View>
      )}

      {photos.length > 1 && (
        <View style={[styles.dots, { left: imgLeft + 34 }]} pointerEvents="none">
          {photos.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: CREAM,
    borderWidth: 1.5,
    borderColor: BORDER,
    elevation: 3,
    shadowColor: '#C25A16',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  photos: { position: 'absolute', top: 0, bottom: 0 },
  noPhoto: { backgroundColor: '#FBE6D6', alignItems: 'center', justifyContent: 'center' },
  closedImg: { opacity: 0.6 },
  closedTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.25)' },
  panelSvg: { position: 'absolute', left: 0, top: 0 },
  left: {
    position: 'absolute',
    left: 14,
    top: 12,
    bottom: 12,
    justifyContent: 'center',
  },
  offerPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F4511E',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
    maxWidth: '100%',
  },
  offerText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: '#FFFFFF',
  },
  name: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: 0.1,
    color: '#1A1A1A',
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  ratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#1BA94C',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rateText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#FFFFFF',
  },
  reviews: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12.5,
    letterSpacing: 0.1,
    color: '#4A4A4A',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 },
  meta: {
    flexShrink: 1,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#5F5F5F',
  },
  cuisine: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: '#7A7A7A',
    marginTop: 2,
  },
  chips: { flexDirection: 'row', gap: 6, marginTop: 7, flexWrap: 'nowrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    elevation: 1,
    shadowColor: '#C25A16',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  chipText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 10.5,
    letterSpacing: 0.1,
    color: '#2A2A2A',
  },
  closedNote: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: '#C62828',
    marginTop: 6,
  },
  actions: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  timePill: {
    position: 'absolute',
    right: 10,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    elevation: 2,
  },
  timeText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#1A1A1A',
  },
  closedPill: { backgroundColor: '#3A3A3A' },
  closedPillText: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  dots: {
    position: 'absolute',
    bottom: 22,
    flexDirection: 'row',
    gap: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotOn: { backgroundColor: '#FFFFFF', width: 8, height: 8 },
});

export default RestaurantGalleryCard;
