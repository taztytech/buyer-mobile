import React from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { OptimizedImage } from '@/components/OptimizedImage';
import type { CardChip, CardExtras, CardStyle, CardTagline } from './cardStyle';

export interface StudioCardData {
  id: string | number;
  name: string;
  cuisine?: string;
  rating?: number;
  reviewCount?: number;
  deliveryTime?: string;
  distance?: string;
  locality?: string;
  photos: string[];
}

interface Props {
  restaurant: StudioCardData;
  style: CardStyle;
  extras: CardExtras | null;
  isOpen: boolean;
  closedNote?: string | null;
  isFavorite: boolean;
  togglingFavorite?: boolean;
  onPress?: () => void;
  onToggleFavorite: () => void;
  onOpenMenu: () => void;
}

const icon = (name: string) => (name || 'label') as any;

/** "0.82Kms" → "0.82 Km". */
const prettyDistance = (d?: string) => {
  const n = parseFloat(String(d ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? `${n.toFixed(2).replace(/\.?0+$/, '')} Km` : null;
};

const reviewText = (n?: number) =>
  !n ? '' : n >= 1000 ? `(${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K)` : `(${n})`;

/**
 * Photos that change one at a time with a soft cross-fade. Only the current
 * and the next photo are ever mounted, which keeps memory low on long lists.
 */
const RollingPhotos: React.FC<{
  photos: string[];
  rolling: boolean;
  intervalSec: number;
  dim: boolean;
}> = ({ photos, rolling, intervalSec, dim }) => {
  const [index, setIndex] = React.useState(0);
  const [next, setNext] = React.useState<number | null>(null);
  const fade = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!rolling || photos.length < 2) return;
    const id = setInterval(() => {
      const n = (index + 1) % photos.length;
      setNext(n);
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 650, useNativeDriver: true }).start(({ finished }) => {
        if (finished) {
          setIndex(n);
          setNext(null);
        }
      });
    }, Math.max(2, intervalSec) * 1000);
    return () => clearInterval(id);
  }, [rolling, photos.length, intervalSec, index, fade]);

  if (!photos.length) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.noPhoto]}>
        <MaterialIcons name="restaurant" size={40} color="rgba(255,255,255,0.5)" />
      </View>
    );
  }
  return (
    <>
      <OptimizedImage
        source={photos[index]}
        style={[StyleSheet.absoluteFill, dim && styles.dim]}
        contentFit="cover"
        showShimmer={false}
        cachePolicy="memory-disk"
      />
      {next !== null && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents="none">
          <OptimizedImage
            source={photos[next]}
            style={[StyleSheet.absoluteFill, dim && styles.dim]}
            contentFit="cover"
            showShimmer={false}
            cachePolicy="memory-disk"
          />
        </Animated.View>
      )}
      {photos.length > 1 && (
        <View style={styles.photoDots} pointerEvents="none">
          {photos.map((_, i) => (
            <View key={i} style={[styles.photoDot, i === (next ?? index) && styles.photoDotOn]} />
          ))}
        </View>
      )}
    </>
  );
};

const Tagline: React.FC<{ t: CardTagline; width: number; height: number }> = ({ t, width, height }) => {
  // Same as the Card Studio preview: 19px × size, at most 55% wide,
  // centred on (x, y).
  const boxW = width * 0.55;
  const [boxH, setBoxH] = React.useState(Math.round(21 * t.size));
  const font =
    t.font === 'script'
      ? { fontFamily: 'Kalam_700Bold' }
      : t.font === 'serif'
        ? { fontFamily: 'serif', fontWeight: '700' as const }
        : { fontFamily: 'Poppins', fontWeight: '800' as const };
  return (
    <View
      pointerEvents="none"
      style={[
        styles.tagline,
        {
          width: boxW,
          left: t.x * width - boxW / 2,
          top: t.y * height - boxH / 2,
          transform: [{ rotate: `${t.rotate}deg` }],
        },
      ]}
      onLayout={e => setBoxH(e.nativeEvent.layout.height)}
    >
      <Text
        allowFontScaling={false}
        style={[styles.taglineText, font, { color: t.color, fontSize: 19 * t.size, lineHeight: 21 * t.size }]}
      >
        {t.text}
      </Text>
    </View>
  );
};

