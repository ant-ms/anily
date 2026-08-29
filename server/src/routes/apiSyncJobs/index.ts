import { app } from "$src/app";
import { prisma } from "$src/prisma";
import { keepAnilistDataUpdated } from "$src/syncs/keepAnilistDataUpdated";
import { SyncJobTrigger } from "../../../generated/prisma";

export const apiSyncJobsGetRoute = app.get("/api/sync-jobs", async (c) => {
  try {
    const jobs = await prisma.syncJob.findMany({
      orderBy: { startedAt: "desc" },
      take: 100,
    });
    return c.json(jobs);
  } catch (error) {
    return c.json(
      {
        error: "Failed to fetch sync jobs",
        reason: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

export const apiSyncJobsTriggerPostRoute = app.post(
  "/api/sync-jobs/trigger",
  async (c) => {
    // Fire and forget — run in background
    keepAnilistDataUpdated(SyncJobTrigger.MANUAL).catch(() => {
      // errors are already recorded to the DB inside keepAnilistDataUpdated
    });
    return c.json({ ok: true });
  },
);
