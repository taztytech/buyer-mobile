/**
 * Search Service
 * Handles all search-related API calls
 */

import { apiService, ApiResponse } from './api.service';

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

class SearchService {
  /**
   * Get search suggestions based on query
   * @param query - Search query string
   * @param latitude - User's latitude
   * @param longitude - User's longitude
   */
  async getSearchSuggestions(
    query: string,
    latitude?: number,
    longitude?: number
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
        limit: 10,
      };

      // Add location parameters if provided
      if (latitude !== undefined && longitude !== undefined) {
        requestBody.lat = latitude;
        requestBody.lng = longitude;
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
