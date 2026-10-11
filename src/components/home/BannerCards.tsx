import React from 'react';
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Image as SvgImage,
  Line,
  LinearGradient as SvgGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode, Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { OptimizedImage } from '@/components/OptimizedImage';
import type { OrgCard } from './HomeTopDash';
import { roundedPolygon } from './ServiceTabs';
import type { BannerCardsStyle, EnginePreset } from './bannerCardsStyle';

/**
 * The home banner boxes under the search bar, drawn the way the admin set
 * them in Banner Cards Studio: a row, a one-by-one carousel, or a train whose
 * coaches carry the banners. Motion runs only while `active` (dash on screen,
 * Home focused), the app is in front and the phone allows motion.
 */

const SIDE = 16;

interface BannerCardsProps {
  cards: OrgCard[];
  style: BannerCardsStyle;
  active: boolean;
  onPress?: (card: OrgCard) => void;
}

const useMotionAllowed = (active: boolean) => {
  const [appActive, setAppActive] = React.useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = React.useState(false);
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', s => setAppActive(s === 'active'));
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const rm = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      sub.remove();
      rm.remove();
    };
  }, []);
  return { running: active && appActive && !reduceMotion, reduceMotion, visible: active && appActive };
};

/* --------------------------------- one box -------------------------------- */

const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '');

const titleAlign = { top: 'flex-start', center: 'center', bottom: 'flex-end' } as const;

interface BoxProps {
  card: OrgCard;
  w: number;
  h: number;
  look: BannerCardsStyle;
  playVideo: boolean;
  borderColor?: string;
  borderWidth?: number;
  /** Stills only (train coaches): a video plays only when there is no still. */
  preferStill?: boolean;
}

const BannerBox: React.FC<BoxProps> = ({ card, w, h, look, playVideo, borderColor, borderWidth, preferStill }) => {
  const uid = safeId(React.useId());
  const { box, title } = look;
  const bColor = borderColor ?? box.borderColor;
  const bWidth = borderWidth ?? box.borderWidth;
  const still = card.imageUrl || card.posterUrl;
  const showVideo = !!card.videoUrl && playVideo && !(preferStill && still);
  const hasTitle = title.show && !!card.title;
  const fadeTop = title.position === 'top';
  const fadeColors =
    title.position === 'center'
      ? (['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.35)'] as const)
      : fadeTop
        ? (['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'] as const)
        : (['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)'] as const);

  const titleEl = hasTitle ? (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { justifyContent: titleAlign[title.position], padding: 7 }]}
    >
      <Text
        numberOfLines={2}
        style={[
          styles.title,
          { fontSize: title.size, lineHeight: Math.round(title.size * 1.2), color: title.color },
        ]}
      >
        {card.title}
      </Text>
    </View>
  ) : null;

  if (box.shape) {
    const shapeR = Math.min(w, h) * box.shape.roundness;
    const inset = bWidth / 2;
    const pts = box.shape.points.map(
      ([x, y]) => [inset + x * (w - bWidth), inset + y * (h - bWidth)] as [number, number],
    );
    const d = roundedPolygon(pts, shapeR);
    const fadeH = title.position === 'center' ? h : h * 0.6;
    const fadeY = title.position === 'bottom' ? h - fadeH : 0;
    return (
      <View style={{ width: w, height: h }}>
        {showVideo && (
          <View style={[StyleSheet.absoluteFill, { borderRadius: shapeR, overflow: 'hidden' }]}>
            <Video
              source={{ uri: card.videoUrl as string }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted
              useNativeControls={false}
            />
          </View>
        )}
        <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <ClipPath id={`c${uid}`}>
              <Path d={d} />
            </ClipPath>
            <SvgGradient id={`f${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000" stopOpacity={fadeTop || title.position === 'center' ? 0.5 : 0} />
              <Stop offset="1" stopColor="#000" stopOpacity={fadeTop ? 0 : 0.5} />
            </SvgGradient>
          </Defs>
          {box.shadow && <Path d={d} fill="rgba(0,40,15,0.22)" transform="translate(1.5, 3)" />}
          {!showVideo && (
            <Path d={d} fill={card.backgroundColor || '#FFF4DE'} />
          )}
          {!showVideo && !!still && (
            <SvgImage
              href={{ uri: still }}
              x={0}
              y={0}
              width={w}
              height={h}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#c${uid})`}
            />
          )}
          {hasTitle && title.fade && (
            <Rect x={0} y={fadeY} width={w} height={fadeH} fill={`url(#f${uid})`} clipPath={`url(#c${uid})`} />
          )}
          {bWidth > 0 && <Path d={d} fill="none" stroke={bColor} strokeWidth={bWidth} />}
        </Svg>
        {titleEl}
      </View>
    );
  }

  return (
    <View
      style={[
        {
          width: w,
          height: h,
          borderRadius: box.radius,
          backgroundColor: card.backgroundColor || '#FFF4DE',
        },
        box.shadow && styles.shadow,
      ]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: box.radius, overflow: 'hidden', borderWidth: bWidth, borderColor: bColor },
        ]}
      >
        {!!still && (
          <OptimizedImage
            source={still}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            shimmerWidth={w}
            shimmerHeight={h}
            transition={200}
            cachePolicy="memory-disk"
          />
        )}
        {showVideo && (
          <Video
            source={{ uri: card.videoUrl as string }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted
            useNativeControls={false}
          />
        )}
        {hasTitle && title.fade && (
          <LinearGradient
            colors={fadeColors}
            style={[
              styles.fade,
              title.position === 'center'
                ? { top: 0, bottom: 0 }
                : fadeTop
                  ? { top: 0, height: h * 0.6 }
                  : { bottom: 0, height: h * 0.6 },
            ]}
            pointerEvents="none"
          />
        )}
      </View>
      {titleEl}
    </View>
  );
};

