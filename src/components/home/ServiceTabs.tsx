import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { OptimizedImage } from '@/components/OptimizedImage';

/** An admin-created tab (home_tabs). Food is fixed and not one of these. */
export interface TopDashTab {
  id: number;
  title: string;
  imageUrl?: string | null;
}

interface ServiceTabsProps {
  tabs: TopDashTab[];
  /** Selected admin tab id; null means Food. */
  selectedId: number | null;
  /** Cut-out image for the Food card; the 🍔 emoji stands in when unset. */
  foodImageUrl?: string | null;
  /** Admin-set name of the first card (HOME_FOOD_TAB_TITLE). */
  foodTitle?: string;
  /** Admin-drawn card shape (HOME_TAB_SHAPE); default card when unset. */
  shape?: TabShapeSpec | null;
  /** Theme colours; the original green look when not given. */
  palette?: Partial<TabPalette> | null;
  onSelect: (tab: TopDashTab | null) => void;
}

export interface TabPalette {
  selectedFill: string;
  selectedRing: string;
  selectedText: string;
  from: string;
  to: string;
  text: string;
  underline: string;
  underlineSelected: string;
}

export const DEFAULT_TAB_PALETTE: TabPalette = {
  selectedFill: '#FFF6EA',
  selectedRing: 'rgba(255,255,255,0.42)',
  selectedText: '#0A7A3C',
  from: '#3DDA83',
  to: '#0A8F43',
  text: '#FFFFFF',
  underline: '#FFD54A',
  underlineSelected: '#0A7A3C',
};

const FOOD_GREEN = '#0A7A3C';
const UNDERLINE = '#FFD54A';
const SIDE = 14;
const OVERLAP = 12;
const RING = 4; // white halo around the selected card

type Pt = [number, number];

/**
 * Closed path through `pts` with each corner rounded by `r` (quadratic
 * curves), so the card keeps the soft, slightly lopsided look of the
 * reference instead of a plain rounded rectangle.
 */
const roundedPolygon = (pts: Pt[], r: number): string => {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const toward = (a: Pt, b: Pt): Pt => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(r, len / 2) / len;
      return [a[0] + dx * k, a[1] + dy * k];
    };
    const start = toward(cur, prev);
    const end = toward(cur, next);
    d += `${i === 0 ? 'M' : 'L'}${start[0].toFixed(1)},${start[1].toFixed(1)} `;
    d += `Q${cur[0].toFixed(1)},${cur[1].toFixed(1)} ${end[0].toFixed(1)},${end[1].toFixed(1)} `;
  }
  return `${d}Z`;
};

/** Admin-drawn card outline: points 0..1 of the card box + corner roundness. */
export interface TabShapeSpec {
  points: Array<[number, number]>;
  roundness: number;
}

/** The card as first designed; used until the admin saves a shape. */
export const DEFAULT_TAB_SHAPE: TabShapeSpec = {
  points: [
    [0.05, 0],
    [0.97, 0.07],
    [1, 1],
    [0, 1],
  ],
  roundness: 0.3,
};

/** Accepts only a usable shape; anything else falls back to the default. */
export const normalizeTabShape = (raw: any): TabShapeSpec => {
  const pts = raw?.points;
  if (!Array.isArray(pts) || pts.length < 3 || pts.length > 12) return DEFAULT_TAB_SHAPE;
  const points: Array<[number, number]> = [];
  for (const p of pts) {
    const x = Number(p?.[0]);
    const y = Number(p?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return DEFAULT_TAB_SHAPE;
    points.push([Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))]);
  }
  const r = Number(raw?.roundness);
  return { points, roundness: Number.isFinite(r) ? Math.min(0.5, Math.max(0, r)) : 0.3 };
};

/** Card outline inside a w×h box, inset (for the halo ring) on every side. */
const cardPath = (shape: TabShapeSpec, w: number, h: number, inset: number): string => {
  const cw = w - inset * 2;
  const ch = h - inset * 2;
  const pts: Pt[] = shape.points.map(([x, y]) => [inset + x * cw, inset + y * ch]);
  return roundedPolygon(pts, Math.min(cw, ch) * shape.roundness);
};

const TabShape: React.FC<{
  w: number;
  h: number;
  selected: boolean;
  gradId: string;
  shape: TabShapeSpec;
  palette: TabPalette;
}> = ({ w, h, selected, gradId, shape, palette }) => (
  <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
    <Defs>
      <SvgGradient id={gradId} x1="0.15" y1="0" x2="0.85" y2="1">
        <Stop offset="0" stopColor={palette.from} />
        <Stop offset="1" stopColor={palette.to} />
      </SvgGradient>
    </Defs>
    {/* soft drop shadow */}
    <Path
      d={cardPath(shape, w, h, RING)}
      fill="rgba(0,45,20,0.18)"
      transform="translate(1.5, 3)"
    />
    {selected ? (
      <>
        <Path d={cardPath(shape, w, h, 0)} fill={palette.selectedRing} />
        <Path d={cardPath(shape, w, h, RING)} fill={palette.selectedFill} />
      </>
    ) : (
      <Path
        d={cardPath(shape, w, h, RING)}
        fill={`url(#${gradId})`}
        stroke="rgba(255,255,255,0.32)"
        strokeWidth={1}
      />
    )}
  </Svg>
);

