/**
 * Top-dash theme (mirror of the Buyer API's theme-config.ts). The server
 * sanitises every config, but the app still treats each field as optional
 * and falls back to Default Green.
 */
import type { TabPalette } from '@/components/home/ServiceTabs';

export interface ThemeColors {
  dashFrom: string;
  dashTo: string;
  dashVia?: string | null;
  dashDirection: 'vertical' | 'horizontal' | 'diagonal';
  onDash: string;
  statusBar: 'light' | 'dark';
  tabSelectedFill: string;
  tabSelectedRing: string;
  tabSelectedText: string;
  tabFrom: string;
  tabTo: string;
  tabText: string;
  tabUnderline: string;
  tabUnderlineSelected: string;
  searchBg: string;
  searchText: string;
  searchIcon: string;
  micColor: string;
  accent: string;
}

export type LayerMotion = 'none' | 'float' | 'sway' | 'spin' | 'pulse' | 'flyby';

export interface ThemeLayer {
  id: string;
  type: 'lottie' | 'image' | 'emoji';
  src: string;
  x: number;
  y: number;
  w: number;
  opacity: number;
  loop: boolean;
  speed: number;
  depth: number;
  every: number;
  motion: LayerMotion;
  front: boolean;
}

export type ParticlePreset =
  | 'none' | 'snow' | 'rain' | 'leaves' | 'petals' | 'sparkles' | 'confetti'
  | 'fireworks' | 'embers' | 'bubbles' | 'lanterns' | 'stars';

export type BurstPreset = 'cracker' | 'confetti' | 'snow' | 'hearts' | 'petals';

export type GarlandPreset = 'none' | 'toran' | 'lights' | 'marigold' | 'bells' | 'stars' | 'mango';

export interface ThemeConfig {
  colors: ThemeColors;
  night?: Partial<ThemeColors> | null;
  background: { imageUrl: string | null; opacity: number; repeat: boolean; parallax: number };
  layers: ThemeLayer[];
  particles: {
    preset: ParticlePreset;
    density: number;
    speed: number;
    size: number;
    wind: number;
    colors: string[];
    glyphs: string[];
  };
  garland: { preset: GarlandPreset; colors: string[]; sway: boolean };
  edge: { preset: 'round' | 'wave' | 'scallop' | 'zigzag' | 'flat'; size: number };
  greeting: {
    text: string;
    textTa: string;
    color: string;
    effect: 'none' | 'shimmer' | 'glow' | 'bounce';
    countdownTo: string | null;
  };
  interaction: { tapBurst: boolean; burst: BurstPreset; haptic: boolean; soundUrl: string | null; tilt: boolean };
  model3d: { url: string | null; x: number; y: number; size: number; autoRotate: boolean; rotateSpeed: number };
}

export interface ActiveTheme {
  id: number | null;
  slug: string;
  name: string;
  version: number;
  config: ThemeConfig;
  next_change_at: string | null;
}

export const DEFAULT_THEME_COLORS: ThemeColors = {
  dashFrom: '#00B14F',
  dashTo: '#00B14F',
  dashVia: null,
  dashDirection: 'vertical',
  onDash: '#FFFFFF',
  statusBar: 'light',
  tabSelectedFill: '#FFF6EA',
  tabSelectedRing: 'rgba(255,255,255,0.42)',
  tabSelectedText: '#0A7A3C',
  tabFrom: '#3DDA83',
  tabTo: '#0A8F43',
  tabText: '#FFFFFF',
  tabUnderline: '#FFD54A',
  tabUnderlineSelected: '#0A7A3C',
  searchBg: '#FFFFFF',
  searchText: '#8A8A8A',
  searchIcon: '#3A3A3A',
  micColor: '#F15A24',
  accent: '#00B14F',
};

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  colors: DEFAULT_THEME_COLORS,
  night: null,
  background: { imageUrl: null, opacity: 0.35, repeat: false, parallax: 0.3 },
  layers: [],
  particles: { preset: 'none', density: 0.5, speed: 1, size: 1, wind: 0, colors: [], glyphs: [] },
  garland: { preset: 'none', colors: [], sway: true },
  edge: { preset: 'round', size: 1 },
  greeting: { text: '', textTa: '', color: '#FFFFFF', effect: 'none', countdownTo: null },
  interaction: { tapBurst: false, burst: 'confetti', haptic: true, soundUrl: null, tilt: false },
  model3d: { url: null, x: 0.85, y: 0.25, size: 0.28, autoRotate: true, rotateSpeed: 1 },
};

/** Merge a server config over the defaults, section by section. */
export const normalizeTheme = (raw: any): ThemeConfig => {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_THEME_CONFIG;
  return {
    colors: { ...d.colors, ...(r.colors || {}) },
    night: r.night && typeof r.night === 'object' ? r.night : null,
    background: { ...d.background, ...(r.background || {}) },
    layers: Array.isArray(r.layers) ? r.layers.slice(0, 12) : [],
    particles: { ...d.particles, ...(r.particles || {}) },
    garland: { ...d.garland, ...(r.garland || {}) },
    edge: { ...d.edge, ...(r.edge || {}) },
    greeting: { ...d.greeting, ...(r.greeting || {}) },
    interaction: { ...d.interaction, ...(r.interaction || {}) },
    model3d: { ...d.model3d, ...(r.model3d || {}) },
  };
};

/** Night colours apply 19:00-06:00 local time. */
export const isNightNow = (d = new Date()) => d.getHours() >= 19 || d.getHours() < 6;

export const effectiveColors = (cfg: ThemeConfig, night: boolean): ThemeColors =>
  night && cfg.night ? { ...cfg.colors, ...cfg.night } : cfg.colors;

export const tabPaletteFrom = (c: ThemeColors): TabPalette => ({
  selectedFill: c.tabSelectedFill,
  selectedRing: c.tabSelectedRing,
  selectedText: c.tabSelectedText,
  from: c.tabFrom,
  to: c.tabTo,
  text: c.tabText,
  underline: c.tabUnderline,
  underlineSelected: c.tabUnderlineSelected,
});

/** Greeting with the countdown: "3 days to go · Happy Deepavali!" before the date. */
export const greetingText = (g: ThemeConfig['greeting'], tamil: boolean, now = new Date()): string => {
  const base = (tamil && g.textTa) || g.text;
  if (!base) return '';
  if (!g.countdownTo) return base;
  const target = new Date(`${g.countdownTo}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (days > 1) return `${days} days to go · ${base}`;
  if (days === 1) return `Tomorrow · ${base}`;
  return base;
};

/** True when the theme draws anything that moves. */
export const themeHasMotion = (cfg: ThemeConfig) =>
  cfg.particles.preset !== 'none' ||
  cfg.garland.preset !== 'none' ||
  cfg.layers.some(l => l.motion !== 'none' || l.type === 'lottie') ||
  !!cfg.greeting.text ||
  cfg.interaction.tapBurst ||
  !!cfg.model3d.url;
