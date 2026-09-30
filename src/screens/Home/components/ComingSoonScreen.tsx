import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Stop, Circle, Rect } from 'react-native-svg';

const { width: W } = Dimensions.get('window');

/* ── Brand tokens ───────────────────────────────────────────────────────── */
const GREEN = '#00B14F';
const GREEN_DEEP = '#0A7A3C';
const YELLOW = '#FFC021';
const INK = '#14181B';
const HEAD_GREY = '#C4CAD1'; // the quiet part of the headline
const SUBTLE = '#7A828B';
const SKYLINE = '#ECEFF3';
const SKYLINE_2 = '#E1E6EC';

/* The rider image is a fixed art size; the Tazty backpack is positioned over
 * its back as a fraction of the rendered image box, so it scales with it.
 * Nudge these three if the pack should sit differently on the rider. */
const RIDER_W = Math.min(W * 0.66, 280);
const RIDER_H = RIDER_W * 1.04;
const BAG = {
  leftPct: 0.02,
  topPct: 0.5,
  sizePct: 0.3,
};

interface ComingSoonScreenProps {
  /** Locality shown in the message, e.g. "Anna Nagar". */
  areaName?: string;
  /** Fired when the rider taps "Notify me". */
  onNotify: () => void;
  /** Spinner on the CTA while the waitlist request is in flight. */
  notifyLoading?: boolean;
  /** Once the area is on the waitlist, the CTA becomes a confirmation. */
  notified?: boolean;
  onHelp: () => void;
  onInstagram: () => void;
}

/**
 * Shown on Home when the user is outside the serviceable area. Reframes "we
 * don't serve you" as "we're on our way": the rider is en route, and one tap
 * puts the neighbourhood on the waitlist.
 */