/**
 * Top-dash tabs: Food first, then the admin tabs, each tucked under the one
 * before. The selected one is the cream card; tapping another switches Home
 * in place (no new screen).
 */
export const ServiceTabs: React.FC<ServiceTabsProps> = ({
  tabs,
  selectedId,
  foodImageUrl,
  foodTitle,
  shape,
  palette: paletteIn,
  onSelect,
}) => {
  const palette = React.useMemo<TabPalette>(
    () => ({ ...DEFAULT_TAB_PALETTE, ...(paletteIn || {}) }),
    [paletteIn],
  );
  const cardShape = React.useMemo(() => normalizeTabShape(shape ?? DEFAULT_TAB_SHAPE), [shape]);
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  // Four cards across, like the reference.
  const cardW = Math.round((width - SIDE * 2 + OVERLAP * 3) / 4);
  const cardH = Math.round(cardW * 0.9);
  const artH = Math.round(cardH * 0.46);

  const all: Array<{ key: string; tab: TopDashTab | null }> = [
    { key: 'food', tab: null },
    ...tabs.map(t => ({ key: `t-${t.id}`, tab: t })),
  ];

  const contentW = SIDE * 2 + cardW + tabs.length * (cardW - OVERLAP);
  const pages = Math.max(1, Math.ceil((contentW - 1) / width));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const max = Math.max(1, contentSize.width - layoutMeasurement.width);
    setPage(Math.min(pages - 1, Math.round((contentOffset.x / max) * (pages - 1))));
  };

  return (
    <View testID="service-tabs">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={pages > 1}
        contentContainerStyle={[styles.content, { paddingHorizontal: SIDE }]}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {all.map(({ key, tab }, i) => {
          const isFood = tab === null;
          const selected = isFood ? selectedId === null : selectedId === tab!.id;
          const title = isFood ? foodTitle || 'Food' : tab!.title;
          const image = isFood ? foodImageUrl : tab!.imageUrl;
          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.9}
              onPress={() => onSelect(tab)}
              style={[
                styles.card,
                {
                  width: cardW,
                  height: cardH,
                  marginLeft: i === 0 ? 0 : -OVERLAP,
                  // Selected card on top; otherwise each sits over the next.
                  zIndex: selected ? 100 : all.length - i,
                  transform: [{ translateY: selected ? -2 : 0 }],
                },
              ]}
              testID={isFood ? 'service-tab-food' : `service-tab-${tab!.id}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={title}
            >
              <TabShape
                w={cardW}
                h={cardH}
                selected={selected}
                gradId={`tabg-${key}`}
                shape={cardShape}
                palette={palette}
              />
              <View style={[styles.inner, { paddingLeft: i === 0 ? 6 : OVERLAP }]}>
                <View style={[styles.art, { height: artH }]}>
                  {image ? (
                    <OptimizedImage
                      source={image}
                      style={styles.fill}
                      contentFit="contain"
                      showShimmer={false}
                      cachePolicy="memory-disk"
                    />
                  ) : isFood ? (
                    <Text style={[styles.emoji, { fontSize: artH * 0.78 }]}>🍔</Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.title,
                    isFood && styles.titleFood,
                    selected ? styles.titleSelected : styles.titlePlain,
                    { color: selected ? palette.selectedText : palette.text },
                  ]}
                  numberOfLines={2}
                >
                  {title}
                </Text>
                <View
                  style={[
                    styles.underline,
                    selected && styles.underlineSelected,
                    { backgroundColor: selected ? palette.underlineSelected : palette.underline },
                  ]}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {pages > 1 && (
        <View style={styles.dots}>
          {Array.from({ length: pages }).map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 2, alignItems: 'center' },
  fill: { width: '100%', height: '100%' },
  card: { justifyContent: 'center' },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 6,
    paddingTop: 6,
    paddingBottom: 6,
  },
  art: { width: '84%', alignItems: 'center', justifyContent: 'center' },
  emoji: { textAlign: 'center' },
  title: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 11.5,
    lineHeight: 14,
    letterSpacing: 0.1,
    textAlign: 'center',
    marginTop: 2,
  },
  titleFood: { fontSize: 16, lineHeight: 19 },
  titlePlain: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  titleSelected: { color: FOOD_GREEN },
  underline: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: UNDERLINE,
    marginTop: 3,
  },
  underlineSelected: { backgroundColor: FOOD_GREEN, width: 28 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  dot: {
    width: 8,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
    marginHorizontal: 3,
  },
  dotActive: { width: 18, backgroundColor: '#FFFFFF' },
});
