import { prisma } from "../prisma";
import { updateAnimeDetailsIfNeeded } from "./animeDetails/keepUpdated.task";
import { getRecentlyUpdatedAnime } from "./animeTitlesAndRelations/gather/getRecentlyUpdatedAnime";
import upsertAnimeTitlesAndRelations from "./animeTitlesAndRelations/upsertAnimeTitlesAndRelations";

// TODO: Is there any way to determine what was updated?

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
    let totalUpdated = 0;
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

        // First update the titles and relations
        await upsertAnimeTitlesAndRelations(anime);

        // Then update the details (thubnail and description)
        await updateAnimeDetailsIfNeeded(anime.id);

        totalUpdated++;
      }

      if (!reachedCutoff && pageInfo.hasNextPage) {
        page++;
      } else {
        break;
      }
    }

    console.log(
      `[animeTitles.keepUpdatedSync] sync complete — updated ${totalUpdated} anime`,
    );
  } catch (error) {
    console.error("[animeTitles.keepUpdatedSync] sync failed:", error);
  }
}
