import { prisma } from "../../prisma";
import { getRecentlyUpdatedAnime } from "./gather/getRecentlyUpdatedAnime";
import upsertAnimeTitlesAndRelations from "./upsertAnimeTitlesAndRelations";

export async function syncRecentlyUpdatedAnime() {
  console.log("[animeTitles.keepUpdatedSync] fetching recently updated anime");

  try {
    const aggregate = await prisma.baseAnime.aggregate({
      _max: { lastUpdated: true },
    });

    const lastUpdatedInDb = aggregate._max.lastUpdated ?? BigInt(0);

    console.log(
      "[animeTitles.keepUpdatedSync] most recent lastUpdated in DB:",
      lastUpdatedInDb,
    );

    let page = 1;
    let totalUpserted = 0;
    let reachedCutoff = false;

    while (!reachedCutoff) {
      const { media, pageInfo } = await getRecentlyUpdatedAnime(page);

      for (const anime of media) {
        if (
          anime.updatedAt != null &&
          BigInt(anime.updatedAt) <= lastUpdatedInDb
        ) {
          reachedCutoff = true;
          break;
        }

        await upsertAnimeTitlesAndRelations(anime);
        totalUpserted++;
      }

      if (!reachedCutoff && pageInfo.hasNextPage) {
        page++;
      } else {
        break;
      }
    }

    console.log(
      `[animeTitles.keepUpdatedSync] sync complete — upserted ${totalUpserted} anime`,
    );
  } catch (error) {
    console.error("[animeTitles.keepUpdatedSync] sync failed:", error);
  }
}
