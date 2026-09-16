import { getAnimeDetails } from "./getAnimeDetails";
import { getAnimeDetailsFromApiAndUpsert } from "$lib/anilistApi/getAnimeDetailsFromApiAndUpsert";
import { getNumberOfAnimeGroupings } from "../apiGrouping/updateAnimeGroupingIfNeeded";
import { prisma } from "$src/prisma";
import { fillAnimeGroupingDetails } from "../apiGrouping/buildAnimeGroupings";
import { collectGroupingMemberIds } from "../apiGrouping/collectGroupingMemberIds";
import { anilistParamValidator } from "$src/validators/anilistId";
import { app } from "$src/app";
import { logger } from "$src/logger";

const log = logger.child({ route: "apiDetails" });

export const apiDetailsAnilistIdGetRoute = app.get(
  "/api/details/:anilistId",
  anilistParamValidator,
  async (c) => {
    const params = c.req.valid("param");

    try {
      const details = await getAnimeDetails(params.anilistId);
      const filteredDetails = {
        anilistId: details.baseAnime.anilistId,
        titleEnglish: details.baseAnime.titleEnglish,
        titleRomanji: details.baseAnime.titleRomanji,
        titleNative: details.baseAnime.titleNative,
        description: details.description,
        thumbnailUrl: details.thumbnailUrl,
        groupingId: details.baseAnime.groupings?.[0]?.id || null,
        isDisplayAnime: details.baseAnime.groupings?.[0]?.displayAnimeId === details.baseAnime.anilistId,
      };
      return c.json(filteredDetails);
    } catch (error) {
      return c.json({
        error: "Failed to get details",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

export const apiDetailsAnilistIdRefreshPostRoute = app.post(
  "/api/details/:anilistId/refresh",
  anilistParamValidator,
  async (c) => {
    const params = c.req.valid("param");

    try {
      // Force a fresh fetch from AniList and upsert into the database.
      await getAnimeDetailsFromApiAndUpsert(params.anilistId);
      return c.body(null, 200);
    } catch (error) {
      return c.json(
        {
          error: "Failed to refresh details",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

export const apiDetailsAnilistIdGroupingPostRoute = app.post(
  "/api/details/:anilistId/grouping",
  anilistParamValidator,
  async (c) => {
    const params = c.req.valid("param");

    const numberOfAnimeGroupings = await getNumberOfAnimeGroupings(
      params.anilistId,
    );

    // If the anime is already grouped, update the display anime to this one
    if (numberOfAnimeGroupings.length > 0) {
      await prisma.animeGrouping.updateMany({
        where: { items: { some: { anilistId: params.anilistId } } },
        data: { displayAnimeId: params.anilistId }
      });
      return c.body(null, 200);
    }

    // Make sure all members have details
    const groupingMemberIds = await collectGroupingMemberIds(params.anilistId);
    await fillAnimeGroupingDetails(groupingMemberIds);

    await prisma.animeGrouping.create({
      data: {
        items: {
          connect: groupingMemberIds.map((id) => ({ anilistId: id })),
        },
        displayAnime: {
          connect: {
            anilistId: params.anilistId,
          },
        },
      },
    });

    return c.body(null, 200);
  },
);

export const apiDetailsAnilistIdGroupingDeleteRoute = app.delete(
  "/api/details/:anilistId/grouping",
  anilistParamValidator,
  async (c) => {
    const params = c.req.valid("param");

    await prisma.animeGrouping.deleteMany({
      where: {
        items: {
          some: {
            anilistId: params.anilistId,
          }
        }
      },
    });

    return c.body(null, 200);
  },
);
