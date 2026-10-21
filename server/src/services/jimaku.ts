import AdmZip from "adm-zip";
import { logger } from "$src/logger";
import { generateStreamSignature } from "@medialy/stream-core";

const log = logger.child({ module: "jimaku" });

const JIMAKU_BASE_URL = "https://jimaku.cc";

export interface JimakuSubtitleFile {
  name: string;
  url: string;
  size: number;
}

export interface SubtitleTrackDto {
  label: string;
  language: string;
  url: string;
  default?: boolean;
}

// In-memory cache for anilistId -> entryId
const entryCache = new Map<number, number | null>();

export function getJimakuApiKey(): string | null {
  const key = process.env.JIMAKU_API_KEY || process.env.JIMAKU_TOKEN || null;
  return key?.trim() || null;
}

/**
 * Searches for an entry on Jimaku by AniList ID, falling back to title search.
 */
export async function searchJimakuEntry(
  anilistId: number,
  titles: string[] = [],
  apiKey: string,
): Promise<number | null> {
  const headers: Record<string, string> = {
    Authorization: apiKey,
    "User-Agent": "Anily/1.0",
  };

  // 1. Search by AniList ID
  try {
    const url = `${JIMAKU_BASE_URL}/api/entries/search?anilist_id=${anilistId}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = (await res.json()) as Array<{ id: number; anilist_id?: number }>;
      if (Array.isArray(data) && data.length > 0 && data[0].id) {
        return data[0].id;
      }
    } else if (res.status === 401) {
      log.warn("Jimaku API returned 401 Unauthorized. Check JIMAKU_API_KEY in .env");
      return null;
    }
  } catch (err: any) {
    log.warn({ err: err?.message, anilistId }, "Failed Jimaku search by anilist_id");
  }

  // 2. Fallback search by anime titles
  for (const title of titles) {
    if (!title || title.trim().length === 0) continue;
    try {
      const qUrl = `${JIMAKU_BASE_URL}/api/entries/search?query=${encodeURIComponent(title.trim())}`;
      const qRes = await fetch(qUrl, { headers, signal: AbortSignal.timeout(6000) });
      if (qRes.ok) {
        const qData = (await qRes.json()) as Array<{ id: number }>;
        if (Array.isArray(qData) && qData.length > 0 && qData[0].id) {
          return qData[0].id;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Retrieves matching subtitle file entries for a given entry and episode.
 */
export async function fetchJimakuFiles(
  entryId: number,
  episodeNumber: number,
  apiKey: string,
): Promise<JimakuSubtitleFile[]> {
  const headers: Record<string, string> = {
    Authorization: apiKey,
    "User-Agent": "Anily/1.0",
  };

  try {
    const url = `${JIMAKU_BASE_URL}/api/entries/${entryId}/files?episode=${episodeNumber}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      log.warn({ status: res.status, entryId, episodeNumber }, "Failed Jimaku files request");
      return [];
    }

    const data = (await res.json()) as Array<{
      name: string;
      url: string;
      size: number;
    }>;

    if (!Array.isArray(data)) return [];

    return data
      .filter((f) => {
        const lower = f.name.toLowerCase();
        return (
          lower.endsWith(".ass") ||
          lower.endsWith(".ssa") ||
          lower.endsWith(".srt") ||
          lower.endsWith(".vtt") ||
          lower.endsWith(".zip")
        );
      })
      .map((f) => {
        const fullUrl = f.url.startsWith("http")
          ? f.url
          : `${JIMAKU_BASE_URL}${f.url.startsWith("/") ? "" : "/"}${f.url}`;
        return {
          name: f.name,
          url: fullUrl,
          size: f.size,
        };
      });
  } catch (err: any) {
    log.warn({ err: err?.message, entryId, episodeNumber }, "Error fetching Jimaku files");
    return [];
  }
}

/**
 * Downloads and decodes a subtitle file, extracting from zip archives when necessary.
 */
