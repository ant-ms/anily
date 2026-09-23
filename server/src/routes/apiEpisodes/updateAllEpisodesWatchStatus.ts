import { prisma } from "../../prisma";

export const updateAllEpisodesWatchStatus = async (
  anilistId: number,
  watched: boolean,
  userId: string,
) => {
  const episodes = await prisma.episode.findMany({
    where: {
      animeDetails: { baseAnimeAnilistId: anilistId },
      airingAt: { lte: new Date() },
    },
    select: { id: true },
  });

  await Promise.all(
    episodes.map((ep) =>
      prisma.userEpisodeProgress.upsert({
        where: {
          userId_episodeId: {
            userId,
            episodeId: ep.id,
          },
        },
        create: {
          userId,
          episodeId: ep.id,
          watched,
        },
        update: {
          watched,
          watchedAt: new Date(),
        },
      }),
    ),
  );
};
