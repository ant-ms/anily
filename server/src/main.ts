import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
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
import "$src/routes/apiRate";
import "$src/routes/apiPing";

app.get("/info", (c) => {
  return c.json({
    project: "anily",
    status: "ok",
    version: packageJson.version,
  });
});

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

