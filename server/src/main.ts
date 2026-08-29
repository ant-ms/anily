import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { getAuth } from "@hono/oidc-auth";
import packageJson from "../package.json";
import { setupAuthHandlers } from "./auth";
import { logger, setupLoggerMiddleware } from "./logger";
import { keepAnilistDataUpdated } from "./syncs/keepAnilistDataUpdated";
import { runAutoDownload } from "./syncs/autoDownload";
import { syncDownloadStatuses } from "$lib/media/mediaManager";
import "dotenv/config";
import { app } from "./app";

import "$src/routes/apiDetails";
import "$src/routes/apiEpisodes";
import "$src/routes/apiGrouping";
import "$src/routes/apiSearch";
import "$src/routes/apiSidebar";
import "$src/routes/apiSyncJobs";
import "$src/routes/apiMedia";
import { prisma } from "$src/prisma";

// Ensure database schema columns exist
const ensureSchema = async () => {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "mediaPath" TEXT;
      ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "mediaSelectedTorrent" JSONB;
      ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "mediaSize" BIGINT;
      ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "mediaTorrentHash" TEXT;
      ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "mediaLastSearchAt" TIMESTAMP(3);
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MediaStatus') THEN
          CREATE TYPE "MediaStatus" AS ENUM ('NONE', 'QUEUED', 'DOWNLOADING', 'AVAILABLE');
        END IF;
      END $$;
      ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "mediaStatus" "MediaStatus" NOT NULL DEFAULT 'NONE';
      CREATE INDEX IF NOT EXISTS "Episode_mediaTorrentHash_idx" ON "Episode"("mediaTorrentHash");
    `);
    logger.info("Database schema verified");
  } catch (err) {
    logger.warn({ err }, "Schema migration check skipped or failed");
  }
};
ensureSchema().catch(() => {});

setupAuthHandlers(app);
setupLoggerMiddleware(app);

app.get("/info", (c) => {
  return c.json({
    project: "anily",
    status: "ok",
    version: packageJson.version,
  });
});

// authenticated routes
app.get("/api/login", (c) => c.redirect("/"));
app.get("/api/me", async (c) => c.json(await getAuth(c)));

// frontend
app.use("/*", serveStatic({ root: "./public" }));
app.get("*", serveStatic({ path: "./public/index.html" }));

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    logger.info(`Server is running on http://localhost:${info.port}`);

    if (process.env.ANILY_DISABLE_SCHEDULES !== "true") {
      setInterval(keepAnilistDataUpdated, 5 * 60 * 1000);
      // Sync download statuses every 30 seconds
      setInterval(syncDownloadStatuses, 30 * 1000);
      // Auto-download newly aired episodes every 15 minutes
      setInterval(runAutoDownload, 15 * 60 * 1000);
    }
  },
);

