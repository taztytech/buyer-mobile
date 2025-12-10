/**
 * Availability Service
 * Handles restaurant availability and sorting logic
 */

import { Restaurant } from './home.service';

/**
 * Extract numeric distance from restaurant distance string or number
 * @param distance - Distance as string (e.g., "5.2Kms") or number
 * @returns Numeric distance value in kilometers
 */
const extractNumericDistance = (distance: string | number | undefined): number => {
  if (typeof distance === 'number') {
    return distance;
  }

  if (typeof distance === 'string') {
    // Extract numeric value from strings like "5.2Kms", "5.2", etc.
    const match = distance.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
  }

  return 0;
};

/**
 * Normalize restaurant ID to string for consistent comparison
 * Handles both string and number IDs
 */
const normalizeId = (id: string | number): string => {
  return String(id);
};

/**
 * Deduplicate restaurants by ID, preserving all unique restaurants
 * Handles ID type mismatches (string vs number)
 * 
 * @param restaurants - Array of restaurants to deduplicate
 * @returns Deduplicated array of restaurants (preserves first occurrence)
 */
export const deduplicateRestaurants = (restaurants: Restaurant[]): Restaurant[] => {
  if (!restaurants || restaurants.length === 0) {
    return restaurants;
  }

  // Use Map with normalized string IDs to handle type mismatches
  const seenIds = new Set<string>();
  const uniqueRestaurants: Restaurant[] = [];

  for (const restaurant of restaurants) {
    const normalizedId = normalizeId(restaurant.id);
    
    // Only add if we haven't seen this ID before
    if (!seenIds.has(normalizedId)) {
      seenIds.add(normalizedId);
      uniqueRestaurants.push(restaurant);
    }
  }

  return uniqueRestaurants;
};

/**
 * Sort restaurants by availability and distance
 * - Opened restaurants appear first, sorted by distance (ascending)
 * - Closed restaurants appear last, sorted by distance (ascending)
 * 
 * @param restaurants - Array of restaurants to sort
 * @param getDistance - Optional function to extract distance from restaurant (for raw API data)
 * @returns Sorted array of restaurants (preserves all restaurants)
 */
export const sortRestaurantsByAvailability = (
  restaurants: Restaurant[],
  getDistance?: (restaurant: Restaurant) => number | string | undefined
): Restaurant[] => {
  if (!restaurants || restaurants.length === 0) {
    return restaurants;
  }

  // Create a copy to avoid mutating the original array
  const sortedRestaurants = [...restaurants];

  // Sort restaurants
  sortedRestaurants.sort((a, b) => {
    // Primary sort: availability (opened restaurants come first)
    const aIsOpen = a.isOpen ?? false;
    const bIsOpen = b.isOpen ?? false;

    if (aIsOpen !== bIsOpen) {
      return aIsOpen ? -1 : 1; // true (open) comes before false (closed)
    }

    // Secondary sort: distance (ascending) - only if both have same availability status
    const aDistance = getDistance ? extractNumericDistance(getDistance(a)) : extractNumericDistance(a.distance);
    const bDistance = getDistance ? extractNumericDistance(getDistance(b)) : extractNumericDistance(b.distance);

    // Tertiary sort: by ID to ensure stable sorting (prevents order changes on re-sort)
    if (aDistance === bDistance) {
      const aId = normalizeId(a.id);
      const bId = normalizeId(b.id);
      return aId.localeCompare(bId);
    }

    return aDistance - bDistance;
  });

  return sortedRestaurants;
};

/**
 * Sort restaurants from raw API data by availability and distance
 * This is useful when you have raw API data with numeric distance before transformation
 * 
 * @param restaurants - Array of raw restaurant data from API
 * @param getIsOpen - Function to determine if restaurant is open
 * @param getDistance - Function to extract distance from restaurant
 * @returns Sorted array of restaurants
 */
export const sortRawRestaurantsByAvailability = <T extends Record<string, any>>(
  restaurants: T[],
  getIsOpen: (restaurant: T) => boolean,
  getDistance: (restaurant: T) => number | string | undefined
): T[] => {
  if (!restaurants || restaurants.length === 0) {
    return restaurants;
  }

  // Create a copy to avoid mutating the original array
  const sortedRestaurants = [...restaurants];

  // Sort restaurants
  sortedRestaurants.sort((a, b) => {
    // Primary sort: availability (opened restaurants come first)
    const aIsOpen = getIsOpen(a);
    const bIsOpen = getIsOpen(b);

    if (aIsOpen !== bIsOpen) {
      return aIsOpen ? -1 : 1; // true (open) comes before false (closed)
    }

    // Secondary sort: distance (ascending) - only if both have same availability status
    const aDistance = extractNumericDistance(getDistance(a));
    const bDistance = extractNumericDistance(getDistance(b));

    return aDistance - bDistance;
  });

  return sortedRestaurants;
};

