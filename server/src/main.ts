import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  oidcAuthMiddleware,
  getAuth,
  revokeSession,
  processOAuthCallback,
} from "@hono/oidc-auth";
import { syncRecentlyUpdatedAnime } from "./anilist/animeTitlesAndRelations/keepUpdated.task";
import packageJson from "../package.json";

const app = new Hono();

// authentication handling
app.get("/logout", async (c) => {
  await revokeSession(c);
  return c.text("You have been successfully logged out!");
});
app.get("/callback", async (c) => {
  c.set("oidcClaimsHook", async (orig, claims) => {
    return {
      ...orig,
      name: claims?.name,
      picture: claims?.picture,
    };
  });

  return processOAuthCallback(c);
});
app.use("/api/*", oidcAuthMiddleware());

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
app.get("api/login", (c) => c.redirect("http://localhost:5173")); // TODO
app.get("/api/me", async (c) => c.json(await getAuth(c)));

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);

    setInterval(syncRecentlyUpdatedAnime, 5 * 60 * 1000);
  },
);
