import { upsertEpisodesForAnime } from "$lib/thetvdb/upsertEpisodesForAnime";
import { prisma } from "../../prisma";

const episodesForAnime = (anilistId: number) =>
  prisma.episode.findMany({
    where: {
      animeDetails: {
        baseAnimeAnilistId: anilistId,
      },
    },
    orderBy: { number: "asc" },
  });

export const getEpisodes = async (anilistId: number) => {
  const existing = await episodesForAnime(anilistId);
  if (existing.length > 0) return existing;

  await upsertEpisodesForAnime(anilistId);
  return await episodesForAnime(anilistId);
};
