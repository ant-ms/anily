import { Hono } from "hono";
import { getAnimeDetails } from "./getAnimeDetails";

export const setupApiDetails = (app: Hono) => {
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
};
