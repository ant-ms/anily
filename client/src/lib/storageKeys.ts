/** Centralised localStorage key constants. Avoids magic strings scattered across the codebase. */
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  BACKEND_URL: 'backendUrl',
  PROFILE_DATA: 'anily:profile_data',
  MEDIA_PLAYER: 'anily:mediaPlayer',
  LANGUAGE_PREFERENCE: 'anily:languagePreference',
  PENDING_WATCH_QUEUE: 'anily:pending_watch_queue',
  ACTIVE_DOWNLOADS: 'anily:active_downloads',
  DOWNLOADED_ANIME_IDS: 'anily:downloaded_anime_ids',
  // cache keys are dynamic — use buildCacheKey helpers below
} as const;

/** Build the localStorage cache key for episode data. */
export const buildEpisodeCacheKey = (anilistId: number): string =>
  `anily:cache:episodes:${anilistId}`;

/** Build the localStorage cache key for anime details. */
export const buildDetailsCacheKey = (anilistId: number): string =>
  `anily:cache:details:${anilistId}`;

/** Build the localStorage cache key for anime grouping data. */
export const buildGroupingCacheKey = (anilistId: number): string =>
  `anily:cache:grouping:${anilistId}`;

/** Build the localStorage cache key for sidebar card data. */
export const buildSidebarCacheKey = (tabId: string): string =>
  `anily:cache:sidebar:${tabId}`;
