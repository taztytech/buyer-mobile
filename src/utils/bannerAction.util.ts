import { Linking } from 'react-native';

/**
 * Banner tap routing.
 *
 * `promotion_type` / `promotion_link` have been carried through to the home
 * carousel since launch (HomeScreen builds them into CarouselItem) but nothing
 * ever consumed them — banners were decorative. This maps every type to a real
 * action, including the new `promo_offer`.
 */
export type BannerPromotionType =
  | 'restaurant_id'
  | 'category_id'
  | 'url'
  | 'organization'
  | 'promo_offer';

export interface BannerActionHandlers {
  onRestaurant: (restaurantId: number) => void;
  onCategory: (categoryId: number) => void;
  onOffer: (offerId: number) => void;
}

export interface BannerActionInput {
  promotionType?: string;
  promotionLink?: string;
}

/**
 * Resolve a banner tap. Returns true when the tap was handled, so callers can
 * distinguish "nothing to do" (organization banners are purely decorative)
 * from an unrecognised type.
 */
export const handleBannerPress = (
  banner: BannerActionInput,
  handlers: BannerActionHandlers,
): boolean => {
  const type = banner.promotionType;
  const link = banner.promotionLink;

  if (!type || !link) return false;

  switch (type) {
    case 'promo_offer': {
      const offerId = Number(link);
      if (!Number.isFinite(offerId)) return false;
      handlers.onOffer(offerId);
      return true;
    }

    case 'restaurant_id': {
      const restaurantId = Number(link);
      if (!Number.isFinite(restaurantId)) return false;
      handlers.onRestaurant(restaurantId);
      return true;
    }

    case 'category_id': {
      const categoryId = Number(link);
      if (!Number.isFinite(categoryId)) return false;
      handlers.onCategory(categoryId);
      return true;
    }

    case 'url': {
      // Only follow http(s); a banner must not be able to launch arbitrary
      // schemes on the device.
      if (!/^https?:\/\//i.test(link)) return false;
      Linking.openURL(link).catch(() => {
        // Swallow — a dead promo link should not surface as a crash.
      });
      return true;
    }

    case 'organization':
    default:
      // Organization banners are brand messaging with no destination.
      return false;
  }
};
