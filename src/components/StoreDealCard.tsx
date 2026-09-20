import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { OfferPrice } from './OfferPrice';
import {
  dealStateLabel,
  isDealOrderable,
  StoreDeal,
} from '@/services/storeDeal.service';

const ORANGE = '#E8501C';

/**
 * The deal's photo, and — when the deal has a promo video — a clip that plays
 * inside the same box: hold the photo `photoSeconds`, play the video once, then
 * loop (unless `loop` is off). The image always renders underneath, so the card
 * looks right before the clip loads and if it fails. Muted by default: many of
 * these scroll in a row and must not all blast audio.
 */
const DealMedia: React.FC<{
  imageUrl: string | null;
  videoUrl: string | null;
  name: string;
  photoSeconds: number;
  muted: boolean;
  loop: boolean;
}> = ({ imageUrl, videoUrl, name, photoSeconds, muted, loop }) => {
  const [phase, setPhase] = useState<'photo' | 'video'>('photo');
  const [videoFailed, setVideoFailed] = useState(false);
  const [stopped, setStopped] = useState(false);
  const videoRef = useRef<Video>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasVideo = !!videoUrl && !videoFailed;

  // Restart the cycle whenever the media changes.
  useEffect(() => {
    setPhase('photo');
    setVideoFailed(false);
    setStopped(false);
  }, [videoUrl, imageUrl]);

  // Drive photo → video. The video → photo hand-back happens in onStatus.
  useEffect(() => {
    if (!hasVideo || stopped || phase !== 'photo') return;
    const holdMs = Math.max(0, photoSeconds ?? 2) * 1000;
    timerRef.current = setTimeout(() => setPhase('video'), holdMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, hasVideo, stopped, photoSeconds]);

  // Always start the clip from the top when it becomes visible.
  useEffect(() => {
    if (phase === 'video') {
      videoRef.current?.setPositionAsync(0).catch(() => {});
    }
  }, [phase]);

  const onStatus = (status: AVPlaybackStatus) => {
    if (!('isLoaded' in status) || !status.isLoaded) return;
    if (status.didJustFinish) {
      setPhase('photo');
      if (!loop) setStopped(true);
    }
  };

  const base = imageUrl ? (
    <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
  ) : (
    <View style={[styles.image, styles.imageFallback]}>
      <Text style={styles.imageFallbackText}>
        {(name || '?').trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );

  return (
    <>
      {base}
      {hasVideo ? (
        <Video
          ref={videoRef}
          source={{ uri: videoUrl as string }}
          style={[StyleSheet.absoluteFill, { opacity: phase === 'video' ? 1 : 0 }]}
          resizeMode={ResizeMode.COVER}
          isMuted={muted}
          isLooping={false}
          shouldPlay={phase === 'video' && !stopped}
          onPlaybackStatusUpdate={onStatus}
          onError={() => setVideoFailed(true)}
        />
      ) : null}
    </>
  );
};

interface StoreDealCardProps {
  deal: StoreDeal;
  /** 'home' is the 156px card in the Home row; 'store' is the wider page card. */
  variant?: 'home' | 'store';
  onAdd: (deal: StoreDeal) => void;
  adding?: boolean;
}

/**
 * One ₹99 Store deal.
 *
 * Every state the card can show (sold out, limit reached, closing soon,
 * unavailable) is decided by the server and arrives as `deal.state`, so the
 * card never has to work out whether the kitchen is open or the budget is
 * spent. There is deliberately no rank badge.
 */
export const StoreDealCard: React.FC<StoreDealCardProps> = ({
  deal,
  variant = 'home',
  onAdd,
  adding = false,
}) => {
  const orderable = isDealOrderable(deal);
  const label = dealStateLabel(deal);
  const isHome = variant === 'home';
  const isVeg = (deal.dietary_preference || '').toLowerCase().includes('veg')
    && !(deal.dietary_preference || '').toLowerCase().includes('non');

  return (
    <View
      style={[styles.card, isHome ? styles.cardHome : styles.cardStore]}
      testID={`store-deal-card-${deal.id}`}
    >
      <View style={[styles.imageWrap, isHome ? styles.imageHome : styles.imageStore]}>
        <DealMedia
          imageUrl={deal.image_url}
          videoUrl={deal.video_url}
          name={deal.name}
          photoSeconds={deal.media_photo_seconds ?? 2}
          muted={deal.media_muted ?? true}
          loop={deal.media_loop ?? true}
        />

        {/* A "1% OFF" badge on a ₹99-from-₹100 deal reads as a joke, so the
            badge appears only when the saving is worth shouting about. */}
        {deal.discount_percent >= 10 ? (
          <View style={styles.discountPill}>
            <Text style={styles.discountText}>{deal.discount_percent}% OFF</Text>
          </View>
        ) : null}

        {/* Sold out / unavailable dims the photo so the state reads at a glance. */}
        {!orderable && label ? (
          <View style={styles.stateOverlay}>
            <Text style={styles.stateOverlayText}>{label}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={[styles.vegMark, { borderColor: isVeg ? '#12894A' : '#C0392B' }]}>
            <View
              style={[styles.vegDot, { backgroundColor: isVeg ? '#12894A' : '#C0392B' }]}
            />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {deal.name}
          </Text>
        </View>

        <Text style={styles.restaurant} numberOfLines={1}>
          {deal.restaurant?.name}
        </Text>

        {deal.state === 'closing_soon' ? (
          <View style={styles.closingChip}>
            <Text style={styles.closingChipText}>Closing soon</Text>
          </View>
        ) : null}

        {/* The circled price and the button used to share one line. On a
            156px card that left the price overlapping a struck-through number
            and a squashed button, so the button now has the width to itself. */}
        <View style={styles.priceRow}>
          <OfferPrice
            dealPrice={deal.deal_price}
            originalPrice={deal.menu_price}
            size={isHome ? 24 : 30}
            disabled={!orderable}
            testID={`${isHome ? 'home' : 'store'}-offer-price-${deal.id}`}
          />
        </View>

        <TouchableOpacity
          style={[styles.addButton, !orderable && styles.addButtonDisabled]}
          onPress={() => onAdd(deal)}
          disabled={!orderable || adding}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={orderable ? `Add ${deal.name}` : label || 'Unavailable'}
          testID={`store-deal-add-${deal.id}`}
        >
          {adding ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text
              style={[styles.addButtonText, !orderable && styles.addButtonTextDisabled]}
              numberOfLines={1}
            >
              {orderable
                ? 'ADD +'
                : label === 'SOLD OUT'
                  ? 'SOLD OUT'
                  : label === 'Limit reached today'
                    ? 'LIMIT REACHED'
                    : 'UNAVAILABLE'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHome: { width: 168 },
  cardStore: { width: '100%' },
  imageWrap: { width: '100%', position: 'relative', backgroundColor: '#F3F3F3' },
  imageHome: { height: 116 },
  imageStore: { height: 150 },
  image: { width: '100%', height: '100%' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  imageFallbackText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 28,
    letterSpacing: 0,
    color: '#B9B4B0',
  },
  discountPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: ORANGE,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountText: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  stateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateOverlayText: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 0.4,
    color: '#7A7A7A',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  body: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vegMark: {
    width: 12,
    height: 12,
    borderWidth: 1.4,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  name: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0,
    color: '#1A1A1A',
  },
  restaurant: {
    marginTop: 1,
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#8A8A8A',
  },
  closingChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#FFF1E8',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  closingChipText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: 0.2,
    color: ORANGE,
  },
  priceRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    marginTop: 6,
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: { backgroundColor: '#EFECE9' },
  addButtonText: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  addButtonTextDisabled: { color: '#9A948E' },
});
