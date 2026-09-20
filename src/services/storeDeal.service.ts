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
}

export const storeDealService = new StoreDealService();
export default storeDealService;
