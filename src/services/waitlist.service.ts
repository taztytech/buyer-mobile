import { apiService, ApiResponse } from './api.service';

export interface WaitlistPayload {
  /** Locality/area name the user is standing in (best-effort). */
  area?: string;
  /** Full address string, when available. */
  address?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Records interest from an unserviceable area so the team can see where demand
 * is building and prioritise expansion. Backed by POST /api/buyer/waitlist.
 */
class WaitlistService {
  async submit(payload: WaitlistPayload): Promise<ApiResponse<any>> {
    try {
      return await apiService.post<any>('/api/buyer/waitlist', payload);
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to join the waitlist' };
    }
  }
}

export const waitlistService = new WaitlistService();