/* ---------------------------------- row ---------------------------------- */

const RowCards: React.FC<BannerCardsProps & { playVideo: boolean }> = ({ cards, style, playVideo, onPress }) => {
  const { width } = useWindowDimensions();
  const { box } = style;
  const n = cards.length;
  const h = box.height;
  // Up to four fill the row; more scroll at the admin's width ratio.
  const w = n <= 4 ? (width - SIDE * 2 - box.gap * (n - 1)) / n : Math.round(h * box.widthRatio);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={n > 4}
      contentContainerStyle={styles.rowContent}
      testID="org-cards"
    >
      {cards.map((c, i) => (
        <Pressable
          key={c.id}
          disabled={!onPress}
          onPress={() => onPress?.(c)}
          style={i < n - 1 && { marginRight: box.gap }}
          testID={`org-card-${c.id}`}
        >
          <BannerBox card={c} w={w} h={h} look={style} playVideo={playVideo} />
        </Pressable>
      ))}
    </ScrollView>
  );
};

/* -------------------------------- carousel ------------------------------- */

const CarouselCards: React.FC<BannerCardsProps & { running: boolean; playVideo: boolean }> = ({
  cards,
  style,
  running,
  playVideo,
  onPress,
}) => {
  const { width } = useWindowDimensions();
  const ref = React.useRef<ScrollView>(null);
  const dragging = React.useRef(false);
  const indexRef = React.useRef(0);
  const { box } = style;
  const h = box.height;
  const w = Math.min(Math.round(h * box.widthRatio), width - SIDE * 2);
  const step = w + box.gap;
  const maxOffset = Math.max(0, SIDE * 2 + cards.length * step - box.gap - width);

  React.useEffect(() => {
    if (!running || maxOffset <= 0 || cards.length < 2) return;
    const id = setInterval(() => {
      if (dragging.current) return;
      let next = indexRef.current + 1;
      if (next * step > maxOffset + step - 1) next = 0;
      indexRef.current = next;
      ref.current?.scrollTo({ x: Math.min(next * step, maxOffset), animated: true });
    }, style.carousel.intervalSec * 1000);
    return () => clearInterval(id);
  }, [running, maxOffset, step, cards.length, style.carousel.intervalSec]);

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      contentContainerStyle={styles.rowContent}
      onScrollBeginDrag={() => {
        dragging.current = true;
      }}
      onMomentumScrollEnd={e => {
        dragging.current = false;
        indexRef.current = Math.round(e.nativeEvent.contentOffset.x / step);
      }}
      testID="org-cards-carousel"
    >
      {cards.map((c, i) => (
        <Pressable
          key={c.id}
          disabled={!onPress}
          onPress={() => onPress?.(c)}
          style={i < cards.length - 1 && { marginRight: box.gap }}
          testID={`org-card-${c.id}`}
        >
          <BannerBox card={c} w={w} h={h} look={style} playVideo={playVideo} />
        </Pressable>
      ))}
    </ScrollView>
  );
};

