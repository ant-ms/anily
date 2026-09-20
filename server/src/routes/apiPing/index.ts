import { app } from "$src/app";
import { prisma } from "$src/prisma";
import { getAuth } from "@hono/oidc-auth";

export const apiPingRoute = app.get("/api/ping", async (c) => {
  let auth: any = null;
  try {
    auth = await getAuth(c);
  } catch {}

  if (!auth && (process.env.OIDC_ISSUER || process.env.OIDC_CLIENT_ID)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let latestSyncJob = null;
  let lastUpdated = null;

  try {
    latestSyncJob = await prisma.syncJob.findFirst({
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        startedAt: true,
        finishedAt: true,
      },
    });
  } catch {}

  try {
    const aggregate = await prisma.baseAnime.aggregate({
      _max: { lastUpdated: true },
    });
    lastUpdated = aggregate._max.lastUpdated ? aggregate._max.lastUpdated.toString() : null;
  } catch {}

  return c.json({
    status: "ok",
    user: auth
      ? {
          sub: auth.sub,
          name: auth.name || auth.preferred_username || auth.email,
          picture: auth.picture,
          email: auth.email,
        }
      : null,
    latestSyncJob: latestSyncJob
      ? {
          ...latestSyncJob,
          startedAt: latestSyncJob.startedAt.toISOString(),
          finishedAt: latestSyncJob.finishedAt?.toISOString() ?? null,
        }
      : null,
    lastUpdated,
    serverTime: new Date().toISOString(),
  });
});
