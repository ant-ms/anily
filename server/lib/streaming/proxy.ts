import type { Context } from "hono";
import { logger } from "$src/logger";

const log = logger.child({ module: "streamProxy" });

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function handleStreamProxy(c: Context) {
  const targetUrl = c.req.query("url");
  const referer = c.req.query("ref") || "";

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
    const upstream = await fetch(parsedUrl.toString(), {
      headers: upstreamHeaders,
    });

    const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
    const isM3U8 =
      contentType.includes("mpegurl") ||
      parsedUrl.pathname.endsWith(".m3u8") ||
      parsedUrl.search.includes(".m3u8");

    if (isM3U8) {
      const text = await upstream.text();
      const baseUrl = parsedUrl.toString();

      // Rewrite M3U8 playlist lines so all segments/sub-playlists route through our proxy
      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          // Rewrite EXT-X-KEY URI if present
          if (trimmed.startsWith("#EXT-X-KEY:")) {
            return trimmed.replace(/URI="([^"]+)"/, (_, keyUri) => {
              const absKey = new URL(keyUri, baseUrl).toString();
              const proxied = `/api/stream/proxy?url=${encodeURIComponent(absKey)}&ref=${encodeURIComponent(referer)}`;
              return `URI="${proxied}"`;
            });
          }

          // Rewrite EXT-X-MAP URI if present
          if (trimmed.startsWith("#EXT-X-MAP:")) {
            return trimmed.replace(/URI="([^"]+)"/, (_, mapUri) => {
              const absMap = new URL(mapUri, baseUrl).toString();
              const proxied = `/api/stream/proxy?url=${encodeURIComponent(absMap)}&ref=${encodeURIComponent(referer)}`;
              return `URI="${proxied}"`;
            });
          }

          // Non-comment lines are segment or playlist URIs
          if (!trimmed.startsWith("#")) {
            const absUri = new URL(trimmed, baseUrl).toString();
            return `/api/stream/proxy?url=${encodeURIComponent(absUri)}&ref=${encodeURIComponent(referer)}`;
          }

          return line;
        })
        .join("\n");

      return new Response(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Binary segment or direct media stream (TS or MP4)
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

    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.set("Cache-Control", "public, max-age=3600");

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    log.error({ err, targetUrl }, "Stream proxy error");
    return c.text("Proxy request failed", 502);
  }
}
