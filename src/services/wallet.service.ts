/**
 * Tazty Wallet service.
 *
 * Read-only in this version: balance, breakdown and history. The server
 * decides whether the wallet is visible (`enabled`); while it is off the
 * Profile menu hides the entry, so nothing here runs for customers.
 */

import { apiService } from './api.service';
import { API_CONFIG } from '@/config/api.config';

export type WalletBucket = 'refund' | 'topup' | 'promo' | 'cashback';

export interface WalletBuckets {
  refund: number;
  topup: number;
  promo: number;
  cashback: number;
}

export interface WalletSummary {
  enabled: boolean;
  /** The wallet may be used at checkout (WALLET_PAYMENT_ENABLED, not frozen). */
  can_pay?: boolean;
  status?: 'active' | 'frozen';
  balance?: number;
  buckets?: WalletBuckets;
  /** Reserved for orders still waiting for payment; not included in balance. */
  on_hold?: number;
  /** Promo and cashback money that runs out, soonest first. */
  expiring?: ExpiringCredit[];
}

/** One promotional credit with its own expiry. */
export interface ExpiringCredit {
  amount: number;
  bucket: WalletBucket;
  expires_at: string;
  days_left: number;
  /** 0 = usable on any order. */
  min_order: number;
  label: string;
}

export interface ReferralCard {
  enabled: boolean;
  code: string | null;
  referrer_amount: number;
  referee_amount: number;
  min_order: number;
  invited: number;
  rewarded: number;
  earned: number;
}

export interface WalletTransaction {
  txn_ref: string;
  direction: 'credit' | 'debit';
  amount: number;
  bucket: WalletBucket;
  type: string;
  status: string;
  /** Customer-facing label, e.g. "Refund for cancelled order". */
  title: string;
  note: string | null;
  order_id: number | null;
  order_number: string | null;
  balance_after: number | null;
  created_at: string;
}

export interface WalletHistoryPage {
  enabled: boolean;
  transactions: WalletTransaction[];
  pagination: { page: number; limit: number; total: number; has_more: boolean };
}

export const WALLET_BUCKET_LABELS: Record<WalletBucket, string> = {
  refund: 'Refunds',
  topup: 'Added money',
  promo: 'Promo credit',
  cashback: 'Cashback',
};

const unwrap = <T>(response: any): T => {
  // The buyer API wraps responses as { success, statusCode, message, data }.
  let payload = response?.data ?? response;
  if (payload && typeof payload === 'object' && 'data' in payload && !('enabled' in payload)) {
    payload = payload.data;
  }
  return payload as T;
};

