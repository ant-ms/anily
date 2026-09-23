import { apiBaseUrl } from "./context.svelte";
import type AnimeDetailsData from "../types/AnimeDetails";
import type { Rating } from "../types/AnimeDetails";
import type EpisodeData from "../types/Episode";
import type SidebarCardData from "../types/SidebarCardData";
import type AnimeGroupingsData from "../types/AnimeGroupings";
import type { AvailableService } from "../types/Media";
import type { SyncJob } from "../types/SyncJob";

export interface PlayStreamResponse {
  streamUrl: string;
  container?: "hls" | "mp4";
  serverName?: string;
  subtitles: Array<{
    label: string;
    language: string;
    url: string;
    default?: boolean;
  }>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message?: string,
  ) {
    super(message || `API Error: ${status} ${statusText}`);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = apiBaseUrl.current;
  if (!baseUrl) {
    throw new Error("API base URL is not configured");
  }

  const url = new URL(path, baseUrl);
  const headers = new Headers(options.headers || {});
  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url.toString(), {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let errorMsg: string | undefined;
    try {
      const errJson = await res.json();
      errorMsg = errJson.reason || errJson.error || errJson.message;
    } catch {}
    throw new ApiError(res.status, res.statusText, errorMsg);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return null as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  async getMe(): Promise<{ email?: string; name?: string; userId?: string; picture?: string }> {
    return request("/api/me");
  },

  async getDetails(anilistId: number): Promise<AnimeDetailsData> {
    return request<AnimeDetailsData>(`/api/details/${anilistId}`);
  },

  async refreshDetails(anilistId: number): Promise<void> {
    return request<void>(`/api/details/${anilistId}/refresh`, { method: "POST" });
  },

  async addGrouping(anilistId: number): Promise<void> {
    return request<void>(`/api/details/${anilistId}/grouping`, { method: "POST" });
  },

  async removeGrouping(anilistId: number): Promise<void> {
    return request<void>(`/api/details/${anilistId}/grouping`, { method: "DELETE" });
  },

  async getEpisodes(anilistId: number): Promise<EpisodeData[]> {
    return request<EpisodeData[]>(`/api/episodes/${anilistId}`);
  },

  async refreshEpisodes(anilistId: number): Promise<void> {
    return request<void>(`/api/episodes/${anilistId}/refresh`, { method: "POST" });
  },

  async setEpisodeWatch(episodeId: number, watched: boolean): Promise<void> {
    return request<void>(`/api/episodes/${episodeId}/watch`, {
      method: "PUT",
      body: JSON.stringify({ watched }),
    });
  },

  async setAllEpisodesWatch(anilistId: number, watched: boolean): Promise<void> {
    return request<void>(`/api/episodes/${anilistId}/watch-all`, {
      method: "PUT",
      body: JSON.stringify({ watched }),
    });
  },

  async getRating(anilistId: number): Promise<{ rating: Rating }> {
    return request<{ rating: Rating }>(`/api/rate/${anilistId}`);
  },

  async setRating(anilistId: number, rating: Rating): Promise<{ rating: Rating }> {
    return request<{ rating: Rating }>(`/api/rate/${anilistId}`, {
      method: "PUT",
      body: JSON.stringify({ rating }),
    });
  },

  async getSidebar(tab: string): Promise<SidebarCardData[]> {
    return request<SidebarCardData[]>(`/api/sidebar/${encodeURIComponent(tab)}`);
  },

  async search(query: string): Promise<any[]> {
    return request<any[]>(`/api/search?q=${encodeURIComponent(query)}`);
  },

  async getGrouping(anilistId: number): Promise<AnimeGroupingsData> {
    return request<AnimeGroupingsData>(`/api/grouping?baseAnilistId=${anilistId}`);
  },

  async getSyncJobs(type?: string): Promise<SyncJob[]> {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    return request<SyncJob[]>(`/api/sync-jobs${query}`);
  },

  async getStreamServices(episodeId: number): Promise<{ services: AvailableService[] }> {
    return request<{ services: AvailableService[] }>(`/api/stream/services/${episodeId}`);
  },

  async getPlayStream(
    episodeId: number,
    params: {
      providerId: string;
      identifier: string;
      language: string;
      server?: string;
    },
  ): Promise<PlayStreamResponse> {
    const sp = new URLSearchParams({
      providerId: params.providerId,
      identifier: params.identifier,
      language: params.language,
    });
    if (params.server) sp.set("server", params.server);
    return request<PlayStreamResponse>(`/api/stream/play/${episodeId}?${sp.toString()}`);
  },

  async ping(): Promise<boolean> {
    try {
      await request("/api/ping");
      return true;
    } catch {
      return false;
    }
  },
};
