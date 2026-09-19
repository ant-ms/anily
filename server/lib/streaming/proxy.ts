import type { Context } from "hono";
import { logger } from "$src/logger";

const log = logger.child({ module: "streamProxy" });

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export function extractFilename(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const pathname = parsed.pathname;
    const lastSlash = pathname.lastIndexOf("/");
    const rawFilename = lastSlash >= 0 ? pathname.slice(lastSlash + 1) : pathname;
    if (rawFilename && rawFilename.includes(".")) {
      const sanitized = rawFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (sanitized) return sanitized;
    }
  } catch {}
  return "";
}

export function makeProxiedUrl(
  targetUri: string,
  baseUrl: string,
  referer: string,
  defaultExt = "ts",
): string {
  const absUrl = new URL(targetUri, baseUrl).toString();
  let filename = extractFilename(absUrl);
  if (!filename) {
    filename = `media.${defaultExt}`;
  }
  const refParam = referer ? `&ref=${encodeURIComponent(referer)}` : "";
  return `/api/stream/proxy/${filename}?url=${encodeURIComponent(absUrl)}${refParam}`;
}

const vttDurationCache = new Map<string, number>();

export async function getVttDuration(vttUrl: string, referer?: string): Promise<number> {
  if (vttDurationCache.has(vttUrl)) {
    return vttDurationCache.get(vttUrl)!;
  }
  try {
    const headers: Record<string, string> = {
      "User-Agent": DEFAULT_USER_AGENT,
    };
    if (referer) {
      headers["Referer"] = referer;
    }
    const res = await fetch(vttUrl, { headers, signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const text = await res.text();
      const matches = [...text.matchAll(/(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{3})/g)];
      if (matches.length > 0) {
        const last = matches[matches.length - 1];
        const h = last[1] ? parseInt(last[1], 10) : 0;
        const m = parseInt(last[2], 10);
        const s = parseInt(last[3], 10);
        const dur = h * 3600 + m * 60 + s + 2;
        vttDurationCache.set(vttUrl, dur);
        return dur;
      }
    }
  } catch (err) {
    log.warn({ err, vttUrl }, "Failed to fetch/parse VTT duration, using fallback");
  }
  return 1440;
}

export async function handleStreamProxy(c: Context) {
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const subVtt = c.req.query("sub_vtt");
  const referer = c.req.query("ref") || "";

  if (subVtt) {
    const duration = await getVttDuration(subVtt, referer);
    const vttProxiedUrl = `/api/stream/proxy/subtitle.vtt?url=${encodeURIComponent(subVtt)}${referer ? `&ref=${encodeURIComponent(referer)}` : ""}`;
    const vttPlaylist = `#EXTM3U
#EXT-X-TARGETDURATION:${Math.ceil(duration)}
#EXT-X-VERSION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:${duration.toFixed(1)},
${vttProxiedUrl}
#EXT-X-ENDLIST
`;
    return new Response(vttPlaylist, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const targetUrl = c.req.query("url");

  if (!targetUrl) {
    return c.text("Missing url parameter", 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return c.text("Invalid protocol", 400);
    }
  } catch {
    return c.text("Invalid url", 400);
  }

  const upstreamHeaders: Record<string, string> = {
    "User-Agent": DEFAULT_USER_AGENT,
  };

  if (referer) {
    upstreamHeaders["Referer"] = referer;
    try {
      upstreamHeaders["Origin"] = new URL(referer).origin;
    } catch {}
  }

  // Forward Range header for video seeking
  const clientRange = c.req.header("range");
  if (clientRange) {
    upstreamHeaders["Range"] = clientRange;
  }

  try {
    let upstream = await fetch(parsedUrl.toString(), {
      method: c.req.method === "HEAD" ? "HEAD" : "GET",
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(12000),
    });

    // Fall back to GET if upstream CDN rejects HEAD requests
    if (c.req.method === "HEAD" && (upstream.status === 405 || upstream.status === 403)) {
      upstream = await fetch(parsedUrl.toString(), {
        method: "GET",
        headers: upstreamHeaders,
        signal: AbortSignal.timeout(12000),
      });
    }

    if (!upstream.ok && upstream.status !== 206) {
      return new Response(c.req.method === "HEAD" ? null : upstream.body, {
        status: upstream.status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": upstream.headers.get("content-type") || "text/plain",
        },
      });
    }

    const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
    const isM3U8 =
      contentType.includes("mpegurl") ||
      parsedUrl.pathname.endsWith(".m3u8") ||
      parsedUrl.search.includes(".m3u8");

    if (isM3U8) {
      if (c.req.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
          },
        });
      }

      const text = await upstream.text();
      const baseUrl = parsedUrl.toString();
      const isMasterPlaylist = text.includes("#EXT-X-STREAM-INF");
      const subsParam = c.req.query("subs");

      let parsedSubs: Array<{ l: string; lang: string; u: string; d?: boolean }> = [];
      if (subsParam && isMasterPlaylist) {
        try {
          parsedSubs = JSON.parse(subsParam);
        } catch {}
      }

      let subTagsInjected = false;
      const subTags = parsedSubs.map((s, idx) => {
        const subPlaylistUrl = `/api/stream/proxy/sub_${s.lang || idx}.m3u8?sub_vtt=${encodeURIComponent(s.u)}${referer ? `&ref=${encodeURIComponent(referer)}` : ""}`;
        const isDef = s.d ? "YES" : idx === 0 ? "YES" : "NO";
        return `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="${(s.l || "Subtitles").replace(/"/g, "")}",DEFAULT=${isDef},AUTOSELECT=${isDef},FORCED=NO,LANGUAGE="${s.lang || "en"}",URI="${subPlaylistUrl}"`;
      });

      // Rewrite M3U8 playlist lines so all segments/sub-playlists route through our proxy
      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          if (trimmed.startsWith("#")) {
            if (trimmed.startsWith("#EXT-X-STREAM-INF") && parsedSubs.length > 0) {
              const withSubs = trimmed.includes("SUBTITLES=") ? trimmed : `${trimmed},SUBTITLES="subs"`;
              if (!subTagsInjected) {
                subTagsInjected = true;
                return `${subTags.join("\n")}\n${withSubs}`;
              }
              return withSubs;
            }

            // Rewrite URI="..." attributes in tags like #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA, #EXT-X-I-FRAME-STREAM-INF
            if (trimmed.includes('URI="')) {
              return trimmed.replace(/URI="([^"]+)"/g, (_, tagUri) => {
                const isPlaylist =
                  trimmed.startsWith("#EXT-X-MEDIA") ||
                  trimmed.startsWith("#EXT-X-I-FRAME");
                const defaultExt = isPlaylist
                  ? "m3u8"
                  : trimmed.startsWith("#EXT-X-KEY")
                    ? "key"
                    : "mp4";
                return `URI="${makeProxiedUrl(tagUri, baseUrl, referer, defaultExt)}"`;
              });
            }
            return line;
          }

          // Non-comment lines are segment or variant playlist URIs
          const defaultExt = isMasterPlaylist ? "m3u8" : "ts";
          return makeProxiedUrl(trimmed, baseUrl, referer, defaultExt);
        })
        .join("\n");

      return new Response(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // Binary segment or direct media stream (TS, MP4, or VTT)
    const responseHeaders = new Headers();
    for (const [headerKey, headerVal] of upstream.headers) {
      const lower = headerKey.toLowerCase();
      if (
        [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
          "last-modified",
          "etag",
        ].includes(lower)
      ) {
        responseHeaders.set(headerKey, headerVal);
      }
    }

    if (parsedUrl.pathname.endsWith(".vtt") || c.req.path.endsWith(".vtt")) {
      responseHeaders.set("content-type", "text/vtt; charset=utf-8");
    }

    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.set("Cache-Control", "public, max-age=3600");

    return new Response(c.req.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    log.error({ err: err?.message, targetUrl }, "Stream proxy error");
    const isTimeout = err?.name === "TimeoutError" || err?.message?.includes("aborted") || err?.name === "AbortError";
    return new Response(isTimeout ? "Upstream timeout" : "Proxy request failed", {
      status: isTimeout ? 504 : 502,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Content-Type": "text/plain",
      },
    });
  }
}
