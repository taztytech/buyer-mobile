/**
 * Address Service
 * Handles all address-related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_CONFIG } from '@/config/api.config';

// Types
export interface AddAddressRequest {
  address1: string;
  address2?: string;
  address3?: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  type: 'home' | 'work' | 'other';
  alternate_phone_number?: number;
  is_default: boolean;
}

export interface AddressResponse {
  id: number;
  address1: string;
  address2?: string;
  address3?: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  type: 'home' | 'work' | 'other';
  alternate_phone_number?: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

class AddressService {
  /**
   * Add a new address
   */
  async addAddress(addressData: AddAddressRequest): Promise<ApiResponse<AddressResponse>> {
    try {
      const response = await apiService.post<AddressResponse>(
        API_CONFIG.ENDPOINTS.USER.ADDRESS,
        addressData
      );

      return response;
    } catch (error) {
      console.error('[AddressService] Add address error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add address',
      };
    }
  }

  /**
   * Get all addresses
   */
  async getAddresses(): Promise<ApiResponse<AddressResponse[]>> {
    try {
      const response = await apiService.get<AddressResponse[]>(
        API_CONFIG.ENDPOINTS.USER.ADDRESS
      );

      return response;
    } catch (error) {
      console.error('[AddressService] Get addresses error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch addresses',
      };
    }
  }

  /**
   * Update an address
   */
  async updateAddress(
    addressId: string,
    addressData: Partial<AddAddressRequest>
  ): Promise<ApiResponse<AddressResponse>> {
    try {
      const response = await apiService.patch<AddressResponse>(
        `${API_CONFIG.ENDPOINTS.USER.ADDRESS}/${addressId}`,
        addressData
      );

      return response;
    } catch (error) {
      console.error('[AddressService] Update address error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update address',
      };
    }
  }

  /**
   * Delete an address
   */
  async deleteAddress(addressId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiService.delete<void>(
        `${API_CONFIG.ENDPOINTS.USER.ADDRESS}/${addressId}`
      );

      return response;
    } catch (error) {
      console.error('[AddressService] Delete address error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete address',
      };
    }
  }
}

// Export singleton instance
export const addressService = new AddressService();
