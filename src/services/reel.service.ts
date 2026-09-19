import { apiService } from './api.service';

export interface Reel {
  id: number;
  store_id: number;
  item_id: number;
  video_url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  duration_seconds?: string | null;
  sequence: number;
  view_count: number;
  item?: {
    id: number;
    name: string;
    description?: string | null;
    images?: string[] | null;
    food_type?: string | null;
    status?: boolean;
  };
}

/**
 * Reels shown under the Reels tab on a store page.
 *
 * Scoped to one store on purpose — there is no home feed. A buyer sees a
 * shop's videos only after opening that shop.
 */
export const reelService = {
  /**
   * Live reels for a store, already ordered by the API: menu order first, then
   * round-robined across dishes so several dishes are seen before a second
   * angle of the first.
   *
   * Returns an empty list rather than throwing when a store has no reels — the
   * caller hides the tab, and a missing tab must never break the store page.
   */
  async getStoreReels(storeId: number): Promise<Reel[]> {
    try {
      const response = await apiService.get<any>(
        `/api/buyer/restaurants/${storeId}/reels`,
      );
      const payload = response?.data?.data ?? response?.data;
      const reels = payload?.reels;
      return Array.isArray(reels) ? reels : [];
    } catch (error) {
      // A store page must still open if the reel service is unavailable.
      console.warn('[reels] could not load reels for store', storeId, error);
      return [];
    }
  },

  /**
   * Counted once the buyer has actually watched three seconds, and once per
   * buyer — the server deduplicates, so a rewatch is a silent no-op.
   *
   * Fire-and-forget: a failed count must never interrupt playback.
   */
  async recordView(reelId: number): Promise<void> {
    try {
      await apiService.post<any>(`/item-reels/${reelId}/view`, {});
    } catch {
      // Deliberately silent.
    }
  },
};
