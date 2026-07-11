import { getAnimeDetailsFromApiAndUpsert } from "$lib/anilistApi/getAnimeDetailsFromApiAndUpsert";
import { prisma } from "../../prisma";

const getAnimeDetailsFromDb = async (anilistId: number) =>
  await prisma.animeDetails.findUnique({
    where: {
      baseAnimeAnilistId: anilistId,
    },
    include: {
      baseAnime: {
        include: {
          groupings: true,
        },
      },
    },
  });

export const getAnimeDetails = async (anilistId: number) =>
  (await getAnimeDetailsFromDb(anilistId)) ??
  (await getAnimeDetailsFromApiAndUpsert(anilistId));
