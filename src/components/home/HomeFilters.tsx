import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type HomeSort = 'relevance' | 'rating' | 'delivery_time' | 'distance';

export interface HomeFilterState {
  sort: HomeSort;
  fastDelivery: boolean;
  offers: boolean;
  openNow: boolean;
  minRating?: number;
  maxDistanceKm?: number;
  cuisines: string[];
}

export const EMPTY_FILTERS: HomeFilterState = {
  sort: 'relevance',
  fastDelivery: false,
  offers: false,
  openNow: false,
  minRating: undefined,
  maxDistanceKm: undefined,
  cuisines: [],
};

/** Query params for GET /api/buyer/home; only what is set is sent. */
export const filtersToParams = (f: HomeFilterState): Record<string, string> => {
  const p: Record<string, string> = {};
  if (f.sort !== 'relevance') p.sort = f.sort;
  if (f.fastDelivery) p.fast_delivery = 'true';
  if (f.offers) p.offers_only = 'true';
  if (f.openNow) p.open_now = 'true';
  if (f.minRating) p.min_rating = String(f.minRating);
  if (f.maxDistanceKm) p.max_distance_km = String(f.maxDistanceKm);
  if (f.cuisines.length) p.cuisines = f.cuisines.join(',');
  return p;
};

/** How many things are switched on (Pure Veg counted separately). */
export const activeFilterCount = (f: HomeFilterState): number =>
  (f.sort !== 'relevance' ? 1 : 0) +
  (f.fastDelivery ? 1 : 0) +
  (f.offers ? 1 : 0) +
  (f.openNow ? 1 : 0) +
  (f.minRating ? 1 : 0) +
  (f.maxDistanceKm ? 1 : 0) +
  f.cuisines.length;

const SORT_LABELS: Record<HomeSort, string> = {
  relevance: 'Relevance',
  rating: 'Rating: high to low',
  delivery_time: 'Delivery time',
  distance: 'Distance',
};

const GREEN = '#00B14F';
const GREEN_DARK = '#0A7A3C';
const INK = '#1B1F1D';
const MUTED = '#6B7671';
const LINE = '#E3E8E5';

/* ------------------------------ chip ------------------------------ */

const Chip: React.FC<{
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  trailing?: React.ReactNode;
  onPress: () => void;
  testID: string;
}> = ({ label, icon, active, trailing, onPress, testID }) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={onPress}
    style={[styles.chip, active && styles.chipOn]}
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ selected: !!active }}
  >
    {icon}
    <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    {trailing}
  </TouchableOpacity>
);

/* ------------------------------ bar ------------------------------ */

interface FilterBarProps {
  filters: HomeFilterState;
  pureVeg: boolean;
  onChange: (next: HomeFilterState) => void;
  onTogglePureVeg: () => void;
  onOpenFilter: () => void;
  onOpenSort: () => void;
}

