/**
 * Search Service
 * Handles all search-related API calls
 */

import { apiService, ApiResponse } from './api.service';
import type { VegModeType } from '@/context/VegModeContext';

export interface SearchSuggestion {
  id: number;
  name: string;
  type: 'item' | 'restaurant';
  image?: string;
  images?: string[];
  logo_url?: string;
  description?: string;
}

export interface SearchSuggestionsResponse {
  items: SearchSuggestion[];
  restaurants: SearchSuggestion[];
}

export interface SearchResultDish {
  id: number;
  name: string;
  image_url?: string;
  base_price?: number;
  dietary_preference?: string | null;
  is_available?: boolean;
  store_id: number | null;
  store_name: string | null;
  distance?: number | null;
  delivery_time?: string;
  rating?: number;
  is_open?: boolean;
}

export interface SearchResultRestaurant {
  id: number;
  name: string;
  logo_url?: string;
  cuisine_tags?: string;
  rating?: number;
  total_reviews?: number;
  delivery_time?: string;
  distance?: number | null;
  is_open?: boolean;
  location?: { locality?: string; city?: string };
}

export interface SearchResultsResponse {
  query: string;
  cleaned_query: string;
  /** What the buyer most likely meant; decides which section leads. */
  intent: 'dish' | 'restaurant';
  dishes: SearchResultDish[];
  restaurants: SearchResultRestaurant[];
}

export interface CategoryDish extends SearchResultDish {
  images?: string[];
  price?: { base_price: number; maximum_price: number; currency: string };
  quantity?: { unit_type: string; unit_value: number; available_count: number };
  has_options?: boolean;
}

export interface CategoryResultsResponse {
  category?: { id: number; name: string; icon?: string };
  dishes: CategoryDish[];
  restaurants: SearchResultRestaurant[];
}

class SearchService {
  /** A "What's on your mind?" category page: its dishes + restaurants. */
  async getCategoryResults(
    categoryId: number,
    latitude?: number,
    longitude?: number,
    vegMode: VegModeType = 'off'
  ): Promise<CategoryResultsResponse> {
    const params: Record<string, any> = {};
    if (latitude !== undefined && longitude !== undefined) {
      params.lat = latitude;
      params.lng = longitude;
    }
    if (vegMode === 'pure') params.veg_only = 'true';
    const response: any = await apiService.get<any>(`/api/buyer/categories/${categoryId}/results`, params);
    let node = response;
    for (let i = 0; i < 4 && node && !Array.isArray(node.dishes); i++) node = node.data;
    if (!node || !Array.isArray(node.dishes)) {
      throw new Error(response?.message || 'Could not load this category');
    }
    return node as CategoryResultsResponse;
  }

  /**
   * Full results (voice or keyboard "search"): real dishes and restaurants,
   * spelling-tolerant, with the intent decided by the server.
   */
  async getSearchResults(
    query: string,
    latitude?: number,
    longitude?: number,
    vegMode: VegModeType = 'off'
  ): Promise<SearchResultsResponse> {
    const body: any = { query };
    if (latitude !== undefined && longitude !== undefined) {
      body.lat = latitude;
      body.lng = longitude;
    }
    if (vegMode === 'pure') body.veg_only = true;
    const response: any = await apiService.post<any>('/api/buyer/search/results', body);
    let node = response;
    for (let i = 0; i < 4 && node && !Array.isArray(node.dishes); i++) node = node.data;
    if (!node || !Array.isArray(node.dishes)) {
      throw new Error(response?.message || 'Search failed');
    }
    return node as SearchResultsResponse;
  }

  /**
   * Get search suggestions based on query
   * @param query - Search query string
   * @param latitude - User's latitude
   * @param longitude - User's longitude
   */
  async getSearchSuggestions(
    query: string,
    latitude?: number,
    longitude?: number,
    vegMode: VegModeType = 'off'
  ): Promise<ApiResponse<SearchSuggestionsResponse>> {
    try {
      if (!query || query.trim().length === 0) {
        return {
          success: true,
          data: {
            items: [],
            restaurants: [],
          },
        };
      }

      // POST method with query, limit, and location in body
      const endpoint = '/api/buyer/search/suggestions';
      const requestBody: any = {
        query: query,
        limit: 50,
      };

      // Add location object if provided (API expects nested location payload)
      if (latitude !== undefined && longitude !== undefined) {
        requestBody.location = {
          lat: latitude,
          lng: longitude,
        };
      }

      // Apply dietary preference filter for veg modes
      if (vegMode === 'pure' || vegMode === 'all') {
        requestBody.filters = {
          ...requestBody.filters,
          dietary_preference: 'veg',
        };
      }

      const response = await apiService.post<any>(endpoint, requestBody);

      if (response.success && response.data) {
        // Extract suggestions from response
        const data = response.data.data || response.data;
        const suggestions = data.suggestions || [];

        // Separate items and restaurants based on type field
        const items = suggestions
          .filter((s: any) => s.type === 'dish' || s.type === 'item')
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            type: 'item' as const,
            image: s.image || s.icon,
            images: s.images || (s.image ? [s.image] : []),
            description: s.description,
          }));

        const restaurants = suggestions
          .filter((s: any) => s.type === 'restaurant')
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            type: 'restaurant' as const,
            logo_url: s.icon || s.image,
            description: s.description,
          }));

        return {
          success: true,
          data: {
            items,
            restaurants,
          },
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to fetch search suggestions',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch search suggestions',
        message: error.message,
      };
    }
  }
}

// Export singleton instance
export const searchService = new SearchService();
export default searchService;
