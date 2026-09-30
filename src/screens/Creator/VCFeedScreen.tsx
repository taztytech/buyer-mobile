import { MaterialIcons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { vcService, VcFeedItem } from '@/services/vc.service';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const GREEN = '#00B14F';

// The bundled branded intro clip, shown as the first reel when the admin enables
// it. A negative id marks the synthetic item so engagement/nav is skipped for it.
const INTRO_ID = -1;
const INTRO_SOURCE = require('../../../assets/flix-intro.mp4');

// Mute is a single global preference: muting one reel mutes them all, and the
// choice sticks as you scroll and when you reopen Flix (module-level so it
// survives the screen unmounting). Default: sound on.
let flixMuted = false;

interface VCFeedScreenProps {
  onBack: () => void;
  // Open a tagged store (optionally focused on an item) in the buyer flow.
  onOpenStore: (storeId: number, itemId?: number | null) => void;
  // The viewer's current location, so the feed shows nearby stores first.
  userLat?: number | null;
  userLng?: number | null;
  // False while the Crave page is showing (Flix is the off-screen pager page),
  // so videos never play their audio in the background. Defaults on.
  screenActive?: boolean;
  // When true (FLIX_INTRO_ENABLED), play the bundled intro clip first.
  introEnabled?: boolean;
}

/**
 * The full-screen vertical video feed. Autoplays the video in view, tap to
 * pause/play, double-tap to like. Pausing reveals the tagged store/item, which
 * opens the store so the viewer can order.
 */
export const VCFeedScreen: React.FC<VCFeedScreenProps> = ({
  onBack,
  onOpenStore,
  userLat,
  userLng,
  screenActive = true,
  introEnabled = false,
}) => {
  const coords = { lat: userLat, lng: userLng };
  const [items, setItems] = useState<VcFeedItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Global mute (see flixMuted above). Applied to every reel.
  const [muted, setMuted] = useState(flixMuted);
  // Instagram-style heart that pops on double-tap.
  const heartAnim = useRef(new Animated.Value(0)).current;
  // Measured height of the feed area — used for the page height + paging so a
  // reel fills the screen exactly and the next one never peeks (varies by device
  // status/nav bars). Falls back to the window height until measured.
  const [pageH, setPageH] = useState(SCREEN_HEIGHT);
  // The tagged store/item card is hidden for a clean view and revealed on a
  // press-and-hold, per the product design. Reset whenever the reel changes.
  const [tagsVisible, setTagsVisible] = useState(false);

  const viewedRef = useRef<Set<number>>(new Set());
  const lastTapRef = useRef<number>(0);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const page = await vcService.getFeed(undefined, coords);
      setItems(page.items);
      setCursor(page.next_cursor);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const loadMore = async () => {
    if (loadingMore || cursor == null) return;
    setLoadingMore(true);
    try {
      const page = await vcService.getFeed(cursor, coords);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const recordView = (video: VcFeedItem) => {
    if (video.id < 0) return; // synthetic intro item — nothing to record
    if (viewedRef.current.has(video.id)) return;
    viewedRef.current.add(video.id);
    vcService.recordView(video.id).catch(() => {});
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (viewableItems.length > 0) {
        const idx = viewableItems[0].index ?? 0;
        setActiveIndex(idx);
        setPaused(false);
        setTagsVisible(false);
        const v = viewableItems[0].item as VcFeedItem;
        if (v) recordView(v);
      }
    },
  ).current;
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  const toggleLike = async (video: VcFeedItem) => {
    const nextLiked = !video.liked;
    // Key by id, not index: with the intro reel prepended the render index is
    // off-by-one from the `items` array, which updated the wrong row (so the
    // tapped heart never turned red).
    setItems((prev) =>
      prev.map((it) =>
        it.id === video.id
          ? {
              ...it,
              liked: nextLiked,
              like_count: it.like_count + (nextLiked ? 1 : -1),
            }
          : it,
      ),
    );
    try {
      if (nextLiked) await vcService.like(video.id);
      else await vcService.unlike(video.id);
    } catch {
      // Revert on failure.
      setItems((prev) =>
        prev.map((it) =>
          it.id === video.id
            ? {
                ...it,
                liked: video.liked,
                like_count: video.like_count,
              }
            : it,
        ),
      );
    }
  };

  const openStore = (video: VcFeedItem) => {
    // Record the shop-from-video signal before leaving, so an order placed at
    // this store within the window is credited to the creator.
    vcService.recordClick(video.id, video.store_id, video.item_id).catch(() => {});
    onOpenStore(video.store_id, video.item_id);
  };

  const toggleMute = () => {
    setMuted((m) => {
      flixMuted = !m; // persist the choice for other reels + next open
      return !m;
    });
  };

  // Pop a big heart in the centre (Instagram-style) on double-tap.
  const popHeart = () => {
    heartAnim.stopAnimation();
    heartAnim.setValue(0);
    Animated.sequence([
      Animated.spring(heartAnim, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.timing(heartAnim, {
        toValue: 0,
        duration: 350,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onTap = (video: VcFeedItem) => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      // Double tap → heart pop + like (only ever likes, like Instagram). Undo the
      // pause the first tap just applied so a double-tap doesn't leave it paused.
      setPaused((p) => !p);
      popHeart();
      if (!video.liked) toggleLike(video);
      lastTapRef.current = 0;
    } else {
      // Single tap toggles pause instantly (no wait for a possible 2nd tap).
      lastTapRef.current = now;
      setPaused((p) => !p);
    }
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: VcFeedItem;
    index: number;
  }) => {
    const isActive = index === activeIndex;
    // Only the current reel and its immediate neighbours get a real <Video>
    // player mounted; every other row shows a lightweight poster. This is what
    // lets the feed hold 1000+ videos without a player per row (memory/crash).
    const shouldMount = Math.abs(index - activeIndex) <= 1;

    // The branded intro reel: bundled local video, no engagement overlays.
    if (item.id === INTRO_ID) {
      return (
        <View style={[styles.page, { height: pageH }]}>
          <Pressable
            style={styles.videoTouch}
            onPress={() => setPaused((p) => !p)}
          >
            {shouldMount ? (
              <Video
                style={styles.video}
                source={INTRO_SOURCE}
                resizeMode={ResizeMode.COVER}
                shouldPlay={isActive && !paused && screenActive}
                isLooping
                isMuted={muted}
              />
            ) : (
              <View style={[styles.video, styles.videoPlaceholder]} />
            )}
            {isActive && paused && (
              <View style={styles.pauseIcon}>
                <MaterialIcons name="play-arrow" size={64} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          <View style={styles.introHint}>
            <MaterialIcons name="keyboard-arrow-up" size={22} color="#FFFFFF" />
            <Text style={styles.introHintText}>Swipe up to explore Flix</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.page, { height: pageH }]}>
        <Pressable
          style={styles.videoTouch}
          onPress={() => onTap(item)}
          onLongPress={() => setTagsVisible(true)}
          delayLongPress={250}
        >
          {shouldMount ? (
            <Video
              style={styles.video}
              source={{ uri: item.video_url }}
              resizeMode={ResizeMode.COVER}
              shouldPlay={isActive && !paused && screenActive}
              isLooping
              isMuted={muted}
              usePoster={!!item.thumbnail_url}
              posterSource={
                item.thumbnail_url ? { uri: item.thumbnail_url } : undefined
              }
            />
          ) : item.thumbnail_url ? (
            <Image
              source={{ uri: item.thumbnail_url }}
              style={styles.video}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.video, styles.videoPlaceholder]}>
              <MaterialIcons
                name="play-circle-outline"
                size={54}
                color="rgba(255,255,255,0.35)"
              />
            </View>
          )}
          {isActive && paused && (
            <View style={styles.pauseIcon}>
              <MaterialIcons name="play-arrow" size={64} color="#FFFFFF" />
            </View>
          )}
        </Pressable>

        {/* Left: creator + caption + tags */}
        <View style={styles.leftInfo}>
          <View style={styles.creatorRow}>
            {item.creator_avatar_url ? (
              <Image
                source={{ uri: item.creator_avatar_url }}
                style={styles.creatorAvatar}
              />
            ) : (
              <View style={[styles.creatorAvatar, styles.creatorAvatarPh]}>
                <Text style={styles.creatorInitial}>
                  {(item.creator_handle || 'c').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.creatorHandle}>@{item.creator_handle}</Text>
          </View>
          {!!item.caption && (
            <Text style={styles.caption} numberOfLines={2}>
              {item.caption}
            </Text>
          )}
          {/* Tagged store/item — hidden until the viewer presses and holds the
              video, then tap it to jump to the store and order. The right-rail
              "Order" button is the always-visible quick path. */}
          {!!item.store_name && isActive && tagsVisible && (
            <TouchableOpacity
              style={styles.tagCard}
              onPress={() => openStore(item)}
              activeOpacity={0.85}
              testID={`vc-open-store-${item.store_id}`}
            >
              <MaterialIcons name="storefront" size={18} color={GREEN} />
              <View style={styles.tagCardText}>
                <Text style={styles.tagCardStore} numberOfLines={1}>
                  {item.store_name}
                </Text>
                {!!item.item_name && (
                  <Text style={styles.tagCardItem} numberOfLines={1}>
                    {item.item_name}
                  </Text>
                )}
              </View>
              <View style={styles.tagCardCta}>
                <Text style={styles.tagCardCtaText}>Order now</Text>
                <MaterialIcons name="chevron-right" size={18} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          )}
          {!!item.store_name && isActive && !tagsVisible && (
            <View style={styles.holdHint}>
              <MaterialIcons name="touch-app" size={13} color="#FFFFFF" />
              <Text style={styles.holdHintText}>Hold to see the store</Text>
            </View>
          )}
        </View>

        {/* Right: actions */}
        <View style={styles.rightRail}>
          <TouchableOpacity
            style={styles.action}
            onPress={() => toggleLike(item)}
            testID={`vc-like-${item.id}`}
          >
            <MaterialIcons
              name={item.liked ? 'favorite' : 'favorite-border'}
              size={34}
              color={item.liked ? '#FF3B5C' : '#FFFFFF'}
            />
            <Text style={styles.actionCount}>{item.like_count}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            onPress={() => openStore(item)}
            testID={`vc-order-${item.id}`}
          >
            <MaterialIcons name="shopping-bag" size={32} color="#FFFFFF" />
            <Text style={styles.actionLabel}>Order</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Prepend the branded intro reel when the admin has enabled it.
  const displayData: VcFeedItem[] = introEnabled
    ? [{ id: INTRO_ID } as VcFeedItem, ...items]
    : items;

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - pageH) > 1) setPageH(h);
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <TouchableOpacity style={styles.back} onPress={onBack} testID="vc-feed-back">
        <MaterialIcons name="arrow-back" size={28} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.brand}>Flix</Text>
      <TouchableOpacity
        style={styles.muteBtn}
        onPress={toggleMute}
        testID="vc-mute"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialIcons
          name={muted ? 'volume-off' : 'volume-up'}
          size={20}
          color="#FFFFFF"
        />
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : displayData.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="videocam-off" size={44} color="#6B7280" />
          <Text style={styles.emptyText}>No videos yet</Text>
        </View>
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={pageH}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={loadMore}
          onEndReachedThreshold={1.5}
          // extraData so a like/mute change re-renders the visible rows.
          extraData={items}
          // Scale: keep only a small window of rows realised so a large feed
          // stays light. getItemLayout lets FlatList skip measuring.
          // NOTE: removeClippedSubviews is deliberately OFF — on Android it
          // recycles rows and bled the previous reel's red heart onto the next
          // one (looked "auto-liked"). windowSize=3 already keeps it light.
          windowSize={3}
          maxToRenderPerBatch={3}
          initialNumToRender={2}
          getItemLayout={(_, index) => ({
            length: pageH,
            offset: pageH * index,
            index,
          })}
        />
      )}

      {/* Instagram-style heart burst on double-tap (non-interactive overlay). */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heartOverlay,
          {
            opacity: heartAnim,
            transform: [
              {
                scale: heartAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1.15],
                }),
              },
            ],
          },
        ]}
      >
        <MaterialIcons name="favorite" size={120} color="#FF3B5C" />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    color: '#9CA3AF',
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  brand: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    zIndex: 10,
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 800,
    fontSize: 20,
    letterSpacing: 0.5,
  },
  back: {
    position: 'absolute',
    top: 44,
    left: 12,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteBtn: {
    position: 'absolute',
    top: 44,
    right: 12,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  page: { height: SCREEN_HEIGHT, width: SCREEN_WIDTH, backgroundColor: '#000' },
  videoTouch: { ...StyleSheet.absoluteFillObject },
  video: { ...StyleSheet.absoluteFillObject },
  videoPlaceholder: {
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introHint: {
    position: 'absolute',
    bottom: 46,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  introHintText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  pauseIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftInfo: {
    position: 'absolute',
    left: 14,
    right: 90,
    bottom: 40,
    gap: 8,
  },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  creatorAvatar: { width: 34, height: 34, borderRadius: 17 },
  creatorAvatarPh: {
    backgroundColor: '#E5F5EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorInitial: {
    color: GREEN,
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 16,
  },
  creatorHandle: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  caption: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 14,
    letterSpacing: 0.1,
  },
  tagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tagCardText: { flex: 1 },
  tagCardStore: {
    color: '#111827',
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 0.1,
  },
  tagCardItem: {
    color: '#6B7280',
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 12,
    letterSpacing: 0.1,
    marginTop: 1,
  },
  tagCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GREEN,
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  tagCardCtaText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  holdHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  holdHintText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 11,
    letterSpacing: 0.1,
  },
  rightRail: {
    position: 'absolute',
    right: 12,
    bottom: 50,
    alignItems: 'center',
    gap: 22,
  },
  action: { alignItems: 'center', gap: 4 },
  actionCount: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
