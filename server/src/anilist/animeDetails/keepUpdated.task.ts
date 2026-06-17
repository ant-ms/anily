import { prisma } from "../../prisma";
import { getAnimeDetailsFromApiAndUpsert } from "./getAnimeDetailsFromApiAndUpsert";

export const updateAnimeDetailsIfNeeded = async (anilistId: number) => {
  const existsInDB = await prisma.animeDetails.findUnique({
    where: { baseAnimeAnilistId: anilistId },
  });

  // We skip updating any details if the anime is not in the database
  if (!existsInDB) return;

  await getAnimeDetailsFromApiAndUpsert(anilistId);
};
