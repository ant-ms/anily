import { getEpisodes } from "./getEpisodes";
import { upsertEpisodesForAnime } from "$lib/thetvdb/upsertEpisodesForAnime";
import { anilistParamValidator } from "$src/validators/anilistId";
import { app } from "$src/app";

export const apiEpisodesAnilistIdGetRoute = app.get(
  "/api/episodes/:anilistId",
  anilistParamValidator,
  async (c) => {
    const params = c.req.valid("param");

    try {
      const episodes = await getEpisodes(params.anilistId);
      const filteredEpisodes = episodes.map((episode) => ({
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
