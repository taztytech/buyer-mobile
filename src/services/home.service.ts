/**
 * Home Service
 * Handles all home page related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_CONFIG } from '@/config/api.config';
import type { VegModeType } from '@/context/VegModeContext';

// Types
export interface BannerItem {
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  cta_button?: string;
  button_text?: string;
  button_color?: string;
  image_url?: string;
  background_color?: string;
  action_url?: string;
  banner_url?: string;
  redirect_url?: string;
  sequence?: number;
  // 'promo_offer' banners are created automatically when an offer is
  // published; promotion_link carries the offer id.
  promotion_type?: 'restaurant_id' | 'category_id' | 'url' | 'organization' | 'promo_offer';
  promotion_link?: string;
}

export interface CategoryItem {
  id: number | string;
  name: string;
  description?: string;
  icon?: string;
  sequence?: number;
  food_type?: string;
  is_veg?: boolean;
}

export interface DishItem {
  id: number | string;
  name: string;
  description?: string;
  image?: string;
  food_type?: string;
  is_veg?: boolean;
  sequence?: number;
}

export interface RestaurantTiming {
  day: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
}

export interface Restaurant {
  id: string | number;
  name: string;
  cuisine: string;
  rating: number;
  reviewCount?: number;
  deliveryTime: string;
  location: string | { lat?: number; lng?: number; city?: string; locality?: string };
  distance: string;
  image: string;
  isFavorite?: boolean;
  isVeg?: boolean;
  timings?: RestaurantTiming[];
  isOpen?: boolean;
}

export interface PaginationMetadata {
  current_page: number;
  total_pages: number;
  total_count: number;
  page_size: number;
  has_more: boolean;
}

export interface OrganizationBanner {
  title?: string;
  subtitle?: string;
  image_url?: string;
  background_color?: string;
  promotion_type?: string;
  sequence?: number;

  /**
   * Appearance, all optional. Anything unset falls back to the values the
   * home screen used before these existed, so an older banner is unaffected.
   */
  media_type?: string;
  video_url?: string;
  /** Shown until the video's first frame is ready. */
  poster_url?: string;
  title_font_size?: number;
  title_color?: string;
  subtitle_font_size?: number;
  subtitle_color?: string;
  /** Only applied when the family is bundled in the app. */
  font_family?: string;
  gradient_from?: string;
  gradient_to?: string;
  gradient_direction?: string;

  /**
   * Tamil title and subtitle, with their own font and sizes.
   *
   * Present only when the admin filled them in, which is also what decides
   * whether the banner shows its language toggle at all. The font is separate
   * because no Latin family bundled here carries Tamil glyphs - Poppins
   * included - so reusing font_family would leave the phone to substitute one.
   */
  title_ta?: string;
  subtitle_ta?: string;
  font_family_ta?: string;
  title_font_size_ta?: number;
  subtitle_font_size_ta?: number;
}

export interface HomeData {
  promotional_banner?: BannerItem | BannerItem[];
  nearby_restaurants?: Restaurant[];
  whats_on_your_mind?: CategoryItem[];
  pagination?: PaginationMetadata;
  home_screen_restaurant_card_style?: string;
  /** Legacy: Home header background string keys */
  home_background_image_url?: string;
  home_background_image?: string;
  header_background_image?: string;
  background_image_url?: string;
  home_screen_background_image?: string;
  organization_banner?: OrganizationBanner[];
  /**
   * Live promo offers for the strip below the shop banners. Carries
   * buyer_state / slots_remaining / opens_in_seconds, so the section renders
   * real state without its own request. Offers past their window are filtered
   * out server-side by clock, so nothing expired can arrive here.
   */
  offer_banner?: any[];
}

