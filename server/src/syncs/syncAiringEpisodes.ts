import { prisma } from "../prisma";
import { upsertEpisodesForAnime } from "$lib/thetvdb/upsertEpisodesForAnime";
import { logger } from "$src/logger";
import { SyncJobTrigger, SyncJobType } from "../../generated/prisma/enums";

let isAiringSyncRunning = false;

export const syncAiringEpisodes = async (
  trigger: SyncJobTrigger = SyncJobTrigger.SCHEDULED,
) => {
  const log = logger.child({ task: "syncAiringEpisodes" });

  if (isAiringSyncRunning) {
    log.info("Airing episode sync is already running, skipping this run.");
    return;
  }

  isAiringSyncRunning = true;

  const job = await prisma.syncJob.create({
    data: {
      type: SyncJobType.EPISODE_METADATA,
      trigger,
      status: "RUNNING",
    },
  });

  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  try {
    // Find anime in user's library that have episodes airing around now,
    // or are from the current / recent season.
    const candidates = await prisma.animeDetails.findMany({
      where: {
        OR: [
          {
            episodes: {
              some: {
                airingAt: {
                  gte: twoWeeksAgo,
                  lte: thirtyDaysFromNow,
                },
              },
            },
          },
          {
            baseAnime: {
              seasonYear: { gte: now.getFullYear() - 1 },
            },
          },
        ],
      },
      include: {
        baseAnime: true,
      },
      orderBy: { id: "asc" },
    });

    log.info(`Found ${candidates.length} currently airing or recent anime to check for episode updates`);

    let episodesUpdatedCount = 0;
    const warnings: Array<{ anilistId: number; title: string; message: string }> = [];

    for (const details of candidates) {
      const anilistId = details.baseAnimeAnilistId;
      const title =
        details.baseAnime.titleEnglish ||
        details.baseAnime.titleRomanji ||
        details.baseAnime.titleNative ||
        `Anime #${anilistId}`;

      try {
        await upsertEpisodesForAnime(anilistId);
        episodesUpdatedCount++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.warn({ anilistId, error }, `Failed to sync episodes for ${title}`);
        warnings.push({
          anilistId,
          title,
          message: `Episode sync failed: ${msg}`,
        });
      }

      // Small pacing delay to avoid burst rate limits on TheTVDB / AnimeSchedule
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        updatesCount: episodesUpdatedCount,
        details: {
          animeChecked: candidates.length,
          episodesUpdated: episodesUpdatedCount,
          warnings: warnings.slice(0, 50),
        },
      },
    });

    log.info(
      { updated: episodesUpdatedCount, warningsCount: warnings.length },
      "Airing episode sync complete",
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ error }, "Airing episode sync failed");
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: errorMessage,
      },
    });
  } finally {
    isAiringSyncRunning = false;
  }
};
