import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { OptimizedImage } from '@/components/OptimizedImage';
import { BrandedLoader } from '@/components/BrandedLoader';
import {
  searchService,
  SearchResultDish,
  SearchResultRestaurant,
  SearchResultsResponse,
} from '@/services/search.service';
import type { VegModeType } from '@/context/VegModeContext';

interface SearchResultsViewProps {
  query: string;
  lat?: number;
  lng?: number;
  vegMode: VegModeType;
  onOpenRestaurant: (restaurantId: number, name: string) => void;
}

type Row =
  | { kind: 'dish'; dish: SearchResultDish }
  | { kind: 'restaurant'; restaurant: SearchResultRestaurant };

const GREEN = '#00B14F';
const GREEN_DARK = '#0A7A3C';
const INK = '#1B1F1D';
const MUTED = '#6B7671';

const km = (d?: number | null) =>
  d != null && Number.isFinite(Number(d)) ? `${Number(d).toFixed(1)} km` : null;

const VegDot: React.FC<{ pref?: string | null }> = ({ pref }) => {
  if (!pref) return null;
  const veg = /veg/i.test(pref) && !/non/i.test(pref);
  const color = veg ? '#0F8A3B' : '#C62828';
  return (
    <View style={[styles.vegBox, { borderColor: color }]}>
      <View style={[styles.vegDot, { backgroundColor: color }]} />
    </View>
  );
};

/**
 * Full search results, grouped. A dish search ("chicken biryani") lists the
 * dishes first, then the restaurants serving them; a restaurant search
 * ("KPS hotel") leads with the restaurant, then its dishes.
 */
