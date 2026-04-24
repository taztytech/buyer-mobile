/**
 * Favorites Service
 * Handles all favorite restaurants related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_CONFIG } from '@/config/api.config';

class FavoritesService {
  private itemFavoriteOverrides = new Map<string, boolean>();
  private itemFavoriteListeners = new Set<(itemId: string, isFavorite: boolean) => void>();
  private restaurantFavoriteOverrides = new Map<string, boolean>();
  private restaurantFavoriteListeners = new Set<(restaurantId: string, isFavorite: boolean) => void>();

  private notifyItemFavoriteChange(itemId: string, isFavorite: boolean) {
    this.itemFavoriteListeners.forEach((listener) => {
      try {
        listener(itemId, isFavorite);
      } catch {
        // ignore listener errors
      }
    });
  }

  setItemFavoriteOverride(itemId: number | string, isFavorite: boolean) {
    const normalizedId = String(itemId);
    this.itemFavoriteOverrides.set(normalizedId, isFavorite);
    this.notifyItemFavoriteChange(normalizedId, isFavorite);
  }

  getItemFavoriteOverride(itemId: number | string): boolean | undefined {
    return this.itemFavoriteOverrides.get(String(itemId));
  }

  subscribeToItemFavoriteChanges(listener: (itemId: string, isFavorite: boolean) => void): () => void {
    this.itemFavoriteListeners.add(listener);
    return () => {
      this.itemFavoriteListeners.delete(listener);
    };
  }

  private notifyRestaurantFavoriteChange(restaurantId: string, isFavorite: boolean) {
    this.restaurantFavoriteListeners.forEach((listener) => {
      try {
        listener(restaurantId, isFavorite);
      } catch {
        // ignore listener errors
      }
    });
  }

  setRestaurantFavoriteOverride(restaurantId: number | string, isFavorite: boolean) {
    const normalizedId = String(restaurantId);
    this.restaurantFavoriteOverrides.set(normalizedId, isFavorite);
    this.notifyRestaurantFavoriteChange(normalizedId, isFavorite);
  }

  getRestaurantFavoriteOverride(restaurantId: number | string): boolean | undefined {
    return this.restaurantFavoriteOverrides.get(String(restaurantId));
  }

  subscribeToRestaurantFavoriteChanges(
    listener: (restaurantId: string, isFavorite: boolean) => void
  ): () => void {
    this.restaurantFavoriteListeners.add(listener);
    return () => {
      this.restaurantFavoriteListeners.delete(listener);
    };
  }

  /**
   * Toggle favorite status for a restaurant
   * @param storeId - Restaurant/Store ID
   */
  async toggleFavoriteRestaurant(storeId: number | string): Promise<ApiResponse<any>> {
    try {
      const endpoint = `/api/buyer/favorites/restaurants/${storeId}`;
      console.log('[FavoritesService] REQUEST toggleFavoriteRestaurant', {
        endpoint,
        storeId,
        method: 'POST',
        body: {},
      });
      const response = await apiService.post<any>(endpoint, {});
      console.log('[FavoritesService] RESPONSE toggleFavoriteRestaurant', {
        endpoint,
        storeId,
        response,
      });
      return response;
    } catch (error: any) {
      console.log('[FavoritesService] ERROR toggleFavoriteRestaurant', {
        endpoint: `/api/buyer/favorites/restaurants/${storeId}`,
        storeId,
        error: error?.message || error,
      });
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
      console.log('[FavoritesService] REQUEST toggleFavoriteItem', {
        endpoint,
        itemId,
        method: 'POST',
        body: {},
      });
      const response = await apiService.post<any>(endpoint, {});
      console.log('[FavoritesService] RESPONSE toggleFavoriteItem', {
        endpoint,
        itemId,
        response,
      });
      return response;
    } catch (error: any) {
      console.log('[FavoritesService] ERROR toggleFavoriteItem', {
        endpoint: `/api/buyer/favorites/items/${itemId}`,
        itemId,
        error: error?.message || error,
      });
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
