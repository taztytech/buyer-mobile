import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import offersService, { Offer } from '@/services/offers.service';
import { useOfferClaim } from '@/hooks/useOfferClaim';

interface OfferDetailScreenProps {
  offerId: number;
  onBack: () => void;
  /** Hand off to checkout once the offer is reserved AND in the cart. */
  onProceedToPayment: (offer: Offer) => void;
}

const formatWhen = (iso?: string): string => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Offer detail + booking entry point.
 *
 * The slot is held by the server before payment starts (reserve → pay →
 * confirm). If the user abandons checkout the hold is released, either by them
 * backing out or by the server reaping it when it expires — so an abandoned
 * cart never permanently costs a slot.
 */
export const OfferDetailScreen: React.FC<OfferDetailScreenProps> = ({
  offerId,
  onBack,
  onProceedToPayment,
}) => {
  const [offer, setOffer] = React.useState<Offer | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { claim, busy: booking } = useOfferClaim();

  const load = React.useCallback(async () => {
    setLoading(true);
    const data = await offersService.getOffer(offerId);
    if (!data) {
      // Server returns 404 for expired/unpublished offers.
      setError('This offer is no longer available.');
    }
    setOffer(data);
    setLoading(false);
  }, [offerId]);

  React.useEffect(() => {
    load();
  }, [load]);

  /**
   * Booking goes through useOfferClaim rather than calling reserve() here,
   * because holding a slot is only half the job — the offer also has to land
   * in the cart and be remembered for the post-payment confirm. Splitting
   * those apart is what previously left users at an empty checkout with a
   * slot held against their name.
   */
  const runClaim = async (forceClearCart = false) => {
    if (!offer) return;
    setError(null);

    const outcome = await claim(offer.id, { forceClearCart });

    switch (outcome.status) {
      case 'in_cart':
        onProceedToPayment(outcome.offer);
        return;

      case 'needs_cart_clear':
        Alert.alert(
          'Clear your cart?',
          'Offer orders are placed on their own. Your current cart will be emptied.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear & continue', onPress: () => runClaim(true) },
          ],
        );
        return;

      case 'needs_login':
        setError('Please log in to book this offer.');
        return;

      case 'sold_out':
        setError('This offer just sold out.');
        load();
        return;

      case 'already_claimed':
        setError('You have already booked this offer.');
        load();
        return;

      case 'not_open_yet':
        setError('Booking has not opened yet.');
        load();
        return;

      case 'closed':
        setError('Booking for this offer has closed.');
        load();
        return;

      default:
        setError(outcome.message ?? 'Could not book this offer.');
        load();
    }
  };

  const handleBook = () => runClaim(false);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1a9656" />
      </SafeAreaView>
    );
  }

  if (!offer) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Offer not found'}</Text>
        <TouchableOpacity testID="offer-detail-back" onPress={onBack}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const total = offersService.getTotalPayable(offer);
  const bookable = offersService.isBookable(offer);

  const deliveryLabel =
    offer.delivery_charge_mode === 'free'
      ? 'Free delivery'
      : offer.delivery_charge_mode === 'per_km'
        ? `₹${offer.delivery_charge_value}/km delivery`
        : `₹${offer.delivery_charge_value} delivery`;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          testID="offer-detail-back"
          onPress={onBack}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {!!offer.banner_image_url && (
          <Image
            source={{ uri: offer.banner_image_url }}
            style={styles.banner}
            resizeMode="cover"
          />
        )}

        <Text style={styles.name}>{offer.name}</Text>
        {!!offer.subtitle && <Text style={styles.subtitle}>{offer.subtitle}</Text>}

        <View style={styles.slotRow}>
          <Text style={styles.slotText}>
            {offer.buyer_state === 'sold_out'
              ? 'SOLD OUT'
              : `${offer.slots_remaining} of ${offer.slots_total} left`}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>What you get</Text>
        {offer.items?.map(item => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name_snapshot}</Text>
            <Text style={styles.itemQty}>x{item.quantity}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Price</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Offer price</Text>
          <Text style={styles.priceValue}>₹{Number(offer.offer_price)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>{deliveryLabel}</Text>
          <Text style={styles.priceValue}>
            {offer.delivery_charge_mode === 'free'
              ? '₹0'
              : `₹${offer.delivery_charge_value ?? 0}`}
          </Text>
        </View>
        <View style={[styles.priceRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₹{total}</Text>
        </View>

        {offer.fulfilment_mode === 'prebooking' && (
          <>
            <Text style={styles.sectionTitle}>Delivery</Text>
            <Text style={styles.deliveryNote}>
              Delivery starts {formatWhen(offer.delivery_starts_at)}
            </Text>
            <Text style={styles.windowNote}>
              Booking open {formatWhen(offer.booking_opens_at)} –{' '}
              {formatWhen(offer.booking_closes_at)}
            </Text>
          </>
        )}

        <Text style={styles.rules}>
          {offer.per_user_limit === 1 ? '1 per customer' : `${offer.per_user_limit} per customer`}
          {' · '}
          {offer.payment_mode === 'online_only' ? 'Online payment only' : 'Online or COD'}
          {' · '}
          {offer.cancellation_allowed ? 'Cancellable' : 'No cancellation'}
        </Text>

        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          testID="offer-book-button"
          style={[styles.cta, !bookable && styles.ctaDisabled]}
          disabled={!bookable || booking}
          onPress={handleBook}
        >
          {booking ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.ctaText}>{offersService.getCtaLabel(offer)}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  content: { padding: 20, paddingBottom: 120 },
  backBtn: { marginBottom: 12 },
  backText: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 14,
    letterSpacing: 0,
    color: '#1a9656',
  },
  banner: { width: '100%', height: 180, borderRadius: 14, marginBottom: 16 },
  name: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 22,
    letterSpacing: 0,
    color: '#1A1A1A',
  },
  subtitle: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 13,
    letterSpacing: 0,
    color: '#6B7280',
    marginTop: 4,
  },
  slotRow: { marginTop: 10 },
  slotText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0,
    color: '#B45309',
  },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: 0,
    color: '#1A1A1A',
    marginTop: 22,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  itemName: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 14,
    letterSpacing: 0,
    color: '#374151',
  },
  itemQty: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: 0,
    color: '#374151',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  priceLabel: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 14,
    letterSpacing: 0,
    color: '#6B7280',
  },
  priceValue: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 14,
    letterSpacing: 0,
    color: '#374151',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
    paddingTop: 10,
  },
  totalLabel: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 16,
    letterSpacing: 0,
    color: '#1A1A1A',
  },
  totalValue: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: 0,
    color: '#1a9656',
  },
  deliveryNote: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: 0,
    color: '#1a9656',
  },
  windowNote: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 12,
    letterSpacing: 0,
    color: '#6B7280',
    marginTop: 4,
  },
  rules: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 12,
    letterSpacing: 0,
    color: '#6B7280',
    marginTop: 20,
  },
  errorText: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0,
    color: '#DC2626',
    marginTop: 14,
  },
  link: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: 0,
    color: '#1a9656',
    marginTop: 10,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cta: {
    backgroundColor: '#1a9656',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaDisabled: { backgroundColor: '#9CA3AF' },
  ctaText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 16,
    letterSpacing: 0,
    color: '#FFFFFF',
  },
});
