import React from 'react';
import offersService, { Offer } from '@/services/offers.service';
import { authService } from '@/services/auth.service';
import { cartService } from '@/services/cart.service';

export type ClaimOutcome =
  | { status: 'needs_login' }
  | { status: 'not_open_yet'; offer: Offer; opensInSeconds: number | null }
  | { status: 'sold_out'; offer: Offer }
  | { status: 'already_claimed'; offer: Offer }
  | { status: 'closed'; offer: Offer }
  | { status: 'needs_cart_clear'; offer: Offer }
  | { status: 'in_cart'; offer: Offer }
  | { status: 'unavailable'; message: string };

/**
 * Tap an offer -> hold a slot -> put it in the cart.
 *
 * Order matters here. The slot is reserved BEFORE the cart write, because the
 * reserve call is what atomically enforces sold-out and one-per-user; adding
 * to the cart first would let more customers into checkout than there are
 * slots. If the cart write then fails, the hold is handed straight back rather
 * than left to expire.
 *
 * Offer state is always re-fetched on tap — a banner may have been rendered
 * minutes ago and the offer could have sold out since.
 */
export const useOfferClaim = () => {
  const [busy, setBusy] = React.useState(false);

  const claim = React.useCallback(
    async (offerId: number, opts?: { forceClearCart?: boolean }): Promise<ClaimOutcome> => {
      setBusy(true);
      try {
        // A claim is tied to a user id, so guests must sign in first. Checked
        // before the API call so the user sees a login sheet, not a 401.
        const isLoggedIn = await authService.isAuthenticated();
        if (!isLoggedIn) {
          return { status: 'needs_login' };
        }

        const offer = await offersService.getOffer(offerId);
        if (!offer) {
          return { status: 'unavailable', message: 'This offer is no longer available.' };
        }

        switch (offer.buyer_state) {
          case 'not_open_yet':
            return {
              status: 'not_open_yet',
              offer,
              opensInSeconds: offer.opens_in_seconds,
            };
          case 'sold_out':
            return { status: 'sold_out', offer };
          case 'already_claimed':
            return { status: 'already_claimed', offer };
          case 'closed':
            return { status: 'closed', offer };
        }

        // Offer orders are standalone. Ask before destroying an existing cart.
        if (!opts?.forceClearCart) {
          const cart = await cartService.getCart().catch(() => null);
          const itemCount = (cart as any)?.items?.length ?? 0;
          if (itemCount > 0) {
            return { status: 'needs_cart_clear', offer };
          }
        } else {
          await cartService.clearCart().catch(() => undefined);
        }

        const reserved = await offersService.reserve(offer.id);
        if (!reserved.success) {
          return {
            status: 'unavailable',
            message: reserved.message ?? 'Could not hold a slot for this offer.',
          };
        }

        // Without a real item id the cart add is guaranteed to be rejected, so
        // fail before taking the slot rather than after.
        const comboItemId = offer.items?.[0]?.item_id;
        if (!comboItemId) {
          await offersService.releaseReservation(offer.id);
          return {
            status: 'unavailable',
            message: 'This offer is not set up correctly. Please try again later.',
          };
        }

        try {
          const added = await cartService.addToCart({
            restaurant_id: offer.store_id,
            item_id: comboItemId,
            quantity: 1,
            promo_offer_id: offer.id,
          });

          // addToCart only THROWS on transport errors; an API rejection comes
          // back as {success:false}. Treating that as success is what sent
          // customers to a checkout with an empty cart and a ₹0.00 bill while
          // the slot stayed held, since neither the release below nor any
          // error message ever ran.
          if (!added?.success) {
            throw new Error(
              added?.message || 'Could not add this offer to your cart.',
            );
          }
        } catch (cartError: any) {
          // Give the slot back immediately rather than holding it for 10
          // minutes over a cart failure the customer never caused.
          await offersService.releaseReservation(offer.id);
          return {
            status: 'unavailable',
            message: cartError?.message ?? 'Could not add this offer to your cart.',
          };
        }

        // Remember which offer this cart is claiming, so the payment layer can
        // confirm it after checkout without threading the id through.
        offersService.setPendingClaim(offer.id, offer.payment_mode);

        return { status: 'in_cart', offer };
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return { claim, busy };
};
