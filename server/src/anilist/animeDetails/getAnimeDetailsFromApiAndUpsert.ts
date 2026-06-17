import { prisma } from "../../prisma";
import { getAnimeDetailsFromAPI } from "./gather/getAnimeDetails";

export const getAnimeDetailsFromApiAndUpsert = async (anilistId: number) => {
  const animeDetails = await getAnimeDetailsFromAPI(anilistId);

  if (!animeDetails) {
    throw new Error("Failed to fetch anime details");
  }

  return await prisma.animeDetails.upsert({
    where: {
      baseAnimeAnilistId: anilistId,
    },
    update: {
      description: animeDetails.description,
      thumbnailUrl:
        animeDetails.coverImage?.extraLarge ||
        animeDetails.coverImage?.large ||
        animeDetails.coverImage?.medium,
    },
    create: {
      baseAnimeAnilistId: anilistId,
      description: animeDetails.description,
      thumbnailUrl:
        animeDetails.coverImage?.extraLarge ||
        animeDetails.coverImage?.large ||
        animeDetails.coverImage?.medium,
      markedForLater: false,
    },
    include: {
      baseAnime: true,
    },
  });
};
