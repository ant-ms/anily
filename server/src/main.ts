import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { getAuth } from "@hono/oidc-auth";
import packageJson from "../package.json";
import { logger } from "./logger";
import { keepAnilistDataUpdated } from "./syncs/keepAnilistDataUpdated";
import { syncAiringEpisodes } from "./syncs/syncAiringEpisodes";
import "dotenv/config";
import { app } from "./app";

import "$src/routes/apiDetails";
import "$src/routes/apiEpisodes";
import "$src/routes/apiGrouping";
import "$src/routes/apiSearch";
import "$src/routes/apiSidebar";
import "$src/routes/apiSyncJobs";
import "$src/routes/apiStream";
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
      ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "mediaFailedTorrents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MediaStatus') THEN
          CREATE TYPE "MediaStatus" AS ENUM ('NONE', 'QUEUED', 'DOWNLOADING', 'AVAILABLE');
        END IF;
      END $$;
      ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "mediaStatus" "MediaStatus" NOT NULL DEFAULT 'NONE';
      CREATE INDEX IF NOT EXISTS "Episode_mediaTorrentHash_idx" ON "Episode"("mediaTorrentHash");

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SyncJobType') THEN
          CREATE TYPE "SyncJobType" AS ENUM ('ANILIST_SYNC', 'EPISODE_METADATA');
        END IF;
      END $$;
      ALTER TABLE "SyncJob" ADD COLUMN IF NOT EXISTS "type" "SyncJobType" NOT NULL DEFAULT 'ANILIST_SYNC';
      ALTER TABLE "SyncJob" ADD COLUMN IF NOT EXISTS "details" JSONB;
    `);
    logger.info("Database schema verified");
  } catch (err) {
    logger.warn({ err }, "Schema migration check skipped or failed");
  }
};
ensureSchema().catch(() => {});

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
      // Sync airing anime episodes from TheTVDB and AnimeSchedule every 60 minutes
      setInterval(syncAiringEpisodes, 60 * 60 * 1000);
    }
  },
);

