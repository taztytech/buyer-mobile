import React from 'react';
import {
  Animated,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/context/CartContext';
import type { CartItem } from '@/context/CartContext';

interface ViewCartBarProps {
  onPress: () => void;
  /**
   * Accepted so existing callers keep compiling. The pill has no room for a
   * menu link, logo or location - those live on the cart screen itself.
   */
  onViewMenu?: () => void;
  restaurantLogo?: any;
  deliveryLocation?: string;
  /** Extra distance above the bottom safe area, e.g. to clear a tab bar. */
  bottomOffset?: number;
  /**
   * Slide the pill out of the way while the customer reads further down the
   * list. It keeps its place in the cart - only the bar moves.
   */
  hidden?: boolean;
}

const THUMB_SIZE = 48;
const THUMB_STEP = 30; // horizontal distance between overlapping photos
const MAX_THUMBS = 3;
const BRAND_GREEN = '#00B14F';

/**
 * A cart line's photo, whatever shape it arrived in.
 *
 * The same field carries three things depending on where the line came from:
 * a plain URL string when the cart was loaded from the API, a
 * `{ uri }` object when a dish was added straight from the restaurant menu,
 * and a bundled asset number in a few older screens. Passing the object
 * through as `{ uri: image }` produced `{ uri: { uri } }`, which Android
 * refuses to cast - "Value for uri cannot be cast from ReadableNativeMap to
 * String" - and that killed the app the moment this pill appeared, i.e. on the
 * very first add to cart.
 */
const toImageSource = (image: unknown): ImageSourcePropType | null => {
  if (!image) return null;
  if (typeof image === 'string') {
    return image.trim().length > 0 ? { uri: image } : null;
  }
  // require()'d asset
  if (typeof image === 'number') return image;
  if (typeof image === 'object') {
    const uri = (image as { uri?: unknown }).uri;
    if (typeof uri === 'string' && uri.trim().length > 0) {
      return { uri };
    }
  }
  return null;
};

/**
 * The newest distinct dishes in the cart, oldest first so the most recently
 * added one is drawn last - in front, on the right.
 *
 * A customisable dish added twice with different options occupies two cart
 * entries; it is shown once, since two identical photos side by side read as
 * a rendering glitch rather than a second item.
 */
const pickThumbnails = (cart: { [key: string]: CartItem }): CartItem[] => {
  const seen = new Set<string>();
  const newestFirst: CartItem[] = [];
  const entries = Object.values(cart);
  for (let i = entries.length - 1; i >= 0 && newestFirst.length < MAX_THUMBS; i--) {
    const item = entries[i];
    const key = String(item.itemId ?? item.id);
    if (seen.has(key)) continue;
    seen.add(key);
    newestFirst.push(item);
  }
  return newestFirst.reverse();
};

/**
 * Floating "View cart" pill: overlapping photos of what is in the cart, the
 * item count, and a chevron. Tapping it runs the caller's checkout handler,
 * so screens that must validate first (open shop, pending quantity flush)
 * keep doing so.
 */
export const ViewCartBar: React.FC<ViewCartBarProps> = ({
  onPress,
  bottomOffset = 0,
  hidden = false,
}) => {
  const { cart, getTotalItems } = useCart();
  const insets = useSafeAreaInsets();
  const totalCartItems = getTotalItems();

  const thumbnails = React.useMemo(() => pickThumbnails(cart), [cart]);

  // Slides down and fades rather than vanishing, so the eye follows it.
  const hideAnim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(hideAnim, {
      toValue: hidden ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [hidden, hideAnim]);

  const translateY = hideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 140],
  });
  const opacity = hideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  // A small bump when something is added, so the new photo arriving is noticed.
  const scale = React.useRef(new Animated.Value(1)).current;
  const previousCount = React.useRef(totalCartItems);
  React.useEffect(() => {
    if (totalCartItems > previousCount.current) {
      scale.setValue(0.94);
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 160,
        useNativeDriver: true,
      }).start();
    }
    previousCount.current = totalCartItems;
  }, [totalCartItems, scale]);

  if (totalCartItems === 0) {
    return null;
  }

  const thumbsWidth =
    THUMB_SIZE + Math.max(thumbnails.length - 1, 0) * THUMB_STEP;
  const itemLabel = totalCartItems === 1 ? 'item' : 'items';

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: insets.bottom + 16 + bottomOffset }]}
    >
      <Animated.View
        style={{ opacity, transform: [{ translateY }, { scale }] }}
        // Out of the way means out of reach: a faded bar must not swallow taps
        // meant for the dish behind it.
        pointerEvents={hidden ? 'none' : 'auto'}
      >
        <TouchableOpacity
          style={styles.pill}
          onPress={onPress}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`View cart, ${totalCartItems} ${itemLabel}`}
          testID="view-cart-bar"
        >
          <View style={[styles.thumbs, { width: thumbsWidth }]}>
            {thumbnails.map((item, index) => {
              const imageSource = toImageSource(item.image);
              return (
              <View
                key={item.id}
                style={[styles.thumb, { left: index * THUMB_STEP, zIndex: index + 1 }]}
                testID={`view-cart-thumb-${index}`}
              >
                {imageSource ? (
                  <Image
                    source={imageSource}
                    style={styles.thumbImage}
                    resizeMode="cover"
                  />
                ) : (
                  // No photo: the dish's initial, so the circle is never empty.
                  <Text style={styles.thumbInitial}>
                    {(item.name || '?').trim().charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              );
            })}
          </View>

          <View style={styles.label}>
            <Text style={styles.title}>View cart</Text>
            <Text style={styles.subtitle}>
              {totalCartItems} {itemLabel}
            </Text>
          </View>

          <View style={styles.chevron}>
            <MaterialIcons name="chevron-right" size={28} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_GREEN,
    borderRadius: 999,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 12,
  },
  thumbs: {
    height: THUMB_SIZE,
  },
  thumb: {
    position: 'absolute',
    top: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2.5,
    borderColor: BRAND_GREEN,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbInitial: {
    fontFamily: 'Poppins',
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: 0,
    color: BRAND_GREEN,
  },
  label: {
    marginLeft: 12,
    marginRight: 18,
  },
  title: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: 0.1,
    lineHeight: 22,
    color: '#FFFFFF',
  },
  subtitle: {
    fontFamily: 'Poppins',
    fontSize: 13,
    fontWeight: 400,
    letterSpacing: 0.1,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  chevron: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
