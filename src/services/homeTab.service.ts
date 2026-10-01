/**
 * Home top-dash tabs (admin-managed, shown after the fixed "Food" tab) and
 * the restaurants and dishes each one lists.
 */

import { apiService } from './api.service';

export interface HomeTabSummary {
  id: number;
  title: string;
  image_url: string | null;
}

export interface HomeTabRestaurant {
  id: number;
  name: string;
  logo_url?: string;
  cuisine_tags?: string;
  food_type?: string | null;
  rating?: number;
  total_reviews?: number;
  delivery_time?: string;
  distance?: number | null;
  is_open?: boolean;
  timings?: any[];
  location?: { lat?: number; lng?: number; city?: string; locality?: string };
}

export interface HomeTabDish {
  id: number;
  name: string;
  short_desc?: string;
  image_url?: string;
  base_price?: number;
  dietary_preference?: string | null;
  is_available?: boolean;
  rating?: number;
  store_id: number | null;
  store_name: string | null;
  delivery_time?: string;
  distance?: number | null;
}

export interface HomeTabListing {
  tab: HomeTabSummary;
  restaurants: HomeTabRestaurant[];
  dishes: HomeTabDish[];
}

/** The buyer API wraps bodies as { success, data }; dig to the listing. */
const findListing = (response: any): HomeTabListing | null => {
  let node = response;
  for (let i = 0; i < 4 && node; i++) {
    if (node && typeof node === 'object' && Array.isArray(node.restaurants)) {
      return node as HomeTabListing;
    }
    node = node?.data;
  }
  return null;
};

export interface HomeTabsConfig {
  food_title?: string;
  food_image_url?: string | null;
  shape?: { points: Array<[number, number]>; roundness: number } | null;
  tabs: HomeTabSummary[];
}

class HomeTabService {
  /** Tabs, first-tab name/image and card shape (for the live refresh). */
  async getActive(): Promise<HomeTabsConfig | null> {
    try {
      const response: any = await apiService.get('/home-tabs/active');
      let node = response;
      for (let i = 0; i < 4 && node && !Array.isArray(node.tabs); i++) node = node.data;
      return node && Array.isArray(node.tabs) ? (node as HomeTabsConfig) : null;
    } catch {
      return null;
    }
  }

  async getListing(id: number, lat?: number, lng?: number): Promise<HomeTabListing> {
    const params: Record<string, any> = {};
    if (lat != null) params.lat = lat;
    if (lng != null) params.lng = lng;
    const response = await apiService.get(`/home-tabs/${id}/listing`, params);
    const listing = findListing(response);
    if (!listing) throw new Error('Could not load this list');
    return {
      tab: listing.tab,
      restaurants: Array.isArray(listing.restaurants) ? listing.restaurants : [],
      dishes: Array.isArray(listing.dishes) ? listing.dishes : [],
    };
  }
}

export const homeTabService = new HomeTabService();
