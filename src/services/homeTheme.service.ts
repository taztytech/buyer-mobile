import { apiService } from './api.service';
import type { ActiveTheme } from '@/components/theme/themeTypes';
import { normalizeTheme } from '@/components/theme/themeTypes';

/** Finds the theme object in the API envelope and normalises its config. */
export const parseActiveTheme = (raw: any): ActiveTheme | null => {
  let node = raw;
  for (let i = 0; i < 4 && node && !(node.config && node.slug); i++) node = node.data;
  if (!node || !node.config) return null;
  return {
    id: node.id ?? null,
    slug: node.slug || 'default-green',
    name: node.name || 'Default Green',
    version: Number(node.version) || 0,
    config: normalizeTheme(node.config),
    next_change_at: node.next_change_at ?? null,
  };
};

class HomeThemeService {
  /** The theme to draw now; `address` lets city-specific themes apply. */
  async getActive(address?: string): Promise<ActiveTheme | null> {
    try {
      const params: Record<string, string> = {};
      if (address) params.city = address.slice(0, 200);
      const response: any = await apiService.get('/home-themes/active', params);
      return parseActiveTheme(response);
    } catch {
      return null;
    }
  }
}

export const homeThemeService = new HomeThemeService();
