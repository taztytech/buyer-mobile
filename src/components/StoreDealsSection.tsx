import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StoreDealCard } from './StoreDealCard';
import type { StoreDeal } from '@/services/storeDeal.service';

const ORANGE = '#E8501C';

interface StoreDealsSectionProps {
  deals: StoreDeal[];
  onAdd: (deal: StoreDeal) => void;
  onSeeAll: () => void;
  addingDealId?: number | null;
  /** Editable labels from the server; fall back to the ₹99 wording. */
  sectionName?: string;
  tagline?: string;
  homeTitle?: string;
}

/**
 * Home: the ₹99 Store banner and the "Today's ₹99 deals" row.
 *
 * Fed by the `store_deals` field of /api/buyer/home, so it renders real state
 * without a request of its own. Renders nothing when there are no deals - no
 * empty header, no gap.
 */
export const StoreDealsSection: React.FC<StoreDealsSectionProps> = ({
  deals,
  onAdd,
  onSeeAll,
  addingDealId = null,
  sectionName = '₹99 Store',
  tagline = 'Great Food. Just ₹99!',
  homeTitle = "Today's deals",
}) => {
  if (!deals?.length) return null;

  return (
    <View style={styles.container} testID="store-deals-section">
      <TouchableOpacity
        style={styles.hero}
        onPress={onSeeAll}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="Explore the 99 rupees store"
        testID="store-deals-hero"
      >
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroKicker}>TAZTY</Text>
          <Text style={styles.heroTitle}>{sectionName.toUpperCase()}</Text>
          <Text style={styles.heroSubtitle}>{tagline}</Text>
        </View>
        <View style={styles.heroButton}>
          <Text style={styles.heroButtonText}>Explore →</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>{homeTitle}</Text>
        <TouchableOpacity
          onPress={onSeeAll}
          accessibilityRole="button"
          testID="store-deals-see-all"
        >
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {deals.map(deal => (
          <View key={deal.id} style={styles.cardWrapper}>
            <StoreDealCard
              deal={deal}
              variant="home"
              onAdd={onAdd}
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
    backgroundColor: ORANGE,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextWrap: { flex: 1 },
  heroKicker: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: 1.6,
    color: 'rgba(255, 255, 255, 0.85)',
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
    fontWeight: 400,
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
    fontWeight: 600,
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
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: 0,
    color: '#1A1A1A',
  },
  seeAll: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: 0.2,
    color: ORANGE,
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  cardWrapper: { marginRight: 12 },
});
