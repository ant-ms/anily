import { app } from "$src/app";
import { logger } from "$src/logger";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { handleStreamProxy } from "$lib/streaming/proxy";
import type { StreamLanguage } from "$lib/streaming/types";
import { getPublicOrigin } from "./helpers";
import { getAvailableStreamServices } from "./getServices";
import { resolvePlayStream } from "./getPlayStream";
import { handleStreamDownload } from "./downloadStream";

const log = logger.child({ module: "apiStream" });

export { getPublicOrigin };

const episodeIdParamValidator = zValidator(
  "param",
  z.object({ episodeId: z.coerce.number().int() }),
);

// GET /api/stream/services/:episodeId
export const apiStreamServicesGetRoute = app.get(
  "/api/stream/services/:episodeId",
  episodeIdParamValidator,
  async (c) => {
    const { episodeId } = c.req.valid("param");

    try {
      const result = await getAvailableStreamServices(episodeId);
      if (result.notFound) {
        return c.json({ error: "Episode not found" }, 404);
      }
      return c.json({ services: result.services ?? [] });
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
      const origin = getPublicOrigin(c);
      const result = await resolvePlayStream(episodeId, {
        providerId,
        identifier,
        language: language as StreamLanguage,
        server,
        origin,
      });

      if (result.notFound) {
        return c.json({ error: "Episode not found" }, 404);
      }
      if (result.unavailable || !result.streamUrl) {
        return c.json({ error: "No stream available from selected provider" }, 404);
      }

      return c.json({
        streamUrl: result.streamUrl,
        container: result.container,
        serverName: result.serverName,
        subtitles: result.subtitles ?? [],
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

// GET /api/stream/download/:episodeId
export const apiStreamDownloadGetRoute = app.get(
  "/api/stream/download/:episodeId",
  episodeIdParamValidator,
  zValidator(
    "query",
    z.object({
      providerId: z.string().optional(),
      identifier: z.string().optional(),
      language: z.enum(["sub", "dub"]).default("sub"),
      server: z.string().optional(),
      token: z.string().optional(),
      session: z.string().optional(),
    }),
  ),
  async (c) => {
    const { episodeId } = c.req.valid("param");
    const { providerId, identifier, language, server } = c.req.valid("query");

    try {
      return await handleStreamDownload(c, episodeId, {
        providerId,
        identifier,
        language: language as StreamLanguage,
        server,
      });
    } catch (error) {
      log.error({ error, episodeId }, "Failed to process download stream");
      return c.json(
        {
          error: "Failed to process download stream",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

// Proxy video chunks / HLS playlists via server to bypass CORS and anti-hotlinking
export const apiStreamProxyRoute = app.all("/api/stream/proxy", async (c) => {
  return await handleStreamProxy(c);
});

export const apiStreamProxyWildcardRoute = app.all("/api/stream/proxy/*", async (c) => {
  return await handleStreamProxy(c);
});

export const apiStreamProxyGetRoute = apiStreamProxyRoute;
