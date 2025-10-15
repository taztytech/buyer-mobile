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

export interface HomeData {
  promotional_banner?: BannerItem | BannerItem[];
  nearby_restaurants?: any[];
  whats_on_your_mind?: any[];
}

class HomeService {
  /**
   * Fetch home page data
   */
  async getHomeData(): Promise<ApiResponse<HomeData>> {
    try {
      const response = await apiService.get<HomeData>(
        API_CONFIG.ENDPOINTS.BUYER.HOME
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
