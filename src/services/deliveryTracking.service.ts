import Constants from '@/shims/rn-constants';
import { ApiResponse } from './api.service';

export interface DeliveryTrackStatusResponse {
  rider?: {
    id?: number | string;
    name?: string | null;
    phone?: string | null;
    current_location?: {
      lat?: number | string | null;
      lng?: number | string | null;
      heading?: number | string | null;
      speed?: number | string | null;
      accuracy?: number | string | null;
      timestamp?: number | string | null;
      updated_at?: number | string | null;
    } | null;
  } | null;
  status?: string | null;
  [key: string]: any;
}

class DeliveryTrackingService {
  private getBaseUrl(): string {
    const extra =
      (Constants.appConfig?.extra as Record<string, any> | undefined) ||
      ((Constants as any)?.manifest2?.extra as Record<string, any> | undefined) ||
      ((Constants as any)?.manifest?.extra as Record<string, any> | undefined) ||
      {};
    const baseUrl =
      (extra.DELIVERY_TRACK_BASE_URL as string | undefined) ||
      process.env.DELIVERY_TRACK_BASE_URL ||
      process.env.PUBLIC_DELIVERY_TRACK_BASE_URL ||
      'https://delivery.tazty.in';
    return String(baseUrl).trim().replace(/\/+$/, '');
  }

  async getTrackStatus(trackingId: number | string): Promise<ApiResponse<DeliveryTrackStatusResponse>> {
    const normalizedId = String(trackingId ?? '').trim();
    if (!normalizedId) {
      return {
        success: false,
        error: 'tracking_id_missing',
        message: 'Tracking id is required',
      };
    }

    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return {
        success: false,
        error: 'delivery_track_base_url_missing',
        message: 'Delivery track base URL is not configured',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const url = `${baseUrl}/api/track/${encodeURIComponent(normalizedId)}/status`;
    const requestMeta = {
      url,
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      params: {
        tracking_id: normalizedId,
      },
    };
    console.log('[DeliveryTracking] request', requestMeta);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);
      console.log('[DeliveryTracking] response', {
        request: requestMeta,
        statusCode: response.status,
        ok: response.ok,
        data: payload,
      });

      if (!response.ok) {
        return {
          success: false,
          error:
            payload?.error ||
            payload?.message ||
            `track_status_failed_${response.status}`,
          message: payload?.message || 'Failed to fetch track status',
          statusCode: response.status,
        };
      }

      return {
        success: true,
        data: (payload?.data ?? payload ?? {}) as DeliveryTrackStatusResponse,
        message: payload?.message || 'Track status fetched',
        statusCode: response.status,
      };
    } catch (error: any) {
      const isAbort = error?.name === 'AbortError';
      console.log('[DeliveryTracking] response_error', {
        request: requestMeta,
        error: error?.message || String(error),
        isAbort,
      });
      return {
        success: false,
        error: isAbort ? 'track_status_timeout' : 'track_status_exception',
        message: isAbort
          ? 'Track status request timed out'
          : error?.message || 'Failed to fetch track status',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const deliveryTrackingService = new DeliveryTrackingService();

