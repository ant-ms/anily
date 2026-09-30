import { prisma } from "$src/prisma";
import { logger } from "$src/logger";

const log = logger.child({ module: "apiStream:skipTimes" });

export type SkipType = "op" | "ed" | "recap" | "mixed-op" | "mixed-ed";

export interface SkipInterval {
  startTime: number;
  endTime: number;
}

export interface SkipTimeEntry {
  type: SkipType;
  interval: SkipInterval;
  skipId?: string;
  episodeLength?: number;
}

export interface EpisodeSkipTimesResult {
  found: boolean;
  notFound?: boolean;
  results: SkipTimeEntry[];
  op?: SkipInterval;
  ed?: SkipInterval;
  recap?: SkipInterval;
  mixedOp?: SkipInterval;
  mixedEd?: SkipInterval;
}

interface AniSkipRawResponse {
  found: boolean;
  results?: Array<{
    interval: {
      startTime: number;
      endTime: number;
    };
    skipType: string;
    skipId?: string;
    episodeLength?: number;
  }>;
  message?: string;
  statusCode?: number;
}

interface CacheEntry {
  result: EpisodeSkipTimesResult;
  expiresAt: number;
}

// Bounded in-memory LRU cache to prevent redundant AniSkip requests
class SkipTimesCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;

  constructor(maxSize = 2000) {
    this.maxSize = maxSize;
  }

  get(key: string): EpisodeSkipTimesResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU position
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.result;
  }

  set(key: string, result: EpisodeSkipTimesResult, ttlMs: number): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      result,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const skipTimesCache = new SkipTimesCache(2000);

const ANISKIP_BASE_URL = "https://api.aniskip.com/v2/skip-times";
const DEFAULT_TIMEOUT_MS = 5000;
const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for successful skip times
const NEGATIVE_TTL_MS = 60 * 60 * 1000; // 1 hour for episodes without skip times

const VALID_SKIP_TYPES: SkipType[] = ["op", "ed", "recap", "mixed-op", "mixed-ed"];

/**
 * Fetch raw skip times from AniSkip with timeout handling.
 */
