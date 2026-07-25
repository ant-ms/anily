import { prisma } from "../prisma";
import { getRecentlyUpdatedAnime } from "$lib/anilistApi/baseAnime/getRecentlyUpdatedAnime";
import { getAnimeDetailsFromApiAndUpsert } from "$lib/anilistApi/getAnimeDetailsFromApiAndUpsert";
import upsertAnimeTitlesAndRelations from "$lib/anilistApi/upsertAnimeTitlesAndRelations";
import { logger } from "$src/logger";
import { Logger } from "pino";
import { updateAnimeGroupingIfNeeded } from "$src/routes/apiGrouping/updateAnimeGroupingIfNeeded";
import { upsertEpisodesForAnime } from "$lib/thetvdb/upsertEpisodesForAnime";

type RecentlyUpdatedAnime = Awaited<
  ReturnType<typeof getRecentlyUpdatedAnime>
>["media"];

const gatherAnimeUntil = async (
  lastUpdatedInDb: bigint,
  page = 1,
): Promise<RecentlyUpdatedAnime> => {
  const { media, pageInfo } = await getRecentlyUpdatedAnime(page);

  const animeToKeep = [];

  for (const anime of media) {
    if (anime.updatedAt != null && BigInt(anime.updatedAt) < lastUpdatedInDb) {
      return animeToKeep;
    }
    animeToKeep.push(anime);
  }

  if (pageInfo.hasNextPage) {
    return [
      ...animeToKeep,
      ...(await gatherAnimeUntil(lastUpdatedInDb, page + 1)),
    ];
  }

  return animeToKeep;
};

const getAllAnimeWithUpdates = async (log: Logger) => {
  const aggregate = await prisma.baseAnime.aggregate({
    _max: { lastUpdated: true },
  });

  const lastUpdatedInDb = aggregate._max.lastUpdated ?? BigInt(0);
  log.info(`most recent lastUpdated in DB: ${lastUpdatedInDb}`);

  return gatherAnimeUntil(lastUpdatedInDb, 1);
};

export const updateAnimeDetailsIfNeeded = async (anilistId: number) => {
  const existsInDB = await prisma.animeDetails.findUnique({
    where: { baseAnimeAnilistId: anilistId },
  });

  // We skip updating any details if the anime is not in the database
  if (!existsInDB) return;

  await getAnimeDetailsFromApiAndUpsert(anilistId);
};

export const keepAnilistDataUpdated = async () => {
  const log = logger.child({ task: "keepAnilistDataUpdated" });

  const animeWithUpdates = await getAllAnimeWithUpdates(log);
  log.info(`found ${animeWithUpdates.length} anime with updates`);

  for (const anime of animeWithUpdates) {
    // TODO: Can we figure out what the last update was and only refresh what actually changed?

    // First update the titles and relations
    await upsertAnimeTitlesAndRelations(anime);

    // Then update the details (thubnail and description)
    await updateAnimeDetailsIfNeeded(anime.id);

    const startDate = anime.startDate?.year && anime.startDate?.month && anime.startDate?.day
      ? new Date(anime.startDate.year, anime.startDate.month - 1, anime.startDate.day)
      : null;

    try {
      await upsertEpisodesForAnime(anime.id, anime.episodes, startDate);
    } catch (error) {
      log.warn({ anilistId: anime.id, error }, "failed to update episodes");
    }

    // If the anime is part of a grouping, update the grouping to include it
    await updateAnimeGroupingIfNeeded(anime.id);
  }

  log.info(`sync complete`);
};
