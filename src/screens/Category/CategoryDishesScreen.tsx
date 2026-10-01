import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { OptimizedImage } from '@/components/OptimizedImage';
import { RestaurantCard } from '@/components/RestaurantCard';
import { BrandedLoader } from '@/components/BrandedLoader';
import { ViewCartBar } from '@/components/ViewCartBar';
import { useCart } from '@/context/CartContext';
import { useVegMode } from '@/context/VegModeContext';
import { useConfirmation } from '@/context/ConfirmationContext';
import { favoritesService } from '@/services/favorites.service';
import {
  searchService,
  CategoryDish,
  SearchResultRestaurant,
} from '@/services/search.service';
import type { Restaurant } from '@/services/home.service';

export interface CategoryChip {
  id: number | string;
  name: string;
  icon?: any;
}

interface CategoryDishesScreenProps {
  categoryName: string;
  categories?: CategoryChip[];
  selectedLocation?: { latitude?: number; longitude?: number };
  onBack: () => void;
  onNavigateToRestaurant: (restaurantId: number, name: string) => void;
  onNavigateToCheckout?: () => void;
  isGuest?: boolean;
  onNavigateToLogin?: () => void;
}

const GREEN = '#00B14F';
const GREEN_DARK = '#0A7A3C';
const INK = '#1B1F1D';
const MUTED = '#6B7671';
const CARD_W = 156;
const IMG_H = 136;

const toRestaurant = (r: SearchResultRestaurant): Restaurant => ({
  id: r.id,
  name: r.name,
  cuisine: r.cuisine_tags || '',
  rating: Number(r.rating || 0),
  reviewCount: Number(r.total_reviews || 0),
  deliveryTime: r.delivery_time || '25-30 mins',
  location: (r.location as any) || '',
  distance:
    r.distance != null && Number.isFinite(Number(r.distance))
      ? `${(Math.floor(Number(r.distance) * 100) / 100).toFixed(2)}Kms`
      : '0Kms',
  image: r.logo_url || '',
  isOpen: r.is_open,
});

const isVegPref = (pref?: string | null) => !!pref && /veg/i.test(pref) && !/non/i.test(pref);

const VegMark: React.FC<{ pref?: string | null }> = ({ pref }) => {
  if (!pref) return null;
  const color = isVegPref(pref) ? '#0F8A3B' : '#C62828';
  return (
    <View style={[styles.vegBox, { borderColor: color }]}>
      <View style={[styles.vegDot, { backgroundColor: color }]} />
    </View>
  );
};

/**
 * "What's on your mind?" category page, Instamart-style: a category rail on
 * top (switches in place), the category's dishes as a horizontal row of
 * product cards with ADD, then the restaurants serving them.
 */
interface CategoryResultsBodyProps {
  /** Category id from the home row; a plain name (from search) uses search. */
  categoryId?: number | string;
  categoryName: string;
  latitude?: number;
  longitude?: number;
  onNavigateToRestaurant: (restaurantId: number, name: string) => void;
  isGuest?: boolean;
  onNavigateToLogin?: () => void;
}

/**
 * A category's dishes (horizontal product cards with ADD) and the
 * restaurants serving them. Used inline on Home and by the category screen.
 */
