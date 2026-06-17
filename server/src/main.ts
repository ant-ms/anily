import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  oidcAuthMiddleware,
  getAuth,
  revokeSession,
  processOAuthCallback,
} from "@hono/oidc-auth";
import { syncRecentlyUpdatedAnime } from "./anilist/keepUpdated.task";
import packageJson from "../package.json";
import { searchForAnime } from "./functions/searchForAnime";
import { getAnimeDetails } from "./functions/getAnimeDetails";

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
app.get("/api/login", (c) => c.redirect("http://localhost:5173")); // TODO
app.get("/api/me", async (c) => c.json(await getAuth(c)));
app.get("/api/search", async (c) => {
  const query = c.req.query("q");
  if (!query) return c.json({ error: "No query provided" });

  try {
    const results = await searchForAnime(query);
    const filteredResults = results.map((result) => {
      return {
        anilistId: result.anilistId,
        titleEnglish: result.titleEnglish,
        titleRomanji: result.titleRomanji,
        titleNative: result.titleNative,
      };
    });
    return c.json(filteredResults);
  } catch (error) {
    return c.json({
      error: "Failed to search",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
});
app.get("/api/details", async (c) => {
  const anilistId = c.req.query("anilistId");
  if (!anilistId) return c.json({ error: "No anilistId provided" });

  let anilistIdInt: number;
  try {
    anilistIdInt = parseInt(anilistId);
  } catch (error) {
    return c.json({
      error: "Invalid anilistId",
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const details = await getAnimeDetails(anilistIdInt);
    const filteredDetails = {
      anilistId: details.baseAnime.anilistId,
      titleEnglish: details.baseAnime.titleEnglish,
      titleRomanji: details.baseAnime.titleRomanji,
      titleNative: details.baseAnime.titleNative,
      description: details.description,
      thumbnailUrl: details.thumbnailUrl,
      markedForLater: details.markedForLater,
    };
    return c.json(filteredDetails);
  } catch (error) {
    return c.json({
      error: "Failed to get details",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
});

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
