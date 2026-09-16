import { app } from "$src/app";
import { prisma } from "$src/prisma";
import { logger } from "$src/logger";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { registry } from "$lib/streaming/registry";
import { handleStreamProxy, extractFilename } from "$lib/streaming/proxy";
import type { StreamLanguage } from "$lib/streaming/types";
import type { Context } from "hono";

const log = logger.child({ module: "apiStream" });

export function getPublicOrigin(c: Context): string {
  const forwardedProto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = (c.req.header("x-forwarded-host") || c.req.header("host"))?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = forwardedProto || "http";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(c.req.url).origin;
}

const episodeIdParamValidator = zValidator(
  "param",
  z.object({ episodeId: z.coerce.number().int() }),
);

// GET /api/stream/services/:episodeId
// Check which streaming services have this episode available
export const apiStreamServicesGetRoute = app.get(
  "/api/stream/services/:episodeId",
  episodeIdParamValidator,
  async (c) => {
    const { episodeId } = c.req.valid("param");

    try {
      const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: {
          animeDetails: {
            include: { baseAnime: true },
          },
        },
      });

      if (!episode) {
        return c.json({ error: "Episode not found" }, 404);
      }

      const baseAnime = episode.animeDetails.baseAnime;
      const titles = [
        baseAnime.titleEnglish,
        baseAnime.titleRomanji,
        baseAnime.titleNative,
      ].filter((t): t is string => Boolean(t));

      const services = await registry.checkAvailability(titles, episode.number);
      return c.json({ services });
    } catch (error) {
      log.error({ error, episodeId }, "Failed to check available services");
      return c.json(
        {
          error: "Failed to check available streaming services",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

// GET /api/stream/play/:episodeId
// Resolve stream URL for chosen provider, returning a proxied server stream URL
export const apiStreamPlayGetRoute = app.get(
  "/api/stream/play/:episodeId",
  episodeIdParamValidator,
  zValidator(
    "query",
    z.object({
      providerId: z.string(),
      identifier: z.string(),
      language: z.enum(["sub", "dub"]),
      server: z.string().optional(),
    }),
  ),
  async (c) => {
    const { episodeId } = c.req.valid("param");
    const { providerId, identifier, language, server } = c.req.valid("query");

    try {
      const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
      });

      if (!episode) {
        return c.json({ error: "Episode not found" }, 404);
      }

      const streamSource = await registry.resolveStream(
        providerId,
        identifier,
        episode.number,
        language as StreamLanguage,
        server,
      );

      if (!streamSource) {
        return c.json({ error: "No stream available from selected provider" }, 404);
      }

      const origin = getPublicOrigin(c);
      const ext = streamSource.container === "hls" ? "master.m3u8" : "video.mp4";
      const filename = extractFilename(streamSource.url) || ext;
      const refParam = streamSource.headers?.Referer
        ? `&ref=${encodeURIComponent(streamSource.headers.Referer)}`
        : "";
      const streamUrl = `${origin}/api/stream/proxy/${filename}?url=${encodeURIComponent(
        streamSource.url,
      )}${refParam}`;

      return c.json({
        streamUrl,
        container: streamSource.container,
        serverName: streamSource.serverName,
      });
    } catch (error) {
      log.error({ error, episodeId, providerId }, "Failed to resolve stream");
      return c.json(
        {
          error: "Failed to resolve stream",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

// Proxy video chunks / HLS playlists via server to bypass CORS and anti-hotlinking
// Support GET, HEAD, and OPTIONS across both base and filename paths
export const apiStreamProxyRoute = app.all("/api/stream/proxy", async (c) => {
  return await handleStreamProxy(c);
});

export const apiStreamProxyWildcardRoute = app.all("/api/stream/proxy/*", async (c) => {
  return await handleStreamProxy(c);
});

export const apiStreamProxyGetRoute = apiStreamProxyRoute;
