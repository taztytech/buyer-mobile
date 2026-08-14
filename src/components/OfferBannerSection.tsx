import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { OfferCard } from './OfferCard';
import type { Offer } from '@/services/offers.service';

interface OfferBannerSectionProps {
  offers: Offer[];
  onOfferPress: (offer: Offer) => void;
  title?: string;
}

/**
 * The dedicated offer strip, rendered below the horizontal shop banners on
 * Home and fed by the `offer_banner` field of /api/buyer/home.
 *
 * That field carries the live offer payload (slots left, buyer_state,
 * countdown), so this renders real state without its own fetch. Offers whose
 * window has closed are filtered out server-side by clock, so nothing expired
 * can reach this component.
 *
 * Renders nothing at all when there are no offers — no empty header, no gap.
 */
export const OfferBannerSection: React.FC<OfferBannerSectionProps> = ({
  offers,
  onOfferPress,
  title = 'Limited Time Offers',
}) => {
  if (!offers?.length) return null;

  const single = offers.length === 1;

  return (
    <View style={styles.container} testID="offer-banner-section">
      <View style={styles.headerRow}>
        <View style={styles.rule} />
        <Text style={styles.title}>{title}</Text>
        <View style={styles.rule} />
      </View>

      {single ? (
        <OfferCard offer={offers[0]} onPress={onOfferPress} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {offers.map(offer => (
            <View key={offer.id} style={styles.cardWrapper}>
              <OfferCard offer={offer} onPress={onOfferPress} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 18, marginBottom: 4 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 10,
  },
  title: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: 0,
    color: '#1A1A1A',
  },
  scrollContent: { paddingHorizontal: 4 },
  cardWrapper: { marginRight: 4 },
});
