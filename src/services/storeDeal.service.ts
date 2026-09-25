/**
 * ₹99 Store service.
 *
 * A deal is one real menu item sold at a Tazty-funded price: the customer pays
 * the deal price, the restaurant is paid its full menu price. Every rule lives
 * on the server — the menu price, the daily budget, the per-person daily limit,
 * the restaurant's hours and whether it delivers here — and arrives already
 * resolved as `state`, so this client only renders what it is told.
 */

import { apiService } from './api.service';
import { API_CONFIG } from '@/config/api.config';

export type StoreDealState =
  | 'available'
  | 'closing_soon'
  | 'sold_out'
  | 'limit_reached'
  | 'unavailable';

export interface StoreDeal {
  id: number;
  item_id: number;
  restaurant_id: number;
  name: string;
  short_desc: string;
  image_url: string | null;
  /** Optional promo clip; when set the card plays photo→video→loop. */
  video_url: string | null;
  /** Seconds the photo is held before the video plays each loop. */
  media_photo_seconds: number;
  media_muted: boolean;
  media_loop: boolean;
  dietary_preference: string | null;
  restaurant: { id: number; name: string; logo_url: string | null };
  deal_price: number;
  /** The real menu price, shown struck through. */
  menu_price: number;
  discount_percent: number;
  savings_per_plate: number;
  tax_rate: number | null;
  distance_km: number | null;
  minutes_to_close: number | null;
  state: StoreDealState;
  is_orderable: boolean;
  /** Most plates this customer may add right now; 0 when not orderable. */
  max_qty: number;
  sequence: number;
}

/** Editable ₹99 Store labels, served by the buyer API. */
export interface StoreDealSection {
  name: string;
  tagline: string;
  home_title: string;
  /** Photo/video played inside the orange ₹99 Store card; null = plain orange. */
  hero_image_url?: string | null;
  hero_video_url?: string | null;
}

export const DEFAULT_STORE_DEAL_SECTION: StoreDealSection = {
  name: '₹99 Store',
  tagline: 'Great Food. Just ₹99!',
  home_title: "Today's deals",
  hero_image_url: null,
  hero_video_url: null,
};

/** Only a real http(s) URL counts as banner media. */
export const heroMediaUrl = (value: unknown): string | null =>
  typeof value === 'string' && /^https?:\/\//i.test(value.trim()) ? value.trim() : null;

const unwrap = <T>(response: any): T => {
  // The buyer API wraps responses as { success, statusCode, message, data }.
  let payload = response?.data ?? response;
  if (payload && typeof payload === 'object' && 'data' in payload) {
    payload = payload.data;
  }
  return payload as T;
};

/** Cards whose ADD button does something. */
export const isDealOrderable = (deal: StoreDeal): boolean =>
  deal.is_orderable && deal.max_qty > 0;

export const dealStateLabel = (deal: StoreDeal): string | null => {
  switch (deal.state) {
    case 'closing_soon':
      return 'Closing soon';
    case 'sold_out':
      return 'SOLD OUT';
    case 'limit_reached':
      return 'Limit reached today';
    case 'unavailable':
      return 'Unavailable';
    default:
      return null;
  }
};

class StoreDealService {
  /** Every live deal for the ₹99 Store page. */
  async getDeals(lat?: number, lng?: number): Promise<StoreDeal[]> {
    try {
      const params: Record<string, any> = {};
      if (lat != null) params.lat = lat;
      if (lng != null) params.lng = lng;
      const response = await apiService.get(
        API_CONFIG.ENDPOINTS.BUYER.STORE_DEALS,
        params,
      );
      const data = unwrap<StoreDeal[]>(response);
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      // A failed deals call must never block a screen.
      console.warn('[StoreDealService] getDeals failed:', error?.message);
      return [];
    }
  }

  /**
   * The editable section labels (name/tagline/home title). Served alongside the
   * deals; falls back to the ₹99 wording so a screen never renders blank.
   */
  async getSection(): Promise<StoreDealSection> {
    try {
      const response: any = await apiService.get(
        API_CONFIG.ENDPOINTS.BUYER.STORE_DEALS,
      );
      const s =
        response?.section ??
        response?.data?.section ??
        response?.data?.data?.section;
      if (s && typeof s === 'object') {
        return {
          name: s.name || DEFAULT_STORE_DEAL_SECTION.name,
          tagline: s.tagline || DEFAULT_STORE_DEAL_SECTION.tagline,
          home_title: s.home_title || DEFAULT_STORE_DEAL_SECTION.home_title,
          hero_image_url: heroMediaUrl(s.hero_image_url),
          hero_video_url: heroMediaUrl(s.hero_video_url),
        };
      }
    } catch (error: any) {
      console.warn('[StoreDealService] getSection failed:', error?.message);
    }
    return DEFAULT_STORE_DEAL_SECTION;
  }
}

export const storeDealService = new StoreDealService();
export default storeDealService;
