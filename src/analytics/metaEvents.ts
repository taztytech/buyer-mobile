import { AppEventsLogger } from 'react-native-fbsdk-next';
import { PurchasePayload, RegistrationMethod } from './types';

const DEFAULT_CURRENCY = 'INR';
const trackedPurchaseOrderIds = new Set<string>();

/**
 * CompleteRegistration
 */
export function trackRegistration(method: RegistrationMethod): void {
  AppEventsLogger.logEvent('CompleteRegistration', {
    registration_method: method,
    currency: DEFAULT_CURRENCY,
  });
}

/**
 * ViewContent (Restaurant)
 */
export function trackViewRestaurant(restaurantId: string, value?: number): void {
  const payload: Record<string, unknown> = {
    content_type: 'restaurant',
    content_ids: [restaurantId],
  };
  if (typeof value === 'number' && Number.isFinite(value)) {
    payload.value = value;
    payload.currency = DEFAULT_CURRENCY;
  }
  AppEventsLogger.logEvent('ViewContent', payload);
}

/**
 * AddToCart
 */
export function trackAddToCart(itemId: string, value: number): void {
  AppEventsLogger.logEvent('AddToCart', {
    content_ids: [itemId],
    value,
    currency: DEFAULT_CURRENCY,
  });
}

/**
 * InitiateCheckout
 */
export function trackCheckout(value: number): void {
  AppEventsLogger.logEvent('InitiateCheckout', {
    value,
    currency: DEFAULT_CURRENCY,
  });
}

/**
 * Purchase (only for delivered + payment confirmed orders)
 */
export function trackPurchase({
  orderId,
  amount,
  numItems,
  currency = DEFAULT_CURRENCY,
  eventId,
}: PurchasePayload): void {
  if (trackedPurchaseOrderIds.has(orderId)) {
    return;
  }

  AppEventsLogger.logPurchase(amount, currency, {
    content_ids: [orderId],
    num_items: numItems,
    event_id: eventId,
  });

  trackedPurchaseOrderIds.add(orderId);
}

/**
 * Optional advanced optimization event.
 */
export function trackSearch(searchString: string): void {
  if (!searchString.trim()) {
    return;
  }
  AppEventsLogger.logEvent('Search', {
    search_string: searchString.trim(),
  });
}

