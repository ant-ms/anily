import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getAuth } from "@hono/oidc-auth";
import packageJson from "../package.json";
import { setupAuthHandlers } from "./auth";
import { logger, setupLoggerMiddleware } from "./logger";
import { setupApiSearch } from "./routes/apiSearch";
import { setupApiDetails } from "./routes/apiDetails";
import { keepAnilistDataUpdated } from "./syncs/keepAnilistDataUpdated";

const app = new Hono();

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

setupApiSearch(app);
setupApiDetails(app);

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

    setInterval(keepAnilistDataUpdated, 5 * 60 * 1000);
  },
);
