import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// react-native's own SafeAreaView does nothing on Android, which is why the
// header was sitting on top of the clock and the battery icon.
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { StoreDealCard } from '@/components/StoreDealCard';
import { ViewCartBar } from '@/components/ViewCartBar';
import { useCart } from '@/context/CartContext';
import { useConfirmation } from '@/context/ConfirmationContext';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import { useStoreDealAdd } from '@/hooks/useStoreDealAdd';
import storeDealService, {
  StoreDeal,
  StoreDealSection,
  DEFAULT_STORE_DEAL_SECTION,
} from '@/services/storeDeal.service';

const ORANGE = '#E8501C';

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

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="store-screen">
      <StatusBar barStyle="light-content" backgroundColor={ORANGE} translucent={false} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="store-screen-back"
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{section.name}</Text>
          <Text style={styles.headerSubtitle}>Great Food. Just ₹99!</Text>
        </View>
      </View>

      {loading ? (
        <View style={[styles.sheet, styles.centre]}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={deal => String(deal.id)}
          numColumns={2}
          columnWrapperStyle={styles.column}
          style={styles.sheet}
          contentContainerStyle={styles.listContent}
          onScroll={e => hideCartBarOnScroll(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />
          }
          renderItem={({ item }) => (
            <View style={styles.cardSlot}>
              <StoreDealCard
                deal={item}
                variant="store"
                onAdd={deal => handleAdd(deal)}
                onOpenStore={deal =>
                  onOpenStore?.(deal.restaurant_id, deal.restaurant?.name ?? '')
                }
                adding={addingDealId === item.id}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centre}>
              <Text style={styles.emptyTitle}>No deals right now</Text>
              <Text style={styles.emptyText}>
                New ₹99 deals are added through the day. Do check back.
              </Text>
            </View>
          }
        />
      )}

      <ViewCartBar hidden={cartBarHidden} onPress={onNavigateToCheckout} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // The safe area itself is orange so the status bar strip matches the header
  // instead of leaving a grey band above it.
  container: { flex: 1, backgroundColor: ORANGE },
  header: {
    backgroundColor: ORANGE,
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backButton: { padding: 6 },
  headerTextWrap: { flex: 1 },
  headerTitle: {
    fontFamily: 'Kalam_700Bold',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 0,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 12,
    letterSpacing: 0.1,
    color: 'rgba(255, 255, 255, 0.92)',
  },
  // The list sits on its own light sheet, so the orange stops at the header.
  sheet: { flex: 1, backgroundColor: '#F7F6F4' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  listContent: { padding: 12, paddingBottom: 140 },
  column: { gap: 12, marginBottom: 12 },
  cardSlot: { flex: 1 },
  emptyTitle: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 16,
    letterSpacing: 0,
    color: '#1A1A1A',
  },
  emptyText: {
    marginTop: 4,
    paddingHorizontal: 32,
    textAlign: 'center',
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#8A8A8A',
  },
});
