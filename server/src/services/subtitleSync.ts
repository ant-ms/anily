import { logger } from "$src/logger";
import { verifyStreamSignature, isSafeStreamUrl } from "@medialy/stream-core";
import { convertAssToVtt, convertSrtToVtt } from "./furigana";

const log = logger.child({ module: "subtitleSync" });

export interface CueTiming {
  start: number; // in seconds
  end: number;   // in seconds
}

export interface SyncOffsetResult {
  offset: number;     // in seconds (+: target is delayed relative to ref; -: target is early)
  confidence: number; // 0 to 1 (overlap fraction / peak prominence)
}

// In-memory cache for reference subtitle text (prevents redundant fetches across multiple candidate tracks)
const refSubTextCache = new Map<string, { text: string; expiresAt: number }>();
const REF_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REF_CACHE_SIZE = 100;

function getCachedRefText(key: string): string | undefined {
  const entry = refSubTextCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    refSubTextCache.delete(key);
    return undefined;
  }
  return entry.text;
}

function setCachedRefText(key: string, text: string): void {
  if (refSubTextCache.size >= MAX_REF_CACHE_SIZE) {
    const oldest = refSubTextCache.keys().next().value;
    if (oldest !== undefined) refSubTextCache.delete(oldest);
  }
  refSubTextCache.set(key, { text, expiresAt: Date.now() + REF_CACHE_TTL_MS });
}

export function clearRefTextCache(): void {
  refSubTextCache.clear();
}

/**
 * Parses a WebVTT timestamp string (HH:MM:SS.mmm or MM:SS.mmm) into seconds.
 */