export async function downloadJimakuSubtitleText(
  fileUrl: string,
  episodeNumber?: number,
): Promise<{ text: string; format: "vtt" | "srt" | "ass" } | null> {
  const apiKey = getJimakuApiKey();
  const headers: Record<string, string> = {
    "User-Agent": "Anily/1.0",
  };
  if (apiKey && fileUrl.includes("jimaku.cc")) {
    headers["Authorization"] = apiKey;
  }

  try {
    const res = await fetch(fileUrl, { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      log.warn({ status: res.status, fileUrl }, "Failed downloading subtitle file");
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Detect ZIP magic numbers (PK\x03\x04 or PK\x05\x06)
    if (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();

      const subEntries = zipEntries.filter((entry) => {
        if (entry.isDirectory) return false;
        const lower = entry.entryName.toLowerCase();
        return (
          lower.endsWith(".ass") ||
          lower.endsWith(".ssa") ||
          lower.endsWith(".srt") ||
          lower.endsWith(".vtt")
        );
      });

      if (subEntries.length === 0) return null;

      let chosen = subEntries[0];
      if (episodeNumber !== undefined && subEntries.length > 1) {
        const epStr = String(episodeNumber);
        const epPadded = epStr.padStart(2, "0");
        const match = subEntries.find((e) => {
          const name = e.entryName;
          const re = new RegExp(`(?:ep|episode|e|[^0-9])(?:${epStr}|${epPadded})(?:[^0-9]|$)`, "i");
          return re.test(name);
        });
        if (match) chosen = match;
      }

      const text = chosen.getData().toString("utf-8");
      const lower = chosen.entryName.toLowerCase();
      const format = lower.endsWith(".vtt") ? "vtt" : lower.endsWith(".srt") ? "srt" : "ass";
      return { text, format };
    }

    const text = buffer.toString("utf-8");
    const lowerUrl = fileUrl.toLowerCase();
    const format = lowerUrl.endsWith(".vtt") ? "vtt" : lowerUrl.endsWith(".srt") ? "srt" : "ass";
    return { text, format };
  } catch (err: any) {
    log.error({ err: err?.message, fileUrl }, "Error downloading subtitle text");
    return null;
  }
}

/**
 * High-level helper to discover and return Japanese subtitle tracks for an anime episode from Jimaku.
 */
export async function getJimakuSubtitlesForEpisode(
  anilistId: number,
  episodeNumber: number,
  titles: string[],
  options: {
    origin: string;
    expires: number;
    isNativeDefault?: boolean;
  },
): Promise<SubtitleTrackDto[]> {
  const apiKey = getJimakuApiKey();
  if (!apiKey) {
    return [];
  }

  let entryId = entryCache.get(anilistId);
  if (entryId === undefined) {
    entryId = await searchJimakuEntry(anilistId, titles, apiKey);
    entryCache.set(anilistId, entryId);
  }

  if (!entryId) {
    return [];
  }

  const files = await fetchJimakuFiles(entryId, episodeNumber, apiKey);
  if (files.length === 0) {
    return [];
  }

  // Sort files: prefer direct subtitle files (.vtt, .ass, .srt) over zips
  files.sort((a, b) => {
    const isZipA = a.name.toLowerCase().endsWith(".zip");
    const isZipB = b.name.toLowerCase().endsWith(".zip");
    if (isZipA && !isZipB) return 1;
    if (!isZipA && isZipB) return -1;
    return 0;
  });

  const bestFile = files[0];
  const { origin, expires, isNativeDefault = false } = options;

  const plainSig = generateStreamSignature(bestFile.url, expires);
  const plainUrl = `${origin}/api/stream/subtitles/track?url=${encodeURIComponent(
    bestFile.url,
  )}&ep=${episodeNumber}&expires=${expires}&sig=${plainSig}`;

  const furiSig = generateStreamSignature(bestFile.url, expires);
  const furiUrl = `${origin}/api/stream/subtitles/track?url=${encodeURIComponent(
    bestFile.url,
  )}&ep=${episodeNumber}&furigana=1&expires=${expires}&sig=${furiSig}`;

  return [
    {
      label: "Japanese [Furigana] (Jimaku)",
      language: "ja",
      url: furiUrl,
      default: isNativeDefault,
    },
    {
      label: "Japanese (Jimaku)",
      language: "ja",
      url: plainUrl,
      default: false,
    },
  ];
}
