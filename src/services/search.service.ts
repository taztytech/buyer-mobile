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
   */
  async getSearchSuggestions(query: string): Promise<ApiResponse<SearchSuggestionsResponse>> {
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

      // POST method with query and limit in body
      const endpoint = '/api/buyer/search/suggestions';
      const response = await apiService.post<any>(endpoint, {
        query: query,
        limit: 10,
      });

      console.log('🔍 Search API Response:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        // Extract suggestions from response
        const data = response.data.data || response.data;
        const suggestions = data.suggestions || [];

        console.log('📊 Suggestions:', suggestions.length);

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

        console.log('🍔 Items:', items.length);
        console.log('🏪 Restaurants:', restaurants.length);

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
      console.error('🔍 Search API Error:', error);
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
