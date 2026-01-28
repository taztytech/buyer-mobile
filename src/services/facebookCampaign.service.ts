/**
 * Facebook Campaign Service
 * Service to load and manage Facebook advertising campaigns
 */

import { Platform } from 'react-native';

export interface FacebookCampaign {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  daily_budget?: number;
  lifetime_budget?: number;
  created_time?: string;
  updated_time?: string;
}

export interface FacebookCampaignResponse {
  data: FacebookCampaign[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
}

class FacebookCampaignService {
  private accessToken: string | null = null;
  private adAccountId: string | null = null;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  /**
   * Initialize the Facebook Campaign service
   * @param accessToken - Facebook access token
   * @param adAccountId - Facebook Ad Account ID (e.g., 'act_123456789')
   */
  initialize(accessToken: string, adAccountId: string): void {
    this.accessToken = accessToken;
    this.adAccountId = adAccountId;
  }

  /**
   * Load campaigns from Facebook Marketing API
   * @param fields - Optional fields to retrieve (default: id, name, objective, status)
   * @param limit - Number of campaigns to retrieve (default: 25)
   * @returns Promise with campaign data
   */
  async loadCampaigns(
    fields: string[] = ['id', 'name', 'objective', 'status', 'daily_budget', 'lifetime_budget', 'created_time', 'updated_time'],
    limit: number = 25
  ): Promise<FacebookCampaignResponse> {
    if (!this.accessToken || !this.adAccountId) {
      throw new Error('Facebook Campaign Service not initialized. Call initialize() first with access token and ad account ID.');
    }

    try {
      const fieldsParam = fields.join(',');
      const url = `${this.baseUrl}/${this.adAccountId}/campaigns?fields=${fieldsParam}&limit=${limit}&access_token=${this.accessToken}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Failed to load Facebook campaigns: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`
        );
      }

      const data: FacebookCampaignResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[FacebookCampaignService] Error loading campaigns:', error);
      throw error;
    }
  }

  /**
   * Load a specific campaign by ID
   * @param campaignId - Facebook Campaign ID
   * @param fields - Optional fields to retrieve
   * @returns Promise with campaign data
   */
  async loadCampaignById(
    campaignId: string,
    fields: string[] = ['id', 'name', 'objective', 'status', 'daily_budget', 'lifetime_budget', 'created_time', 'updated_time']
  ): Promise<FacebookCampaign> {
    if (!this.accessToken) {
      throw new Error('Facebook Campaign Service not initialized. Call initialize() first with access token.');
    }

    try {
      const fieldsParam = fields.join(',');
      const url = `${this.baseUrl}/${campaignId}?fields=${fieldsParam}&access_token=${this.accessToken}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Failed to load Facebook campaign: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`
        );
      }

      const data: FacebookCampaign = await response.json();
      return data;
    } catch (error) {
      console.error('[FacebookCampaignService] Error loading campaign:', error);
      throw error;
    }
  }

  /**
   * Load campaigns with pagination
   * @param fields - Optional fields to retrieve
   * @param limit - Number of campaigns per page
   * @param after - Cursor for pagination (from previous response)
   * @returns Promise with campaign data including pagination info
   */
  async loadCampaignsPaginated(
    fields: string[] = ['id', 'name', 'objective', 'status'],
    limit: number = 25,
    after?: string
  ): Promise<FacebookCampaignResponse> {
    if (!this.accessToken || !this.adAccountId) {
      throw new Error('Facebook Campaign Service not initialized. Call initialize() first with access token and ad account ID.');
    }

    try {
      const fieldsParam = fields.join(',');
      let url = `${this.baseUrl}/${this.adAccountId}/campaigns?fields=${fieldsParam}&limit=${limit}&access_token=${this.accessToken}`;
      
      if (after) {
        url += `&after=${after}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Failed to load Facebook campaigns: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`
        );
      }

      const data: FacebookCampaignResponse = await response.json();
      return data;
    } catch (error) {
      console.error('[FacebookCampaignService] Error loading campaigns:', error);
      throw error;
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return !!(this.accessToken && this.adAccountId);
  }

  /**
   * Clear the access token and ad account ID
   */
  reset(): void {
    this.accessToken = null;
    this.adAccountId = null;
  }
}

// Export singleton instance
export const facebookCampaignService = new FacebookCampaignService();
