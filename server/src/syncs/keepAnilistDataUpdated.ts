import { prisma } from "../prisma";
import { getRecentlyUpdatedAnime } from "$lib/anilistApi/baseAnime/getRecentlyUpdatedAnime";
import { getAnimeDetailsFromApiAndUpsert } from "$lib/anilistApi/getAnimeDetailsFromApiAndUpsert";
import upsertAnimeTitlesAndRelations from "$lib/anilistApi/upsertAnimeTitlesAndRelations";
import { logger } from "$src/logger";
import { Logger } from "pino";
import { updateAnimeGroupingIfNeeded } from "$src/routes/apiGrouping/updateAnimeGroupingIfNeeded";
import { upsertEpisodesForAnime } from "$lib/thetvdb/upsertEpisodesForAnime";
import { SyncJobTrigger, SyncJobType } from "../../generated/prisma/enums";

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

export const updateAnimeDetailsIfNeeded = async (anilistId: number): Promise<boolean> => {
  const existsInDB = await prisma.animeDetails.findUnique({
    where: { baseAnimeAnilistId: anilistId },
  });

  // We skip updating any details if the anime is not in the database
  if (!existsInDB) return false;

  await getAnimeDetailsFromApiAndUpsert(anilistId);
  return true;
};

export const keepAnilistDataUpdated = async (trigger: SyncJobTrigger = SyncJobTrigger.SCHEDULED) => {
  const log = logger.child({ task: "keepAnilistDataUpdated" });

  const job = await prisma.syncJob.create({
    data: {
      type: SyncJobType.ANILIST_SYNC,
      trigger,
      status: "RUNNING",
    },
  });

  let animeWithUpdates: RecentlyUpdatedAnime = [];
  let detailsUpdatedCount = 0;
  let episodesUpdatedCount = 0;
  let groupingsUpdatedCount = 0;
  const warnings: Array<{ anilistId: number; title: string; message: string }> = [];

  try {
    animeWithUpdates = await getAllAnimeWithUpdates(log);
    log.info(`found ${animeWithUpdates.length} anime with updates`);

    for (const anime of animeWithUpdates) {
      const title = anime.title?.english || anime.title?.romaji || anime.title?.native || `Anime #${anime.id}`;

      // First update the titles and relations
      await upsertAnimeTitlesAndRelations(anime);

      // Then update the details (thumbnail and description)
      const updatedDetails = await updateAnimeDetailsIfNeeded(anime.id);
      if (updatedDetails) detailsUpdatedCount++;

      const startDate = anime.startDate?.year && anime.startDate?.month && anime.startDate?.day
        ? new Date(anime.startDate.year, anime.startDate.month - 1, anime.startDate.day)
        : null;

      try {
        await upsertEpisodesForAnime(anime.id, anime.episodes, startDate);
        episodesUpdatedCount++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.warn({ anilistId: anime.id, error }, "failed to update episodes");
        warnings.push({
          anilistId: anime.id,
          title,
          message: `Episode sync: ${msg}`,
        });
      }

      // If the anime is part of a grouping, update the grouping to include it
      try {
        await updateAnimeGroupingIfNeeded(anime.id);
        groupingsUpdatedCount++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.warn({ anilistId: anime.id, error }, "failed to update grouping");
        warnings.push({
          anilistId: anime.id,
          title,
          message: `Grouping sync: ${msg}`,
        });
      }
    }

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        updatesCount: animeWithUpdates.length,
        details: {
          animeChecked: animeWithUpdates.length,
          titlesUpdated: animeWithUpdates.length,
          detailsUpdated: detailsUpdatedCount,
          episodesUpdated: episodesUpdatedCount,
          groupingsUpdated: groupingsUpdatedCount,
          warnings: warnings.slice(0, 50),
        },
      },
    });

    log.info(`sync complete`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ error }, "sync failed");
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: errorMessage,
        details: {
          animeChecked: animeWithUpdates.length,
          warnings: warnings.slice(0, 50),
        },
      },
    });
  }
};
