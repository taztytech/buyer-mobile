/**
 * Banner box look and motion (mirror of the Buyer API's
 * banner-cards/banner-cards-style.ts). Comes in the Home payload
 * (banner_cards_style) and from GET /banner-cards/style after a live push.
 */

export type BannerCardsMode = 'row' | 'carousel' | 'train';
export type EnginePreset = 'steam' | 'bullet' | 'toy' | 'festival';

export interface BannerShape {
  points: Array<[number, number]>;
  roundness: number;
}

export interface BannerCardsStyle {
  mode: BannerCardsMode;
  box: {
    shape: BannerShape | null;
    radius: number;
    height: number;
    widthRatio: number;
    gap: number;
    borderColor: string;
    borderWidth: number;
    shadow: boolean;
  };
  title: {
    show: boolean;
    position: 'top' | 'center' | 'bottom';
    size: number;
    color: string;
    fade: boolean;
  };
  carousel: { intervalSec: number };
  train: {
    engine: { preset: EnginePreset; artUrl: string | null; color: string; accent: string };
    coach: { color: string; color2: string; stripe: string; frame: string };
    wheels: { show: boolean; color: string };
    motion: 'continuous' | 'stop';
    speed: number;
    direction: 'left' | 'right';
    stopSec: number;
    gapSec: number;
    smoke: boolean;
    bounce: boolean;
    track: { show: boolean; color: string };
    soundUrl: string | null;
    haptic: boolean;
  };
}

export const DEFAULT_BANNER_CARDS_STYLE: BannerCardsStyle = {
  mode: 'row',
  box: {
    shape: null,
    radius: 16,
    height: 76,
    widthRatio: 1.35,
    gap: 8,
    borderColor: 'rgba(255,255,255,0.85)',
    borderWidth: 2,
    shadow: false,
  },
  title: { show: true, position: 'top', size: 11, color: '#FFFFFF', fade: true },
  carousel: { intervalSec: 3 },
  train: {
    engine: { preset: 'steam', artUrl: null, color: '#C62828', accent: '#FFD54A' },
    coach: { color: '#1565C0', color2: '#0D47A1', stripe: '#FFD54A', frame: '#FFFFFF' },
    wheels: { show: true, color: '#263238' },
    motion: 'stop',
    speed: 70,
    direction: 'left',
    stopSec: 5,
    gapSec: 2,
    smoke: true,
    bounce: true,
    track: { show: true, color: 'rgba(255,255,255,0.75)' },
    soundUrl: null,
    haptic: true,
  },
};

const num = (v: any, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const str = (v: any, d: string) => (typeof v === 'string' && v.trim() ? v.trim() : d);
const bool = (v: any, d: boolean) => (typeof v === 'boolean' ? v : d);
const pick = <T extends string>(v: any, all: readonly T[], d: T): T => (all.includes(v) ? v : d);
const url = (v: any) => (typeof v === 'string' && /^https?:\/\//.test(v) ? v : null);

const shapeOf = (raw: any): BannerShape | null => {
  const pts = raw?.points;
  if (!Array.isArray(pts) || pts.length < 3 || pts.length > 12) return null;
  const points: Array<[number, number]> = [];
  for (const p of pts) {
    const x = Number(p?.[0]);
    const y = Number(p?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    points.push([Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))]);
  }
  return { points, roundness: num(raw?.roundness, 0.2, 0, 0.5) };
};

/** The server already sanitises; this only keeps a bad payload from crashing Home. */
export const normalizeBannerCardsStyle = (raw: any): BannerCardsStyle => {
  const D = DEFAULT_BANNER_CARDS_STYLE;
  const b = raw?.box ?? {};
  const t = raw?.title ?? {};
  const tr = raw?.train ?? {};
  const e = tr.engine ?? {};
  const c = tr.coach ?? {};
  return {
    mode: pick(raw?.mode, ['row', 'carousel', 'train'] as const, D.mode),
    box: {
      shape: shapeOf(b.shape),
      radius: num(b.radius, D.box.radius, 0, 40),
      height: num(b.height, D.box.height, 56, 140),
      widthRatio: num(b.widthRatio, D.box.widthRatio, 0.6, 2),
      gap: num(b.gap, D.box.gap, 0, 24),
      borderColor: str(b.borderColor, D.box.borderColor),
      borderWidth: num(b.borderWidth, D.box.borderWidth, 0, 5),
      shadow: bool(b.shadow, D.box.shadow),
    },
    title: {
      show: bool(t.show, D.title.show),
      position: pick(t.position, ['top', 'center', 'bottom'] as const, D.title.position),
      size: num(t.size, D.title.size, 9, 16),
      color: str(t.color, D.title.color),
      fade: bool(t.fade, D.title.fade),
    },
    carousel: { intervalSec: num(raw?.carousel?.intervalSec, D.carousel.intervalSec, 2, 10) },
    train: {
      engine: {
        preset: pick(e.preset, ['steam', 'bullet', 'toy', 'festival'] as const, D.train.engine.preset),
        artUrl: url(e.artUrl),
        color: str(e.color, D.train.engine.color),
        accent: str(e.accent, D.train.engine.accent),
      },
      coach: {
        color: str(c.color, D.train.coach.color),
        color2: str(c.color2, D.train.coach.color2),
        stripe: str(c.stripe, D.train.coach.stripe),
        frame: str(c.frame, D.train.coach.frame),
      },
      wheels: {
        show: bool(tr.wheels?.show, D.train.wheels.show),
        color: str(tr.wheels?.color, D.train.wheels.color),
      },
      motion: pick(tr.motion, ['continuous', 'stop'] as const, D.train.motion),
      speed: num(tr.speed, D.train.speed, 20, 220),
      direction: pick(tr.direction, ['left', 'right'] as const, D.train.direction),
      stopSec: num(tr.stopSec, D.train.stopSec, 1, 20),
      gapSec: num(tr.gapSec, D.train.gapSec, 0, 30),
      smoke: bool(tr.smoke, D.train.smoke),
      bounce: bool(tr.bounce, D.train.bounce),
      track: {
        show: bool(tr.track?.show, D.train.track.show),
        color: str(tr.track?.color, D.train.track.color),
      },
      soundUrl: url(tr.soundUrl),
      haptic: bool(tr.haptic, D.train.haptic),
    },
  };
};
