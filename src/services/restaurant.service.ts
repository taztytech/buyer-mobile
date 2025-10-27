import { apiService } from './api.service';

export interface RestaurantLocation {
  lat: number;
  lng: number;
  city: string;
  locality: string;
}

export interface RestaurantTiming {
  day: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
}

export interface RestaurantOffer {
  id: number;
  name: string;
  description: string;
  offer_code: string;
  banner_image_url: string;
  valid_from: string;
  valid_to: string;
}

export interface RestaurantStats {
  total_items: number;
  total_categories: number;
  active_offers: number;
  average_rating: number;
  total_reviews: number;
}

export interface RestaurantDetails {
  id: number;
  name: string;
  description?: string;
  logo_url: string;
  fssai_license?: string;
  gst_number?: string;
  locations: RestaurantLocation[];
  timings: RestaurantTiming[];
  offers: RestaurantOffer[];
  stats: RestaurantStats;
  is_open: boolean;
  delivery_time?: string;
  min_order_value?: number;
  delivery_fee?: number;
  categories: any[];
  applied_filters?: {
    search?: string;
    dietary_preference?: string;
  };
}

export interface RestaurantDetailsResponse {
  success: boolean;
  message: string;
  data: RestaurantDetails;
}

export interface RestaurantDetailsParams {
  lat: number;
  lng: number;
  search?: string;
  include_items?: boolean;
}

class RestaurantService {
  /**
   * Get restaurant details by ID
   */
  async getRestaurantDetails(
    restaurantId: number,
    params: RestaurantDetailsParams
  ): Promise<RestaurantDetailsResponse> {
    try {
      const queryParams = {
        lat: params.lat,
        lng: params.lng,
        ...(params.search && { search: params.search }),
        include_items: params.include_items !== false ? 'true' : 'false',
      };

      const response = await apiService.get<any>(
        `/api/buyer/restaurants/${restaurantId}`,
        queryParams
      );

      // The API returns { success, data, message } where data contains the actual restaurant data
      if (response.success && response.data) {
        // Check if data has nested data property (API response format)
        const restaurantData = response.data.data || response.data;

        return {
          success: true,
          message: response.data.message || response.message || 'Success',
          data: restaurantData,
        };
      } else {
        return {
          success: false,
          message: response.message || 'Failed to fetch restaurant details',
          data: {} as RestaurantDetails,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch restaurant details',
        data: {} as RestaurantDetails,
      };
    }
  }
}

export const restaurantService = new RestaurantService();
