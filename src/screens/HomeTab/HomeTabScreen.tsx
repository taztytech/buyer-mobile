import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { OptimizedImage } from '@/components/OptimizedImage';
import { RestaurantCard } from '@/components/RestaurantCard';
import { BrandedLoader } from '@/components/BrandedLoader';
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
const SIDE = 16;

interface HomeTabScreenProps {
  tab: HomeTabSummary;
  latitude?: number;
  longitude?: number;
  onBack: () => void;
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

export const HomeTabScreen: React.FC<HomeTabScreenProps> = ({
  tab,
  latitude,
  longitude,
  onBack,
  onOpenRestaurant,
  isGuest,
  onNavigateToLogin,
}) => {
  const { width } = useWindowDimensions();
  const [listing, setListing] = React.useState<HomeTabListing | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      setListing(await homeTabService.getListing(tab.id, latitude, longitude));
    } catch (e: any) {
      setError("We couldn't load this list. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab.id, latitude, longitude]);

  React.useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const restaurants = listing?.restaurants ?? [];
  const dishes = listing?.dishes ?? [];
  const dishW = (width - SIDE * 2 - 12) / 2;
  const imageUrl = listing?.tab?.image_url ?? tab.image_url;

  const openDish = (d: HomeTabDish) => {
    if (d.store_id) onOpenRestaurant(d.store_id, d.store_name || '');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="home-tab-screen">
      <StatusBar barStyle="light-content" backgroundColor={GREEN} translucent={false} />

      <LinearGradient colors={[GREEN, '#01A148']} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="home-tab-back"
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {tab.title}
          </Text>
          {!loading && !error && (
            <Text style={styles.headerSub}>
              {restaurants.length} restaurants · {dishes.length} dishes
            </Text>
          )}
        </View>
        {!!imageUrl && (
          <OptimizedImage
            source={imageUrl}
            style={styles.headerImage}
            contentFit="contain"
            showShimmer={false}
            cachePolicy="memory-disk"
          />
        )}
      </LinearGradient>

      {loading ? (
        <View style={styles.sheet}>
          <BrandedLoader />
        </View>
      ) : (
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              colors={[GREEN]}
              tintColor={GREEN}
            />
          }
        >
          {error ? (
            <View style={styles.empty}>
              <MaterialIcons name="wifi-off" size={36} color="#9AA5A0" />
              <Text style={styles.emptyText}>{error}</Text>
              <TouchableOpacity
                style={styles.retry}
                onPress={() => {
                  setLoading(true);
                  load();
                }}
                testID="home-tab-retry"
              >
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : restaurants.length === 0 && dishes.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="restaurant" size={36} color="#9AA5A0" />
              <Text style={styles.emptyText}>
                Nothing here yet. Check back soon for {tab.title.toLowerCase()} near you.
              </Text>
            </View>
          ) : null}

          {dishes.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Dishes</Text>
              <View style={styles.dishGrid}>
                {dishes.map(d => (
                  <TouchableOpacity
                    key={`d-${d.id}`}
                    activeOpacity={0.88}
                    style={[styles.dishCard, { width: dishW }]}
                    onPress={() => openDish(d)}
                    testID={`home-tab-dish-${d.id}`}
                  >
                    <View style={[styles.dishImageWrap, { height: dishW * 0.78 }]}>
                      {d.image_url ? (
                        <OptimizedImage
                          source={d.image_url}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          shimmerWidth={dishW}
                          shimmerHeight={dishW * 0.78}
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <MaterialIcons name="restaurant-menu" size={30} color="#B9C4BE" />
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
                        <Text style={styles.dishName} numberOfLines={2}>
                          {d.name}
                        </Text>
                      </View>
                      {!!d.store_name && (
                        <Text style={styles.dishStore} numberOfLines={1}>
                          {d.store_name}
                        </Text>
                      )}
                      <View style={styles.dishFoot}>
                        <Text style={styles.dishPrice}>
                          {d.base_price ? `₹${Math.round(Number(d.base_price))}` : ''}
                        </Text>
                        <View style={styles.viewPill}>
                          <Text style={styles.viewPillText}>View</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
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
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GREEN },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 22,
    minHeight: 96,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, marginLeft: 4 },
  headerTitle: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  headerSub: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  headerImage: { width: 84, height: 72 },
  sheet: {
    flex: 1,
    backgroundColor: '#F6F8F7',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginTop: -14,
    overflow: 'hidden',
  },
  content: { paddingHorizontal: SIDE, paddingTop: 18, paddingBottom: 40 },
  sectionTitle: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.1,
    color: '#1B1F1D',
    marginBottom: 10,
    marginTop: 6,
  },
  dishGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dishCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#0B3D22',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  dishImageWrap: {
    width: '100%',
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
  dishBody: { padding: 10 },
  dishNameRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dishName: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.1,
    color: '#1B1F1D',
  },
  dishStore: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#6B7671',
    marginTop: 2,
  },
  dishFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dishPrice: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#1B1F1D',
  },
  viewPill: {
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  viewPillText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.3,
    color: GREEN_DARK,
  },
  vegBox: {
    width: 12,
    height: 12,
    borderWidth: 1.2,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
    marginTop: 3,
  },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  restaurantWrap: { marginBottom: 12 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
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
