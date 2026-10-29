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

// In-memory TTL cache for anilistId -> entryId
const ENTRY_CACHE_POSITIVE_TTL_MS = 60 * 60 * 1000; // 1 hour
const ENTRY_CACHE_NEGATIVE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRY_CACHE_SIZE = 1000;
const entryCache = new Map<number, { value: number | null; expiresAt: number }>();

export function clearEntryCache(): void {
  entryCache.clear();
}

function getCachedEntryId(anilistId: number): number | null | undefined {
  const entry = entryCache.get(anilistId);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    entryCache.delete(anilistId);
    return undefined;
  }
  entryCache.delete(anilistId);
  entryCache.set(anilistId, entry);
  return entry.value;
}

function setCachedEntryId(anilistId: number, value: number | null): void {
  if (entryCache.has(anilistId)) {
    entryCache.delete(anilistId);
  } else if (entryCache.size >= MAX_ENTRY_CACHE_SIZE) {
    const oldestKey = entryCache.keys().next().value;
    if (oldestKey !== undefined) entryCache.delete(oldestKey);
  }
  const ttl = value !== null ? ENTRY_CACHE_POSITIVE_TTL_MS : ENTRY_CACHE_NEGATIVE_TTL_MS;
  entryCache.set(anilistId, { value, expiresAt: Date.now() + ttl });
}

export function isJimakuHost(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    return host === "jimaku.cc" || host.endsWith(".jimaku.cc");
  } catch {
    return false;
  }
}

/**
 * Extracts a recognizable release group or platform tag from a subtitle filename.
 */
export function extractReleaseTag(filename: string): string {
  const bracketMatch = filename.match(/^\[([^\]]+)\]/);
  if (bracketMatch) {
    const candidate = bracketMatch[1].trim();
    if (!/^\d{3,4}p$/i.test(candidate) && !/subtitle/i.test(candidate)) {
      return candidate;
    }
  }

  const lower = filename.toLowerCase();
  if (lower.includes("subsplease")) return "SubsPlease";
  if (lower.includes("erai-raws") || lower.includes("erai")) return "Erai-raws";
  if (lower.includes("crunchyroll") || /\bcr\b/i.test(filename)) return "Crunchyroll";
  if (lower.includes("horriblesubs") || lower.includes("horrible")) return "HorribleSubs";
  if (lower.includes("netflix") || /\bnf\b/i.test(filename)) return "Netflix";
  if (lower.includes("amazon") || lower.includes("amzn") || lower.includes("prime")) return "Amazon";
  if (lower.includes("b-global") || lower.includes("bilibili")) return "Bilibili";
  if (lower.includes("hidive")) return "HIDIVE";
  if (lower.includes("tokyo mx") || lower.includes("tokyomx")) return "Tokyo MX";
  if (lower.includes("bs11")) return "BS11";
  if (lower.includes("ohys-raws") || lower.includes("ohys")) return "Ohys-Raws";

  return "Jimaku";
}

/**
 * Scores a subtitle file by release type and format.
 * High scores prioritize Crunchyroll/Web-DL sources which match streaming video providers.
 */