export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  query,
  lat,
  lng,
  vegMode,
  onOpenRestaurant,
}) => {
  const [data, setData] = React.useState<SearchResultsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await searchService.getSearchResults(query, lat, lng, vegMode));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [query, lat, lng, vegMode]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centre}>
        <BrandedLoader fullScreen={false} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centre}>
        <MaterialIcons name="wifi-off" size={40} color="rgba(0,0,0,0.25)" />
        <Text style={styles.emptyTitle}>Search didn't load</Text>
        <TouchableOpacity style={styles.retry} onPress={load} testID="search-results-retry">
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const label = data.cleaned_query || query;
  const dishRows: Row[] = data.dishes.map(d => ({ kind: 'dish', dish: d }));
  const restRows: Row[] = data.restaurants.map(r => ({ kind: 'restaurant', restaurant: r }));

  const dishSection = {
    key: 'dishes',
    title:
      data.intent === 'restaurant' && data.restaurants[0]
        ? `Dishes`
        : `Dishes for “${label}”`,
    data: dishRows,
  };
  const restSection = {
    key: 'restaurants',
    title: data.intent === 'restaurant' ? 'Restaurants' : `Restaurants serving “${label}”`,
    data: restRows,
  };
  const sections = (data.intent === 'restaurant'
    ? [restSection, dishSection]
    : [dishSection, restSection]
  ).filter(s => s.data.length > 0);

  if (!sections.length) {
    return (
      <View style={styles.centre}>
        <MaterialIcons name="search-off" size={48} color="rgba(0,0,0,0.2)" />
        <Text style={styles.emptyTitle}>Nothing found for “{label}”</Text>
        <Text style={styles.emptySub}>Try a dish like “biryani” or a restaurant name.</Text>
      </View>
    );
  }

  const renderDish = (d: SearchResultDish) => {
    const meta = [d.store_name, km(d.distance), d.delivery_time].filter(Boolean).join(' • ');
    const closed = d.is_open === false;
    return (
      <TouchableOpacity
        style={[styles.row, closed && styles.rowClosed]}
        activeOpacity={0.85}
        onPress={() => d.store_id && onOpenRestaurant(d.store_id, d.store_name || '')}
        testID={`search-dish-${d.id}`}
      >
        <View style={styles.thumb}>
          {d.image_url ? (
            <OptimizedImage
              source={d.image_url}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              shimmerWidth={84}
              shimmerHeight={84}
              cachePolicy="memory-disk"
            />
          ) : (
            <MaterialIcons name="restaurant-menu" size={28} color="#B9C4BE" />
          )}
        </View>
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <VegDot pref={d.dietary_preference} />
            <Text style={styles.name} numberOfLines={2}>
              {d.name}
            </Text>
          </View>
          {!!meta && (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          )}
          <View style={styles.footRow}>
            <Text style={styles.price}>
              {d.base_price ? `₹${Math.round(Number(d.base_price))}` : ''}
            </Text>
            {closed ? (
              <Text style={styles.closedTag}>Closed now</Text>
            ) : (
              <View style={styles.viewPill}>
                <Text style={styles.viewPillText}>View</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRestaurant = (r: SearchResultRestaurant) => {
    const meta = [r.delivery_time, km(r.distance)].filter(Boolean).join(' • ');
    const closed = r.is_open === false;
    return (
      <TouchableOpacity
        style={[styles.row, closed && styles.rowClosed]}
        activeOpacity={0.85}
        onPress={() => onOpenRestaurant(r.id, r.name)}
        testID={`search-restaurant-${r.id}`}
      >
        <View style={[styles.thumb, styles.thumbRound]}>
          {r.logo_url ? (
            <OptimizedImage
              source={r.logo_url}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              shimmerWidth={84}
              shimmerHeight={84}
              cachePolicy="memory-disk"
            />
          ) : (
            <MaterialIcons name="storefront" size={28} color="#B9C4BE" />
          )}
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {r.name}
          </Text>
          <View style={styles.ratingRow}>
            {!!r.rating && (
              <View style={styles.ratingPill}>
                <MaterialIcons name="star" size={12} color="#FFFFFF" />
                <Text style={styles.ratingText}>{Number(r.rating).toFixed(1)}</Text>
              </View>
            )}
            {!!meta && <Text style={styles.meta}>{meta}</Text>}
          </View>
          {!!r.cuisine_tags && (
            <Text style={styles.meta} numberOfLines={1}>
              {r.cuisine_tags}
            </Text>
          )}
          {closed && <Text style={styles.closedTag}>Closed now</Text>}
        </View>
        <MaterialIcons name="chevron-right" size={22} color="#9AA5A0" />
      </TouchableOpacity>
    );
  };

  return (
    <SectionList
      sections={sections}
      keyExtractor={(row, i) =>
        row.kind === 'dish' ? `d-${row.dish.id}-${i}` : `r-${row.restaurant.id}-${i}`
      }
      renderItem={({ item }) =>
        item.kind === 'dish' ? renderDish(item.dish) : renderRestaurant(item.restaurant)
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>
          {section.title}{' '}
          <Text style={styles.sectionCount}>({section.data.length})</Text>
        </Text>
      )}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID="search-results-view"
    />
  );
};

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.1,
    color: INK,
    marginTop: 18,
    marginBottom: 8,
  },
  sectionCount: { fontWeight: '500', color: MUTED, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1EF',
  },
  rowClosed: { opacity: 0.55 },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EEF2F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRound: { borderRadius: 42 },
  body: { flex: 1, marginLeft: 12, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start' },
  name: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: INK,
  },
  meta: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    letterSpacing: 0.1,
    color: MUTED,
    marginTop: 2,
  },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  price: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.1,
    color: INK,
  },
  viewPill: {
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 3,
  },
  viewPillText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.3,
    color: GREEN_DARK,
  },
  closedTag: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#C62828',
    marginTop: 2,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: GREEN,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  ratingText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#FFFFFF',
  },
  vegBox: {
    width: 13,
    height: 13,
    borderWidth: 1.2,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginTop: 4,
  },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  emptyTitle: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.1,
    color: INK,
    marginTop: 12,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    letterSpacing: 0.1,
    color: MUTED,
    marginTop: 4,
    textAlign: 'center',
  },
  retry: {
    marginTop: 14,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  retryText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
});
