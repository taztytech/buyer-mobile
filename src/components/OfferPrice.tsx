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

const CIRCLE_PATH =
  'M60 4 C 90 2, 99 18, 96 30 C 92 46, 30 50, 10 40 C -4 32, 2 10, 26 5 C 40 2, 58 3, 70 7';

const COLORS = {
  price: '#E8501C',
  priceDisabled: '#AAAAAA',
  circleDisabled: '#C8C8C8',
  original: '#9A948E',
};

interface OfferPriceProps {
  dealPrice: number;
  /** Menu price. Hidden when it is not above the deal price. */
  originalPrice?: number;
  /** 25 on Home cards, 30 on the ₹99 Store page. */
  size?: number;
  /** Sold out, limit reached or unavailable. */
  disabled?: boolean;
  testID?: string;
}

export const OfferPrice: React.FC<OfferPriceProps> = ({
  dealPrice,
  originalPrice,
  size = 25,
  disabled = false,
  testID = 'offer-price',
}) => {
  const priceColor = disabled ? COLORS.priceDisabled : COLORS.price;
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
            { fontSize: size, lineHeight: size * 1.15, color: priceColor },
          ]}
        >
          {/* The rupee sign is smaller and raised so the number leads. */}
          <Text style={{ fontSize: size * 0.64 }}>₹</Text>
          {dealPrice}
        </Text>
      </View>

      {showOriginal ? (
        <Text style={styles.original} importantForAccessibility="no">
          ₹{originalPrice}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  circleWrap: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    marginLeft: -2,
  },
  price: {
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
});
