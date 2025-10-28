/**
 * Home Service
 * Handles all home page related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_CONFIG } from '@/config/api.config';

// Types
export interface BannerItem {
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  cta_button?: string;
  button_text?: string;
  image_url?: string;
  background_color?: string;
  action_url?: string;
  banner_url?: string;
  redirect_url?: string;
}

export interface CategoryItem {
  id: number | string;
  name: string;
  description?: string;
  icon?: string;
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

export interface HomeData {
  promotional_banner?: BannerItem | BannerItem[];
  nearby_restaurants?: Restaurant[];
  whats_on_your_mind?: CategoryItem[];
  pagination?: PaginationMetadata;
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
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.getHours() * 100 + now.getMinutes(); // Convert to HHMM format

    // Find timing for current day
    const todayTiming = timings.find(t => t.day === currentDay);

    if (!todayTiming) {
      return false; // No timing info for today means closed
    }

    if (!todayTiming.is_open) {
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
      // Build query params
      const params = new URLSearchParams();

      if (latitude !== undefined && longitude !== undefined) {
        params.append('latitude', latitude.toString());
        params.append('longitude', longitude.toString());
      }

      if (vegMode && vegMode !== 'off') {
        params.append('veg_mode', vegMode);
      }

      if (page > 1) {
        params.append('page', page.toString());
      }

      const queryString = params.toString();
      const endpoint = queryString
        ? `${API_CONFIG.ENDPOINTS.BUYER.HOME}?${queryString}`
        : API_CONFIG.ENDPOINTS.BUYER.HOME;

      const response = await apiService.get<HomeData>(endpoint);

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
