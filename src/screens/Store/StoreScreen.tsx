import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
// react-native's own SafeAreaView does nothing on Android, which is why the
// header was sitting on top of the clock and the battery icon.
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { OptimizedImage } from '@/components/OptimizedImage';
import { VoiceSearchOverlay } from '@/components/home/VoiceSearchOverlay';
import { favoritesService } from '@/services/favorites.service';
import { ViewCartBar } from '@/components/ViewCartBar';
import { useCart } from '@/context/CartContext';
import { useConfirmation } from '@/context/ConfirmationContext';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import { useStoreDealAdd } from '@/hooks/useStoreDealAdd';
import storeDealService, {
  isDealOrderable,
  StoreDeal,
  StoreDealSection,
  DEFAULT_STORE_DEAL_SECTION,
} from '@/services/storeDeal.service';

const ORANGE = '#F7562A';

interface StoreScreenProps {
  onBack: () => void;
  /** A deal is counted per customer, so a guest is sent to sign in first. */
  onRequireLogin: () => void;
  onNavigateToCheckout: () => void;
  /** Tap a deal card → open its store. */
  onOpenStore?: (storeId: number, name: string) => void;
  latitude?: number;
  longitude?: number;
}

/**
 * The ₹99 Store page.
 *
 * Prices are Tazty-funded: the customer pays the deal price and the restaurant
 * is paid its full menu price, which is the number shown struck through. Every
 * card's state (sold out, limit reached, closing soon, unavailable) is decided
 * by the server, so this screen never computes availability itself.
 */
