import { searchForAnime } from "./searchForAnime";
import { app } from "$src/app";
import { getAuthenticatedUser } from "$src/auth";
import { prisma } from "$src/prisma";

export const apiSearchGetRoute = app.get("/api/search", async (c) => {
  const query = c.req.query("q");
  if (!query) return c.json({ error: "No query provided" }, 400);

  try {
    const [user, results] = await Promise.all([
      getAuthenticatedUser(c),
      searchForAnime(query),
    ]);

    const userBookmarks = await prisma.userBookmark.findMany({
      where: {
        userId: user.id,
        anilistId: { in: results.map((r) => r.anilistId) },
      },
      select: { anilistId: true },
    });
    const bookmarkedSet = new Set(userBookmarks.map((b) => b.anilistId));

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

      const isBookmarked = bookmarkedSet.has(result.anilistId);

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
    return c.json(
      {
        error: "Failed to search",
        reason: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
