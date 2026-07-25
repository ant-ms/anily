import { prisma } from "../../src/prisma";
import { getAnimeDetailsFromAPI } from "$lib/anilistApi/animeDetails/getAnimeDetails";

export const getAnimeDetailsFromApiAndUpsert = async (anilistId: number) => {
  const animeDetails = await getAnimeDetailsFromAPI(anilistId);

  if (!animeDetails) {
    throw new Error("Failed to fetch anime details");
  }

  const thumbnailUrl =
    animeDetails.coverImage?.extraLarge ||
    animeDetails.coverImage?.large ||
    animeDetails.coverImage?.medium;

  const upserted = await prisma.animeDetails.upsert({
    where: {
      baseAnimeAnilistId: anilistId,
    },
    update: {
      description: animeDetails.description,
      thumbnailUrl,
    },
    create: {
      baseAnimeAnilistId: anilistId,
      description: animeDetails.description,
      thumbnailUrl,
    },
    include: {
      // TODO: Remove duplication
      baseAnime: {
        include: {
          groupings: true,
        },
      },
    },
  });

  let startDate: Date | null = null;
  if (animeDetails.startDate?.year && animeDetails.startDate?.month && animeDetails.startDate?.day) {
    startDate = new Date(
      animeDetails.startDate.year,
      animeDetails.startDate.month - 1,
      animeDetails.startDate.day
    );
  }

  // Also fetch and upsert episodes using the correct episode count cap from Anilist.
  const { upsertEpisodesForAnime } = await import("../thetvdb/upsertEpisodesForAnime");
  await upsertEpisodesForAnime(anilistId, animeDetails.episodes, startDate);

  return upserted;
};
