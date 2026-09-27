import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * The ₹99 Store price: a handwritten figure inside a loose hand-drawn circle,
 * with the real menu price struck through beside it.
 *
 * The circle is one SVG path stretched to whatever the number needs
 * (preserveAspectRatio="none"), so ₹50 and ₹199 both sit inside it without
 * clipping. It is drawn statically — no animation library — because the only
 * thing an animated version adds is a draw-in the customer sees once.
 *
 * Used on the Home deal cards (size 25) and the ₹99 Store page (size 30).
 * Cart, checkout and bill lines keep plain Poppins prices.
 */

// A hand-drawn ring centred in its 100x50 box: once round clockwise from the
// top, overshooting the start a little like a pen stroke. It stays inside the
// box on every side, so it never gets clipped off-centre.
const CIRCLE_PATH =
  'M 56 4 C 82 3, 97 12, 97 25 C 97 39, 77 47, 50 47 C 23 47, 3 39, 3 25 C 3 11, 22 3, 46 3.5 C 56 3.5, 66 4.5, 75 7.5';

const COLORS = {
  price: '#E8501C',
  priceDisabled: '#AAAAAA',
  circleDisabled: '#C8C8C8',
  original: '#9A948E',
  priceOnDark: '#FFFFFF',
  originalOnDark: 'rgba(255,255,255,0.78)',
};

interface OfferPriceProps {
  dealPrice: number;
  /** Menu price. Hidden when it is not above the deal price. */
  originalPrice?: number;
  /** 25 on Home cards, 30 on the ₹99 Store page. */
  size?: number;
  /** Sold out, limit reached or unavailable. */
  disabled?: boolean;
  /**
   * Drawn straight on a photo (deal cards): white price and a light struck
   * price, both with a shadow, instead of orange/grey on a white background.
   */
  onDark?: boolean;
  testID?: string;
}

export const OfferPrice: React.FC<OfferPriceProps> = ({
  dealPrice,
  originalPrice,
  size = 25,
  disabled = false,
  onDark = false,
  testID = 'offer-price',
}) => {
  const priceColor = disabled
    ? COLORS.priceDisabled
    : onDark
      ? COLORS.priceOnDark
      : COLORS.price;
  const circleColor = disabled ? COLORS.circleDisabled : COLORS.price;
  const showOriginal = originalPrice != null && originalPrice > dealPrice;

  return (
    <View style={styles.row} testID={testID}>
      <View
        style={styles.circleWrap}
        accessible
        accessibilityLabel={
          showOriginal
            ? `Offer price ${dealPrice} rupees, was ${originalPrice} rupees`
            : `Price ${dealPrice} rupees`
        }
      >
        <Svg
          style={StyleSheet.absoluteFill}
          viewBox="0 0 100 50"
          preserveAspectRatio="none"
        >
          <Path
            d={CIRCLE_PATH}
            fill="none"
            stroke={circleColor}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </Svg>
        <Text
          style={[
            styles.price,
            onDark && styles.shadowOnDark,
            { fontSize: size, lineHeight: size * 1.15, color: priceColor },
          ]}
        >
          {/* The rupee sign is smaller and raised so the number leads. */}
          <Text style={{ fontSize: size * 0.64 }}>₹</Text>
          {dealPrice}
        </Text>
      </View>

      {showOriginal ? (
        <Text
          style={[
            styles.original,
            onDark && styles.shadowOnDark,
            onDark && { color: COLORS.originalOnDark },
          ]}
          importantForAccessibility="no"
        >
          ₹{originalPrice}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  circleWrap: {
    // The ring is an absoluteFill SVG over this box, so more padding grows the
    // ring OUTWARD from the number — giving the price clear margin inside it.
    // Kalam's digits lean right past their measured width, so a little extra on
    // the right keeps the number optically centred in the ring.
    paddingLeft: 16,
    paddingRight: 21,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  price: {
    textAlign: 'center',
    // Android pads text for accents by default, which pushed the price below
    // the middle of the ring.
    includeFontPadding: false,
    textAlignVertical: 'center',
    // Kalam is loaded in App.tsx alongside Poppins; its ₹ glyph is present, so
    // the rupee sign never falls back to a system face.
    fontFamily: 'Kalam_700Bold',
    letterSpacing: 0,
  },
  original: {
    marginLeft: 6,
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 11,
    letterSpacing: 0.1,
    color: COLORS.original,
    textDecorationLine: 'line-through',
  },
  shadowOnDark: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
