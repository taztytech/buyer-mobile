import { apiService } from './api.service';
import { API_CONFIG } from '@/config/api.config';

/**
 * Video Commerce (creator) API for the buyer app.
 *
 * Thin wrapper over the Buyer API's /vc/creator/* routes. All calls are
 * authenticated by the logged-in buyer's JWT, which apiService already attaches.
 */

export type VcCreatorState =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'paused';

export interface VcCreator {
  state: VcCreatorState;
  handle?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  rejection_reason?: string | null;
  paused_reason?: string | null;
  intro_video_due_at?: string | null;
}

export interface ApplyCreatorInput {
  handle: string;
  email: string;
  instagram_profile_url?: string;
  facebook_profile_url?: string;
  youtube_channel_url?: string;
}

export interface VcStore {
  id: number;
  name: string;
  logo_url?: string | null;
}

export interface VcStoreItem {
  id: number;
  name: string;
}

export interface VcVideo {
  id: number;
  video_url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  store_name?: string | null;
  item_name?: string | null;
  status: string;
  like_count: number;
  view_count: number;
  order_count: number;
}

export interface RegisterVideoInput {
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  store_id: number;
  item_id?: number;
  store_name?: string;
  item_name?: string;
  duration_secs?: number;
}

export interface VcFeedItem {
  id: number;
  video_url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  store_id: number;
  item_id?: number | null;
  store_name?: string | null;
  item_name?: string | null;
  like_count: number;
  view_count: number;
  liked: boolean;
  creator_handle?: string | null;
  creator_name?: string | null;
  creator_avatar_url?: string | null;
}

export interface VcFeedPage {
  items: VcFeedItem[];
  next_cursor: number | null;
}

class VcService {
  async requestEmailOtp(email: string): Promise<void> {
    await apiService.post('/vc/creator/email/request-otp', { email });
  }

  async verifyEmailOtp(email: string, otp: string): Promise<void> {
    await apiService.post('/vc/creator/email/verify-otp', { email, otp });
  }

  /** True when the creator id is free to use. */
  async isHandleAvailable(handle: string): Promise<boolean> {
    const res = await apiService.get<{ available: boolean }>(
      '/vc/creator/handle-available',
      { handle },
    );
    return Boolean((res.data as any)?.available);
  }

  async apply(input: ApplyCreatorInput): Promise<VcCreator> {
    const res = await apiService.post<VcCreator>('/vc/creator/apply', input);
    return (res.data as VcCreator) ?? { state: 'pending' };
  }