/* ---------------------------------- train --------------------------------- */

interface TrainPlan {
  W: number;
  L: number;
  speed: number;
  stop: boolean;
  stopSec: number;
  gapSec: number;
  right: boolean;
}

/** Cycle length (s) of one pass. */
const trainCycle = (p: TrainPlan) => {
  'worklet';
  if (!p.stop) return (p.W + p.L) / p.speed + p.gapSec;
  const stopX = (p.W - p.L) / 2;
  const d1 = (2 * (p.W - stopX)) / p.speed;
  const d2 = (2 * (stopX + p.L)) / p.speed;
  return d1 + p.stopSec + d2 + p.gapSec;
};

/** Train position (left edge, px) and whether it is moving, at time t. */
const trainAt = (t: number, p: TrainPlan): [number, number] => {
  'worklet';
  const cycle = trainCycle(p);
  const u = t % cycle;
  let x = -p.L;
  let moving = 0;
  if (!p.stop) {
    const dur = (p.W + p.L) / p.speed;
    if (u < dur) {
      x = p.W - u * p.speed;
      moving = 1;
    }
  } else {
    const stopX = (p.W - p.L) / 2;
    const d1 = (2 * (p.W - stopX)) / p.speed;
    const d2 = (2 * (stopX + p.L)) / p.speed;
    if (u < d1) {
      const k = u / d1;
      x = p.W - (p.W - stopX) * (1 - (1 - k) * (1 - k));
      moving = 1 - k;
    } else if (u < d1 + p.stopSec) {
      x = stopX;
    } else if (u < d1 + p.stopSec + d2) {
      const k = (u - d1 - p.stopSec) / d2;
      x = stopX - (stopX + p.L) * k * k;
      moving = k;
    }
  }
  if (p.right) x = p.W - x - p.L;
  return [x, Math.min(1, moving * 3)];
};

