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
 * Rank torrents using AI (OpenRouter). Returns recommended index and reason.
 * @param animeName  e.g. "Frieren: Beyond Journey's End"
 * @param episodeNumber e.g. 12, or null for movie/special
 * @param results    array of TorrentResult from jackett.ts
 */
export async function rankTorrents(
  animeName: string,
  episodeNumber: number | null,
  results: TorrentResult[],
): Promise<TorrentAIResult> {
  const apiKey = process.env.OPENROUTER_KEY;

  if (!apiKey) {
    log.warn("OPENROUTER_KEY not set, skipping AI ranking");
    return { index: -1, confidence: "low", reason: "OpenRouter API key not configured" };
  }

  if (results.length === 0) {
    return { index: -1, confidence: "low", reason: "No torrent results to rank" };
  }

  const candidates = results.map((r, i) => ({
    index: i,
    title: r.title,
    size_mb: Math.round(r.size / 1024 / 1024),
    seeders: r.seeders,
    source: r.source,
  }));

  const prompt = `You are selecting the best torrent for an anime episode.

Anime: ${animeName}
Episode: ${episodeNumber ?? "Movie/Special"}

Candidates (JSON):
${JSON.stringify(candidates, null, 2)}

Selection rules (in priority order):
1. Dual audio (English + Japanese) — strongly preferred, look for "Dual Audio", "[Dual]", "[EN+JA]", "DUAL"
2. Japanese audio + English subtitles — good fallback, look for "[JA+EN sub]", SubsPlease, Erai-raws releases
3. Known quality groups preferred: SubsPlease, Erai-raws, Judas, NyaaSI-trusted
4. Reasonable file size: 200MB-4GB for 1080p, 100MB-2GB for 720p. Flag suspiciously small files (<80MB) or huge (>8GB)
5. Seeder count: higher is better, but don't sacrifice quality for seeders
6. Prefer 1080p over 720p over lower

Return ONLY valid JSON (no markdown):
{"index": <number 0-based matching array>, "confidence": "high"|"medium"|"low", "reason": "brief explanation"}

If no good match or all results seem wrong (wrong anime, wrong episode, implausible), return {"index": -1, "confidence": "low", "reason": "..."}`;

  const messages: OpenRouterMessage[] = [{ role: "user", content: prompt }];
  const model = process.env.OPENROUTER_MODEL || "z-ai/glm-5.3-flash";

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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

    // Clamp index to valid range
    if (parsed.index !== -1 && (parsed.index < 0 || parsed.index >= results.length)) {
      log.warn({ index: parsed.index, count: results.length }, "AI returned out-of-range index");
      return { index: -1, confidence: "low", reason: "AI returned out-of-range index" };
    }

    return parsed;
  } catch (error) {
    log.warn({ error }, "Error calling OpenRouter for torrent ranking");
    return { index: -1, confidence: "low", reason: "AI request error" };
  }
}
