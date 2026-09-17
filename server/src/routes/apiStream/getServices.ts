import { prisma } from "$src/prisma";
import { registry } from "$lib/streaming/registry";
import type { AvailableService } from "$lib/streaming/types";

export async function getAvailableStreamServices(
  episodeId: number,
): Promise<{ services?: AvailableService[]; notFound?: boolean }> {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      animeDetails: {
        include: { baseAnime: true },
      },
    },
  });

  if (!episode) {
    return { notFound: true };
  }

  const baseAnime = episode.animeDetails.baseAnime;
  const titles = [
    baseAnime.titleEnglish,
    baseAnime.titleRomanji,
    baseAnime.titleNative,
  ].filter((t): t is string => Boolean(t));

  const services = await registry.checkAvailability(titles, episode.number);
  return { services };
}