export function parseVttTimestampToSeconds(timeStr: string): number | null {
  const match = timeStr.trim().match(/^(?:(?:(\d{1,2}):)?(\d{2}):)?(\d{2})[.,](\d{3})$/);
  if (!match) return null;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = parseInt(match[3], 10);
  const millis = parseInt(match[4], 10);

  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

/**
 * Formats seconds into a standard WebVTT timestamp (HH:MM:SS.mmm).
 */
export function formatVttTimestamp(seconds: number): string {
  const totalMs = Math.round(Math.max(0, seconds) * 1000);
  const ms = totalMs % 1000;
  const totalS = Math.floor(totalMs / 1000);
  const s = totalS % 60;
  const totalM = Math.floor(totalS / 60);
  const m = totalM % 60;
  const h = Math.floor(totalM / 60);

  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  const mmm = String(ms).padStart(3, "0");

  return `${hh}:${mm}:${ss}.${mmm}`;
}

/**
 * Extracts start and end timestamps (in seconds) for each dialogue cue in a WebVTT string.
 */
export function parseVttCueTimings(vttContent: string): CueTiming[] {
  const cues: CueTiming[] = [];
  const lines = vttContent.split(/\r?\n/);
  const arrowRegex = /^\s*((?:(?:\d{1,2}:)?\d{2}:)?\d{2}[.,]\d{3})\s*-->\s*((?:(?:\d{1,2}:)?\d{2}:)?\d{2}[.,]\d{3})/;

  for (const line of lines) {
    const match = line.match(arrowRegex);
    if (match) {
      const start = parseVttTimestampToSeconds(match[1]);
      const end = parseVttTimestampToSeconds(match[2]);

      if (start !== null && end !== null && end > start && end - start < 120) {
        cues.push({ start, end });
      }
    }
  }

  return cues;
}

/**
 * Converts arbitrary subtitle text (WebVTT, ASS, SRT) to standard WebVTT format.
 * Strips UTF-8 BOM if present.
 */
export function convertToVtt(content: string): string {
  const clean = content.replace(/^\uFEFF/, "").trimStart();
  if (clean.startsWith("WEBVTT")) {
    return clean;
  }
  if (clean.includes("[Events]") || clean.includes("[Script Info]")) {
    return convertAssToVtt(clean);
  }
  return convertSrtToVtt(clean);
}

/**
 * Calculates the optimal temporal offset to synchronize target cues with reference cues.
 * Uses binary voice activity cross-correlation.
 * Returns the offset in seconds to ADD to target cue timestamps.
 */
export function calculateSubtitleOffset(
  refCues: CueTiming[],
  targetCues: CueTiming[],
  options: {
    maxOffsetSec?: number;
    minConfidence?: number;
  } = {},
): SyncOffsetResult {
  const { maxOffsetSec = 45, minConfidence = 0.2 } = options;

  if (refCues.length === 0 || targetCues.length === 0) {
    return { offset: 0, confidence: 0 };
  }

  const maxRefTime = refCues.reduce((m, c) => Math.max(m, c.end), 0);
  const maxTargetTime = targetCues.reduce((m, c) => Math.max(m, c.end), 0);
  const totalDuration = Math.max(maxRefTime, maxTargetTime) + maxOffsetSec * 2 + 10;

  const binResolution = 0.1; // 100ms per bin
  const numBins = Math.ceil(totalDuration / binResolution);

  const refBins = new Uint8Array(numBins);
  const targetBins = new Uint8Array(numBins);

  for (const cue of refCues) {
    const startIdx = Math.max(0, Math.floor(cue.start / binResolution));
    const endIdx = Math.min(numBins - 1, Math.ceil(cue.end / binResolution));
    for (let i = startIdx; i <= endIdx; i++) {
      refBins[i] = 1;
    }
  }

  let targetActiveCount = 0;
  for (const cue of targetCues) {
    const startIdx = Math.max(0, Math.floor(cue.start / binResolution));
    const endIdx = Math.min(numBins - 1, Math.ceil(cue.end / binResolution));
    for (let i = startIdx; i <= endIdx; i++) {
      if (targetBins[i] === 0) {
        targetBins[i] = 1;
        targetActiveCount++;
      }
    }
  }

  if (targetActiveCount === 0) {
    return { offset: 0, confidence: 0 };
  }

  const maxShiftBins = Math.floor(maxOffsetSec / binResolution);
  const coarseStep = 5; // 0.5s step for initial scan

  let bestCoarseBin = 0;
  let maxCoarseOverlap = -1;

  // 1. Coarse search (-maxOffset to +maxOffset)
  for (let k = -maxShiftBins; k <= maxShiftBins; k += coarseStep) {
    let overlap = 0;
    const startI = Math.max(0, -k);
    const endI = Math.min(numBins - 1, numBins - 1 - k);

    for (let i = startI; i <= endI; i += 2) {
      if (targetBins[i] === 1 && refBins[i + k] === 1) {
        overlap++;
      }
    }

    if (overlap > maxCoarseOverlap) {
      maxCoarseOverlap = overlap;
      bestCoarseBin = k;
    }
  }

  // 2. Fine search around best coarse candidate (+-1.5s in single 100ms bin steps)
  const fineSearchRange = Math.min(maxShiftBins, Math.floor(1.5 / binResolution));
  const fineMin = Math.max(-maxShiftBins, bestCoarseBin - fineSearchRange);
  const fineMax = Math.min(maxShiftBins, bestCoarseBin + fineSearchRange);

  let bestBin = bestCoarseBin;
  let maxFineOverlap = -1;

  for (let k = fineMin; k <= fineMax; k++) {
    let overlap = 0;
    const startI = Math.max(0, -k);
    const endI = Math.min(numBins - 1, numBins - 1 - k);

    for (let i = startI; i <= endI; i++) {
      if (targetBins[i] === 1 && refBins[i + k] === 1) {
        overlap++;
      }
    }

    if (overlap > maxFineOverlap) {
      maxFineOverlap = overlap;
      bestBin = k;
    }
  }

  const confidence = maxFineOverlap / targetActiveCount;
  const bestOffsetSec = +(bestBin * binResolution).toFixed(3);

  // If confidence is below threshold or offset is negligible (< 100ms), do not shift
  if (confidence < minConfidence || Math.abs(bestOffsetSec) < 0.1) {
    return { offset: 0, confidence };
  }

  return { offset: bestOffsetSec, confidence };
}

/**
 * Shifts all timestamp intervals in a WebVTT content string by offsetSec seconds.
 * Properly buffers and preserves cue identifiers without leaving orphaned IDs when cues are dropped.
 */
export function shiftVttTimestamps(vttContent: string, offsetSec: number): string {
  if (Math.abs(offsetSec) < 0.05) {
    return vttContent;
  }

  const lines = vttContent.split(/\r?\n/);
  const result: string[] = [];
  const arrowRegex = /^\s*((?:(?:\d{1,2}:)?\d{2}:)?\d{2}[.,]\d{3})\s*-->\s*((?:(?:\d{1,2}:)?\d{2}:)?\d{2}[.,]\d{3})(.*)/;

  let pendingCueId: string | null = null;
  let skipCurrentCue = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(arrowRegex);

    if (match) {
      const origStart = parseVttTimestampToSeconds(match[1]);
      const origEnd = parseVttTimestampToSeconds(match[2]);
      const trailingSettings = match[3] || "";

      if (origStart !== null && origEnd !== null) {
        const newStart = Math.max(0, origStart + offsetSec);
        const newEnd = Math.max(0, origEnd + offsetSec);

        // If the cue ended before 0:00 after shift, drop both ID and cue
        if (newEnd <= 0) {
          skipCurrentCue = true;
          pendingCueId = null;
          continue;
        }

        // Cue survived: flush pending identifier if present
        if (pendingCueId !== null) {
          result.push(pendingCueId);
          pendingCueId = null;
        }

        skipCurrentCue = false;
        result.push(`${formatVttTimestamp(newStart)} --> ${formatVttTimestamp(newEnd)}${trailingSettings}`);
        continue;
      }
    }

    if (skipCurrentCue) {
      if (!line.trim()) {
        skipCurrentCue = false;
      }
      continue;
    }

    // Check if line is an isolated cue identifier before timestamp
    if (
      i + 1 < lines.length &&
      lines[i + 1].match(arrowRegex) &&
      line.trim() &&
      !line.startsWith("NOTE") &&
      !line.startsWith("WEBVTT")
    ) {
      pendingCueId = line;
      continue;
    }

    result.push(line);
  }

  return result.join("\n");
}

