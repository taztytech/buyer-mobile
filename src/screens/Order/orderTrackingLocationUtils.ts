export interface Coordinate {
  latitude: number;
  longitude: number;
}

const toNumber = (value: any): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toEpochMs = (value: any): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1000000000000 ? value : value * 1000;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric > 1000000000000 ? numeric : numeric * 1000;
    }
    const parsedDate = Date.parse(value);
    return Number.isFinite(parsedDate) ? parsedDate : null;
  }
  return null;
};

const extractCoordinate = (source: any): Coordinate | null => {
  if (!source || typeof source !== 'object') return null;

  const latKeys = [
    'latitude',
    'lat',
    'agent_latitude',
    'agent_lat',
    'rider_latitude',
    'rider_lat',
    'restaurant_latitude',
    'restaurant_lat',
    'delivery_latitude',
    'delivery_lat',
    'customer_latitude',
    'customer_lat',
    'location_latitude',
    'pickup_latitude',
    'drop_latitude',
  ];
  const lngKeys = [
    'longitude',
    'lng',
    'lon',
    'agent_longitude',
    'agent_lng',
    'rider_longitude',
    'rider_lng',
    'restaurant_longitude',
    'restaurant_lng',
    'delivery_longitude',
    'delivery_lng',
    'customer_longitude',
    'customer_lng',
    'location_longitude',
    'pickup_longitude',
    'drop_longitude',
  ];

  let lat: number | null = null;
  let lng: number | null = null;

  for (const key of latKeys) {
    lat = toNumber((source as any)[key]);
    if (lat !== null) break;
  }
  for (const key of lngKeys) {
    lng = toNumber((source as any)[key]);
    if (lng !== null) break;
  }

  // Support GeoJSON-like format: { coordinates: [lng, lat] }
  if ((lat === null || lng === null) && Array.isArray((source as any).coordinates) && (source as any).coordinates.length >= 2) {
    const coordLng = toNumber((source as any).coordinates[0]);
    const coordLat = toNumber((source as any).coordinates[1]);
    if (coordLat !== null && coordLng !== null) {
      lat = coordLat;
      lng = coordLng;
    }
  }

  if (lat === null || lng === null) return null;
  return { latitude: lat, longitude: lng };
};

export const extractRestaurantCoordinate = (order: any): Coordinate | null => {
  if (!order) return null;
  return (
    extractCoordinate(order.pickup_address) ||
    extractCoordinate(order.restaurant?.location) ||
    extractCoordinate(order.restaurant?.locations?.[0]) ||
    extractCoordinate(order.restaurant?.address) ||
    extractCoordinate(order.restaurant) ||
    extractCoordinate(order)
  );
};

export const extractCustomerCoordinate = (order: any): Coordinate | null => {
  if (!order) return null;
  return (
    extractCoordinate(order.delivery_address?.location) ||
    extractCoordinate(order.delivery_address) ||
    extractCoordinate(order.customer?.location) ||
    extractCoordinate(order.customer) ||
    extractCoordinate(order)
  );
};

export const extractAgentCoordinate = (order: any): Coordinate | null => {
  if (!order) return null;

  const liveCurrentLocation =
    extractCoordinate(order.track_status?.rider?.current_location) ||
    extractCoordinate(order.track_status?.delivery_partner?.current_location) ||
    extractCoordinate(order.track_status?.agent?.current_location) ||
    extractCoordinate(order.rider?.current_location) ||
    extractCoordinate(order.delivery_partner?.current_location) ||
    extractCoordinate(order.agent?.current_location);

  if (liveCurrentLocation) {
    return liveCurrentLocation;
  }

  const tracking = Array.isArray(order.tracking) ? [...order.tracking].reverse() : [];
  for (const item of tracking) {
    const coord = extractCoordinate(item);
    if (coord) return coord;
  }

  return (
    extractCoordinate(order.track_status?.rider?.current_location) ||
    extractCoordinate(order.track_status?.delivery_partner?.current_location) ||
    extractCoordinate(order.track_status?.agent?.current_location) ||
    extractCoordinate(order.agent?.current_location) ||
    extractCoordinate(order.agent?.location) ||
    extractCoordinate(order.agent) ||
    extractCoordinate(order.delivery_partner?.current_location) ||
    extractCoordinate(order.delivery_partner?.location) ||
    extractCoordinate(order.delivery_partner) ||
    extractCoordinate(order.rider?.current_location) ||
    extractCoordinate(order.rider?.location) ||
    extractCoordinate(order.rider) ||
    null
  );
};

