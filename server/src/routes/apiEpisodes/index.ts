import { getEpisodes } from "./getEpisodes";
import { upsertEpisodesForAnime } from "$lib/thetvdb/upsertEpisodesForAnime";
import { anilistParamValidator } from "$src/validators/anilistId";
import { app } from "$src/app";
import { updateEpisodeWatchStatus } from "./updateEpisodeWatchStatus";
import { updateAllEpisodesWatchStatus } from "./updateAllEpisodesWatchStatus";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

export const apiEpisodesAnilistIdGetRoute = app.get(
  "/api/episodes/:anilistId",
  anilistParamValidator,
  async (c) => {
    const params = c.req.valid("param");

    try {
      const episodes = await getEpisodes(params.anilistId);
      const filteredEpisodes = episodes.map((episode) => ({
        id: episode.id,
        number: episode.number,
        airingAt: episode.airingAt,
        watched: episode.watched,
        titleEnglish: episode.titleEnglish,
        titleNative: episode.titleNative,
        titleRomanji: episode.titleRomanji,
        thumbnailUrl: episode.thumbnailUrl,
      }));
      return c.json(filteredEpisodes);
    } catch (error) {
      return c.json({
        error: "Failed to get episodes",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

export const apiEpisodesAnilistIdRefreshPostRoute = app.post(
  "/api/episodes/:anilistId/refresh",
  anilistParamValidator,
  async (c) => {
    const params = c.req.valid("param");

    try {
      await upsertEpisodesForAnime(params.anilistId);
      return c.body(null, 200);
    } catch (error) {
      return c.json(
        {
          error: "Failed to refresh episodes",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

export const apiEpisodesWatchPutRoute = app.put(
  "/api/episodes/:episodeId/watch",
  zValidator(
    "param",
    z.object({
      episodeId: z.coerce.number().int(),
    }),
  ),
  zValidator(
    "json",
    z.object({
      watched: z.boolean(),
    }),
  ),
  async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");

    try {
      await updateEpisodeWatchStatus(params.episodeId, body.watched);
      return c.body(null, 200);
    } catch (error) {
      return c.json(
        {
          error: "Failed to update episode watch status",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

export const apiEpisodesWatchAllPutRoute = app.put(
  "/api/episodes/:anilistId/watch-all",
  anilistParamValidator,
  zValidator(
    "json",
    z.object({
      watched: z.boolean(),
    }),
  ),
  async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");

    try {
      await updateAllEpisodesWatchStatus(params.anilistId, body.watched);
      return c.body(null, 200);
    } catch (error) {
      return c.json(
        {
          error: "Failed to update all episodes watch status",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);