/**
 * Normalizes a refSub URL into a canonical upstream URL for caching purposes.
 * Strips transient token parameters (sig, expires) so the cache key remains stable.
 */
export function normalizeRefSubForCache(refSubUrl?: string): string {
  if (!refSubUrl) return "";
  try {
    const parsed = new URL(refSubUrl);
    return parsed.searchParams.get("url") || parsed.origin + parsed.pathname;
  } catch {
    return refSubUrl;
  }
}

/**
 * Safely fetches reference subtitle content from a signed proxy URL.
 * Enforces mandatory signature and expiry verification to eliminate arbitrary SSRF exploitation.
 */
export async function fetchReferenceSubtitleText(refSubUrl: string): Promise<string | null> {
  try {
    const parsed = new URL(refSubUrl);
    const upstreamUrl = parsed.searchParams.get("url") || refSubUrl;
    const ref = parsed.searchParams.get("ref");
    const sig = parsed.searchParams.get("sig");
    const expires = parsed.searchParams.get("expires");

    // Enforce mandatory HMAC signature and expiration checks to prevent open-proxy / SSRF attacks
    if (!sig || !expires) {
      log.warn({ refSubUrl }, "RefSub missing mandatory HMAC signature or expiration");
      return null;
    }

    const expNum = Number(expires);
    if (isNaN(expNum) || !verifyStreamSignature(upstreamUrl, expNum, sig)) {
      log.warn({ upstreamUrl }, "RefSub failed HMAC signature verification");
      return null;
    }

    if (!isSafeStreamUrl(upstreamUrl)) {
      log.warn({ upstreamUrl }, "RefSub destination address failed safety check");
      return null;
    }

    // Return cached text if available
    const cached = getCachedRefText(upstreamUrl);
    if (cached) return cached;

    const headers: Record<string, string> = {
      "User-Agent": "Anily/1.0",
    };
    if (ref) {
      headers["Referer"] = ref;
    }

    const res = await fetch(upstreamUrl, {
      headers,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      log.warn({ status: res.status, upstreamUrl }, "Failed fetching refSub");
      return null;
    }

    const text = await res.text();
    setCachedRefText(upstreamUrl, text);
    return text;
  } catch (err: any) {
    log.warn({ err: err?.message, refSubUrl }, "Error downloading reference subtitle");
    return null;
  }
}

/**
 * High-level orchestration: converts target subtitle to WebVTT, and synchronizes
 * timestamps against reference subtitle text if available and well-correlated.
 */
export function synchronizeSubtitle(
  targetDownloaded: { text: string; format: "vtt" | "srt" | "ass" },
  refText: string | null,
  targetUrl?: string,
): string {
  let vtt: string;
  if (targetDownloaded.format === "ass") {
    vtt = convertAssToVtt(targetDownloaded.text);
  } else if (targetDownloaded.format === "srt") {
    vtt = convertSrtToVtt(targetDownloaded.text);
  } else {
    vtt = convertToVtt(targetDownloaded.text);
  }

  if (!refText) {
    return vtt;
  }

  try {
    const refVtt = convertToVtt(refText);
    const refCues = parseVttCueTimings(refVtt);
    const targetCues = parseVttCueTimings(vtt);

    const { offset, confidence } = calculateSubtitleOffset(refCues, targetCues);
    if (confidence >= 0.2 && Math.abs(offset) >= 0.1) {
      log.info({ offset, confidence, targetUrl }, "Applied auto-sync offset to Japanese subtitles");
      vtt = shiftVttTimestamps(vtt, offset);
    }
  } catch (err: any) {
    log.warn({ err: err?.message }, "Failed to auto-sync subtitle against reference track");
  }

  return vtt;
}