class HomeService {
  /**
   * Check if location is serviceable (within Madurai city bounds)
   * @param latitude - Location latitude
   * @param longitude - Location longitude
   * @returns boolean indicating if location is serviceable
   */
  isLocationServiceable(latitude: number, longitude: number): boolean {
    // Madurai city approximate bounds with some padding
    const MADURAI_BOUNDS = {
      north: 10.00,  // ~9.97°N + padding
      south: 9.85,   // ~9.87°N - padding
      east: 78.25,   // ~78.20°E + padding
      west: 78.05,   // ~78.07°E - padding
    };

    // Check if coordinates are within bounds
    const isWithinBounds =
      latitude >= MADURAI_BOUNDS.south &&
      latitude <= MADURAI_BOUNDS.north &&
      longitude >= MADURAI_BOUNDS.west &&
      longitude <= MADURAI_BOUNDS.east;

    return isWithinBounds;
  }

  /**
   * Check if restaurant is currently open based on timings
   * @param timings - Array of restaurant timings
   * @returns boolean indicating if restaurant is open
   */
  isRestaurantOpen(timings?: RestaurantTiming[]): boolean {
    if (!timings || timings.length === 0) {
      return true; // Default to open if no timing info
    }

    const now = new Date();
    const jsDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const currentTime = now.getHours() * 100 + now.getMinutes(); // Convert to HHMM format

    // Convert JavaScript day (0-6) to API day format (1-7)
    // API format: 1 = Sunday, 2 = Monday, ..., 7 = Saturday
    // JS format: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const apiDay = jsDay + 1;

    // Find timing for current day
    const todayTiming = timings.find(t => t.day === apiDay);

    if (!todayTiming) {
      return false; // No timing info for today means closed
    }

    if (todayTiming.is_open === false) {
      return false; // Explicitly marked as closed
    }

    // Convert time strings to numbers for comparison
    const openTime = parseInt(todayTiming.open_time);
    const closeTime = parseInt(todayTiming.close_time);

    // Check if current time is within opening hours
    if (closeTime > openTime) {
      // Normal case: opens and closes on same day
      return currentTime >= openTime && currentTime <= closeTime;
    } else {
      // Special case: closes after midnight (e.g., 2200 to 0200)
      return currentTime >= openTime || currentTime <= closeTime;
    }
  }

  /**
   * Get next opening time information for a restaurant
   * @param timings - Array of restaurant timings
   * @returns Object with next opening information or null if always closed
   */
  getNextOpeningTime(timings?: RestaurantTiming[]): { day: number; time: string; daysUntil: number; minutesUntil: number } | null {
    if (!timings || timings.length === 0) {
      return null; // No timing info
    }

    const now = new Date();
    const jsDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Convert JavaScript day (0-6) to API day format (1-7)
    // API format: 1 = Sunday, 2 = Monday, ..., 7 = Saturday
    const apiDay = jsDay + 1;

    // Check if restaurant opens later today
    const todayTiming = timings.find(t => t.day === apiDay);
    if (todayTiming && todayTiming.is_open) {
      const openTime = parseInt(todayTiming.open_time);
      if (currentTime < openTime) {
        // Opens later today
        const openHour = Math.floor(openTime / 100);
        const openMinute = openTime % 100;
        const minutesUntil = (openHour - currentHour) * 60 + (openMinute - currentMinute);

        return {
          day: apiDay,
          time: todayTiming.open_time,
          daysUntil: 0,
          minutesUntil: minutesUntil,
        };
      }
    }

    // Check next 7 days for opening time
    for (let i = 1; i <= 7; i++) {
      const nextDay = (apiDay + i) > 7 ? (apiDay + i) - 7 : (apiDay + i);
      const nextDayTiming = timings.find(t => t.day === nextDay);

      if (nextDayTiming && nextDayTiming.is_open) {
        const openTime = parseInt(nextDayTiming.open_time);
        const openHour = Math.floor(openTime / 100);
        const openMinute = openTime % 100;

        // Calculate minutes until opening
        const timeUntilMidnight = (24 - currentHour) * 60 - currentMinute;
        const timeFromMidnight = openHour * 60 + openMinute;
        const minutesUntil = timeUntilMidnight + timeFromMidnight + ((i - 1) * 24 * 60);

        return {
          day: nextDay,
          time: nextDayTiming.open_time,
          daysUntil: i,
          minutesUntil: minutesUntil,
        };
      }
    }

    return null; // No opening found in next 7 days
  }