/**
 * Horizontal chips between the top-dash and "What's on your mind?".
 * Each quick chip toggles one rule; Filter and Sort open their sheets.
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  pureVeg,
  onChange,
  onTogglePureVeg,
  onOpenFilter,
  onOpenSort,
}) => {
  const count = activeFilterCount(filters) + (pureVeg ? 1 : 0);
  const toggle = (k: 'fastDelivery' | 'offers' | 'openNow') =>
    onChange({ ...filters, [k]: !filters[k] });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.bar}
      keyboardShouldPersistTaps="handled"
      testID="home-filter-bar"
    >
      <Chip
        label={count ? `Filter · ${count}` : 'Filter'}
        active={count > 0}
        icon={<MaterialIcons name="tune" size={17} color={count ? GREEN_DARK : INK} />}
        onPress={onOpenFilter}
        testID="filter-chip-open"
      />
      <Chip
        label={filters.sort === 'relevance' ? 'Sort by' : SORT_LABELS[filters.sort].split(':')[0]}
        active={filters.sort !== 'relevance'}
        trailing={
          <MaterialIcons
            name="keyboard-arrow-down"
            size={18}
            color={filters.sort !== 'relevance' ? GREEN_DARK : INK}
          />
        }
        onPress={onOpenSort}
        testID="filter-chip-sort"
      />
      <Chip
        label="Fast Delivery"
        active={filters.fastDelivery}
        icon={<MaterialIcons name="bolt" size={17} color="#F15A24" />}
        onPress={() => toggle('fastDelivery')}
        testID="filter-chip-fast"
      />
      <Chip
        label="Offers"
        active={filters.offers}
        icon={<MaterialIcons name="local-offer" size={15} color="#F15A24" />}
        onPress={() => toggle('offers')}
        testID="filter-chip-offers"
      />
      <Chip
        label="Pure Veg"
        active={pureVeg}
        icon={<MaterialIcons name="eco" size={16} color="#1F9D4C" />}
        onPress={onTogglePureVeg}
        testID="filter-chip-veg"
      />
      <Chip
        label="Rating 4.0+"
        active={filters.minRating === 4}
        icon={<MaterialIcons name="star" size={16} color="#F5A623" />}
        onPress={() => onChange({ ...filters, minRating: filters.minRating === 4 ? undefined : 4 })}
        testID="filter-chip-rating"
      />
      <Chip
        label="Open now"
        active={filters.openNow}
        icon={<MaterialIcons name="schedule" size={15} color={GREEN} />}
        onPress={() => toggle('openNow')}
        testID="filter-chip-open-now"
      />
      <Chip
        label="Nearby"
        active={filters.maxDistanceKm === 3}
        icon={<MaterialIcons name="near-me" size={15} color="#2D7FF9" />}
        onPress={() =>
          onChange({ ...filters, maxDistanceKm: filters.maxDistanceKm === 3 ? undefined : 3 })
        }
        testID="filter-chip-nearby"
      />
      {count > 0 && (
        <Chip
          label="Clear all"
          icon={<MaterialIcons name="close" size={15} color={MUTED} />}
          onPress={() => {
            onChange(EMPTY_FILTERS);
            if (pureVeg) onTogglePureVeg();
          }}
          testID="filter-chip-clear"
        />
      )}
    </ScrollView>
  );
};

/* ----------------------------- sheets ----------------------------- */

const Sheet: React.FC<{
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ visible, title, onClose, children, footer }) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} testID="filter-sheet-backdrop" />
      <View style={[styles.sheet, { paddingBottom: 12 + insets.bottom }]}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} testID="filter-sheet-close">
            <MaterialIcons name="close" size={24} color={INK} />
          </TouchableOpacity>
        </View>
        {children}
        {footer}
      </View>
    </Modal>
  );
};

const Radio: React.FC<{ on: boolean }> = ({ on }) => (
  <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
);

export const SortSheet: React.FC<{
  visible: boolean;
  value: HomeSort;
  onClose: () => void;
  onPick: (sort: HomeSort) => void;
}> = ({ visible, value, onClose, onPick }) => (
  <Sheet visible={visible} title="Sort by" onClose={onClose}>
    {(Object.keys(SORT_LABELS) as HomeSort[]).map(s => (
      <TouchableOpacity
        key={s}
        style={styles.row}
        onPress={() => {
          onPick(s);
          onClose();
        }}
        testID={`sort-${s}`}
      >
        <Text style={[styles.rowText, value === s && styles.rowTextOn]}>{SORT_LABELS[s]}</Text>
        <Radio on={value === s} />
      </TouchableOpacity>
    ))}
  </Sheet>
);

const Pill: React.FC<{ label: string; on: boolean; onPress: () => void; testID: string }> = ({
  label,
  on,
  onPress,
  testID,
}) => (
  <TouchableOpacity onPress={onPress} style={[styles.pill, on && styles.pillOn]} testID={testID}>
    <Text style={[styles.pillText, on && styles.pillTextOn]}>{label}</Text>
  </TouchableOpacity>
);

