import { searchForAnime } from "./searchForAnime";
import { app } from "$src/app";

export const apiSearchGetRoute = app.get("/api/search", async (c) => {
  const query = c.req.query("q");
  if (!query) return c.json({ error: "No query provided" });

  try {
    const results = await searchForAnime(query);
    const filteredResults = results.map((result) => {
      let thumbnailUrl = result.animeDetails?.thumbnailUrl ?? null;

      // If this specific season doesn't have a thumbnail, look up its grouping/chain
      if (!thumbnailUrl && result.groupings.length > 0) {
        for (const grouping of result.groupings) {
          if (grouping.displayAnime?.animeDetails?.thumbnailUrl) {
            thumbnailUrl = grouping.displayAnime.animeDetails.thumbnailUrl;
            break;
          }
          const itemWithThumb = grouping.items.find(
            (item) => item.animeDetails?.thumbnailUrl
          );
          if (itemWithThumb?.animeDetails?.thumbnailUrl) {
            thumbnailUrl = itemWithThumb.animeDetails.thumbnailUrl;
            break;
          }
        }
      }

      if (!thumbnailUrl && result.displayForGroupings.length > 0) {
        for (const grouping of result.displayForGroupings) {
          if (grouping.displayAnime?.animeDetails?.thumbnailUrl) {
            thumbnailUrl = grouping.displayAnime.animeDetails.thumbnailUrl;
            break;
          }
          const itemWithThumb = grouping.items.find(
            (item) => item.animeDetails?.thumbnailUrl
          );
          if (itemWithThumb?.animeDetails?.thumbnailUrl) {
            thumbnailUrl = itemWithThumb.animeDetails.thumbnailUrl;
            break;
          }
        }
      }

      const isBookmarked =
        result.animeDetails?.groupingId != null ||
        result.groupings.length > 0 ||
        result.displayForGroupings.length > 0;

      return {
        anilistId: result.anilistId,
        titleEnglish: result.titleEnglish,
        titleRomanji: result.titleRomanji,
        titleNative: result.titleNative,
        format: result.format,
        season: result.season,
        seasonYear: result.seasonYear,
        thumbnailUrl,
        isBookmarked,
      };
    });

    filteredResults.sort((a, b) => {
      if (a.isBookmarked && !b.isBookmarked) return -1;
      if (!a.isBookmarked && b.isBookmarked) return 1;
      if (a.thumbnailUrl && !b.thumbnailUrl) return -1;
      if (!a.thumbnailUrl && b.thumbnailUrl) return 1;
      return 0;
    });

    return c.json(filteredResults.slice(0, 20));
  } catch (error) {
    return c.json({
      error: "Failed to search",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
});
