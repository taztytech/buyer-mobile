/**
 * Offers Service
 *
 * Promo offers are a fixed combo from one store at a fixed price with limited
 * slots — not coupon codes. The server owns every rule (slot count, one claim
 * per user, expiry, payment mode); this client only renders what it returns.
 *
 * Expiry note: the API excludes expired offers by clock, not just by stored
 * status, so an offer whose booking window has passed will simply not appear
 * in the list. The app does not need its own expiry logic.
 */

import { apiService } from './api.service';
import { API_CONFIG } from '@/config/api.config';

export type FulfilmentMode = 'direct' | 'prebooking';
export type PaymentMode = 'online_only' | 'both';
export type DeliveryChargeMode = 'standard' | 'per_km' | 'free';

/** Single derived state the UI switches on — computed server-side. */
export type BuyerState =
  | 'not_open_yet'
  | 'bookable'
  | 'sold_out'
  | 'already_claimed'
  | 'closed';

export interface OfferItem {
  id: number;
  item_id: number;
  quantity: number;
  name_snapshot: string;
  price_snapshot?: number;
}

export interface Offer {
  id: number;
  name: string;
  subtitle?: string;
  description?: string;
  banner_image_url?: string;
  store_id: number;
  offer_price: number;
  strike_price?: number;
  fulfilment_mode: FulfilmentMode;
  booking_opens_at?: string;
  booking_closes_at?: string;
  delivery_starts_at?: string;
  max_claims: number;
  per_user_limit: number;
  payment_mode: PaymentMode;
  cancellation_allowed: boolean;
  delivery_charge_mode: DeliveryChargeMode;
  delivery_charge_value?: number;
  status: string;
  items: OfferItem[];

  // Server-derived
  slots_remaining: number;
  slots_total: number;
  already_claimed: boolean;
  buyer_state: BuyerState;
  opens_in_seconds: number | null;
}

export interface ReserveResponse {
  claim_id: number;
  offer_id: number;
  expires_at: string;
  slots_remaining: number;
}

export interface ConfirmResponse {
  claim_id: number;
  status: string;
  amount_paid: number;
  delivery_charge: number;
  total: number;
  delivery_starts_at?: string;
}

const unwrap = <T>(response: any): T => {
  // The buyer API wraps responses as { success, statusCode, message, data }.
  let payload = response?.data ?? response;
  if (payload && typeof payload === 'object' && 'data' in payload) {
    payload = payload.data;
  }
  return payload as T;
};

class OffersService {
  /** Offers visible right now. Expired ones are already filtered out server-side. */
  async getActiveOffers(): Promise<Offer[]> {
    try {
      const response = await apiService.get(API_CONFIG.ENDPOINTS.BUYER.OFFERS_ACTIVE);
      const data = unwrap<Offer[]>(response);
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      // A failed offers call must never block the home screen.
      console.warn('[OffersService] getActiveOffers failed:', error?.message);
      return [];
    }
  }

  async getOffer(id: number): Promise<Offer | null> {
    try {
      const response = await apiService.get(API_CONFIG.ENDPOINTS.BUYER.OFFER_DETAIL(id));
      return unwrap<Offer>(response) ?? null;
    } catch (error: any) {
      console.warn('[OffersService] getOffer failed:', error?.message);
      return null;
    }
  }

  /** Hold a slot. Fails with a message if sold out or already claimed. */
  async reserve(
    id: number,
  ): Promise<{ success: boolean; data?: ReserveResponse; message?: string }> {
    try {
      const response = await apiService.post(
        API_CONFIG.ENDPOINTS.BUYER.OFFER_RESERVE(id),
        {},
      );
      return { success: true, data: unwrap<ReserveResponse>(response) };
    } catch (error: any) {
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Could not hold a slot for this offer',
      };
    }
  }

  async confirm(
    id: number,
    paymentMethod: 'online' | 'cod',
    orderId?: number,
  ): Promise<{ success: boolean; data?: ConfirmResponse; message?: string }> {
    try {
      const response = await apiService.post(
        API_CONFIG.ENDPOINTS.BUYER.OFFER_CONFIRM(id),
        { payment_method: paymentMethod, order_id: orderId },
      );
      return { success: true, data: unwrap<ConfirmResponse>(response) };
    } catch (error: any) {
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Could not confirm your booking',
      };
    }
  }

  /** Give back an unpaid hold (user backed out of checkout). */
  async releaseReservation(id: number): Promise<boolean> {
    try {
      await apiService.delete(API_CONFIG.ENDPOINTS.BUYER.OFFER_RESERVE(id));
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(
    id: number,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      await apiService.post(API_CONFIG.ENDPOINTS.BUYER.OFFER_CANCEL(id), {});
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Could not cancel this booking',
      };
    }
  }

  /**
   * Turn the held slot into a confirmed claim once an order is paid for.
   *
   * Called from the payment success path. Deliberately never throws: the money
   * has already been taken and the order exists, so a failure here must not
   * surface as a failed payment. If it does fail the slot stays held and the
   * server's reaper releases it, which is recoverable — a false "payment
   * failed" shown to a charged customer is not.
   *
   * Safe to call with no pending offer: it resolves to a no-op.
   */
  async confirmForOrder(
    orderId: number,
    paymentMethod: 'online' | 'cod',
  ): Promise<void> {
    try {
      const pending = await this.getPendingClaimOfferId();
      if (!pending) return;

      const result = await this.confirm(pending, paymentMethod, orderId);
      if (!result.success) {
        console.warn(
          '[OffersService] confirmForOrder failed:',
          result.message,
          { orderId, pending },
        );
        return;
      }
      await this.clearPendingClaim();
    } catch (error: any) {
      console.warn('[OffersService] confirmForOrder threw:', error?.message);
    }
  }

  /**
   * The offer currently held for this user, remembered when it was added to
   * the cart so the payment layer does not have to thread it through checkout.
   */
  private pendingOfferId: number | null = null;

  setPendingClaim(offerId: number) {
    this.pendingOfferId = offerId;
  }

  async getPendingClaimOfferId(): Promise<number | null> {
    return this.pendingOfferId;
  }

  async clearPendingClaim(): Promise<void> {
    this.pendingOfferId = null;
  }

  /** Total the customer pays, e.g. 79 + 20 = 99. */
  getTotalPayable(offer: Offer): number {
    if (offer.delivery_charge_mode === 'free') return Number(offer.offer_price);
    return Number(offer.offer_price) + Number(offer.delivery_charge_value ?? 0);
  }

  /** CTA label for the current state. */
  getCtaLabel(offer: Offer): string {
    switch (offer.buyer_state) {
      case 'not_open_yet':
        return 'Not open yet';
      case 'sold_out':
        return 'SOLD OUT';
      case 'already_claimed':
        return 'Already booked';
      case 'closed':
        return 'Booking closed';
      case 'bookable':
      default:
        return `Book Now — ₹${this.getTotalPayable(offer)}`;
    }
  }

  isBookable(offer: Offer): boolean {
    return offer.buyer_state === 'bookable';
  }
}

export const offersService = new OffersService();
export default offersService;
