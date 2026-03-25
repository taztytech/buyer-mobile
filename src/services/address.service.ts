/**
 * Address Service
 * Handles all address-related API calls
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, ApiResponse } from './api.service';
import { API_CONFIG } from '@/config/api.config';
import { GUEST_SELECTED_LOCATION_KEY } from './storage.service';

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
   * After OTP login, POST the guest's persisted delivery location as a saved address.
   * Keeps `selectedLocation` in AsyncStorage with `guestLocationSynced: true` after success so logout/login
   * does not duplicate the same address. Skips if invalid or at max addresses.
   */
  async syncGuestPersistedLocationAfterLogin(): Promise<void> {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(GUEST_SELECTED_LOCATION_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;

    const lat = typeof parsed.latitude === 'number' ? parsed.latitude : null;
    const lng = typeof parsed.longitude === 'number' ? parsed.longitude : null;
    if (lat == null || lng == null || lat === 0 || lng === 0) return;

    // Already synced on a previous login (or saved on logout while logged in); do not POST again.
    if (parsed.guestLocationSynced === true) {
      return;
    }

    const coordsNear = (a: number, b: number) => Math.abs(a - b) < 0.0002;

    const addrList = await this.getAddresses();
    if (addrList.success && addrList.data?.length) {
      const alreadyOnServer = addrList.data.some(
        (a) => coordsNear(a.latitude, lat) && coordsNear(a.longitude, lng)
      );
      if (alreadyOnServer) {
        try {
          await AsyncStorage.setItem(
            GUEST_SELECTED_LOCATION_KEY,
            JSON.stringify({ ...parsed, guestLocationSynced: true })
          );
        } catch {
          // ignore
        }
        return;
      }
    }

    if (addrList.success && addrList.data && addrList.data.length >= MAX_ADDRESSES) {
      return;
    }

    const typeRaw = parsed.type;
    const type: 'home' | 'work' | 'other' =
      typeof typeRaw === 'string' && ['home', 'work', 'other'].includes(typeRaw)
        ? (typeRaw as 'home' | 'work' | 'other')
        : 'other';

    const pincodeFromAddress =
      typeof parsed.address === 'string' ? parsed.address.match(/\b(\d{6})\b/)?.[1] : undefined;
    const pincodeDigits = (v: unknown): string | undefined => {
      if (v == null) return undefined;
      const d = String(v).replace(/\D/g, '').slice(0, 6);
      return d.length === 6 ? d : undefined;
    };

    const structured =
      typeof parsed.address1 === 'string' &&
      String(parsed.address1).trim().length > 0 &&
      typeof parsed.city === 'string' &&
      String(parsed.city).trim().length > 0 &&
      (pincodeDigits(parsed.pincode) != null || pincodeFromAddress != null);

    let body: AddAddressRequest;

    if (structured) {
      const pc = pincodeDigits(parsed.pincode) ?? pincodeFromAddress ?? '625001';
      body = {
        address1: String(parsed.address1).trim().slice(0, 200),
        address2: typeof parsed.address2 === 'string' ? parsed.address2.slice(0, 200) : undefined,
        address3: typeof parsed.address3 === 'string' ? parsed.address3.slice(0, 200) : undefined,
        city: String(parsed.city).trim().slice(0, 100),
        state: String(parsed.state || 'Tamil Nadu').trim().slice(0, 100),
        pincode: pc,
        latitude: lat,
        longitude: lng,
        type,
        is_default: true,
      };
    } else {
      const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
      const addrLine = typeof parsed.address === 'string' ? parsed.address.trim() : '';
      const pc = pincodeDigits(parsed.pincode) ?? pincodeFromAddress ?? '625001';
      body = {
        address1: (name || 'Delivery location').slice(0, 200),
        address3: addrLine ? addrLine.slice(0, 500) : undefined,
        city: typeof parsed.city === 'string' && parsed.city.trim() ? parsed.city.trim().slice(0, 100) : 'Madurai',
        state: typeof parsed.state === 'string' && parsed.state.trim() ? parsed.state.trim().slice(0, 100) : 'Tamil Nadu',
        pincode: pc,
        latitude: lat,
        longitude: lng,
        type,
        is_default: true,
      };
    }

    const response = await this.addAddress(body);
    if (response.success) {
      try {
        await AsyncStorage.setItem(
          GUEST_SELECTED_LOCATION_KEY,
          JSON.stringify({ ...parsed, guestLocationSynced: true })
        );
      } catch {
        // ignore
      }
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
