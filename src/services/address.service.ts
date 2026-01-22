/**
 * Address Service
 * Handles all address-related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_CONFIG } from '@/config/api.config';

export const MAX_ADDRESSES = 5;

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
  // In-memory cache for addresses
  private addressCache: AddressResponse[] | null = null;
  private cacheTimestamp: number | null = null;
  private inFlightRequest: Promise<ApiResponse<AddressResponse[]>> | null = null;

  // Cache duration: 5 minutes (in milliseconds)
  private readonly CACHE_DURATION = 5 * 60 * 1000;

  /**
   * Clear the address cache
   * Call this after adding, updating, or deleting an address, or when switching accounts
   */
  clearCache(): void {
    this.addressCache = null;
    this.cacheTimestamp = null;
    this.inFlightRequest = null;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    if (!this.addressCache || !this.cacheTimestamp) {
      return false;
    }

    const now = Date.now();
    const isValid = (now - this.cacheTimestamp) < this.CACHE_DURATION;

    return isValid;
  }

  /**
   * Add a new address
   */
  async addAddress(addressData: AddAddressRequest): Promise<ApiResponse<AddressResponse>> {
    try {
      const response = await apiService.post<AddressResponse>(
        API_CONFIG.ENDPOINTS.USER.ADDRESS,
        addressData
      );

      // Clear cache after successful add
      if (response.success) {
        this.clearCache();
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add address',
      };
    }
  }

  /**
   * Get all addresses (with caching and request deduplication)
   */
  async getAddresses(): Promise<ApiResponse<AddressResponse[]>> {
    try {
      // Check if cache is valid
      if (this.isCacheValid() && this.addressCache) {
        return {
          success: true,
          data: this.addressCache,
        };
      }

      // If request is already in flight, wait for it
      if (this.inFlightRequest) {
        return this.inFlightRequest;
      }

      // Make new request
      this.inFlightRequest = apiService.get<AddressResponse[]>(
        API_CONFIG.ENDPOINTS.USER.ADDRESS
      );

      const response = await this.inFlightRequest;

      // Cache the result if successful
      if (response.success && response.data) {
        this.addressCache = response.data;
        this.cacheTimestamp = Date.now();
      }

      // Clear in-flight flag
      this.inFlightRequest = null;

      return response;
    } catch (error) {
      // Clear in-flight flag on error
      this.inFlightRequest = null;

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

      // Clear cache after successful update
      if (response.success) {
        this.clearCache();
      }

      return response;
    } catch (error) {
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

      // Clear cache after successful delete
      if (response.success) {
        this.clearCache();
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete address',
      };
    }
  }
}

// Export singleton instance
export const addressService = new AddressService();
