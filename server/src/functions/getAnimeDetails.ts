import { getAnimeDetailsFromApiAndUpsert } from "../anilist/animeDetails/getAnimeDetailsFromApiAndUpsert";
import { prisma } from "../prisma";

const getAnimeDetailsFromDb = async (anilistId: number) =>
  await prisma.animeDetails.findUnique({
    where: {
      baseAnimeAnilistId: anilistId,
    },
    include: {
      baseAnime: true,
    },
  });

export const getAnimeDetails = async (anilistId: number) => {
  const anime = await getAnimeDetailsFromDb(anilistId);
  if (anime) return anime;

  return getAnimeDetailsFromApiAndUpsert(anilistId);
};