export const extractTrackingPathCoordinates = (order: any): Coordinate[] => {
  if (!order || !Array.isArray(order.tracking)) return [];
  const points: Coordinate[] = [];

  for (const item of order.tracking) {
    const point = extractCoordinate(item);
    if (!point) continue;

    const prev = points[points.length - 1];
    if (
      !prev ||
      Math.abs(prev.latitude - point.latitude) > 0.00001 ||
      Math.abs(prev.longitude - point.longitude) > 0.00001
    ) {
      points.push(point);
    }
  }

  return points;
};

export interface AgentTrackingUpdate extends Coordinate {
  timestamp?: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

export const extractLatestAgentTrackingUpdate = (order: any): AgentTrackingUpdate | null => {
  if (!order) return null;

  const currentLocation =
    order?.track_status?.rider?.current_location ||
    order?.track_status?.delivery_partner?.current_location ||
    order?.track_status?.agent?.current_location ||
    order?.rider?.current_location ||
    order?.delivery_partner?.current_location ||
    order?.agent?.current_location;

  const liveCoord = extractCoordinate(currentLocation);
  if (liveCoord) {
    return {
      ...liveCoord,
      timestamp:
        toEpochMs(currentLocation?.timestamp) ??
        toEpochMs(currentLocation?.updated_at) ??
        toEpochMs(order?.updated_at) ??
        Date.now(),
      heading: toNumber(currentLocation?.heading ?? currentLocation?.bearing ?? currentLocation?.course) ?? undefined,
      speed: toNumber(currentLocation?.speed ?? currentLocation?.velocity) ?? undefined,
      accuracy: toNumber(currentLocation?.accuracy ?? currentLocation?.gps_accuracy) ?? undefined,
    };
  }

  const tracking = Array.isArray(order.tracking) ? [...order.tracking].reverse() : [];
  for (const item of tracking) {
    const coord = extractCoordinate(item);
    if (!coord) continue;
    return {
      ...coord,
      timestamp:
        toEpochMs(item?.timestamp) ??
        toEpochMs(item?.updated_at) ??
        toEpochMs(item?.created_at) ??
        undefined,
      heading: toNumber(item?.heading ?? item?.bearing ?? item?.course) ?? undefined,
      speed: toNumber(item?.speed ?? item?.velocity) ?? undefined,
      accuracy: toNumber(item?.accuracy ?? item?.gps_accuracy) ?? undefined,
    };
  }

  const fallbackCoord = extractAgentCoordinate(order);
  if (!fallbackCoord) return null;
  return {
    ...fallbackCoord,
    timestamp:
      toEpochMs(order?.updated_at) ??
      toEpochMs(order?.timestamp) ??
      Date.now(),
    heading:
      toNumber(
        order?.track_status?.rider?.current_location?.heading ??
          order?.track_status?.delivery_partner?.current_location?.heading ??
          order?.track_status?.agent?.current_location?.heading ??
        order?.agent?.current_location?.heading ??
          order?.delivery_partner?.current_location?.heading ??
          order?.rider?.current_location?.heading ??
          order?.agent?.heading ??
          order?.delivery_partner?.heading ??
          order?.rider?.heading,
      ) ??
      undefined,
    speed:
      toNumber(
        order?.track_status?.rider?.current_location?.speed ??
          order?.track_status?.delivery_partner?.current_location?.speed ??
          order?.track_status?.agent?.current_location?.speed ??
        order?.agent?.current_location?.speed ??
          order?.delivery_partner?.current_location?.speed ??
          order?.rider?.current_location?.speed ??
          order?.agent?.speed ??
          order?.delivery_partner?.speed ??
          order?.rider?.speed,
      ) ??
      undefined,
    accuracy:
      toNumber(
        order?.track_status?.rider?.current_location?.accuracy ??
          order?.track_status?.delivery_partner?.current_location?.accuracy ??
          order?.track_status?.agent?.current_location?.accuracy ??
        order?.agent?.current_location?.accuracy ??
          order?.delivery_partner?.current_location?.accuracy ??
          order?.rider?.current_location?.accuracy ??
          order?.agent?.accuracy ??
          order?.delivery_partner?.accuracy ??
          order?.rider?.accuracy,
      ) ??
      undefined,
  };
};

