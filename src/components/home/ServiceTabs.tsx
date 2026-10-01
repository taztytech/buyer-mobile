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
  onSelect: (tab: TopDashTab | null) => void;
}

const CREAM = '#FFF6EA';
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

/**
 * Card outline inside a w×h box: a little narrower at the top than the bottom
 * and, for the unselected cards, a top edge that dips to the right — the
 * tilted-tile look of the reference.
 */
const cardPath = (w: number, h: number, inset: number, tilt: boolean): string => {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const cw = x1 - x0;
  const ch = y1 - y0;
  const topIn = cw * 0.05;
  const dip = tilt ? ch * 0.07 : ch * 0.02;
  const pts: Pt[] = [
    [x0 + topIn, y0],
    [x1 - topIn * 0.6, y0 + dip],
    [x1, y1],
    [x0, y1],
  ];
  return roundedPolygon(pts, Math.min(cw, ch) * 0.3);
};

const TabShape: React.FC<{ w: number; h: number; selected: boolean; gradId: string }> = ({
  w,
  h,
  selected,
  gradId,
}) => (
  <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
    <Defs>
      <SvgGradient id={gradId} x1="0.15" y1="0" x2="0.85" y2="1">
        <Stop offset="0" stopColor="#3DDA83" />
        <Stop offset="0.55" stopColor="#14A954" />
        <Stop offset="1" stopColor="#0A8F43" />
      </SvgGradient>
    </Defs>
    {/* soft drop shadow */}
    <Path
      d={cardPath(w, h, RING, !selected)}
      fill="rgba(0,45,20,0.18)"
      transform="translate(1.5, 3)"
    />
    {selected ? (
      <>
        <Path d={cardPath(w, h, 0, false)} fill="rgba(255,255,255,0.42)" />
        <Path d={cardPath(w, h, RING, false)} fill={CREAM} />
      </>
    ) : (
      <Path
        d={cardPath(w, h, RING, true)}
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
  onSelect,
}) => {
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
              <TabShape w={cardW} h={cardH} selected={selected} gradId={`tabg-${key}`} />
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
                  ]}
                  numberOfLines={2}
                >
                  {title}
                </Text>
                <View style={[styles.underline, selected && styles.underlineSelected]} />
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