  /**
   * Get formatted message for when restaurant opens
   * @param timings - Array of restaurant timings
   * @returns Formatted string like "Opens today in 30 mins" or "Opens in 2 days"
   */
  getRestaurantOpeningMessage(timings?: RestaurantTiming[]): string | null {
    // Check if restaurant is currently open
    if (this.isRestaurantOpen(timings)) {
      return null; // Restaurant is open, no message needed
    }

    const nextOpening = this.getNextOpeningTime(timings);

    if (!nextOpening) {
      return 'Currently closed'; // No opening info available
    }

    const { daysUntil, minutesUntil } = nextOpening;

    if (daysUntil === 0) {
      // Opens today
      if (minutesUntil < 60) {
        return `Opens today in ${minutesUntil} min${minutesUntil !== 1 ? 's' : ''}`;
      } else {
        const hours = Math.floor(minutesUntil / 60);
        const mins = minutesUntil % 60;
        if (mins === 0) {
          return `Opens today in ${hours} hour${hours !== 1 ? 's' : ''}`;
        }
        return `Opens today in ${hours}h ${mins}m`;
      }
    } else if (daysUntil === 1) {
      return 'Opens tomorrow';
    } else {
      return `Opens in ${daysUntil} days`;
    }
  }

  /**
   * Fetch dishes based on food type
   * @param foodType - Food type filter: 'Veg' | 'Non Veg'
   * @param limit - Number of dishes to fetch (default: 10)
   * @param page - Page number for pagination (default: 1)
   */
  async getDishes(
    foodType?: string,
    limit: number = 10,
    page: number = 1,
    vegMode: VegModeType = 'off'
  ): Promise<ApiResponse<{ dishes: DishItem[] }>> {
    try {
      // Build query params
      const params = new URLSearchParams();
      params.append('order_by', 'sequence');
      params.append('status', 'true');
      params.append('limit', limit.toString());
      params.append('page', page.toString());

      if (foodType) {
        params.append('food_type', foodType);
      }

      if (vegMode && vegMode !== 'off') {
        // API expects explicit food_type when veg mode filters are active
        if (vegMode === 'pure') {
          params.set('food_type', 'pure-veg');
        } else if (vegMode === 'all') {
          params.set('food_type', 'veg');
        }
      }

      const queryString = params.toString();
      const endpoint = `${API_CONFIG.ENDPOINTS.BUYER.DISH}?${queryString}`;

      const response = await apiService.get<{ dishes: DishItem[] }>(endpoint);

      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch dishes',
        message: error.message,
      };
    }
  }

  /**
   * Fetch home page data
   * @param latitude - User's latitude
   * @param longitude - User's longitude
   * @param vegMode - Veg mode filter: 'off' | 'pure' | 'all'
   * @param page - Page number for pagination (default: 1)
   */
  async getHomeData(
    latitude?: number,
    longitude?: number,
    vegMode?: 'off' | 'pure' | 'all',
    page: number = 1
  ): Promise<ApiResponse<HomeData>> {
    try {
      // Build query params as object (apiService.get will handle URL encoding)
      const params: Record<string, any> = {};

      if (latitude !== undefined && longitude !== undefined) {
        params.latitude = latitude.toString();
        params.longitude = longitude.toString();
      }

      if (vegMode && vegMode !== 'off') {
        params.veg_mode = vegMode;
      }

      if (page > 1) {
        params.page = page.toString();
      }

      // CRITICAL: Always use cache-busting headers for home API
      // This prevents HTTP cache from returning stale responses
      // We call this API fresh whenever user comes to homepage, so no timestamp needed
      const cacheBustingHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      };

      const response = await apiService.get<HomeData>(
        API_CONFIG.ENDPOINTS.BUYER.HOME,
        params,
        cacheBustingHeaders
      );

      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch home data',
        message: error.message,
      };
    }
  }
}

// Export singleton instance
export const homeService = new HomeService();
export default homeService;