const Chip: React.FC<{ chip: CardChip; bg: string; color: string }> = ({ chip, bg, color }) => (
  <View style={[styles.chip, { backgroundColor: bg }]}>
    <MaterialIcons name={icon(chip.icon)} size={12} color={color} />
    <Text style={[styles.chipText, { color }]} numberOfLines={1}>
      {chip.label}
    </Text>
  </View>
);

/**
 * Home restaurant card from the Card Studio: "overlay" (full photo with a
 * fade and the details on the left, as in the design) or "classic" (photo
 * on top, details below). Positions, colours and size follow the style.
 */
export const StudioRestaurantCard: React.FC<Props> = ({
  restaurant: r,
  style: s,
  extras,
  isOpen,
  closedNote,
  isFavorite,
  togglingFavorite,
  onPress,
  onToggleFavorite,
  onOpenMenu,
}) => {
  const [w, setW] = React.useState(0);
  const classic = s.layout === 'classic';
  const photoH = classic ? Math.round(s.height * 0.62) : s.height;
  const dist = prettyDistance(r.distance);
  const meta = [dist, r.locality].filter(Boolean).join(' · ');
  const badge = s.positions.badge !== 'hidden' ? extras?.badge : null;
  const chips = s.positions.chips ? extras?.chips ?? [] : [];
  const light = s.overlay === 'light';
  const k = s.overlayStrength;
  const fade = light
    ? [`rgba(255,247,240,${k})`, `rgba(255,247,240,${k * 0.72})`, 'rgba(255,247,240,0)']
    : [`rgba(0,0,0,${k * 0.88})`, `rgba(0,0,0,${k * 0.55})`, 'rgba(0,0,0,0)'];

  const badgeEl = badge ? (
    <View style={[styles.badge, { backgroundColor: badge.color }]}>
      <MaterialIcons name={icon(badge.icon)} size={13} color="#FFFFFF" />
      <Text style={styles.badgeText} numberOfLines={1}>
        {badge.text}
      </Text>
    </View>
  ) : null;

  const details = (onPhoto: boolean) => {
    const nameColor = onPhoto ? s.colors.name : '#1A1A1A';
    const metaColor = onPhoto ? s.colors.meta : '#5F5F5F';
    return (
      <>
        {s.positions.badge === 'top-left' && onPhoto && badgeEl}
        <Text
          style={[styles.name, { color: nameColor, fontWeight: String(s.nameWeight) as any }]}
          numberOfLines={2}
        >
          {r.name}
        </Text>
        {!!r.rating && r.rating > 0 && (
          <View style={styles.ratingRow}>
            <View style={[styles.ratePill, { backgroundColor: s.colors.ratingBg }]}>
              <MaterialIcons name="star" size={12} color="#FFFFFF" />
              <Text style={styles.rateText}>{r.rating.toFixed(1)}</Text>
            </View>
            <Text style={[styles.reviews, { color: metaColor }]}>{reviewText(r.reviewCount)}</Text>
          </View>
        )}
        {!!meta && (
          <Text style={[styles.meta, { color: metaColor }]} numberOfLines={1}>
            {meta}
          </Text>
        )}
        {!!r.cuisine && (
          <Text style={[styles.meta, { color: metaColor }]} numberOfLines={1}>
            {r.cuisine}
          </Text>
        )}
        {!isOpen && !!closedNote && (
          <Text style={styles.closedNote} numberOfLines={1}>
            {closedNote}
          </Text>
        )}
      </>
    );
  };

  const timePill =
    s.positions.time !== 'hidden' ? (
      isOpen ? (
        !!r.deliveryTime && (
          <View
            style={[
              styles.timePill,
              { backgroundColor: s.colors.timeBg },
              s.positions.time === 'top-right' ? styles.timeTop : styles.timeBottom,
            ]}
          >
            <MaterialIcons name="schedule" size={14} color="#F26A1B" />
            <Text style={[styles.timeText, { color: s.colors.timeText }]}>{r.deliveryTime}</Text>
          </View>
        )
      ) : (
        <View style={[styles.timePill, styles.closedPill, styles.timeBottom]}>
          <Text style={styles.closedPillText}>CLOSED</Text>
        </View>
      )
    ) : null;

  const actions = (
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
            size={18}
            color={isFavorite ? '#FF3B30' : '#1A1A1A'}
          />
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.circle} onPress={onOpenMenu} testID={`restaurant-menu-${r.id}`}>
        <MaterialIcons name="more-vert" size={18} color="#1A1A1A" />
      </TouchableOpacity>
    </View>
  );

  const nameJustify =
    s.positions.name === 'top-left' ? 'flex-start' : s.positions.name === 'bottom-left' ? 'flex-end' : 'center';

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      onLayout={e => setW(e.nativeEvent.layout.width)}
      style={[
        styles.card,
        {
          borderRadius: s.radius,
          borderWidth: s.borderWidth,
          borderColor: s.borderColor ?? 'transparent',
        },
        s.shadow && styles.shadow,
      ]}
      testID={`restaurant-card-${r.id}`}
    >
      <View style={[styles.photoBox, { height: photoH, borderRadius: s.radius }, classic && styles.photoTopOnly]}>
        <RollingPhotos
          photos={r.photos}
          rolling={s.photos.rolling && isOpen}
          intervalSec={s.photos.intervalSec}
          dim={!isOpen}
        />
        {!classic && (
          <LinearGradient
            colors={fade as any}
            locations={[0, 0.48, 0.9]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
        {!!extras?.tagline && w > 0 && <Tagline t={extras.tagline} width={w} height={photoH} />}

        {!classic && (
          <View
            style={[styles.overlayContent, { justifyContent: nameJustify, paddingBottom: chips.length ? 46 : 14 }]}
            pointerEvents="box-none"
          >
            {details(true)}
          </View>
        )}

        {classic && s.positions.badge === 'top-left' && <View style={styles.classicBadge}>{badgeEl}</View>}
        {s.positions.badge === 'top-right' && <View style={styles.badgeTopRight}>{badgeEl}</View>}

        {!classic && chips.length > 0 && (
          <View style={styles.chipsRow} pointerEvents="none">
            {chips.map(c => (
              <Chip key={c.key + c.label} chip={c} bg={s.colors.chipBg} color={s.colors.chipText} />
            ))}
          </View>
        )}
        {actions}
        {timePill}
      </View>

      {classic && (
        <View style={styles.classicBody}>
          {details(false)}
          {chips.length > 0 && (
            <View style={[styles.chipsInline]}>
              {chips.map(c => (
                <Chip key={c.key + c.label} chip={c} bg="#F3F5F4" color="#2A2A2A" />
              ))}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', overflow: 'hidden' },
  shadow: {
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  photoBox: { width: '100%', overflow: 'hidden', backgroundColor: '#3A2A20' },
  photoTopOnly: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  noPhoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#5A3E2B' },
  dim: { opacity: 0.55 },
  photoDots: { position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', gap: 4 },
  photoDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  photoDotOn: { backgroundColor: '#FFFFFF', width: 12 },
  overlayContent: {
    position: 'absolute',
    left: 14,
    top: 12,
    bottom: 12,
    width: '62%',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 6,
    maxWidth: '100%',
  },
  badgeText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#FFFFFF',
  },
  badgeTopRight: { position: 'absolute', top: 12, right: 92 },
  classicBadge: { position: 'absolute', top: 12, left: 12 },
  name: {
    fontFamily: 'Poppins',
    fontSize: 19,
    lineHeight: 23,
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  ratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  rateText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#FFFFFF',
  },
  reviews: { fontFamily: 'Poppins', fontWeight: '500', fontSize: 12, letterSpacing: 0.1 },
  meta: { fontFamily: 'Poppins', fontWeight: '500', fontSize: 12, letterSpacing: 0.1, marginTop: 2 },
  closedNote: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: '#FF8A80',
    marginTop: 4,
  },
  tagline: { position: 'absolute', alignItems: 'center' },
  taglineText: {
    textAlign: 'center',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  chipsRow: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', gap: 6, maxWidth: '64%' },
  chipsInline: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 1,
  },
  chipText: { fontFamily: 'Poppins', fontWeight: '600', fontSize: 10.5, letterSpacing: 0.1 },
  actions: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePill: {
    position: 'absolute',
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    elevation: 2,
  },
  timeBottom: { bottom: 12 },
  timeTop: { top: 50 },
  timeText: { fontFamily: 'Poppins', fontWeight: '700', fontSize: 12, letterSpacing: 0.1 },
  closedPill: { backgroundColor: '#3A3A3A' },
  closedPillText: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  classicBody: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 },
});

export default StudioRestaurantCard;
