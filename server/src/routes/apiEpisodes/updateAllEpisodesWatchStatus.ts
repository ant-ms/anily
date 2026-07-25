import { prisma } from "../../prisma";

export const updateAllEpisodesWatchStatus = async (
  anilistId: number,
  watched: boolean,
) => {
  return prisma.episode.updateMany({
    where: { 
      animeDetails: { baseAnimeAnilistId: anilistId },
      airingAt: { lte: new Date() }
    },
    data: { watched },
  });
};
