import { prisma } from "../../src/prisma";
import { getAnimeDetailsFromAPI } from "$lib/anilistApi/animeDetails/getAnimeDetails";

export const upsertAnimeDetailsFromApiData = async (
  anilistId: number,
  animeDetails: Awaited<ReturnType<typeof getAnimeDetailsFromAPI>>,
) => {
  if (!animeDetails) {
    throw new Error("Failed to fetch anime details");
  }

  await prisma.baseAnime.upsert({
    where: { anilistId },
    update: {},
    create: {
      anilistId,
      lastUpdated: BigInt(Math.floor(Date.now() / 1000)),
      format: "TV",
      titleEnglish: animeDetails.title?.english ?? null,
    },
  });

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
      baseAnime: {
        include: {
          groupings: true,
        },
      },
    },
  });

  return upserted;
};

export const getAnimeDetailsFromApiAndUpsert = async (anilistId: number) => {
  const animeDetails = await getAnimeDetailsFromAPI(anilistId);
  return upsertAnimeDetailsFromApiData(anilistId, animeDetails);
};
