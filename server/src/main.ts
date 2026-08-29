import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { getAuth } from "@hono/oidc-auth";
import packageJson from "../package.json";
import { setupAuthHandlers } from "./auth";
import { logger, setupLoggerMiddleware } from "./logger";
import { keepAnilistDataUpdated } from "./syncs/keepAnilistDataUpdated";
import "dotenv/config";
import { app } from "./app";

import "$src/routes/apiDetails";
import "$src/routes/apiEpisodes";
import "$src/routes/apiGrouping";
import "$src/routes/apiSearch";
import "$src/routes/apiSidebar";
import "$src/routes/apiSyncJobs";

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
    }
  },
);
