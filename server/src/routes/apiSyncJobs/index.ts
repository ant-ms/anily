import { app } from "$src/app";
import { prisma } from "$src/prisma";
import { SyncJobType } from "../../../generated/prisma/enums";

export const apiSyncJobsGetRoute = app.get("/api/sync-jobs", async (c) => {
  try {
    const type = c.req.query("type");
    const jobs = await prisma.syncJob.findMany({
      where: type ? { type: type as SyncJobType } : undefined,
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
