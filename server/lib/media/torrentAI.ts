import { logger } from "$src/logger";
import type { TorrentResult } from "./jackett";

export interface TorrentAIResult {
  index: number;
  confidence: "high" | "medium" | "low";
  reason: string;
}

interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const log = logger.child({ module: "torrentAI" });

/**
 * Constructs request headers for OpenRouter API calls with App Attribution support.
 * @see https://openrouter.ai/docs/app-attribution
 */
export function getOpenRouterHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "HTTP-Referer":
      process.env.OPENROUTER_HTTP_REFERER ||
      process.env.APP_URL ||
      process.env.OIDC_AUTH_EXTERNAL_URL ||
      "https://anily.ant.ms",
    "X-OpenRouter-Title": process.env.OPENROUTER_TITLE || "Anily",
  };

  const key = apiKey || process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }

  if (process.env.OPENROUTER_CATEGORIES) {
    headers["X-OpenRouter-Categories"] = process.env.OPENROUTER_CATEGORIES;
  }

  if (process.env.OPENROUTER_APP_VISIBILITY) {
    headers["X-OpenRouter-App-Visibility"] = process.env.OPENROUTER_APP_VISIBILITY;
  }

  return headers;
}

/**
 * Rank torrents using AI (OpenRouter). Returns recommended index and reason.
 * @param animeName  e.g. "Frieren: Beyond Journey's End"
 * @param episodeNumber e.g. 12, or null for movie/special
 * @param results    array of TorrentResult from jackett.ts
 */
export async function rankTorrents(
  animeName: string,
  episodeNumber: number | null,
  results: TorrentResult[],
  options?: {
    excludeLinks?: string[];
    isCompletedAnime?: boolean;
    totalEpisodes?: number;
  },
): Promise<TorrentAIResult> {
  const apiKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    log.warn("OPENROUTER_KEY not set, skipping AI ranking");
    return { index: -1, confidence: "low", reason: "OpenRouter API key not configured" };
  }

  const excludeSet = new Set(options?.excludeLinks ?? []);
  const validResults = results.filter((r) => !excludeSet.has(r.link) && !excludeSet.has(r.title));

  if (validResults.length === 0) {
    return { index: -1, confidence: "low", reason: "No torrent results to rank" };
  }

  const candidates = validResults.map((r, i) => ({
    index: i,
    original_index: results.indexOf(r),
    title: r.title,
    size_mb: Math.round(r.size / 1024 / 1024),
    seeders: r.seeders,
    source: r.source,
  }));

  const isBatchAllowed = options?.isCompletedAnime;
  const prompt = `You are selecting the best torrent for an anime episode.

Anime: ${animeName}
Episode: ${episodeNumber ?? "Movie/Special"}${options?.totalEpisodes ? ` (Total Episodes: ${options.totalEpisodes})` : ""}
${isBatchAllowed ? "NOTE: This anime has completely finished airing. Entire season BATCH torrents (e.g., '01-12', 'Batch', 'Complete', 'Season 1') ARE ALLOWED and WELCOMED if they contain this episode and have good seeders!" : "NOTE: Prefer single episode torrents matching this episode number."}

Candidates (JSON):
${JSON.stringify(candidates, null, 2)}

Selection rules (in priority order):
1. Correct show and episode coverage: must be for '${animeName}'. ${isBatchAllowed ? "Can be either the specific episode OR a full season batch containing this episode." : "Must specifically match episode " + (episodeNumber ?? "Special") + "."}
2. Dual audio (English + Japanese) — strongly preferred, look for "Dual Audio", "[Dual]", "[EN+JA]", "DUAL"
3. Japanese audio + English subtitles — good fallback, look for "[JA+EN sub]", SubsPlease, Erai-raws releases
4. Known quality groups preferred: SubsPlease, Erai-raws, Judas, NyaaSI-trusted, LostYears, Beatrice-Raws
5. Reasonable file size: For single episodes: 200MB-4GB. For whole season batches: 3GB-45GB depending on episode count. Suspiciously tiny files (<60MB) are fake.
6. Seeder count: higher is better, active seeders are crucial.
7. Prefer 1080p over 720p over lower

Return ONLY valid JSON (no markdown):
{"index": <number from 0-based 'index' in array>, "confidence": "high"|"medium"|"low", "reason": "brief explanation"}

If no good match or all results seem wrong (wrong anime, wrong episode, implausible), return {"index": -1, "confidence": "low", "reason": "..."}`;

  const messages: OpenRouterMessage[] = [{ role: "user", content: prompt }];
  const model = process.env.OPENROUTER_MODEL || "z-ai/glm-5.3-flash";

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: getOpenRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.warn({ status: response.status, errorText }, "OpenRouter request failed");
      return { index: -1, confidence: "low", reason: "AI request failed" };
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content ?? "";

    let parsed: TorrentAIResult;
    try {
      parsed = JSON.parse(content) as TorrentAIResult;
    } catch {
      log.warn({ content }, "Failed to parse AI response as JSON");
      return { index: -1, confidence: "low", reason: "Failed to parse AI response" };
    }

    // Validate the result
    if (
      typeof parsed.index !== "number" ||
      !["high", "medium", "low"].includes(parsed.confidence) ||
      typeof parsed.reason !== "string"
    ) {
      log.warn({ parsed }, "AI returned unexpected structure");
      return { index: -1, confidence: "low", reason: "AI returned unexpected structure" };
    }

    if (parsed.index === -1) {
      return parsed;
    }

    // Clamp index to candidate range and map back to original results index
    if (parsed.index < 0 || parsed.index >= candidates.length) {
      log.warn({ index: parsed.index, count: candidates.length }, "AI returned out-of-range index");
      return { index: -1, confidence: "low", reason: "AI returned out-of-range index" };
    }

    return {
      index: candidates[parsed.index].original_index,
      confidence: parsed.confidence,
      reason: parsed.reason,
    };
  } catch (error) {
    log.warn({ error }, "Error calling OpenRouter for torrent ranking");
    return { index: -1, confidence: "low", reason: "AI request error" };
  }
}