export const CategoryResultsBody: React.FC<CategoryResultsBodyProps> = ({
  categoryId,
  categoryName,
  latitude,
  longitude,
  onNavigateToRestaurant,
  isGuest,
  onNavigateToLogin,
}) => {
  const { vegMode } = useVegMode();
  const { showConfirmation } = useConfirmation();
  const {
    cart,
    addToCart,
    updateQuantity,
    clearCart,
    setRestaurantInfo,
    restaurantId: cartRestaurantId,
  } = useCart();

  const [dishes, setDishes] = React.useState<CategoryDish[]>([]);
  const [restaurants, setRestaurants] = React.useState<SearchResultRestaurant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [favs, setFavs] = React.useState<Set<number>>(new Set());
  const selectedName = categoryName;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (typeof categoryId === 'number') {
        const res = await searchService.getCategoryResults(categoryId, latitude, longitude, vegMode);
        setDishes(res.dishes);
        setRestaurants(res.restaurants);
      } else {
        // Reached from search with a dish name that is not a category.
        const res = await searchService.getSearchResults(categoryName, latitude, longitude, vegMode);
        setDishes(res.dishes as CategoryDish[]);
        setRestaurants(res.restaurants);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [categoryId, categoryName, latitude, longitude, vegMode]);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggleFav = async (d: CategoryDish) => {
    if (isGuest) {
      onNavigateToLogin?.();
      return;
    }
    setFavs(prev => {
      const next = new Set(prev);
      if (next.has(d.id)) next.delete(d.id);
      else next.add(d.id);
      return next;
    });
    favoritesService.toggleFavoriteItem(d.id).catch(() => undefined);
  };

  const doAdd = (d: CategoryDish, price: number) => {
    const sid = Number(d.store_id);
    setRestaurantInfo(sid, d.store_name || 'Restaurant');
    addToCart(
      {
        id: String(d.id),
        itemId: Number(d.id),
        name: d.name,
        price,
        quantity: 1,
        isVeg: isVegPref(d.dietary_preference),
        image: d.image_url,
        isCustomizable: false,
      },
      sid,
    ).catch(() => undefined);
  };

  const onAdd = (d: CategoryDish) => {
    if (!d.store_id) return;
    if (d.has_options) {
      // Add-ons / variants are chosen on the menu.
      onNavigateToRestaurant(Number(d.store_id), d.store_name || '');
      return;
    }
    if (isGuest) {
      onNavigateToLogin?.();
      return;
    }
    const price = Number(d.price?.base_price ?? d.base_price ?? 0);
    const sid = Number(d.store_id);
    const conflict = Object.keys(cart).length > 0 && (cartRestaurantId === null || cartRestaurantId !== sid);
    if (conflict) {
      showConfirmation({
        title: 'Replace cart item?',
        message:
          'Your cart contains dishes from another restaurant. Do you want to discard the selection and add dishes from this restaurant?',
        confirmText: 'Replace',
        cancelText: 'Cancel',
        confirmButtonColor: '#FF0000',
        onConfirm: async () => {
          await clearCart();
          doAdd(d, price);
        },
      });
      return;
    }
    doAdd(d, price);
  };

  const renderDish = ({ item: d }: { item: CategoryDish }) => {
    const base = Number(d.price?.base_price ?? d.base_price ?? 0);
    const mrp = Number(d.price?.maximum_price ?? 0);
    const discount = mrp > base && base > 0 ? Math.round(((mrp - base) / mrp) * 100) : 0;
    const qty = d.quantity;
    const portion =
      qty && qty.unit_type && qty.unit_type !== 'unit' && qty.unit_value
        ? `${qty.unit_value} ${qty.unit_type}`
        : null;
    const left = qty && qty.available_count > 0 && qty.available_count <= 5 ? qty.available_count : 0;
    const imgs = d.images?.length ? d.images : d.image_url ? [d.image_url] : [];
    const inCart = cart[String(d.id)]?.quantity ?? 0;
    const closed = d.is_open === false;

    return (
      <View style={[styles.card, closed && styles.cardClosed]} testID={`category-dish-${d.id}`}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => d.store_id && onNavigateToRestaurant(Number(d.store_id), d.store_name || '')}
        >
          <View style={styles.imgWrap}>
            {imgs[0] ? (
              <OptimizedImage
                source={imgs[0]}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                shimmerWidth={CARD_W}
                shimmerHeight={IMG_H}
                cachePolicy="memory-disk"
              />
            ) : (
              <MaterialIcons name="restaurant-menu" size={34} color="#B9C4BE" />
            )}
            <TouchableOpacity style={styles.heart} onPress={() => toggleFav(d)} hitSlop={8} testID={`category-dish-fav-${d.id}`}>
              <MaterialIcons
                name={favs.has(d.id) ? 'favorite' : 'favorite-border'}
                size={20}
                color={favs.has(d.id) ? '#E5484D' : '#5B6661'}
              />
            </TouchableOpacity>
            {imgs.length > 1 && (
              <View style={styles.dots}>
                {imgs.slice(0, 4).map((_, i) => (
                  <View key={i} style={[styles.dot, i === 0 && styles.dotOn]} />
                ))}
              </View>
            )}
            <View style={styles.vegCorner}>
              <VegMark pref={d.dietary_preference} />
            </View>
          </View>
        </TouchableOpacity>

        {/* ADD overlaps the bottom of the image, like the reference. */}
        <View style={styles.addWrap}>
          {inCart > 0 && !d.has_options ? (
            <View style={styles.stepper}>
              <TouchableOpacity onPress={() => updateQuantity(String(d.id), inCart - 1)} hitSlop={6} testID={`category-dish-minus-${d.id}`}>
                <MaterialIcons name="remove" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.stepperText}>{inCart}</Text>
              <TouchableOpacity onPress={() => updateQuantity(String(d.id), inCart + 1)} hitSlop={6} testID={`category-dish-plus-${d.id}`}>
                <MaterialIcons name="add" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addBtn, closed && styles.addBtnOff]}
              disabled={closed}
              onPress={() => onAdd(d)}
              testID={`category-dish-add-${d.id}`}
            >
              <Text style={[styles.addText, closed && styles.addTextOff]}>{closed ? 'CLOSED' : 'ADD'}</Text>
            </TouchableOpacity>
          )}
          {d.has_options && !closed && <Text style={styles.options}>customisable</Text>}
        </View>

        <View style={styles.body}>
          {!!portion && <Text style={styles.portion}>{portion}</Text>}
          <View style={styles.priceRow}>
            <View style={styles.priceChip}>
              <Text style={styles.price}>₹{Math.round(base)}</Text>
            </View>
            {discount > 0 && <Text style={styles.mrp}>₹{Math.round(mrp)}</Text>}
          </View>
          {discount > 0 && <Text style={styles.off}>{discount}% OFF</Text>}
          <Text style={styles.name} numberOfLines={3}>
            {d.name}
          </Text>
          {!!d.store_name && (
            <View style={styles.storeChip}>
              <Text style={styles.storeChipText} numberOfLines={1}>
                {d.store_name}
              </Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <MaterialIcons name="timer" size={13} color={MUTED} />
            <Text style={styles.meta}>{(d.delivery_time || '').replace(' mins', ' mins')}</Text>
            {left > 0 && <Text style={styles.left}>{left} left</Text>}
          </View>
          <TouchableOpacity
            style={styles.moreChip}
            onPress={() => d.store_id && onNavigateToRestaurant(Number(d.store_id), d.store_name || '')}
            testID={`category-dish-more-${d.id}`}
          >
            <Text style={styles.moreText} numberOfLines={1}>
              More from {d.store_name || 'restaurant'}
            </Text>
            <MaterialIcons name="play-arrow" size={12} color={GREEN_DARK} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centre}>
        <BrandedLoader fullScreen={false} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.centre}>
        <MaterialIcons name="wifi-off" size={40} color="rgba(0,0,0,0.25)" />
        <Text style={styles.emptyTitle}>Couldn't load {selectedName}</Text>
        <TouchableOpacity style={styles.retry} onPress={load} testID="category-retry">
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View testID={`category-results-${categoryName}`}>
      {dishes.length > 0 && (
        <>
          <Text style={styles.section}>
            {selectedName} dishes <Text style={styles.count}>({dishes.length})</Text>
          </Text>
          <FlatList
            data={dishes}
            horizontal
            keyExtractor={d => String(d.id)}
            renderItem={renderDish}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dishRow}
            extraData={{ cart, favs }}
          />
        </>
      )}

      {restaurants.length > 0 && (
        <>
          <Text style={styles.section}>
            Restaurants serving {selectedName} <Text style={styles.count}>({restaurants.length})</Text>
          </Text>
          {restaurants.map(r => (
            <View key={r.id} style={styles.restWrap}>
              <RestaurantCard
                restaurant={toRestaurant(r)}
                layoutMode={4}
                onPress={() => onNavigateToRestaurant(r.id, r.name)}
                isGuest={isGuest}
                onNavigateToLogin={onNavigateToLogin}
              />
            </View>
          ))}
        </>
      )}

      {!dishes.length && !restaurants.length && (
        <View style={styles.centre}>
          <MaterialIcons name="restaurant" size={44} color="rgba(0,0,0,0.2)" />
          <Text style={styles.emptyTitle}>Nothing in {selectedName} near you yet</Text>
          <Text style={styles.emptySub}>Try another category.</Text>
        </View>
      )}
    </View>
  );
};