/** "₹1,234.50", or "₹1,234" for whole rupees. */
export const formatRupees = (amount: number | null | undefined): string => {
  const n = Number(amount || 0);
  const whole = Number.isInteger(n);
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

class WalletService {
  /** null when it could not be loaded - callers treat that as hidden. */
  async getSummary(): Promise<WalletSummary | null> {
    try {
      const response: any = await apiService.get(API_CONFIG.ENDPOINTS.BUYER.WALLET);
      if (response?.success === false) return null;
      const data = unwrap<WalletSummary>(response);
      return data && typeof data === 'object' && 'enabled' in data ? data : null;
    } catch (error: any) {
      console.warn('[WalletService] getSummary failed:', error?.message);
      return null;
    }
  }

  async getTransactions(page = 1, limit = 20): Promise<WalletHistoryPage | null> {
    try {
      const response: any = await apiService.get(
        API_CONFIG.ENDPOINTS.BUYER.WALLET_TRANSACTIONS,
        { page, limit },
      );
      if (response?.success === false) return null;
      const data = unwrap<WalletHistoryPage>(response);
      return data && Array.isArray(data.transactions) ? data : null;
    } catch (error: any) {
      console.warn('[WalletService] getTransactions failed:', error?.message);
      return null;
    }
  }

  /** What the customer may add now, and who pays the fee. null = hide "Add money". */
  async getTopupLimits(): Promise<TopupLimits | null> {
    try {
      const response: any = await apiService.get(API_CONFIG.ENDPOINTS.BUYER.WALLET_TOPUP_LIMITS);
      if (response?.success === false) return null;
      const data = unwrap<TopupLimits>(response);
      return data && typeof data === 'object' && 'enabled' in data ? data : null;
    } catch (error: any) {
      console.warn('[WalletService] getTopupLimits failed:', error?.message);
      return null;
    }
  }

  /** Start a top-up: returns the Razorpay order to open. Throws the server's message. */
  async createTopup(amount: number): Promise<CreatedTopup> {
    const response: any = await apiService.post(API_CONFIG.ENDPOINTS.BUYER.WALLET_TOPUPS, { amount });
    if (response?.success === false) {
      throw new Error(response?.message || response?.error || 'Could not start adding money.');
    }
    const data = unwrap<CreatedTopup>(response);
    if (!data?.topup_id || !data?.payment_details?.razorpay_order_id) {
      throw new Error('Could not start adding money.');
    }
    return data;
  }

  /** After Razorpay says OK. The server credits once (the webhook may be first). */
  async verifyTopup(
    topupId: number,
    payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  ): Promise<{ status: string } | null> {
    try {
      const response: any = await apiService.post(
        API_CONFIG.ENDPOINTS.BUYER.WALLET_TOPUP_VERIFY(topupId),
        payment,
      );
      if (response?.success === false) return null;
      return unwrap<{ status: string }>(response);
    } catch (error: any) {
      console.warn('[WalletService] verifyTopup failed:', error?.message);
      return null;
    }
  }

  /** Redeem a promo code. Throws the server's message so the sheet can show it. */
  async redeemCode(code: string): Promise<{ amount: number; expires_in_days: number; min_order: number }> {
    const response: any = await apiService.post(API_CONFIG.ENDPOINTS.BUYER.WALLET_REDEEM, {
      code: code.trim().toUpperCase(),
    });
    if (response?.success === false) {
      throw new Error(response?.message || response?.error || 'That code could not be used.');
    }
    return unwrap(response);
  }

  /** The customer's referral code and what it has earned. null = hide the card. */
  async getReferral(): Promise<ReferralCard | null> {
    try {
      const response: any = await apiService.get(API_CONFIG.ENDPOINTS.BUYER.WALLET_REFERRAL);
      if (response?.success === false) return null;
      const data = unwrap<ReferralCard>(response);
      return data && typeof data === 'object' && 'enabled' in data ? data : null;
    } catch (error: any) {
      console.warn('[WalletService] getReferral failed:', error?.message);
      return null;
    }
  }

  /** Enter a friend's code. Throws the server's message. */
  async applyReferral(code: string): Promise<{ applied: boolean; message: string }> {
    const response: any = await apiService.post(API_CONFIG.ENDPOINTS.BUYER.WALLET_REFERRAL_APPLY, {
      code: code.trim().toUpperCase(),
    });
    if (response?.success === false) {
      throw new Error(response?.message || response?.error || 'That code could not be used.');
    }
    return unwrap(response);
  }
}

export interface TopupLimits {
  enabled: boolean;
  frozen: boolean;
  min: number;
  max: number;
  /** Most the customer can add right now (max, daily limit and cap applied). */
  max_now: number;
  daily_remaining: number;
  balance_cap_remaining: number;
  fee_bearer: 'tazty' | 'customer';
  /** 0 unless the customer pays the fee. */
  fee_percent: number;
  suggestions: number[];
  /** "Add ₹2,000, get ₹100" - empty when bonuses are off. */
  bonus_tiers?: { min_amount: number; bonus_amount: number; expires_in_days: number }[];
}

export interface CreatedTopup {
  topup_id: number;
  amount: number;
  fee_amount: number;
  charged_amount: number;
  /** Bonus promised for this top-up; paid when it is credited. */
  bonus_amount?: number;
  bonus_expires_in_days?: number | null;
  payment_details: {
    razorpay_order_id: string;
    /** Paise. */
    amount: number;
    currency: string;
    key: string;
    name: string;
    description: string;
    prefill?: { name?: string; email?: string; contact?: string };
  };
}

/** Convenience fee the customer pays (rounded up to the rupee, like the server). */
export const topupFee = (amount: number, limits: TopupLimits | null): number => {
  if (!limits || limits.fee_bearer !== 'customer' || !(limits.fee_percent > 0)) return 0;
  return Math.ceil((Math.round(amount * 100) * limits.fee_percent) / 100 / 100);
};

/**
 * What the wallet can actually pay for an order of this size. Promo credit
 * can carry a minimum order, and the server will not spend a lot the order is
 * too small for - so the checkout must not promise it either.
 */
export const usableWalletBalance = (
  summary: WalletSummary | null,
  orderTotal: number,
): number => {
  const balance = Number(summary?.balance || 0);
  const blocked = (summary?.expiring || [])
    .filter(lot => lot.min_order > 0 && orderTotal < lot.min_order)
    .reduce((sum, lot) => sum + Number(lot.amount || 0), 0);
  return Math.max(0, Math.round((balance - blocked) * 100) / 100);
};

/** The bonus this amount earns right now, or 0. Mirrors the server's rule. */
export const topupBonus = (amount: number, limits: TopupLimits | null): number => {
  const tiers = (limits?.bonus_tiers || []).filter((t) => amount >= t.min_amount);
  if (tiers.length === 0) return 0;
  return tiers.reduce((best, t) => (t.min_amount > best.min_amount ? t : best), tiers[0])
    .bonus_amount;
};

export const walletService = new WalletService();
