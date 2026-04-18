/**
 * Exotel Service
 * Handles Exotel API calls for connecting users with delivery agents
 */

import Constants from '@/shims/rn-constants';
import { ApiResponse } from './api.service';

// Types
export interface ExotelCallRequest {
  order_id?: string; // Optional - only required for order-specific calls
  from: string;
  to: string;
}

export interface ExotelCallResponse {
  success: boolean;
  message?: string;
  error?: string;
}

class ExotelService {
  private getExotelApiUrl(): string {
    // Get seller base URL from environment config
    const sellerBaseUrl =
      (Constants.appConfig?.extra?.TAZTY_SELLER_BASEURL as string | undefined) ||
      'https://api.valardigital.in';
    
    // Construct the full Exotel API URL by appending /exotel to the base URL
    return `${String(sellerBaseUrl).trim().replace(/\/+$/, '')}/exotel`;
  }

  /**
   * Initiate a call between user and delivery agent via Exotel
   * @param request - Call request with order_id, from (user phone), and to (agent phone)
   * @returns API response indicating success or failure
   */
  async initiateCall(request: ExotelCallRequest): Promise<ApiResponse<ExotelCallResponse>> {
    try {
      // Validate request - order_id is optional, but from and to are required
      if (!request.from || !request.to) {
        return {
          success: false,
          error: 'Missing required fields: from and to are required',
          message: 'Missing required fields',
        };
      }

      // Validate phone numbers (should be numeric strings)
      const phoneRegex = /^\d+$/;
      if (!phoneRegex.test(request.from) || !phoneRegex.test(request.to)) {
        return {
          success: false,
          error: 'Invalid phone number format. Phone numbers must contain only digits',
          message: 'Invalid phone number format',
        };
      }

      // Make API call to Exotel endpoint
      // Note: This is an external API, so we use fetch directly instead of apiService
      // to avoid authentication headers that might interfere
      const requestBody: any = {
        from: request.from,
        to: request.to,
      };
      
      // Only include order_id if provided (for order-specific calls)
      if (request.order_id) {
        requestBody.order_id = request.order_id;
      }

      const response = await fetch(this.getExotelApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Parse response
      const responseData = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          success: true,
          data: responseData,
          message: responseData.message || 'Call initiated successfully',
        };
      } else {
        return {
          success: false,
          error: responseData.error || responseData.message || `Failed to initiate call: ${response.statusText}`,
          message: responseData.message || 'Failed to initiate call',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to initiate call. Please check your internet connection and try again.',
        message: error.message || 'Network error',
      };
    }
  }
}

// Export singleton instance
export const exotelService = new ExotelService();
