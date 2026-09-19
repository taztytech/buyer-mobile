import React from 'react';
import { authService } from '@/services/auth.service';
import { cartService } from '@/services/cart.service';
import type { StoreDeal } from '@/services/storeDeal.service';

export type StoreDealAddOutcome =
  | { status: 'needs_login' }
  | { status: 'needs_cart_clear'; deal: StoreDeal }
  | { status: 'in_cart'; deal: StoreDeal }
  | { status: 'unavailable'; message: string };

/**
 * Tap ADD on a ₹99 Store deal -> put it in the cart.
 *
 * The deal's price, its daily budget and this customer's daily limit are all
 * enforced by the API on the add and again, under a lock, when the order is
 * placed — so nothing here needs to (or can) decide whether a plate is still
 * going. Whatever the API refuses comes back as a message to show as-is.
 *
 * A deal cart is standalone, so an existing cart has to be cleared first; the
 * customer is asked before anything is thrown away.
 */
export const useStoreDealAdd = () => {
  const [addingDealId, setAddingDealId] = React.useState<number | null>(null);

  const add = React.useCallback(
    async (
      deal: StoreDeal,
      opts?: { forceClearCart?: boolean; quantity?: number },
    ): Promise<StoreDealAddOutcome> => {
      setAddingDealId(deal.id);
      try {
        // A deal is counted per customer per day, so a guest cannot take one.
        // Checked before the call so they see a login sheet, not a 401.
        const isLoggedIn = await authService.isAuthenticated();
        if (!isLoggedIn) {
          return { status: 'needs_login' };
        }

        const cart = await cartService.getCart().catch(() => null);
        const existingItems = ((cart as any)?.items ?? []) as any[];
        const hasOtherItems = existingItems.some(
          i => Number(i?.store_deal_id ?? 0) !== Number(deal.id),
        );

        if (hasOtherItems) {
          if (!opts?.forceClearCart) {
            return { status: 'needs_cart_clear', deal };
          }
          await cartService.clearCart().catch(() => undefined);
        }

        const added = await cartService.addToCart({
          restaurant_id: deal.restaurant_id,
          item_id: deal.item_id,
          quantity: opts?.quantity ?? 1,
          store_deal_id: deal.id,
        });

        // addToCart only THROWS on transport errors; an API rejection arrives
        // as { success: false }, and treating that as success would leave the
        // customer looking at an empty cart.
        if (!added?.success) {
          return {
            status: 'unavailable',
            message: added?.message || 'Could not add this deal to your cart.',
          };
        }

        return { status: 'in_cart', deal };
      } catch (error: any) {
        return {
          status: 'unavailable',
          message:
            error?.response?.data?.message ||
            error?.message ||
            'Could not add this deal to your cart.',
        };
      } finally {
        setAddingDealId(null);
      }
    },
    [],
  );

  return { add, addingDealId };
};
