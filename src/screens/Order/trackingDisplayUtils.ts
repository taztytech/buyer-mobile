/**
 * Merge FCM/orders-list snapshot with full order API data for Track Order UI.
 * Phone helpers: use for Exotel only — do not render in UI.
 */

/** Parse backend updated_at for comparison (ISO string or epoch ms/s). */
export const parseOrderUpdatedAtMs = (value: unknown): number => {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? t : 0;
};

/**
 * Merge context snapshot with API snapshot so UI shows the freshest status.
 */
export const resolveTrackingDisplayOrder = (
  contextOrder: any | undefined,
  apiOrder: any | undefined,
): any | undefined => {
  if (!contextOrder && !apiOrder) return undefined;
  if (!apiOrder) return contextOrder;
  if (!contextOrder) return apiOrder;

  const tCtx = parseOrderUpdatedAtMs(contextOrder.updated_at);
  const tApi = parseOrderUpdatedAtMs(apiOrder.updated_at);
  const apiWinsOrTie = tApi >= tCtx;

  if (apiWinsOrTie) {
    return {
      ...contextOrder,
      ...apiOrder,
      tracking:
        Array.isArray((contextOrder as any).tracking) && (contextOrder as any).tracking.length > 0
          ? (contextOrder as any).tracking
          : (apiOrder as any).tracking,
      tracking_id:
        (apiOrder as any).tracking_id ??
        (apiOrder as any).trackingId ??
        (contextOrder as any).tracking_id ??
        (contextOrder as any).trackingId,
      tracking_url:
        (apiOrder as any).tracking_url ||
        (apiOrder as any).trackingUrl ||
        (contextOrder as any).tracking_url ||
        (contextOrder as any).trackingUrl,
      track_status:
        (apiOrder as any).track_status ||
        (apiOrder as any).trackStatus ||
        (contextOrder as any).track_status ||
        (contextOrder as any).trackStatus,
      restaurant: (apiOrder as any).restaurant || (contextOrder as any).restaurant,
      delivery_address: (apiOrder as any).delivery_address || (contextOrder as any).delivery_address,
      rider: {
        ...((contextOrder as any).rider || {}),
        ...((apiOrder as any).rider || {}),
        current_location:
          (apiOrder as any)?.rider?.current_location ||
          (contextOrder as any)?.rider?.current_location ||
          (apiOrder as any)?.track_status?.rider?.current_location ||
          (contextOrder as any)?.track_status?.rider?.current_location ||
          null,
      },
    };
  }

  return {
    ...apiOrder,
    ...contextOrder,
    tracking:
      Array.isArray((contextOrder as any).tracking) && (contextOrder as any).tracking.length > 0
        ? (contextOrder as any).tracking
        : (apiOrder as any).tracking,
    tracking_id:
      (contextOrder as any).tracking_id ??
      (contextOrder as any).trackingId ??
      (apiOrder as any).tracking_id ??
      (apiOrder as any).trackingId,
    tracking_url:
      (contextOrder as any).tracking_url ||
      (contextOrder as any).trackingUrl ||
      (apiOrder as any).tracking_url ||
      (apiOrder as any).trackingUrl,
    track_status:
      (contextOrder as any).track_status ||
      (contextOrder as any).trackStatus ||
      (apiOrder as any).track_status ||
      (apiOrder as any).trackStatus,
    restaurant: (contextOrder as any).restaurant || (apiOrder as any).restaurant,
    delivery_address: (contextOrder as any).delivery_address || (apiOrder as any).delivery_address,
    rider: {
      ...((apiOrder as any).rider || {}),
      ...((contextOrder as any).rider || {}),
      current_location:
        (contextOrder as any)?.rider?.current_location ||
        (apiOrder as any)?.rider?.current_location ||
        (contextOrder as any)?.track_status?.rider?.current_location ||
        (apiOrder as any)?.track_status?.rider?.current_location ||
        null,
    },
  };
};

/** Resolve rider phone for Exotel only — never render this string in the UI. */
export const resolveAgentPhoneForExotel = (order: any | null | undefined): string | null => {
  if (!order) return null;
  const trackingArray = order.tracking ?? [];
  const latestWithAgent = [...trackingArray].reverse().find((e: any) => e?.agent_name || e?.agent_phone);
  const phone =
    latestWithAgent?.agent_phone ||
    order.agent?.phone ||
    order.delivery_partner?.phone ||
    order.rider?.phone ||
    null;
  return phone ? String(phone).trim() || null : null;
};