const Wheel: React.FC<{ r: number; color: string; rot: SharedValue<number> }> = ({ r, color, rot }) => {
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}rad` }] }));
  const s = r * 2;
  return (
    <Animated.View style={[{ width: s, height: s }, st]}>
      <Svg width={s} height={s}>
        <Circle cx={r} cy={r} r={r - 0.8} fill={color} stroke="#B0BEC5" strokeWidth={1.4} />
        <Line x1={r} y1={1.5} x2={r} y2={s - 1.5} stroke="#B0BEC5" strokeWidth={1.2} />
        <Line x1={1.5} y1={r} x2={s - 1.5} y2={r} stroke="#B0BEC5" strokeWidth={1.2} />
        <Circle cx={r} cy={r} r={r * 0.3} fill="#B0BEC5" />
      </Svg>
    </Animated.View>
  );
};

const FLAG_COLORS = ['#FF5252', '#FFD54A', '#69F0AE', '#40C4FF', '#FF4081', '#FFAB40'];

/** Engine art in a 125×100 box, facing left (front at x = 0). */
const EngineSvg: React.FC<{ preset: EnginePreset; color: string; accent: string; w: number; h: number }> = ({
  preset,
  color,
  accent,
  w,
  h,
}) => {
  const dark = '#263238';
  if (preset === 'bullet') {
    return (
      <Svg width={w} height={h} viewBox="0 0 125 100">
        <Path d="M0,92 C0,62 28,30 72,28 L125,28 L125,92 Z" fill={color} />
        <Path d="M26,50 C36,40 52,36 70,36 L70,50 L24,54 Z" fill="#BBDEFB" />
        <Rect x={78} y={38} width={16} height={14} rx={3} fill="#BBDEFB" />
        <Rect x={100} y={38} width={16} height={14} rx={3} fill="#BBDEFB" />
        <Path d="M10,74 L125,70 L125,77 L8,80 Z" fill={accent} />
        <Circle cx={9} cy={84} r={3.2} fill="#FFF59D" />
        <Rect x={6} y={90} width={119} height={6} fill={dark} />
      </Svg>
    );
  }
  const toy = preset === 'toy';
  return (
    <Svg width={w} height={h} viewBox="0 0 125 100">
      {/* cowcatcher + frame */}
      <Polygon points="0,100 14,74 16,100" fill={dark} />
      <Rect x={10} y={86} width={113} height={10} rx={2} fill={dark} />
      {/* chimney */}
      <Rect x={20} y={16} width={12} height={32} fill={toy ? accent : dark} />
      {toy ? (
        <Circle cx={26} cy={14} r={10} fill={dark} />
      ) : (
        <Rect x={16} y={10} width={20} height={7} rx={2} fill={dark} />
      )}
      {/* boiler */}
      <Rect x={12} y={44} width={72} height={42} rx={toy ? 21 : 16} fill={color} />
      <Rect x={32} y={44} width={4} height={42} fill={accent} />
      <Rect x={54} y={44} width={4} height={42} fill={accent} />
      <Ellipse cx={46} cy={44} rx={8} ry={7} fill={accent} />
      <Circle cx={14} cy={58} r={preset === 'festival' ? 7 : 5} fill={preset === 'festival' ? '#FF9800' : accent} />
      {/* cabin */}
      <Rect x={78} y={20} width={45} height={68} rx={toy ? 10 : 4} fill={color} />
      <Rect x={74} y={13} width={51} height={9} rx={toy ? 5 : 3} fill={dark} />
      <Rect x={88} y={30} width={25} height={21} rx={3} fill="#BBDEFB" stroke={accent} strokeWidth={2} />
      <Rect x={12} y={76} width={111} height={4} fill={accent} />
      {preset === 'festival' && (
        <G>
          <Path d="M28,10 Q64,34 100,13" stroke={accent} strokeWidth={1.5} fill="none" />
          {[0.15, 0.32, 0.5, 0.68, 0.85].map((k, i) => {
            const x = 28 + (100 - 28) * k;
            const y = (1 - k) * (1 - k) * 10 + 2 * (1 - k) * k * 34 + k * k * 13;
            return <Polygon key={k} points={`${x - 4},${y} ${x + 4},${y} ${x},${y + 8}`} fill={FLAG_COLORS[i]} />;
          })}
        </G>
      )}
    </Svg>
  );
};

const PUFFS = 6;

const Puff: React.FC<{ i: number; t: SharedValue<number>; moving: SharedValue<number>; size: number }> = ({
  i,
  t,
  moving,
  size,
}) => {
  const st = useAnimatedStyle(() => {
    const p = (t.value * 0.9 + i / PUFFS) % 1;
    return {
      opacity: (1 - p) * 0.8 * moving.value,
      transform: [{ translateX: p * size * 1.8 }, { translateY: -p * size * 2.2 }, { scale: 0.4 + p * 1.2 }],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: size / 2 },
        { backgroundColor: 'rgba(255,255,255,0.92)' },
        st,
      ]}
    />
  );
};

const TrainCards: React.FC<BannerCardsProps & { running: boolean; reduceMotion: boolean; playVideo: boolean }> = ({
  cards,
  style,
  running,
  reduceMotion,
  playVideo,
  onPress,
}) => {
  const { width: W } = useWindowDimensions();
  const tr = style.train;
  const h = style.box.height;
  const photoW = Math.round(h * style.box.widthRatio);
  const pad = 5;
  const stripeH = 4;
  const coachW = photoW + pad * 2;
  const bodyH = h + pad * 2 + stripeH;
  const wheelR = tr.wheels.show ? Math.max(6, Math.round(h * 0.09)) : 0;
  const under = tr.wheels.show ? wheelR + 3 : 3;
  const engineH = bodyH + 14;
  const engineW = Math.round(engineH * 1.25);
  const coupling = 8;
  const L = engineW + cards.length * (coupling + coachW);
  const topPad = tr.smoke ? 24 : 6;
  const carH = engineH + under;
  const trackH = tr.track.show ? 8 : 0;
  const height = topPad + carH + trackH;
  const right = tr.direction === 'right';

  const plan = React.useMemo<TrainPlan>(
    () => ({
      W,
      L,
      speed: tr.speed,
      stop: tr.motion === 'stop',
      stopSec: tr.stopSec,
      gapSec: tr.gapSec,
      right,
    }),
    [W, L, tr.speed, tr.motion, tr.stopSec, tr.gapSec, right],
  );

  const t = useSharedValue(0);
  const pos = useSharedValue(W);
  const moving = useSharedValue(0);
  const rot = useSharedValue(0);

  // Reduced motion: park the train in the middle with every coach showing.
  React.useEffect(() => {
    if (!reduceMotion) return;
    pos.value = (W - L) / 2;
    moving.value = 0;
  }, [reduceMotion, W, L]); // eslint-disable-line react-hooks/exhaustive-deps

  const frame = useFrameCallback(info => {
    const dt = Math.min(info.timeSincePreviousFrame ?? 16, 64) / 1000;
    t.value += dt;
    const [x, m] = trainAt(t.value, plan);
    rot.value += (x - pos.value) / Math.max(wheelR, 1);
    pos.value = x;
    moving.value = m;
  }, false);

  React.useEffect(() => {
    frame.setActive(running);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new plan (admin change, rotation): start a fresh pass.
  React.useEffect(() => {
    t.value = 0;
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  // Optional whistle each time the train comes in.
  const soundRef = React.useRef<Audio.Sound | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    if (!tr.soundUrl) return;
    Audio.Sound.createAsync({ uri: tr.soundUrl }, { volume: 0.5 })
      .then(({ sound }) => {
        if (cancelled) sound.unloadAsync().catch(() => undefined);
        else soundRef.current = sound;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    };
  }, [tr.soundUrl]);
  const whistle = React.useCallback(() => {
    soundRef.current?.replayAsync().catch(() => undefined);
  }, []);
  useAnimatedReaction(
    () => Math.floor(t.value / trainCycle(plan)),
    (cur, prev) => {
      if (prev !== null && cur !== prev) runOnJS(whistle)();
    },
    [plan, whistle],
  );

  const trainStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value }] }));
  const bobEngine = useAnimatedStyle(() => ({
    transform: [{ translateY: tr.bounce ? Math.sin(t.value * 22) * 1.3 * moving.value : 0 }],
  }));
  const bobCoach = useAnimatedStyle(() => ({
    transform: [{ translateY: tr.bounce ? Math.sin(t.value * 22 + 1.7) * 1.1 * moving.value : 0 }],
  }));

  const tapCoach = (c: OrgCard) => {
    if (tr.haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onPress?.(c);
  };

  const art = tr.engine.artUrl;
  const artIsLottie = !!art && /\.json(\?|$)/i.test(art);
  const hasChimney = tr.smoke && (!!art || tr.engine.preset !== 'bullet');
  const puffSize = Math.max(9, Math.round(engineH * 0.16));
  const flip = right ? [{ scaleX: -1 }] : [];

  const engine = (
    <Animated.View key="engine" style={[{ width: engineW, height: carH }, bobEngine]}>
      <View style={{ width: engineW, height: engineH, transform: flip }}>
        {art ? (
          artIsLottie ? (
            <LottieView source={{ uri: art }} autoPlay={running} loop style={{ width: engineW, height: engineH }} />
          ) : (
            <OptimizedImage
              source={art}
              style={{ width: engineW, height: engineH }}
              contentFit="contain"
              shimmerWidth={engineW}
              shimmerHeight={engineH}
              cachePolicy="memory-disk"
            />
          )
        ) : (
          <EngineSvg preset={tr.engine.preset} color={tr.engine.color} accent={tr.engine.accent} w={engineW} h={engineH} />
        )}
        {hasChimney && (
          <View style={{ position: 'absolute', left: engineW * 0.208, top: engineH * 0.1 }} pointerEvents="none">
            {Array.from({ length: PUFFS }, (_, i) => (
              <Puff key={i} i={i} t={t} moving={moving} size={puffSize} />
            ))}
          </View>
        )}
      </View>
      {tr.wheels.show && (
        <View style={[styles.wheels, { top: engineH - wheelR - 1, paddingHorizontal: engineW * 0.14 }]}>
          <Wheel r={wheelR} color={tr.wheels.color} rot={rot} />
          <Wheel r={wheelR} color={tr.wheels.color} rot={rot} />
          <Wheel r={Math.round(wheelR * 1.3)} color={tr.wheels.color} rot={rot} />
        </View>
      )}
    </Animated.View>
  );

  const parts: React.ReactNode[] = [engine];
  cards.forEach((c, i) => {
    parts.push(
      <View key={`k${c.id}`} style={[styles.coupling, { width: coupling, marginBottom: under + 8 }]} />,
    );
    parts.push(
      <Animated.View key={c.id} style={[{ width: coachW, height: carH, justifyContent: 'flex-end' }, bobCoach]}>
        <Pressable onPress={() => tapCoach(c)} testID={`org-card-${c.id}`} style={{ marginBottom: under }}>
          <LinearGradient
            colors={[tr.coach.color, tr.coach.color2]}
            style={[styles.coach, { width: coachW, height: bodyH, padding: pad, paddingBottom: pad + stripeH }]}
          >
            <BannerBox
              card={c}
              w={photoW}
              h={h}
              look={style}
              playVideo={playVideo && running && i < 4}
              preferStill
              borderColor={tr.coach.frame}
              borderWidth={Math.max(2, style.box.borderWidth)}
            />
            <View style={[styles.stripe, { height: stripeH, backgroundColor: tr.coach.stripe }]} />
          </LinearGradient>
        </Pressable>
        {tr.wheels.show && (
          <View style={[styles.wheels, { bottom: 0, paddingHorizontal: coachW * 0.1 }]} pointerEvents="none">
            <Wheel r={wheelR} color={tr.wheels.color} rot={rot} />
            <Wheel r={wheelR} color={tr.wheels.color} rot={rot} />
          </View>
        )}
      </Animated.View>,
    );
  });

  return (
    <View style={{ width: W, height, marginTop: 4, marginBottom: 8, overflow: 'hidden' }} testID="org-cards-train">
      {tr.track.show && (
        <Svg width={W} height={trackH} style={{ position: 'absolute', left: 0, top: topPad + carH - 1 }}>
          <Rect x={0} y={0} width={W} height={2.5} fill={tr.track.color} />
          {Array.from({ length: Math.ceil(W / 14) }, (_, i) => (
            <Rect key={i} x={i * 14 + 3} y={3} width={7} height={3} rx={1} fill={tr.track.color} opacity={0.6} />
          ))}
        </Svg>
      )}
      <Animated.View
        style={[
          styles.train,
          { top: topPad, width: L, height: carH, flexDirection: right ? 'row-reverse' : 'row' },
          trainStyle,
        ]}
      >
        {parts}
      </Animated.View>
    </View>
  );
};

/* --------------------------------- switch -------------------------------- */

export const BannerCards: React.FC<BannerCardsProps> = props => {
  const { running, reduceMotion, visible } = useMotionAllowed(props.active);
  if (!props.cards.length) return null;
  const playVideo = visible;
  if (props.style.mode === 'train') {
    return <TrainCards {...props} running={running} reduceMotion={reduceMotion} playVideo={playVideo} />;
  }
  if (props.style.mode === 'carousel') {
    return <CarouselCards {...props} running={running} playVideo={playVideo} />;
  }
  return <RowCards {...props} playVideo={playVideo} />;
};

const styles = StyleSheet.create({
  rowContent: { paddingHorizontal: SIDE, paddingTop: 10, paddingBottom: 14 },
  title: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  fade: { position: 'absolute', left: 0, right: 0 },
  shadow: {
    elevation: 4,
    shadowColor: '#002A10',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
  },
  train: { position: 'absolute', left: 0, alignItems: 'flex-end' },
  coach: { borderRadius: 9, overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  coupling: { height: 4, backgroundColor: '#37474F', borderRadius: 2 },
  wheels: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
