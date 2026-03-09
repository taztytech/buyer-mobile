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

