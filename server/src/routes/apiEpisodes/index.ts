import { getEpisodes } from "./getEpisodes";
import { upsertEpisodesForAnime } from "$lib/thetvdb/upsertEpisodesForAnime";
import { anilistParamValidator } from "$src/validators/anilistId";
import { app } from "$src/app";
import { updateEpisodeWatchStatus } from "./updateEpisodeWatchStatus";
import { updateAllEpisodesWatchStatus } from "./updateAllEpisodesWatchStatus";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getAuthenticatedUser } from "$src/auth";
import { prisma } from "$src/prisma";

export const apiEpisodesAnilistIdGetRoute = app.get(
  "/api/episodes/:anilistId",
  anilistParamValidator,
  async (c) => {
    const params = c.req.valid("param");

    try {
      const user = await getAuthenticatedUser(c);
      const episodes = await getEpisodes(params.anilistId);

      const userProgress = await prisma.userEpisodeProgress.findMany({
        where: {
          userId: user.id,
          episodeId: { in: episodes.map((e) => e.id) },
        },
      });
      const progressMap = new Map(userProgress.map((p) => [p.episodeId, p.watched]));

      const filteredEpisodes = episodes.map((episode) => ({
        id: episode.id,
        number: episode.number,
        airingAt: episode.airingAt,
        watched: progressMap.has(episode.id) ? progressMap.get(episode.id)! : episode.watched,
        titleEnglish: episode.titleEnglish,
        titleNative: episode.titleNative,
        titleRomanji: episode.titleRomanji,
        thumbnailUrl: episode.thumbnailUrl,
        mediaStatus: episode.mediaStatus,
        mediaPath: episode.mediaPath,
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
      const user = await getAuthenticatedUser(c);
      await updateEpisodeWatchStatus(
        params.episodeId,
        body.watched,
        user.id,
      );
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
      const user = await getAuthenticatedUser(c);
      await updateAllEpisodesWatchStatus(
        params.anilistId,
        body.watched,
        user.id,
      );
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
