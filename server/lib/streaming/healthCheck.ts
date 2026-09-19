import type { StreamSource } from "./types";
import { logger } from "$src/logger";

const log = logger.child({ module: "streamHealthCheck" });

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Deep pre-flight probe:
 * Verifies that a stream is not just returning a 200 on master manifest,
 * but that variant playlists and actual media chunks (TS / MP4) are reachable
 * and transferring data within a low latency window.
 */
export async function probeStreamHealth(
  streamSource: StreamSource,
  timeoutMs = 2500,
): Promise<boolean> {
  if (!streamSource?.url) return false;

  const headers: Record<string, string> = {
    "User-Agent": DEFAULT_USER_AGENT,
    ...(streamSource.headers || {}),
  };

  try {
    const res = await fetch(streamSource.url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      log.debug({ status: res.status, url: streamSource.url }, "Master manifest probe failed");
      return false;
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const isM3U8 =
      streamSource.container === "hls" ||
      contentType.includes("mpegurl") ||
      streamSource.url.includes(".m3u8");

    if (isM3U8) {
      const text = await res.text();
      let mediaUrl = streamSource.url;

      // Handle Master Playlist -> Variant Playlist
      if (text.includes("#EXT-X-STREAM-INF")) {
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
            const next = lines[i + 1]?.trim();
            if (next && !next.startsWith("#")) {
              mediaUrl = new URL(next, streamSource.url).toString();
              break;
            }
          }
        }

        const variantRes = await fetch(mediaUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(Math.min(timeoutMs, 2000)),
        });

        if (!variantRes.ok) {
          log.debug({ status: variantRes.status, mediaUrl }, "Variant playlist probe failed");
          return false;
        }

        const variantText = await variantRes.text();
        return await probeSegmentChunk(variantText, mediaUrl, headers, timeoutMs);
      } else {
        // Direct media playlist
        return await probeSegmentChunk(text, streamSource.url, headers, timeoutMs);
      }
    } else {
      // Direct MP4 / non-HLS container: probe first bytes
      const probeRes = await fetch(streamSource.url, {
        method: "GET",
        headers: {
          ...headers,
          Range: "bytes=0-4096",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!probeRes.ok && probeRes.status !== 206) return false;
      const buf = await probeRes.arrayBuffer();
      return buf.byteLength > 0;
    }
  } catch (err: any) {
    log.debug({ err: err.message, url: streamSource.url }, "Probe stream health exception");
    return false;
  }
}

async function probeSegmentChunk(
  playlistText: string,
  baseUrl: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<boolean> {
  const segLine = playlistText.split("\n").find((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith("#");
  });

  if (!segLine) {
    log.debug({ baseUrl }, "No media segment found in playlist");
    return false;
  }

  const segUrl = new URL(segLine.trim(), baseUrl).toString();

  try {
    const segRes = await fetch(segUrl, {
      method: "GET",
      headers: {
        ...headers,
        Range: "bytes=0-4096",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (segRes.status < 200 || segRes.status >= 400) {
      log.debug({ status: segRes.status, segUrl }, "Segment probe returned non-2xx status");
      return false;
    }

    const chunk = await segRes.arrayBuffer();
    return chunk.byteLength > 0;
  } catch (err: any) {
    log.debug({ err: err.message, segUrl }, "Segment probe timed out or stalled");
    return false;
  }
}
