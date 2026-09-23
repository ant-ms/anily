import { prisma } from "../../prisma";

export const updateEpisodeWatchStatus = async (
  id: number,
  watched: boolean,
  userId: string,
) => {
  return await prisma.userEpisodeProgress.upsert({
    where: {
      userId_episodeId: {
        userId,
        episodeId: id,
      },
    },
    create: {
      userId,
      episodeId: id,
      watched,
    },
    update: {
      watched,
      watchedAt: new Date(),
    },
  });
};

