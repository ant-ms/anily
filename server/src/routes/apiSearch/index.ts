import { searchForAnime } from "./searchForAnime";
import { app } from "$src/app";

export const apiSearchGetRoute = app.get("/api/search", async (c) => {
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
