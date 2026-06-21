import { logger } from "$src/logger";
import { prisma } from "$src/prisma";
import { collectGroupingMemberIds } from "./collectGroupingMemberIds";

export const getNumberOfAnimeGroupings = async (anilistId: number) => {
  const groupingMemberIds = await collectGroupingMemberIds(anilistId);
  return await prisma.animeGrouping.findMany({
    where: {
      items: {
        some: {
          anilistId: {
            in: Array.from(groupingMemberIds),
          },
        },
      },
    },
  });
};

export const updateAnimeGroupingIfNeeded = async (anilistId: number) => {
  const numberOfAnimeGroupings = await getNumberOfAnimeGroupings(anilistId);

  // If no anime grouping is found, nothing to update
  if (numberOfAnimeGroupings.length === 0) return;

  // If multiple anime groupings are found, log a warning and return early
  if (numberOfAnimeGroupings.length > 1) {
    logger.warn(
      "Multiple anime groupings found for one of the grouping members with anilistId: " +
        anilistId,
    );
    return;
  }

  // If a single anime grouping is found, update it to include all the grouping members
  const groupingMemberIds = await collectGroupingMemberIds(anilistId);
  const animeGrouping = numberOfAnimeGroupings[0];
  await prisma.animeGrouping.update({
    where: { id: animeGrouping.id },
    data: {
      items: {
        set: Array.from(groupingMemberIds).map((anilistId) => ({ anilistId })),
      },
    },
  });
};
