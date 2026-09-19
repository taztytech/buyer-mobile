import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Reel, reelService } from '@/services/reel.service';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

/** A view counts only once the buyer has genuinely watched this long. */
const VIEW_THRESHOLD_MS = 3000;

interface ReelsPagerProps {
  reels: Reel[];
  /** Container height, so the pager fits under the store header. */
  height?: number;
  onAddToCart?: (itemId: number) => void;
  isOutOfStock?: (itemId: number) => boolean;
  priceFor?: (itemId: number) => string | undefined;
}

/**
 * Instagram Reels style vertical pager.
 *
 * Continuous scroll with no segment bars — Stories-style segments imply a
 * finite set the viewer is working through, which is the wrong mental model
 * here. Reaching the end loops back to the first.
 */
export const ReelsPager: React.FC<ReelsPagerProps> = ({
  reels,
  height = SCREEN_HEIGHT,
  onAddToCart,
  isOutOfStock,
  priceFor,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const listRef = useRef<FlatList<Reel>>(null);
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counted = useRef<Set<number>>(new Set());

  /**
   * Only the visible reel plays; the rest are paused so several decoders are
   * not competing, which is what makes a pager stutter on mid-range phones.
   */
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setActiveIndex(first.index);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  // Start the clock on whichever reel is showing; a swipe away cancels it, so
  // scrolling past at speed never inflates anyone's numbers.
  useEffect(() => {
    if (viewTimer.current) clearTimeout(viewTimer.current);

    const reel = reels[activeIndex];
    if (!reel || counted.current.has(reel.id)) return;

    viewTimer.current = setTimeout(() => {
      counted.current.add(reel.id);
      void reelService.recordView(reel.id);
    }, VIEW_THRESHOLD_MS);

    return () => {
      if (viewTimer.current) clearTimeout(viewTimer.current);
    };
  }, [activeIndex, reels]);

  /** Loop rather than dead-ending on the last reel. */
  const handleEndReached = useCallback(() => {
    if (reels.length > 1) {
      listRef.current?.scrollToIndex({ index: 0, animated: false });
    }
  }, [reels.length]);

  const renderReel = useCallback(
    ({ item, index }: { item: Reel; index: number }) => {
      const itemId = item.item_id;
      const outOfStock = isOutOfStock?.(itemId) ?? false;
      const price = priceFor?.(itemId);

      return (
        <View style={[styles.page, { height }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMuted((m) => !m)}>
            {/* Poster shows instantly while the video buffers, so the screen is
                never blank on a slow connection. */}
            {item.thumbnail_url ? (
              <Image
                source={{ uri: item.thumbnail_url }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : null}

            <Video
              source={{ uri: item.video_url }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay={index === activeIndex}
              isLooping
              isMuted={muted}
              useNativeControls={false}
            />
          </Pressable>

          <View style={styles.scrim} pointerEvents="none" />

          <View style={styles.overlay}>
            {outOfStock ? (
              <View style={styles.outOfStockPill}>
                <Text style={styles.outOfStockText}>Out of Stock</Text>
              </View>
            ) : null}

            <Text style={styles.name} numberOfLines={1}>
              {item.item?.name || 'Dish'}
            </Text>
            {price ? <Text style={styles.price}>₹{price}</Text> : null}
            {item.caption ? (
              <Text style={styles.caption} numberOfLines={2}>
                {item.caption}
              </Text>
            ) : null}

            <Pressable
              style={[styles.addButton, outOfStock && styles.addButtonDisabled]}
              disabled={outOfStock}
              onPress={() => onAddToCart?.(itemId)}
              testID={`reel-add-${itemId}`}
            >
              <Text style={styles.addButtonText}>
                {outOfStock ? 'Unavailable' : '+ Add'}
              </Text>
            </Pressable>
          </View>

          {muted ? (
            <View style={styles.mutedHint} pointerEvents="none">
              <Text style={styles.mutedHintText}>Tap for sound</Text>
            </View>
          ) : null}
        </View>
      );
    },
    [activeIndex, height, muted, onAddToCart, isOutOfStock, priceFor],
  );

  if (reels.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={reels}
      keyExtractor={(reel) => String(reel.id)}
      renderItem={renderReel}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      snapToInterval={height}
      snapToAlignment="start"
      decelerationRate="fast"
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.1}
      // Keeping only a couple of pages mounted stops memory climbing as a
      // buyer swipes through a long menu.
      windowSize={3}
      maxToRenderPerBatch={2}
      initialNumToRender={1}
      removeClippedSubviews
      getItemLayout={(_, index) => ({
        length: height,
        offset: height * index,
        index,
      })}
    />
  );
};

const styles = StyleSheet.create({
  page: { width: SCREEN_WIDTH, backgroundColor: '#000' },
  empty: {
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
  },
  outOfStockPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(169,58,44,0.92)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  outOfStockText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  name: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 22,
    letterSpacing: 0.2,
  },
  price: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  caption: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    letterSpacing: 0.1,
    marginTop: 6,
  },
  addButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#1DA84E',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  addButtonDisabled: { backgroundColor: 'rgba(255,255,255,0.25)' },
  addButtonText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  mutedHint: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mutedHintText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