  /**
   * Upload a profile picture. Multipart, so it goes through fetch directly with
   * the buyer's token rather than the JSON apiService client. Returns the new
   * avatar URL.
   */
  async uploadAvatar(fileUri: string): Promise<string | null> {
    const token = await apiService.getAccessToken();
    const form = new FormData();
    form.append('file', {
      uri: fileUri,
      name: 'avatar.jpg',
      type: 'image/jpeg',
    } as any);
    const res = await fetch(`${API_CONFIG.BASE_URL}/vc/creator/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    if (!res.ok) throw new Error('Avatar upload failed');
    const json = await res.json().catch(() => null);
    return json?.data?.avatar_url ?? json?.avatar_url ?? null;
  }

  // ---- Video upload + tagging ----------------------------------------------

  async searchStores(q: string): Promise<VcStore[]> {
    const res = await apiService.get<VcStore[]>('/vc/creator/stores', { q });
    return (res.data as VcStore[]) ?? [];
  }

  async storeItems(storeId: number): Promise<VcStoreItem[]> {
    const res = await apiService.get<VcStoreItem[]>(
      `/vc/creator/stores/${storeId}/items`,
    );
    return (res.data as VcStoreItem[]) ?? [];
  }

  async myVideos(): Promise<VcVideo[]> {
    const res = await apiService.get<VcVideo[]>('/vc/creator/videos');
    return (res.data as VcVideo[]) ?? [];
  }

  /**
   * Upload a local video file straight to S3 via a presigned URL, then register
   * it. Kept off apiService because the file goes to S3, not our API.
   *
   * The PUT goes through XMLHttpRequest so we can report real 0–100% progress.
   * IMPORTANT: the presigned URL is signed with BOTH ContentType and ACL
   * (public-read), so the PUT must send `Content-Type` AND `x-amz-acl` — miss
   * either and S3 returns 403 SignatureDoesNotMatch (the "Upload failed" bug).
   *
   * @param onProgress receives 0–100 as the upload advances (95 = bytes done,
   *        100 = registered).
   */
  async uploadAndRegisterVideo(
    fileUri: string,
    meta: Omit<RegisterVideoInput, 'video_url'>,
    contentType = 'video/mp4',
    onProgress?: (pct: number) => void,
  ): Promise<VcVideo> {
    onProgress?.(1);
    const urlRes = await apiService.post<{ upload_url: string; public_url: string }>(
      '/vc/creator/videos/upload-url',
      { kind: 'video', content_type: contentType },
    );
    const { upload_url, public_url } = urlRes.data as any;
    if (!upload_url || !public_url) {
      throw new Error('Could not start the upload. Please try again.');
    }

    // Read the local file into a blob, then PUT the raw bytes to S3.
    const fileResp = await fetch(fileUri);
    const blob = await fileResp.blob();

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', upload_url);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.setRequestHeader('x-amz-acl', 'public-read');
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable && onProgress) {
          // Reserve the last 5% for the register call after the bytes land.
          onProgress(Math.min(95, Math.round((e.loaded / e.total) * 95)));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else
          reject(
            new Error(
              `Upload rejected by storage (${xhr.status}). Please try again.`,
            ),
          );
      };
      xhr.onerror = () =>
        reject(new Error('Network problem during upload. Please try again.'));
      xhr.ontimeout = () =>
        reject(new Error('Upload timed out. Please try again on a better network.'));
      xhr.send(blob);
    });

    onProgress?.(97);
    const res = await apiService.post<VcVideo>('/vc/creator/videos', {
      ...meta,
      video_url: public_url,
    });
    onProgress?.(100);
    return res.data as VcVideo;
  }

  // ---- Feed + engagement ----------------------------------------------------

  async getFeed(
    cursor?: number,
    coords?: { lat?: number | null; lng?: number | null },
  ): Promise<VcFeedPage> {
    const params: Record<string, any> = {};
    if (cursor != null) params.cursor = cursor;
    if (coords?.lat != null && coords?.lng != null) {
      params.lat = coords.lat;
      params.lng = coords.lng;
    }
    const res = await apiService.get<VcFeedPage>(
      '/vc/feed',
      Object.keys(params).length ? params : undefined,
    );
    return (res.data as VcFeedPage) ?? { items: [], next_cursor: null };
  }

  async like(videoId: number): Promise<void> {
    await apiService.post(`/vc/videos/${videoId}/like`, {});
  }

  async unlike(videoId: number): Promise<void> {
    await apiService.delete(`/vc/videos/${videoId}/like`);
  }

  async recordView(videoId: number): Promise<void> {
    await apiService.post(`/vc/videos/${videoId}/view`, {});
  }

  /** Tell the server the viewer shopped from this video (for order attribution). */
  async recordClick(
    videoId: number,
    storeId: number,
    itemId?: number | null,
  ): Promise<void> {
    await apiService.post('/vc/attribution/click', {
      video_id: videoId,
      store_id: storeId,
      item_id: itemId ?? undefined,
    });
  }

  /** Current creator status for this buyer; 'none' if they never applied. */
  async me(): Promise<VcCreator> {
    try {
      const res = await apiService.get<VcCreator>('/vc/creator/me');
      return (res.data as VcCreator) ?? { state: 'none' };
    } catch {
      return { state: 'none' };
    }
  }
}

export const vcService = new VcService();
export default vcService;
