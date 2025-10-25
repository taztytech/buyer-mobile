/**
 * Favorites Service
 * Handles all favorite restaurants related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_CONFIG } from '@/config/api.config';

class FavoritesService {
  /**
   * Toggle favorite status for a restaurant
   * @param storeId - Restaurant/Store ID
   */
  async toggleFavoriteRestaurant(storeId: number | string): Promise<ApiResponse<any>> {
    try {
      const endpoint = `/api/buyer/favorites/restaurants/${storeId}`;
      const response = await apiService.post<any>(endpoint, {});
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to toggle favorite',
        message: error.message,
      };
    }
  }

  /**
   * Get user's favorite restaurants
   */
  async getFavoriteRestaurants(): Promise<ApiResponse<any>> {
    try {
      const endpoint = '/api/buyer/favorites/restaurants';
      const response = await apiService.get<any>(endpoint);
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch favorite restaurants',
        message: error.message,
      };
    }
  }

  /**
   * Toggle favorite status for a menu item
   * @param itemId - Menu Item ID
   */
  async toggleFavoriteItem(itemId: number | string): Promise<ApiResponse<any>> {
    try {
      const endpoint = `/api/buyer/favorites/items/${itemId}`;
      const response = await apiService.post<any>(endpoint, {});
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to toggle favorite item',
        message: error.message,
      };
    }
  }

  /**
   * Get user's favorite items
   */
  async getFavoriteItems(): Promise<ApiResponse<any>> {
    try {
      const endpoint = '/api/buyer/favorites/items';
      const response = await apiService.get<any>(endpoint);
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch favorite items',
        message: error.message,
      };
    }
  }

  /**
   * Get all user's favorites (restaurants and items)
   */
  async getAllFavorites(): Promise<ApiResponse<any>> {
    try {
      const endpoint = '/api/buyer/favorites/all';
      const response = await apiService.get<any>(endpoint);
      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch all favorites',
        message: error.message,
      };
    }
  }
}

// Export singleton instance
export const favoritesService = new FavoritesService();
export default favoritesService;
