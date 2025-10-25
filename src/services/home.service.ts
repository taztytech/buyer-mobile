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

export interface Restaurant {
  id: string | number;
  name: string;
  cuisine: string;
  rating: number;
  deliveryTime: string;
  location: string | { lat?: number; lng?: number; city?: string; locality?: string };
  distance: string;
  image: string;
  isFavorite?: boolean;
  isVeg?: boolean;
}

export interface HomeData {
  promotional_banner?: BannerItem | BannerItem[];
  nearby_restaurants?: Restaurant[];
  whats_on_your_mind?: CategoryItem[];
}

class HomeService {
  /**
   * Fetch home page data
   * @param latitude - User's latitude
   * @param longitude - User's longitude
   * @param vegMode - Veg mode filter: 'off' | 'pure' | 'all'
   */
  async getHomeData(
    latitude?: number,
    longitude?: number,
    vegMode?: 'off' | 'pure' | 'all'
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