export const FilterSheet: React.FC<{
  visible: boolean;
  value: HomeFilterState;
  pureVeg: boolean;
  cuisines: string[];
  onClose: () => void;
  onApply: (next: HomeFilterState, pureVeg: boolean) => void;
}> = ({ visible, value, pureVeg, cuisines, onClose, onApply }) => {
  const [draft, setDraft] = React.useState(value);
  const [veg, setVeg] = React.useState(pureVeg);

  // Start from what is applied each time the sheet opens.
  React.useEffect(() => {
    if (visible) {
      setDraft(value);
      setVeg(pureVeg);
    }
  }, [visible, value, pureVeg]);

  const set = (patch: Partial<HomeFilterState>) => setDraft(d => ({ ...d, ...patch }));
  const toggleCuisine = (c: string) =>
    set({
      cuisines: draft.cuisines.includes(c)
        ? draft.cuisines.filter(x => x !== c)
        : [...draft.cuisines, c],
    });

  return (
    <Sheet
      visible={visible}
      title="Filters"
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => {
              setDraft(EMPTY_FILTERS);
              setVeg(false);
            }}
            testID="filter-sheet-clear"
          >
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => {
              onApply(draft, veg);
              onClose();
            }}
            testID="filter-sheet-apply"
          >
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetBody}>
        <Text style={styles.group}>Sort by</Text>
        <View style={styles.pills}>
          {(Object.keys(SORT_LABELS) as HomeSort[]).map(s => (
            <Pill key={s} label={SORT_LABELS[s]} on={draft.sort === s} onPress={() => set({ sort: s })} testID={`fs-sort-${s}`} />
          ))}
        </View>

        <Text style={styles.group}>Quick filters</Text>
        <View style={styles.pills}>
          <Pill label="Fast Delivery (≤30 min)" on={draft.fastDelivery} onPress={() => set({ fastDelivery: !draft.fastDelivery })} testID="fs-fast" />
          <Pill label="Offers" on={draft.offers} onPress={() => set({ offers: !draft.offers })} testID="fs-offers" />
          <Pill label="Pure Veg" on={veg} onPress={() => setVeg(v => !v)} testID="fs-veg" />
          <Pill label="Open now" on={draft.openNow} onPress={() => set({ openNow: !draft.openNow })} testID="fs-open" />
        </View>

        <Text style={styles.group}>Rating</Text>
        <View style={styles.pills}>
          {[3.5, 4, 4.5].map(r => (
            <Pill
              key={r}
              label={`${r.toFixed(1)}+ ★`}
              on={draft.minRating === r}
              onPress={() => set({ minRating: draft.minRating === r ? undefined : r })}
              testID={`fs-rating-${r}`}
            />
          ))}
        </View>

        <Text style={styles.group}>Distance</Text>
        <View style={styles.pills}>
          {[2, 3, 5].map(km => (
            <Pill
              key={km}
              label={`Within ${km} km`}
              on={draft.maxDistanceKm === km}
              onPress={() => set({ maxDistanceKm: draft.maxDistanceKm === km ? undefined : km })}
              testID={`fs-distance-${km}`}
            />
          ))}
        </View>

        {cuisines.length > 0 && (
          <>
            <Text style={styles.group}>Cuisines</Text>
            <View style={styles.pills}>
              {cuisines.map(c => (
                <Pill key={c} label={c} on={draft.cuisines.includes(c)} onPress={() => toggleCuisine(c)} testID={`fs-cuisine-${c}`} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 38,
    paddingHorizontal: 13,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LINE,
    elevation: 1,
    shadowColor: '#0B3D22',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  chipOn: { backgroundColor: '#E8F7EE', borderColor: GREEN },
  chipText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    letterSpacing: 0.1,
    color: INK,
  },
  chipTextOn: { color: GREEN_DARK, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D5DBD8',
    marginBottom: 6,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  sheetTitle: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.1,
    color: INK,
  },
  sheetScroll: { flexGrow: 0 },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  rowText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 15,
    letterSpacing: 0.1,
    color: INK,
  },
  rowTextOn: { color: GREEN_DARK, fontWeight: '600' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#B8C1BC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: GREEN },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN },
  group: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
    color: INK,
    marginTop: 16,
    marginBottom: 8,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: '#FFFFFF',
  },
  pillOn: { backgroundColor: '#E8F7EE', borderColor: GREEN },
  pillText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    letterSpacing: 0.1,
    color: INK,
  },
  pillTextOn: { color: GREEN_DARK, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  clearBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
    color: GREEN_DARK,
  },
  applyBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
});