/**
 * Category page (from search / View All): header, category rail that
 * switches in place, then the shared results body and the cart bar.
 */
export const CategoryDishesScreen: React.FC<CategoryDishesScreenProps> = ({
  categoryName,
  categories = [],
  selectedLocation,
  onBack,
  onNavigateToRestaurant,
  onNavigateToCheckout,
  isGuest,
  onNavigateToLogin,
}) => {
  const insets = useSafeAreaInsets();
  const { getTotalItems } = useCart();

  const rail = React.useMemo(
    () => categories.filter(c => c.id !== 'view-all' && c.name !== 'View All'),
    [categories],
  );
  const [selectedName, setSelectedName] = React.useState(categoryName);
  React.useEffect(() => setSelectedName(categoryName), [categoryName]);
  const selected = rail.find(c => c.name.toLowerCase() === selectedName.toLowerCase());

  // Keep the selected category in view on the rail.
  const railRef = React.useRef<ScrollView>(null);
  const railX = React.useRef<Record<string, number>>({});
  React.useEffect(() => {
    const x = railX.current[selectedName.toLowerCase()];
    if (x !== undefined) railRef.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  }, [selectedName, rail.length]);

  const totalItems = getTotalItems();

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="category-dishes-screen">
      <StatusBar barStyle="dark-content" backgroundColor="#E9F8EF" />
      <LinearGradient colors={['#E9F8EF', '#F4FBF6', '#FFFFFF']} style={styles.topBg}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.back} accessibilityLabel="Go back" testID="category-back">
            <MaterialIcons name="arrow-back" size={24} color={INK} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {selectedName}
          </Text>
        </View>

        {rail.length > 0 && (
          <ScrollView
            ref={railRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {rail.map(c => {
              const on = c.name.toLowerCase() === selectedName.toLowerCase();
              const src = typeof c.icon === 'string' ? { uri: c.icon } : c.icon;
              return (
                <TouchableOpacity
                  key={String(c.id)}
                  onLayout={e => {
                    railX.current[c.name.toLowerCase()] = e.nativeEvent.layout.x;
                  }}
                  onPress={() => setSelectedName(c.name)}
                  style={[styles.railItem, on && styles.railItemOn]}
                  activeOpacity={0.8}
                  testID={`category-rail-${c.id}`}
                >
                  <View style={[styles.railCircle, on && styles.railCircleOn]}>
                    {src ? <Image source={src} style={styles.railImg} /> : null}
                  </View>
                  <Text style={[styles.railLabel, on && styles.railLabelOn]} numberOfLines={2}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: (totalItems > 0 ? 110 : 30) + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <CategoryResultsBody
          categoryId={selected?.id}
          categoryName={selectedName}
          latitude={selectedLocation?.latitude}
          longitude={selectedLocation?.longitude}
          onNavigateToRestaurant={onNavigateToRestaurant}
          isGuest={isGuest}
          onNavigateToLogin={onNavigateToLogin}
        />
      </ScrollView>

      {totalItems > 0 && onNavigateToCheckout && <ViewCartBar onPress={onNavigateToCheckout} />}
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topBg: { paddingBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.1,
    color: INK,
  },
  rail: { paddingHorizontal: 10, paddingTop: 2, gap: 4 },
  railItem: {
    width: 78,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  railItemOn: { backgroundColor: '#DDF4E5', borderColor: GREEN },
  railCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  railCircleOn: { borderWidth: 2, borderColor: '#FFFFFF' },
  railImg: { width: 56, height: 56 },
  railLabel: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 11.5,
    lineHeight: 14,
    letterSpacing: 0.1,
    color: INK,
    textAlign: 'center',
    marginTop: 5,
  },
  railLabelOn: { fontWeight: '700', color: GREEN_DARK },
  section: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.1,
    color: INK,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 10,
  },
  count: { fontWeight: '500', color: MUTED, fontSize: 14 },
  dishRow: { paddingHorizontal: 12, gap: 10, paddingBottom: 4 },
  card: {
    width: CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6ECE8',
    overflow: 'visible',
  },
  cardClosed: { opacity: 0.6 },
  imgWrap: {
    width: CARD_W - 2,
    height: IMG_H,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.25)' },
  dotOn: { backgroundColor: '#5B6661', width: 10 },
  vegCorner: {
    position: 'absolute',
    bottom: 26,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    padding: 1,
  },
  addWrap: { alignItems: 'flex-end', marginTop: -18, marginRight: 8, minHeight: 36 },
  addBtn: {
    minWidth: 72,
    height: 34,
    borderRadius: 9,
    borderWidth: 1.2,
    borderColor: GREEN,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0B3D22',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  addBtnOff: { borderColor: '#C9D1CD' },
  addText: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
    color: GREEN_DARK,
  },
  addTextOff: { color: '#9AA5A0', fontSize: 11 },
  stepper: {
    minWidth: 76,
    height: 34,
    borderRadius: 9,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  stepperText: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  options: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 10,
    letterSpacing: 0.1,
    color: MUTED,
    marginTop: 2,
  },
  body: { paddingHorizontal: 9, paddingBottom: 10, paddingTop: 2 },
  portion: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    letterSpacing: 0.1,
    color: MUTED,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  priceChip: { backgroundColor: '#FFE45C', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  price: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.1,
    color: INK,
  },
  mrp: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#8A938F',
    textDecorationLine: 'line-through',
  },
  off: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: '#1F8A4C',
    marginTop: 2,
  },
  name: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 13.5,
    lineHeight: 18,
    letterSpacing: 0.1,
    color: INK,
    marginTop: 4,
  },
  storeChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF6DE',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 5,
    maxWidth: '100%',
  },
  storeChipText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.1,
    color: '#6A5317',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  meta: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: MUTED,
  },
  left: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: '#C2410C',
    marginLeft: 6,
  },
  moreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: '#E8F7EE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 7,
    gap: 2,
  },
  moreText: {
    flexShrink: 1,
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.1,
    color: GREEN_DARK,
  },
  vegBox: {
    width: 13,
    height: 13,
    borderWidth: 1.2,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  restWrap: { marginHorizontal: 16, marginBottom: 12 },
  centre: { alignItems: 'center', justifyContent: 'center', padding: 32, flexGrow: 1 },
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
  },
  retry: { marginTop: 14, backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  retryText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
});

export default CategoryDishesScreen;
