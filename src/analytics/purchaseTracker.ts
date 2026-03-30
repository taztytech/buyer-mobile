import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackPurchase } from './metaEvents';

const TRACKED_PURCHASE_IDS_KEY = '@tazty_meta_tracked_purchase_ids_v1';

const PURCHASE_SUCCESS_STATUSES = new Set(['delivered', 'completed']);
const PAYMENT_SUCCESS_STATUSES = new Set(['paid', 'captured', 'success', 'completed', 'successful']);

let trackedPurchaseIds: Set<string> | null = null;
let loadTrackedIdsPromise: Promise<void> | null = null;

const normalize = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-');

const isDeliveredStatus = (status: unknown): boolean =>
  PURCHASE_SUCCESS_STATUSES.has(normalize(status));

const isPaymentConfirmed = (paymentStatus: unknown): boolean =>
  PAYMENT_SUCCESS_STATUSES.has(normalize(paymentStatus));

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const resolveOrderId = (order: any): string | null => {
  const raw =
    order?.id ??
    order?.order_id ??
    order?.orderId ??
    order?.track_status?.order_id ??
    null;
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim();
  return normalized.length > 0 ? normalized : null;
};

const resolveAmount = (order: any): number | null =>
  toFiniteNumber(
    order?.summary?.total_amount ??
      order?.total_amount ??
      order?.final_amount ??
      order?.amount,
  );

const resolveNumItems = (order: any): number | undefined => {
  if (Array.isArray(order?.items)) {
    const total = order.items.reduce((sum: number, item: any) => {
      const qty = toFiniteNumber(item?.quantity) ?? 0;
      return sum + qty;
    }, 0);
    return Number.isFinite(total) && total > 0 ? total : undefined;
  }
  const fromPayload = toFiniteNumber(order?.num_items ?? order?.numItems);
  return fromPayload !== null && fromPayload > 0 ? fromPayload : undefined;
};

const ensureTrackedIdsLoaded = async (): Promise<void> => {
  if (trackedPurchaseIds) return;
  if (!loadTrackedIdsPromise) {
    loadTrackedIdsPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(TRACKED_PURCHASE_IDS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          trackedPurchaseIds = new Set(parsed.map((id) => String(id)));
        } else {
          trackedPurchaseIds = new Set();
        }
      } catch {
        trackedPurchaseIds = new Set();
      } finally {
        loadTrackedIdsPromise = null;
      }
    })();
  }
  await loadTrackedIdsPromise;
};

const persistTrackedIds = async (): Promise<void> => {
  if (!trackedPurchaseIds) return;
  try {
    await AsyncStorage.setItem(
      TRACKED_PURCHASE_IDS_KEY,
      JSON.stringify(Array.from(trackedPurchaseIds)),
    );
  } catch {
    // Best-effort persistence; event has already been sent.
  }
};

export async function trackPurchaseIfEligible(
  order: any,
  source: string = 'unknown',
): Promise<boolean> {
  const status = order?.status;
  const paymentStatus = order?.payment_status ?? order?.paymentStatus;

  if (!isDeliveredStatus(status) || !isPaymentConfirmed(paymentStatus)) {
    return false;
  }

  const orderId = resolveOrderId(order);
  const amount = resolveAmount(order);
  if (!orderId || amount === null) {
    return false;
  }

  await ensureTrackedIdsLoaded();
  if (!trackedPurchaseIds) return false;
  if (trackedPurchaseIds.has(orderId)) {
    return false;
  }

  trackPurchase({
    orderId,
    amount,
    numItems: resolveNumItems(order),
    // Deterministic id enables dedup across app flows and CAPI.
    eventId: `purchase_${orderId}`,
  });

  trackedPurchaseIds.add(orderId);
  await persistTrackedIds();
  console.log('[MetaPurchase] Tracked purchase event', { orderId, source });
  return true;
}

