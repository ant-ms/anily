import { Hono } from "hono";
import { getAnimeDetails } from "./getAnimeDetails";
import { getNumberOfAnimeGroupings } from "../apiGrouping/updateAnimeGroupingIfNeeded";
import { prisma } from "$src/prisma";
import { fillAnimeGroupingDetails } from "../apiGrouping/buildAnimeGroupings";
import { collectGroupingMemberIds } from "../apiGrouping/collectGroupingMemberIds";

export const setupApiDetails = (app: Hono) => {
  app.get("/api/details/:anilistId", async (c) => {
    const anilistId = c.req.param("anilistId");
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
        groupingId: details.baseAnime.groupings?.[0]?.id || null,
      };
      return c.json(filteredDetails);
    } catch (error) {
      return c.json({
        error: "Failed to get details",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/details/:anilistId/grouping", async (c) => {
    const anilistId = c.req.param("anilistId");
    if (!anilistId) return c.json({ error: "No anilistId provided" });

    // TODO: Reduce duplication
    let anilistIdInt: number;
    try {
      anilistIdInt = parseInt(anilistId);
    } catch (error) {
      return c.json({
        error: "Invalid anilistId",
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    const numberOfAnimeGroupings =
      await getNumberOfAnimeGroupings(anilistIdInt);

    // If the anime is already grouped, return a 200 status with a message
    if (numberOfAnimeGroupings.length > 0) {
      return c.body(null, 200);
    }

    // Make sure all members have details
    const groupingMemberIds = await collectGroupingMemberIds(anilistIdInt);
    await fillAnimeGroupingDetails(groupingMemberIds);

    await prisma.animeGrouping.create({
      data: {
        items: {
          connect: groupingMemberIds.map((id) => ({ anilistId: id })),
        },
        displayAnime: {
          connect: {
            anilistId: anilistIdInt,
          },
        },
      },
    });

    return c.body(null, 200);
  });

  app.delete("/api/details/:anilistId/grouping", async (c) => {
    const anilistId = c.req.param("anilistId");
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

    await prisma.animeGrouping.deleteMany({
      where: {
        displayAnime: {
          anilistId: anilistIdInt,
        },
      },
    });

    return c.body(null, 200);
  });
};
