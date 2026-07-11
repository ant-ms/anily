import { serve } from "@hono/node-server";
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
import "$src/routes/apiSidebar/inbox";

setupAuthHandlers(app);
setupLoggerMiddleware(app);

// application basics
app.get("/", (c) => {
  // TODO: Serve a static HTML pages (frontend)
  return c.text("Hello Hono!");
});
app.get("/info", (c) => {
  return c.json({
    project: "anily",
    status: "ok",
    version: packageJson.version,
  });
});

// authenticated routes
app.get("/api/login", (c) => c.redirect("http://localhost:5173")); // TODO
app.get("/api/me", async (c) => c.json(await getAuth(c)));

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