async function queryAniSkipApi(
  malId: number,
  episodeNumber: number,
  episodeLength: number,
): Promise<AniSkipRawResponse | null> {
  const typesParams = VALID_SKIP_TYPES.map((t) => `types=${t}`).join("&");
  const url = `${ANISKIP_BASE_URL}/${malId}/${episodeNumber}?${typesParams}&episodeLength=${episodeLength}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Anily-Streaming/1.0 (https://github.com/anily)",
      },
      signal: controller.signal,
    });

    if (res.status === 404) {
      return { found: false, results: [] };
    }

    if (!res.ok) {
      log.warn({ status: res.status, url }, "AniSkip API returned non-OK status");
      return null;
    }

    return (await res.json()) as AniSkipRawResponse;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      log.warn({ malId, episodeNumber, episodeLength }, "AniSkip request timed out");
    } else {
      log.warn({ err, malId, episodeNumber }, "Failed to query AniSkip API");
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Map raw AniSkip results into an organized, ergonomic structure.
 */
function normalizeSkipTimes(
  results: AniSkipRawResponse["results"],
  duration?: number,
): EpisodeSkipTimesResult {
  if (!results || results.length === 0) {
    return { found: false, results: [] };
  }

  const entries: SkipTimeEntry[] = [];

  for (const item of results) {
    const type = item.skipType as SkipType;
    if (!VALID_SKIP_TYPES.includes(type)) continue;

    if (
      typeof item.interval?.startTime === "number" &&
      typeof item.interval?.endTime === "number" &&
      item.interval.endTime > item.interval.startTime
    ) {
      entries.push({
        type,
        interval: {
          startTime: Math.round(item.interval.startTime * 100) / 100,
          endTime: Math.round(item.interval.endTime * 100) / 100,
        },
        skipId: item.skipId,
        episodeLength: item.episodeLength,
      });
    }
  }

  if (entries.length === 0) {
    return { found: false, results: [] };
  }

  // Find best match for each skip type.
  // If multiple entries exist for the same type, choose the one closest to the video duration.
  const findBestForType = (type: SkipType): SkipInterval | undefined => {
    const matching = entries.filter((e) => e.type === type);
    if (matching.length === 0) return undefined;
    if (matching.length === 1 || !duration || duration <= 0) {
      return matching[0].interval;
    }

    let best = matching[0];
    let minDiff = Math.abs((best.episodeLength ?? 0) - duration);

    for (let i = 1; i < matching.length; i++) {
      const diff = Math.abs((matching[i].episodeLength ?? 0) - duration);
      if (diff < minDiff) {
        minDiff = diff;
        best = matching[i];
      }
    }

    return best.interval;
  };

  return {
    found: true,
    results: entries,
    op: findBestForType("op"),
    ed: findBestForType("ed"),
    recap: findBestForType("recap"),
    mixedOp: findBestForType("mixed-op"),
    mixedEd: findBestForType("mixed-ed"),
  };
}

/**
 * Fetch skip times for a given MAL ID and episode number.
 * Attempts duration-specific lookup first, falling back to all-cuts lookup if needed.
 */
export async function fetchAniSkipTimes(
  malId: number,
  episodeNumber: number,
  duration?: number,
): Promise<EpisodeSkipTimesResult> {
  const durationKey = duration && duration > 0 ? Math.round(duration) : 0;
  const cacheKey = `${malId}:${episodeNumber}:${durationKey}`;

  const cached = skipTimesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let rawData: AniSkipRawResponse | null = null;

  // 1. Try duration-specific query if duration is known
  if (durationKey > 0) {
    rawData = await queryAniSkipApi(malId, episodeNumber, durationKey);
  }

  // 2. Fall back to episodeLength=0 if duration query was skipped, returned 404, or had no results
  if (!rawData || !rawData.found || !rawData.results || rawData.results.length === 0) {
    const fallbackData = await queryAniSkipApi(malId, episodeNumber, 0);
    if (fallbackData?.found && fallbackData.results && fallbackData.results.length > 0) {
      rawData = fallbackData;
    }
  }

  const result = normalizeSkipTimes(rawData?.results, durationKey > 0 ? durationKey : undefined);
  const ttl = result.found ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
  skipTimesCache.set(cacheKey, result, ttl);

  return result;
}

/**
 * Resolve MAL ID from AniList if it wasn't saved in baseAnime.
 */
async function resolveMissingMalId(anilistId: number): Promise<number | null> {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: `query ($id: Int) { Media(id: $id, type: ANIME) { idMal } }`,
        variables: { id: anilistId },
      }),
    });

    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { Media?: { idMal?: number | null } } };
    const malId = body.data?.Media?.idMal;

    if (typeof malId === "number" && malId > 0) {
      await prisma.baseAnime.update({
        where: { anilistId },
        data: { malId },
      });
      return malId;
    }
  } catch (err) {
    log.warn({ err, anilistId }, "Failed to resolve missing MAL ID from AniList");
  }
  return null;
}

/**
 * Resolves skip times for a given database episode ID.
 */
export async function getEpisodeSkipTimes(
  episodeId: number,
  duration?: number,
): Promise<EpisodeSkipTimesResult> {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      animeDetails: {
        include: {
          baseAnime: true,
        },
      },
    },
  });

  if (!episode) {
    return { notFound: true, found: false, results: [] };
  }

  let malId = episode.animeDetails.baseAnime.malId;
  if (!malId) {
    malId = await resolveMissingMalId(episode.animeDetails.baseAnime.anilistId);
  }

  if (!malId) {
    log.debug({ episodeId }, "No MAL ID found for episode, skipping AniSkip lookup");
    return { found: false, results: [] };
  }

  return await fetchAniSkipTimes(malId, episode.number, duration);
}
