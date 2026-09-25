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
import { LinearGradient } from 'expo-linear-gradient';
import { OfferPrice } from './OfferPrice';
import { useCart } from '@/context/CartContext';
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

  // Once the deal is in the cart the button becomes a − qty + stepper. A deal
  // cart holds only deal lines, so the line is found by the menu item id.
  const { cart, updateQuantity } = useCart();
  const cartEntry = Object.entries(cart).find(
    ([, item]) => Number(item.itemId) === Number(deal.item_id),
  );
  const cartKey = cartEntry?.[0];
  const quantityInCart = cartEntry?.[1]?.quantity ?? 0;
  const inCart = quantityInCart > 0 && !!cartKey;

  // "+" goes through the normal add, so the server re-checks the daily limit and
  // keeps the deal price; "−" is always allowed (0 takes it out of the cart).
  const increment = () => onAdd(deal);
  const decrement = () => {
    if (cartKey) updateQuantity(cartKey, quantityInCart - 1);
  };

  const addControl = inCart ? (
    <View
      style={[styles.stepper, isHome && styles.controlFullWidth]}
      testID={`store-deal-stepper-${deal.id}`}
    >
      <TouchableOpacity
        style={styles.stepperButton}
        onPress={decrement}
        disabled={adding}
        accessibilityRole="button"
        accessibilityLabel={`Remove one ${deal.name}`}
        testID={`store-deal-decrement-${deal.id}`}
      >
        <Text style={styles.stepperSymbol}>−</Text>
      </TouchableOpacity>
      {adding ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={styles.stepperQty} testID={`store-deal-qty-${deal.id}`}>
          {quantityInCart}
        </Text>
      )}
      <TouchableOpacity
        style={styles.stepperButton}
        onPress={increment}
        disabled={!orderable || adding}
        accessibilityRole="button"
        accessibilityLabel={`Add one more ${deal.name}`}
        testID={`store-deal-increment-${deal.id}`}
      >
        <Text style={[styles.stepperSymbol, !orderable && styles.stepperSymbolDisabled]}>+</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <TouchableOpacity
      style={[
        styles.addButton,
        isHome && styles.controlFullWidth,
        !orderable && styles.addButtonDisabled,
      ]}
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
                ? 'LIMIT'
                : 'N/A'}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View
      style={[styles.card, isHome ? styles.cardHome : styles.cardStore]}
      testID={`store-deal-card-${deal.id}`}
    >
      {/* Full-bleed image / video fills the whole card. */}
      <View style={StyleSheet.absoluteFill}>
        <DealMedia
          imageUrl={deal.image_url}
          videoUrl={deal.video_url}
          name={deal.name}
          photoSeconds={deal.media_photo_seconds ?? 2}
          muted={deal.media_muted ?? true}
          loop={deal.media_loop ?? true}
        />
      </View>

      {/* Dark gradient at the bottom so the overlaid text stays legible on any photo. */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.45, 1]}
        style={styles.scrim}
        pointerEvents="none"
      />

      {/* A "1% OFF" badge on a ₹99-from-₹100 deal reads as a joke, so the
          badge appears only when the saving is worth shouting about. */}
      {deal.discount_percent >= 10 ? (
        <View style={styles.discountPill}>
          <Text style={styles.discountText}>{deal.discount_percent}% OFF</Text>
        </View>
      ) : null}

      {deal.state === 'closing_soon' ? (
        <View style={styles.closingChip}>
          <Text style={styles.closingChipText}>Closing soon</Text>
        </View>
      ) : null}

      {/* Everything overlaid on the image, bottom-aligned (Swiggy-style). */}
      <View style={styles.overlay}>
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

        <View style={styles.priceRow}>
          {/* Price sits on a light chip so the orange circle and the struck
              menu price both read against the photo. */}
          <View style={styles.priceChip}>
            <OfferPrice
              dealPrice={deal.deal_price}
              originalPrice={deal.menu_price}
              size={isHome ? 22 : 28}
              disabled={!orderable}
              testID={`${isHome ? 'home' : 'store'}-offer-price-${deal.id}`}
            />
          </View>

          {/* The wide ₹99 Store card has room beside the price; the narrow
              Home card puts the control on its own row below. */}
          {isHome ? null : addControl}
        </View>

        {isHome ? <View style={styles.controlRow}>{addControl}</View> : null}
      </View>

      {/* Sold out / unavailable dims the whole card. */}
      {!orderable && label ? (
        <View style={styles.stateOverlay}>
          <Text style={styles.stateOverlayText}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHome: { width: 168, height: 236 },
  cardStore: { width: '100%', height: 220 },
  // Used by DealMedia — the media fills the whole card.
  image: { width: '100%', height: '100%' },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F3F3' },
  imageFallbackText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 40,
    letterSpacing: 0,
    color: '#B9B4B0',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
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
  closingChip: {
    position: 'absolute',
    top: 8,
    right: 8,
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
  stateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateOverlayText: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 0.6,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 6,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vegMark: {
    width: 14,
    height: 14,
    borderWidth: 1.6,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  name: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: 0,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  restaurant: {
    marginTop: 1,
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 11,
    letterSpacing: 0.1,
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  priceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceChip: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  addButton: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    height: 34,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: { backgroundColor: 'rgba(255,255,255,0.25)' },
  controlRow: { marginTop: 8 },
  controlFullWidth: { alignSelf: 'stretch' },
  stepper: {
    height: 34,
    minWidth: 96,
    backgroundColor: ORANGE,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSymbol: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 0,
    color: '#FFFFFF',
  },
  stepperSymbolDisabled: { color: 'rgba(255,255,255,0.45)' },
  stepperQty: {
    minWidth: 20,
    textAlign: 'center',
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 0,
    color: '#FFFFFF',
  },
  addButtonText: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  addButtonTextDisabled: { color: '#F0EAE6' },
});
