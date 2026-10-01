import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { OptimizedImage } from '@/components/OptimizedImage';
import { RestaurantCard } from '@/components/RestaurantCard';
import type { Restaurant } from '@/services/home.service';
import {
  homeTabService,
  HomeTabDish,
  HomeTabListing,
  HomeTabRestaurant,
  HomeTabSummary,
} from '@/services/homeTab.service';

const GREEN = '#00B14F';
const GREEN_DARK = '#0A7A3C';
const DISH_W = 148;

interface HomeTabContentProps {
  tab: HomeTabSummary;
  latitude?: number;
  longitude?: number;
  onOpenRestaurant: (restaurantId: number, name: string) => void;
  isGuest?: boolean;
  onNavigateToLogin?: () => void;
}

const toRestaurant = (r: HomeTabRestaurant): Restaurant => ({
  id: r.id,
  name: r.name,
  cuisine: r.cuisine_tags || '',
  rating: Number(r.rating || 0),
  reviewCount: Number(r.total_reviews || 0),
  deliveryTime: r.delivery_time || '25-30 mins',
  location: r.location || '',
  distance:
    r.distance != null && Number.isFinite(Number(r.distance))
      ? `${(Math.floor(Number(r.distance) * 100) / 100).toFixed(2)}Kms`
      : '0Kms',
  image: r.logo_url || '',
  isVeg: r.food_type === 'veg' || r.food_type === 'pure-veg',
  timings: r.timings as any,
  isOpen: r.is_open,
});

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
 * What a selected top-dash tab shows on Home in place of the Food feed:
 * its dishes as a horizontal row, then its restaurants. Tabs and search stay
 * above, so switching back to Food is one tap.
 */
export const HomeTabContent: React.FC<HomeTabContentProps> = ({
  tab,
  latitude,
  longitude,
  onOpenRestaurant,
  isGuest,
  onNavigateToLogin,
}) => {
  const [listing, setListing] = React.useState<HomeTabListing | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setListing(await homeTabService.getListing(tab.id, latitude, longitude));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tab.id, latitude, longitude]);

  React.useEffect(() => {
    setListing(null);
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centre} testID="home-tab-loading">
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centre}>
        <MaterialIcons name="wifi-off" size={34} color="#9AA5A0" />
        <Text style={styles.emptyText}>We couldn't load {tab.title}.</Text>
        <TouchableOpacity style={styles.retry} onPress={load} testID="home-tab-retry">
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const restaurants = listing?.restaurants ?? [];
  const dishes = listing?.dishes ?? [];

  if (!restaurants.length && !dishes.length) {
    return (
      <View style={styles.centre}>
        <MaterialIcons name="restaurant" size={34} color="#9AA5A0" />
        <Text style={styles.emptyText}>
          Nothing in {tab.title} yet. Check back soon.
        </Text>
      </View>
    );
  }

  const openDish = (d: HomeTabDish) => {
    if (d.store_id) onOpenRestaurant(d.store_id, d.store_name || '');
  };

  return (
    <View style={styles.wrap} testID={`home-tab-content-${tab.id}`}>
      {dishes.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Dishes</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dishRow}
          >
            {dishes.map(d => (
              <TouchableOpacity
                key={`d-${d.id}`}
                activeOpacity={0.88}
                style={styles.dishCard}
                onPress={() => openDish(d)}
                testID={`home-tab-dish-${d.id}`}
              >
                <View style={styles.dishImageWrap}>
                  {d.image_url ? (
                    <OptimizedImage
                      source={d.image_url}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      shimmerWidth={DISH_W}
                      shimmerHeight={DISH_W * 0.72}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <MaterialIcons name="restaurant-menu" size={28} color="#B9C4BE" />
                  )}
                  {d.is_available === false && (
                    <View style={styles.soldOut}>
                      <Text style={styles.soldOutText}>Not available now</Text>
                    </View>
                  )}
                </View>
                <View style={styles.dishBody}>
                  <View style={styles.dishNameRow}>
                    <VegDot pref={d.dietary_preference} />
                    <Text style={styles.dishName} numberOfLines={1}>
                      {d.name}
                    </Text>
                  </View>
                  {!!d.store_name && (
                    <Text style={styles.dishStore} numberOfLines={1}>
                      {d.store_name}
                    </Text>
                  )}
                  {!!d.base_price && (
                    <Text style={styles.dishPrice}>₹{Math.round(Number(d.base_price))}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {restaurants.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Restaurants</Text>
          {restaurants.map(r => (
            <View key={`r-${r.id}`} style={styles.restaurantWrap}>
              <RestaurantCard
                restaurant={toRestaurant(r)}
                layoutMode={4}
                onPress={() => onOpenRestaurant(r.id, r.name)}
                isGuest={isGuest}
                onNavigateToLogin={onNavigateToLogin}
              />
            </View>
          ))}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingTop: 6, paddingBottom: 24 },
  centre: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.1,
    color: '#1B1F1D',
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 10,
  },
  dishRow: { paddingHorizontal: 20, paddingBottom: 4 },
  dishCard: {
    width: DISH_W,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#0B3D22',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    marginBottom: 6,
  },
  dishImageWrap: {
    width: '100%',
    height: DISH_W * 0.72,
    backgroundColor: '#EEF2F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOut: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#5B6661',
  },
  dishBody: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 },
  dishNameRow: { flexDirection: 'row', alignItems: 'center' },
  dishName: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#1B1F1D',
  },
  dishStore: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#6B7671',
    marginTop: 1,
  },
  dishPrice: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.1,
    color: GREEN_DARK,
    marginTop: 4,
  },
  vegBox: {
    width: 12,
    height: 12,
    borderWidth: 1.2,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  restaurantWrap: { marginHorizontal: 20, marginBottom: 12 },
  emptyText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: '#5B6661',
    textAlign: 'center',
    marginTop: 10,
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
