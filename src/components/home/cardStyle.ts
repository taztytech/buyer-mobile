/**
 * Restaurant card look (mirror of the Buyer API's restaurant-card/card-style.ts).
 * The global style comes in the Home payload (restaurant_card_style); each
 * restaurant may carry `card` extras (badge, tagline, chips, layout tweaks).
 */

export type CardLayout = 'overlay' | 'split' | 'classic';

export interface CardStyle {
  layout: CardLayout;
  overlay: 'dark' | 'light';
  overlayStrength: number;
  height: number;
  radius: number;
  borderColor: string | null;
  borderWidth: number;
  shadow: boolean;
  positions: {
    name: 'top-left' | 'center-left' | 'bottom-left';
    badge: 'top-left' | 'top-right' | 'hidden';
    time: 'bottom-right' | 'top-right' | 'hidden';
    chips: boolean;
  };
  colors: {
    name: string;
    meta: string;
    ratingBg: string;
    chipBg: string;
    chipText: string;
    timeBg: string;
    timeText: string;
  };
  nameWeight: number;
  photos: { rolling: boolean; intervalSec: number };
}

export interface CardBadge {
  text: string;
  color: string;
  icon: string;
}

export interface CardTagline {
  text: string;
  font: 'script' | 'bold' | 'serif';
  color: string;
  x: number;
  y: number;
  size: number;
  rotate: number;
}

export interface CardChip {
  key: string;
  label: string;
  icon: string;
}

export interface CardExtras {
  badge: CardBadge | null;
  tagline: CardTagline | null;
  chips: CardChip[];
  layout: Partial<Pick<CardStyle, 'layout' | 'overlay' | 'overlayStrength'>> & {
    positions?: Partial<CardStyle['positions']>;
  };
}

const DARK_COLORS: CardStyle['colors'] = {
  name: '#FFFFFF',
  meta: 'rgba(255,255,255,0.88)',
  ratingBg: '#1BA94C',
  chipBg: 'rgba(0,0,0,0.45)',
  chipText: '#FFFFFF',
  timeBg: '#FFFFFF',
  timeText: '#1A1A1A',
};

const LIGHT_COLORS: CardStyle['colors'] = {
  name: '#1A1A1A',
  meta: '#4A4A4A',
  ratingBg: '#1BA94C',
  chipBg: '#FFFFFF',
  chipText: '#2A2A2A',
  timeBg: '#FFFFFF',
  timeText: '#1A1A1A',
};

export const DEFAULT_CARD_STYLE: CardStyle = {
  layout: 'overlay',
  overlay: 'dark',
  overlayStrength: 0.75,
  height: 196,
  radius: 22,
  borderColor: null,
  borderWidth: 0,
  shadow: true,
  positions: { name: 'center-left', badge: 'top-left', time: 'bottom-right', chips: true },
  colors: DARK_COLORS,
  nameWeight: 800,
  photos: { rolling: true, intervalSec: 3 },
};

export const normalizeCardStyle = (raw: any): CardStyle => {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_CARD_STYLE;
  const overlay = r.overlay === 'light' ? 'light' : 'dark';
  return {
    ...d,
    ...r,
    overlay,
    positions: { ...d.positions, ...(r.positions || {}) },
    colors: { ...(overlay === 'light' ? LIGHT_COLORS : DARK_COLORS), ...(r.colors || {}) },
    photos: { ...d.photos, ...(r.photos || {}) },
  };
};

/**
 * The style one card uses: the global look with this restaurant's tweaks.
 * Flipping a single card to light/dark also swaps to that overlay's text
 * colours unless the global style set its own.
 */
export const cardStyleFor = (global: CardStyle, extras?: CardExtras | null): CardStyle => {
  const l = extras?.layout;
  if (!l || !Object.keys(l).length) return global;
  const overlay = l.overlay ?? global.overlay;
  const colors =
    overlay !== global.overlay ? (overlay === 'light' ? LIGHT_COLORS : DARK_COLORS) : global.colors;
  return {
    ...global,
    layout: l.layout ?? global.layout,
    overlay,
    overlayStrength: l.overlayStrength ?? global.overlayStrength,
    positions: { ...global.positions, ...(l.positions || {}) },
    colors,
  };
};