export const ComingSoonScreen: React.FC<ComingSoonScreenProps> = ({
  areaName,
  onNotify,
  notifyLoading = false,
  notified = false,
  onHelp,
  onInstagram,
}) => {
  const enter = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const scroll = useRef(new Animated.Value(0)).current; // buildings sliding past

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // The rider bobs gently, as if riding over the road…
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // …while the city slides left behind him, so he reads as moving forward.
    Animated.loop(
      Animated.timing(scroll, {
        toValue: 1,
        duration: 5200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const contentY = enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const bob = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const skylineX = scroll.interpolate({ inputRange: [0, 1], outputRange: [0, -W] });

  const where = areaName && areaName.trim().length > 0 ? areaName.trim() : 'your area';
  const SKY_W = W;
  const SKY_H = RIDER_H + 40;

  return (
    <Animated.View style={[styles.root, { opacity: enter, transform: [{ translateY: contentY }] }]}>
      {/* Headline — quiet grey line, then the neighbourhood in brand green */}
      <View style={styles.headline}>
        <Text style={styles.headTop}>COMING SOON TO YOUR</Text>
        <View style={styles.headAccentRow}>
          <MaterialIcons name="place" size={22} color={GREEN} style={styles.headDot} />
          <Text style={styles.headAccent}>NEIGHBOURHOOD</Text>
          <MaterialIcons name="restaurant" size={20} color={YELLOW} style={styles.headDot} />
        </View>
      </View>

      {/* Illustration: a soft halo + a city that slides left, so the rider reads
          as riding forward. */}
      <View style={styles.stage}>
        {/* static soft halo behind the rider */}
        <Svg width={SKY_W} height={SKY_H} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="42%" r="52%">
              <Stop offset="0" stopColor={GREEN} stopOpacity="0.10" />
              <Stop offset="0.6" stopColor={GREEN} stopOpacity="0.04" />
              <Stop offset="1" stopColor={GREEN} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={SKY_W / 2} cy={SKY_H * 0.42} r={SKY_W * 0.34} fill="url(#halo)" />
        </Svg>

        {/* two identical skyline+road tiles scrolling left, wrapping seamlessly */}
        <Animated.View
          style={[
            styles.skylineTrack,
            { width: SKY_W * 2, height: SKY_H, transform: [{ translateX: skylineX }] },
          ]}
          pointerEvents="none"
        >
          {renderTile(SKY_W, SKY_H)}
          {renderTile(SKY_W, SKY_H)}
        </Animated.View>

        {/* rider — bobs in place while the world scrolls behind him */}
        <Animated.View style={{ transform: [{ translateY: bob }] }}>
          <View style={styles.riderBox}>
            <Image
              source={require('../../../../assets/delivery_man.png')}
              style={styles.rider}
              resizeMode="contain"
            />
            {/* Tazty-branded delivery pack, sitting on the rider's back */}
            <View style={styles.bag} pointerEvents="none">
              <View style={styles.bagPanel} />
              <Text style={styles.bagText} numberOfLines={1}>
                Tazty
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Message */}
      <Text style={styles.body}>
        We only serve Madurai city right now — but we're expanding fast. We'll
        ping you the moment Tazty reaches {where}.
      </Text>

      {/* Primary action */}
      <TouchableOpacity
        style={[styles.cta, notified && styles.ctaDone]}
        onPress={onNotify}
        disabled={notifyLoading || notified}
        activeOpacity={0.88}
        testID="coming-soon-notify"
      >
        {notifyLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : notified ? (
          <>
            <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
            <Text style={styles.ctaText}>You're on the list</Text>
          </>
        ) : (
          <Text style={styles.ctaText}>Notify me when we launch</Text>
        )}
      </TouchableOpacity>

      {/* Footer links */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={onHelp} activeOpacity={0.7} testID="coming-soon-help">
          <Text style={styles.footerLink}>Need help?</Text>
        </TouchableOpacity>
        <Text style={styles.footerDivider}>·</Text>
        <TouchableOpacity onPress={onInstagram} activeOpacity={0.7} testID="coming-soon-instagram">
          <Text style={styles.footerLink}>Follow us on Instagram</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

/** One repeating tile: a flat city skyline with a road + lane dashes. Two of
 *  these slide left in a loop so the rider reads as moving forward. */
function renderTile(w: number, h: number) {
  const base = h * 0.9;
  const buildings = [
    { x: 0.02, w: 0.09, h: 0.3 },
    { x: 0.13, w: 0.07, h: 0.5 },
    { x: 0.22, w: 0.1, h: 0.22 },
    { x: 0.34, w: 0.08, h: 0.4 },
    { x: 0.44, w: 0.06, h: 0.28 },
    { x: 0.52, w: 0.1, h: 0.46 },
    { x: 0.64, w: 0.07, h: 0.24 },
    { x: 0.73, w: 0.09, h: 0.54 },
    { x: 0.84, w: 0.07, h: 0.3 },
    { x: 0.92, w: 0.07, h: 0.42 },
  ];
  return (
    <Svg width={w} height={h}>
      {buildings.map((b, i) => (
        <Rect
          key={i}
          x={w * b.x}
          y={base - h * b.h}
          width={w * b.w}
          height={h * b.h}
          rx={3}
          fill={i % 2 === 0 ? SKYLINE : SKYLINE_2}
        />
      ))}
      {/* road line the rider travels along */}
      <Rect x={0} y={base} width={w} height={2.5} fill={SKYLINE_2} />
      {/* lane dashes — they slide with the tile, selling forward motion */}
      {[0.08, 0.32, 0.56, 0.8].map((x, i) => (
        <Rect
          key={`d${i}`}
          x={w * x}
          y={base + 9}
          width={w * 0.07}
          height={3}
          rx={1.5}
          fill={GREEN}
          opacity={0.25}
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  /* Headline */
  headline: {
    alignItems: 'center',
    marginBottom: 4,
  },
  headTop: {
    fontFamily: 'BalooThambi2_800ExtraBold',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 1.2,
    color: HEAD_GREY,
    textAlign: 'center',
  },
  headAccentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headAccent: {
    fontFamily: 'BalooThambi2_800ExtraBold',
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: 0.6,
    color: GREEN,
    textAlign: 'center',
  },
  headDot: {
    marginHorizontal: 6,
  },
  /* Illustration stage */
  stage: {
    width: W,
    height: RIDER_H + 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  skylineTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    flexDirection: 'row',
  },
  riderBox: {
    width: RIDER_W,
    height: RIDER_H,
  },
  rider: {
    width: RIDER_W,
    height: RIDER_H,
  },
  bag: {
    position: 'absolute',
    left: RIDER_W * BAG.leftPct,
    top: RIDER_H * BAG.topPct,
    width: RIDER_W * BAG.sizePct,
    height: RIDER_W * BAG.sizePct,
    backgroundColor: GREEN,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: GREEN_DEEP,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  bagPanel: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    height: '38%',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 6,
  },
  bagText: {
    fontFamily: 'CooperBlack',
    fontSize: RIDER_W * BAG.sizePct * 0.26,
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginTop: '18%',
  },
  /* Message */
  body: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 14.5,
    lineHeight: 22,
    letterSpacing: 0.1,
    color: SUBTLE,
    textAlign: 'center',
    maxWidth: 340,
    marginTop: 4,
  },
  /* CTA */
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 27,
    backgroundColor: GREEN,
    marginTop: 24,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaDone: {
    backgroundColor: GREEN_DEEP,
    shadowOpacity: 0.18,
  },
  ctaText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  /* Footer */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  footerLink: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0.2,
    color: INK,
    textDecorationLine: 'underline',
  },
  footerDivider: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#B6BBC1',
  },
});

export default ComingSoonScreen;