export function scoreJimakuFile(filename: string): number {
  let score = 0;
  const lower = filename.toLowerCase();

  // Prefer direct subtitle files over zip archives
  if (
    lower.endsWith(".ass") ||
    lower.endsWith(".ssa") ||
    lower.endsWith(".srt") ||
    lower.endsWith(".vtt")
  ) {
    score += 20;
  }

  // Release match priorities: Crunchyroll web-dl rips match streaming providers (MegaPlay, HiAnime, etc.)
  if (lower.includes("subsplease")) score += 100;
  else if (lower.includes("erai-raws") || lower.includes("erai")) score += 95;
  else if (lower.includes("crunchyroll") || /\bcr\b/i.test(filename)) score += 90;
  else if (lower.includes("web-dl") || lower.includes("webrip") || lower.includes("web")) score += 50;
  else if (lower.includes("horriblesubs") || lower.includes("horrible")) score += 40;
  else if (lower.includes("netflix") || /\bnf\b/i.test(filename)) score += 30;
  else if (lower.includes("amazon") || lower.includes("amzn") || lower.includes("prime")) score += 30;
  else if (lower.includes("b-global") || lower.includes("bilibili")) score += 25;
  else if (lower.includes("hidive")) score += 25;
  else if (lower.includes("tokyo mx") || lower.includes("bs11") || lower.includes("at-x") || /\btv\b/i.test(filename)) score += 10;
  else if (lower.includes("ohys") || lower.includes("leopard")) score += 10;

  return score;
}

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
  if (apiKey && isJimakuHost(fileUrl)) {
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
          // Strip season indicators (e.g. "Season 3", "S02") to prevent false positive matches
          const cleanName = e.entryName.replace(/\b(?:season|s)\s*\d+\b/gi, "");
          const re = new RegExp(`(?:ep|episode|e|[^0-9])(?:${epStr}|${epPadded})(?:[^0-9]|$)`, "i");
          return re.test(cleanName);
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
    refSubUrl?: string;
  },
): Promise<SubtitleTrackDto[]> {
  const apiKey = getJimakuApiKey();
  if (!apiKey) {
    return [];
  }

  let entryId = getCachedEntryId(anilistId);
  if (entryId === undefined) {
    entryId = await searchJimakuEntry(anilistId, titles, apiKey);
    setCachedEntryId(anilistId, entryId);
  }

  if (!entryId) {
    return [];
  }

  const files = await fetchJimakuFiles(entryId, episodeNumber, apiKey);
  if (files.length === 0) {
    return [];
  }

  // Score and sort files: prioritize Web-DL/Crunchyroll releases over TV/unknown
  files.sort((a, b) => scoreJimakuFile(b.name) - scoreJimakuFile(a.name));

  // Select up to 2 distinct release candidates to provide fallback options without cluttering
  const candidates: Array<{ file: JimakuSubtitleFile; tag: string }> = [];
  const seenTags = new Set<string>();

  for (const f of files) {
    const tag = extractReleaseTag(f.name);
    if (!seenTags.has(tag)) {
      seenTags.add(tag);
      candidates.push({ file: f, tag });
      if (candidates.length >= 2) break;
    }
  }

  if (candidates.length === 0) {
    candidates.push({ file: files[0], tag: extractReleaseTag(files[0].name) });
  }

  const { origin, expires, isNativeDefault = false, refSubUrl } = options;
  const refParam = refSubUrl ? `&refSub=${encodeURIComponent(refSubUrl)}` : "";
  const tracks: SubtitleTrackDto[] = [];

  for (let idx = 0; idx < candidates.length; idx++) {
    const { file, tag } = candidates[idx];
    const isPrimary = idx === 0;
    const labelSuffix = tag === "Jimaku" ? "Jimaku" : `Jimaku - ${tag}`;

    const plainSig = generateStreamSignature(file.url, expires);
    const plainUrl = `${origin}/api/stream/subtitles/track?url=${encodeURIComponent(
      file.url,
    )}&ep=${episodeNumber}${refParam}&expires=${expires}&sig=${plainSig}`;

    const furiSig = generateStreamSignature(file.url, expires);
    const furiUrl = `${origin}/api/stream/subtitles/track?url=${encodeURIComponent(
      file.url,
    )}&ep=${episodeNumber}&furigana=1${refParam}&expires=${expires}&sig=${furiSig}`;

    tracks.push(
      {
        label: `Japanese [Furigana] (${labelSuffix})`,
        language: "ja",
        url: furiUrl,
        default: isPrimary ? isNativeDefault : false,
      },
      {
        label: `Japanese (${labelSuffix})`,
        language: "ja",
        url: plainUrl,
        default: false,
      },
    );
  }

  return tracks;
}

