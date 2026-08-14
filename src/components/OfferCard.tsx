import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import type { Offer } from '@/services/offers.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;

interface OfferCardProps {
  offer: Offer;
  onPress: (offer: Offer) => void;
}

/** Live countdown to booking open, ticking each second. */
const useCountdown = (initialSeconds: number | null) => {
  const [remaining, setRemaining] = React.useState<number | null>(initialSeconds);

  React.useEffect(() => {
    setRemaining(initialSeconds);
  }, [initialSeconds]);

  React.useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const timer = setInterval(() => {
      setRemaining(prev => (prev === null || prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  return remaining;
};

const formatCountdown = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

/**
 * Home-screen card for a promo offer.
 *
 * Every state shown here is decided by the server (`buyer_state`) — the app
 * never computes whether an offer is live or expired. Expired offers are not
 * returned by the API at all, so they cannot appear.
 */
export const OfferCard: React.FC<OfferCardProps> = ({ offer, onPress }) => {
  const countdown = useCountdown(offer.opens_in_seconds);

  const renderPill = () => {
    switch (offer.buyer_state) {
      case 'not_open_yet':
        return (
          <View style={[styles.pill, styles.pillInfo]}>
            <Text style={styles.pillText} testID="offer-card-countdown">
              {countdown && countdown > 0
                ? `Opens in ${formatCountdown(countdown)}`
                : 'Opening now'}
            </Text>
          </View>
        );
      case 'sold_out':
        return (
          <View style={[styles.pill, styles.pillMuted]}>
            <Text style={styles.pillText}>SOLD OUT</Text>
          </View>
        );
      case 'already_claimed':
        return (
          <View style={[styles.pill, styles.pillSuccess]}>
            <Text style={styles.pillText}>Booked ✓</Text>
          </View>
        );
      case 'closed':
        return (
          <View style={[styles.pill, styles.pillMuted]}>
            <Text style={styles.pillText}>Booking closed</Text>
          </View>
        );
      case 'bookable':
      default:
        return (
          <View style={[styles.pill, styles.pillLive]}>
            <Text style={styles.pillText}>
              {offer.slots_remaining} of {offer.slots_total} left
            </Text>
          </View>
        );
    }
  };

  const dimmed =
    offer.buyer_state === 'sold_out' || offer.buyer_state === 'closed';

  return (
    <TouchableOpacity
      testID={`offer-card-${offer.id}`}
      activeOpacity={0.85}
      onPress={() => onPress(offer)}
      style={[styles.card, dimmed && styles.cardDimmed]}
    >
      {offer.banner_image_url ? (
        <Image
          source={{ uri: offer.banner_image_url }}
          style={styles.banner}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.banner, styles.bannerFallback]} />
      )}

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {offer.name}
          </Text>
          {renderPill()}
        </View>

        {!!offer.subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {offer.subtitle}
          </Text>
        )}

        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{Number(offer.offer_price)}</Text>
          {!!offer.strike_price && (
            <Text style={styles.strike}>₹{Number(offer.strike_price)}</Text>
          )}
          {offer.delivery_charge_mode === 'free' && (
            <Text style={styles.freeTag}>FREE DELIVERY</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignSelf: 'center',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginVertical: 10,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardDimmed: { opacity: 0.6 },
  banner: { width: '100%', height: 140 },
  bannerFallback: { backgroundColor: '#1a9656' },
  body: { padding: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 16,
    letterSpacing: 0,
    color: '#1A1A1A',
    marginRight: 8,
  },
  subtitle: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 12,
    letterSpacing: 0,
    color: '#6B7280',
    marginTop: 2,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  price: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: 0,
    color: '#1a9656',
  },
  strike: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 14,
    letterSpacing: 0,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  freeTag: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#1a9656',
    marginLeft: 'auto',
  },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  pillLive: { backgroundColor: '#1a9656' },
  pillInfo: { backgroundColor: '#2563EB' },
  pillMuted: { backgroundColor: '#9CA3AF' },
  pillSuccess: { backgroundColor: '#059669' },
  pillText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: 0,
    color: '#FFFFFF',
  },
});
