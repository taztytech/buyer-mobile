/**
 * Agent → store (blue) route visibility for Track Order.
 * Keeps blue through order-ready and agent-arrived-restaurant until pickup / out-for-delivery.
 * GPS proximity only hides blue when status is not explicitly “en route to store”.
 */

import type { Coordinate } from './orderTrackingLocationUtils';

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

export const haversineMeters = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const earthRadius = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const q =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
  return earthRadius * c;
};

const normalizeStatus = (status: string | null | undefined): string =>
  String(status || '')
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-');

/** Hide blue once rider is this close to the store (GPS fallback). */
export const STORE_ARRIVED_DISTANCE_METERS = 45;

const POST_PICKUP_OR_ENROUTE_CUSTOMER = new Set([
  'picked',
  'picked-up',
  'in-transit',
  'out-for-delivery',
  'on-the-way',
  'en-route',
  'delivered',
  'completed',
  'cancelled',
  'canceled',
]);

/** Rider at store, waiting for handoff — keep blue until picked-up. */
const ARRIVED_AT_RESTAURANT = new Set(['agent-arrived-restaurant', 'agent_arrived_restaurant']);

const EN_ROUTE_TO_STORE_STATUSES = new Set([
  'assigned',
  'agent-assigned',
  'rider-assigned',
  'rider-accepted',
  'accepted',
  'packed',
  'order-ready',
  'order_ready',
  'ready-for-pickup',
  'ready-for-delivery',
  'preparing',
  'billed',
  'confirmed',
]);

export function computeShowStoreToAgentRoute(
  status: string | null | undefined,
  restaurant: Coordinate | null | undefined,
  agent: Coordinate | null | undefined,
): boolean {
  const s = normalizeStatus(status);
  if (!s) return false;

  if (POST_PICKUP_OR_ENROUTE_CUSTOMER.has(s)) return false;
  if (ARRIVED_AT_RESTAURANT.has(s)) return true;

  const hasAgent =
    !!agent && Number.isFinite(agent.latitude) && Number.isFinite(agent.longitude);
  const hasRestaurant =
    !!restaurant && Number.isFinite(restaurant.latitude) && Number.isFinite(restaurant.longitude);

  if (hasAgent && hasRestaurant) {
    const closeToStore =
      haversineMeters(agent!, restaurant!) < STORE_ARRIVED_DISTANCE_METERS;
    if (closeToStore && !EN_ROUTE_TO_STORE_STATUSES.has(s)) return false;
  }

  if (EN_ROUTE_TO_STORE_STATUSES.has(s)) return true;

  if (hasAgent && hasRestaurant) {
    return haversineMeters(agent!, restaurant!) >= STORE_ARRIVED_DISTANCE_METERS;
  }

  return false;
}
