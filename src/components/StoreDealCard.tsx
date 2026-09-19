import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { OfferPrice } from './OfferPrice';
import {
  dealStateLabel,
  isDealOrderable,
  StoreDeal,
} from '@/services/storeDeal.service';

const ORANGE = '#E8501C';

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
        {deal.image_url ? (
          <Image
            source={{ uri: deal.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Text style={styles.imageFallbackText}>
              {(deal.name || '?').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

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