export const StoreScreen: React.FC<StoreScreenProps> = ({
  onBack,
  onRequireLogin,
  onOpenStore,
  onNavigateToCheckout,
  latitude,
  longitude,
}) => {
  const [deals, setDeals] = React.useState<StoreDeal[]>([]);
  const [section, setSection] = React.useState<StoreDealSection>(
    DEFAULT_STORE_DEAL_SECTION,
  );
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const { reloadCart, setRestaurantInfo, getTotalItems } = useCart();
  const { showConfirmation } = useConfirmation();
  const { add, addingDealId } = useStoreDealAdd();
  const { hidden: cartBarHidden, onScroll: hideCartBarOnScroll } = useHideOnScroll(getTotalItems());

  const load = React.useCallback(async () => {
    const [list, sec] = await Promise.all([
      storeDealService.getDeals(latitude, longitude),
      storeDealService.getSection(),
    ]);
    setDeals(list);
    setSection(sec);
  }, [latitude, longitude]);

  React.useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAdd = React.useCallback(
    async (deal: StoreDeal, forceClearCart = false) => {
      const outcome = await add(deal, { forceClearCart });

      switch (outcome.status) {
        case 'needs_login':
          onRequireLogin();
          return;

        case 'needs_cart_clear':
          showConfirmation({
            title: 'Start a new cart?',
            message:
              '₹99 Store deals are ordered on their own. Your current cart will be cleared.',
            confirmText: 'Clear and add',
            cancelText: 'Keep my cart',
            confirmButtonColor: ORANGE,
            onConfirm: () => {
              handleAdd(deal, true);
            },
          });
          return;

        case 'unavailable':
          // The server's message is the accurate one (sold out for today,
          // limit reached, restaurant closed), so it is shown as it came.
          showConfirmation({
            title: '₹99 Store',
            message: outcome.message,
            confirmText: 'OK',
            cancelText: '',
            confirmButtonColor: ORANGE,
            onConfirm: () => { },
          });
          // Whatever it was, the card state has moved on.
          load();
          return;

        case 'in_cart':
          setRestaurantInfo(deal.restaurant_id, deal.restaurant?.name || '');
          await reloadCart();
          load();
          return;
      }
    },
    [add, load, onRequireLogin, reloadCart, setRestaurantInfo, showConfirmation],
  );

  // ---- search, quick filters, favourites -------------------------------
  const [query, setQuery] = React.useState('');
  const [chip, setChip] = React.useState<ChipKey>('all');
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const [favs, setFavs] = React.useState<Set<number>>(new Set());
  const { width } = useWindowDimensions();
  const cardW = (width - 12 * 2 - 12) / 2;

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter(d => {
      if (q && !`${d.name} ${d.restaurant?.name ?? ''}`.toLowerCase().includes(q)) return false;
      switch (chip) {
        case 'half':
          return Number(d.discount_percent || 0) >= 50;
        case 'under99':
          return Number(d.deal_price) <= 99;
        case 'ending':
          return d.state === 'closing_soon' || (d.minutes_to_close != null && d.minutes_to_close <= 60);
        case 'veg':
          return isVegPref(d.dietary_preference);
        default:
          return true;
      }
    });
  }, [deals, query, chip]);

  const toggleFav = (d: StoreDeal) => {
    setFavs(prev => {
      const next = new Set(prev);
      if (next.has(d.id)) next.delete(d.id);
      else next.add(d.id);
      return next;
    });
    favoritesService.toggleFavoriteItem(d.item_id).catch(() => undefined);
  };

  const renderDeal = ({ item: d }: { item: StoreDeal }) => {
    const orderable = isDealOrderable(d);
    const off = Math.round(Number(d.discount_percent || 0));
    const stateLabel = STATE_LABEL[d.state as string];
    const adding = addingDealId === d.id;
    const closing =
      d.state === 'closing_soon' && d.minutes_to_close != null
        ? `Ends in ${d.minutes_to_close} min`
        : null;
    const away = d.distance_km != null ? `${Number(d.distance_km).toFixed(1)} km` : null;
    const pill = closing || away;

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        style={[styles.card, { width: cardW }]}
        onPress={() => onOpenStore?.(d.restaurant_id, d.restaurant?.name ?? '')}
        testID={`store-deal-${d.id}`}
      >
        <View style={[styles.imgWrap, { height: cardW * 0.82 }]}>
          {d.image_url ? (
            <OptimizedImage
              source={d.image_url}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              shimmerWidth={cardW}
              shimmerHeight={cardW * 0.82}
              cachePolicy="memory-disk"
            />
          ) : (
            <MaterialIcons name="restaurant" size={32} color="#E2C2AE" />
          )}
          {!orderable && <View style={styles.imgDim} />}
          {(stateLabel || off > 0) && (
            <View style={[styles.offBadge, stateLabel && styles.offBadgeMuted]}>
              <Text style={styles.offBadgeText}>{stateLabel || `${off}% OFF`}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.heart}
            onPress={() => toggleFav(d)}
            hitSlop={8}
            accessibilityLabel="Save to favourites"
            testID={`store-deal-fav-${d.id}`}
          >
            <MaterialIcons
              name={favs.has(d.id) ? 'favorite' : 'favorite-border'}
              size={18}
              color={favs.has(d.id) ? RED : '#3D3D3D'}
            />
          </TouchableOpacity>
          {!!pill && (
            <View style={styles.timePill}>
              <Text style={styles.timePillText}>{pill}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.dealName} numberOfLines={1}>
            {d.name}
          </Text>
          {!!d.restaurant?.name && (
            <Text style={styles.storeName} numberOfLines={1}>
              {d.restaurant.name}
            </Text>
          )}
          <View style={styles.bottomRow}>
            <View style={styles.prices}>
              {Number(d.menu_price) > Number(d.deal_price) && (
                <Text style={styles.mrp}>₹{Math.round(Number(d.menu_price))}</Text>
              )}
              <Text style={styles.dealPrice}>₹{Math.round(Number(d.deal_price))}</Text>
            </View>
            <TouchableOpacity
              style={[styles.addBtn, !orderable && styles.addBtnOff]}
              disabled={!orderable || adding}
              onPress={() => handleAdd(d)}
              testID={`store-deal-add-${d.id}`}
            >
              {adding ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.addText}>{orderable ? 'Add +' : 'Off'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="store-screen">
      <StatusBar barStyle="light-content" backgroundColor={ORANGE} translucent={false} />

      <LinearGradient
        colors={['#F7562A', '#FF7A2F', '#FF9A3D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        {/* Offer-tag accent, top right. */}
        <View style={styles.tagDeco} pointerEvents="none">
          <Text style={styles.tagDecoText}>%</Text>
        </View>

        <View style={styles.titleRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="store-screen-back"
          >
            <MaterialIcons name="arrow-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.pctBadge}>
            <Text style={styles.pctBadgeText}>%</Text>
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {section.name}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {section.tagline}
            </Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={22} color="#6B6B6B" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={`Search in ${section.name}...`}
            placeholderTextColor="#9A9A9A"
            returnKeyType="search"
            testID="store-search-input"
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} testID="store-search-clear">
              <MaterialIcons name="close" size={20} color="#9A9A9A" />
            </TouchableOpacity>
          )}
          <View style={styles.searchDivider} />
          <TouchableOpacity
            onPress={() => setVoiceOpen(true)}
            hitSlop={8}
            accessibilityLabel="Search by voice"
            testID="store-voice-search"
          >
            <MaterialIcons name="mic" size={22} color={RED} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CHIPS.map(c => {
            const on = chip === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => setChip(c.key)}
                style={[styles.chip, on && styles.chipOn]}
                testID={`store-chip-${c.key}`}
              >
                {c.icon && (
                  <MaterialIcons name={c.icon as any} size={14} color={on ? '#FFFFFF' : RED} />
                )}
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={[styles.sheet, styles.centre]}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={deal => String(deal.id)}
          numColumns={2}
          columnWrapperStyle={styles.column}
          style={styles.sheet}
          contentContainerStyle={styles.listContent}
          onScroll={e => hideCartBarOnScroll(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          extraData={{ favs, addingDealId }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />
          }
          renderItem={renderDeal}
          ListEmptyComponent={
            <View style={styles.centre}>
              <Text style={styles.emptyTitle}>
                {deals.length ? 'No deals match' : 'No deals right now'}
              </Text>
              <Text style={styles.emptyText}>
                {deals.length
                  ? 'Try another filter or clear the search.'
                  : 'New deals are added through the day. Do check back.'}
              </Text>
            </View>
          }
        />
      )}

      <ViewCartBar hidden={cartBarHidden} onPress={onNavigateToCheckout} />
      <VoiceSearchOverlay
        visible={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onResult={text => {
          setVoiceOpen(false);
          setQuery(text);
        }}
      />
    </SafeAreaView>
  );
};

type ChipKey = 'all' | 'half' | 'under99' | 'ending' | 'veg';

const CHIPS: Array<{ key: ChipKey; label: string; icon?: string }> = [
  { key: 'all', label: 'All' },
  { key: 'half', label: '50%+ OFF' },
  { key: 'under99', label: 'Under ₹99' },
  { key: 'ending', label: 'Ending Soon', icon: 'schedule' },
  { key: 'veg', label: 'Pure Veg', icon: 'eco' },
];

const STATE_LABEL: Record<string, string> = {
  sold_out: 'SOLD OUT',
  limit_reached: 'LIMIT REACHED',
  unavailable: 'CLOSED',
};

const isVegPref = (pref?: string | null) => !!pref && /veg/i.test(pref) && !/non/i.test(pref);

const RED = '#EF3B24';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ORANGE },
  header: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  tagDeco: {
    position: 'absolute',
    top: -6,
    right: 18,
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#E5322D',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '16deg' }],
    elevation: 4,
  },
  tagDecoText: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 26,
    letterSpacing: 0,
    color: '#FFD3C2',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 70 },
  backButton: { padding: 4 },
  pctBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFC9A8',
  },
  pctBadgeText: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0,
    color: RED,
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  headerTitle: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    letterSpacing: 0.1,
    color: 'rgba(255, 255, 255, 0.95)',
  },
  searchBar: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
    elevation: 3,
    shadowColor: '#7A2A00',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#1A1A1A',
    paddingVertical: 0,
  },
  searchDivider: { width: 1, height: 24, backgroundColor: '#E5E5E5' },
  chipsWrap: { backgroundColor: '#FFF8F3' },
  chips: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1DCD0',
  },
  chipOn: { backgroundColor: RED, borderColor: RED },
  chipText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 12.5,
    letterSpacing: 0.1,
    color: '#2A2A2A',
  },
  chipTextOn: { color: '#FFFFFF' },
  sheet: { flex: 1, backgroundColor: '#FFF8F3' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  listContent: { paddingHorizontal: 12, paddingTop: 2, paddingBottom: 140 },
  column: { gap: 12, marginBottom: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    elevation: 2,
    shadowColor: '#7A2A00',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  imgWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFF1E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.5)' },
  offBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: RED,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  offBadgeMuted: { backgroundColor: '#5B5B5B' },
  offBadgeText: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  timePill: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  timePillText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 10.5,
    letterSpacing: 0.1,
    color: '#2A2A2A',
  },
  cardBody: { paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 },
  dealName: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0,
    color: '#1A1A1A',
  },
  storeName: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#6F6F6F',
    marginTop: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  prices: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  mrp: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    letterSpacing: 0,
    color: '#8E8E8E',
    textDecorationLine: 'line-through',
  },
  dealPrice: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0,
    color: RED,
  },
  addBtn: {
    minWidth: 62,
    height: 32,
    borderRadius: 9,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  addBtnOff: { backgroundColor: '#C9C9C9' },
  addText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  emptyTitle: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0,
    color: '#1A1A1A',
  },
  emptyText: {
    marginTop: 4,
    paddingHorizontal: 32,
    textAlign: 'center',
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#8A8A8A',
  },
});
