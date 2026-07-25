import { prisma } from "../../prisma";

export const updateEpisodeWatchStatus = async (id: number, watched: boolean) => {
  return prisma.episode.update({
    where: { id },
    data: { watched },
  });
};
