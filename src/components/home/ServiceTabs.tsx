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
import { LinearGradient } from 'expo-linear-gradient';
import { OptimizedImage } from '@/components/OptimizedImage';

/** An admin-created tab (home_tabs). Food is fixed and not one of these. */
export interface TopDashTab {
  id: number;
  title: string;
  imageUrl?: string | null;
}

interface ServiceTabsProps {
  tabs: TopDashTab[];
  /** Cut-out image for the Food card; the 🍔 emoji stands in when unset. */
  foodImageUrl?: string | null;
  onTabPress: (tab: TopDashTab) => void;
}

const CREAM = '#FFF6EA';
const FOOD_GREEN = '#0A7A3C';
const UNDERLINE = '#FFD54A';
const SIDE = 14;
const OVERLAP = 14;

/**
 * Top-dash tabs: a raised cream "Food" card (the screen you are on), then
 * glossy green cards that tuck under the one before, each with a cut-out food
 * image, a two-line title and a short underline. Page dots follow the scroll.
 */
export const ServiceTabs: React.FC<ServiceTabsProps> = ({ tabs, foodImageUrl, onTabPress }) => {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  // Four cards fill the row like the reference: Food a little larger.
  const foodW = Math.round(width * 0.29);
  const foodH = Math.round(foodW * 1.0);
  const tabW = Math.round(width * 0.265);
  const tabH = Math.round(foodH * 0.92);

  const contentW = SIDE * 2 + foodW + tabs.length * (tabW - OVERLAP);
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
        <View
          style={[styles.foodCard, { width: foodW, height: foodH }]}
          testID="service-tab-food"
          accessibilityRole="tab"
          accessibilityState={{ selected: true }}
          accessibilityLabel="Food"
        >
          <View style={[styles.foodArt, { height: foodH * 0.56 }]}>
            {foodImageUrl ? (
              <OptimizedImage
                source={foodImageUrl}
                style={styles.fill}
                contentFit="contain"
                showShimmer={false}
                cachePolicy="memory-disk"
              />
            ) : (
              <Text style={[styles.foodEmoji, { fontSize: foodH * 0.34 }]}>🍔</Text>
            )}
          </View>
          <Text style={styles.foodLabel}>Food</Text>
          <View style={[styles.underline, styles.underlineFood]} />
        </View>

        {tabs.map((tab, i) => (
          <TouchableOpacity
            key={tab.id}
            activeOpacity={0.88}
            onPress={() => onTabPress(tab)}
            style={[
              styles.tabCard,
              { width: tabW, height: tabH, zIndex: tabs.length - i, elevation: 4 },
            ]}
            testID={`service-tab-${tab.id}`}
            accessibilityRole="tab"
            accessibilityLabel={tab.title}
          >
            <LinearGradient
              colors={['#34D27A', '#12A853', '#0B9446']}
              locations={[0, 0.55, 1]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={[styles.tabFill, { paddingLeft: OVERLAP }]}
            >
              {/* Gloss along the top edge, as on the reference cards. */}
              <View style={styles.gloss} pointerEvents="none" />
              <View style={[styles.tabArt, { height: tabH * 0.5 }]}>
                {tab.imageUrl ? (
                  <OptimizedImage
                    source={tab.imageUrl}
                    style={styles.fill}
                    contentFit="contain"
                    showShimmer={false}
                    cachePolicy="memory-disk"
                  />
                ) : null}
              </View>
              <Text style={styles.tabLabel} numberOfLines={2}>
                {tab.title}
              </Text>
              <View style={styles.underline} />
            </LinearGradient>
          </TouchableOpacity>
        ))}
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
  content: { paddingTop: 4, paddingBottom: 6, alignItems: 'center' },
  fill: { width: '100%', height: '100%' },

  foodCard: {
    borderRadius: 30,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    zIndex: 99,
    elevation: 8,
    shadowColor: '#00391A',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 2, height: 5 },
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  foodArt: { width: '86%', alignItems: 'center', justifyContent: 'center' },
  foodEmoji: { textAlign: 'center' },
  foodLabel: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: 0.2,
    color: FOOD_GREEN,
  },

  tabCard: {
    marginLeft: -OVERLAP,
    borderRadius: 26,
    shadowColor: '#00391A',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: -3, height: 4 },
  },
  tabFill: {
    flex: 1,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 6,
    paddingTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '38%',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  tabArt: { width: '92%', alignItems: 'center', justifyContent: 'center' },
  tabLabel: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.1,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  underline: {
    width: 30,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: UNDERLINE,
    marginTop: 4,
  },
  underlineFood: { backgroundColor: FOOD_GREEN, width: 34 },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  dot: {
    width: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
    marginHorizontal: 3,
  },
  dotActive: { width: 20, backgroundColor: '#FFFFFF' },
});
