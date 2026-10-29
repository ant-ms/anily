import { getAnimeDetails } from "./getAnimeDetails";
import { syncAnimePipeline } from "$src/services/syncAnimePipeline";
import { prisma } from "$src/prisma";
import { fillAnimeGroupingDetails } from "../apiGrouping/buildAnimeGroupings";
import { collectGroupingMemberIds } from "../apiGrouping/collectGroupingMemberIds";
import { anilistParamValidator } from "$src/validators/anilistId";
import { app } from "$src/app";
import { logger } from "$src/logger";

const log = logger.child({ route: "apiDetails" });

class AsyncKeyedMutex {
  private activeLocks = new Map<number, Promise<void>>();

  async runExclusive<T>(key: number, fn: () => Promise<T>): Promise<T> {
    while (this.activeLocks.has(key)) {
      try {
        await this.activeLocks.get(key);
      } catch {
        // Ignore errors from previous holder
      }
    }

    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.activeLocks.set(key, promise);

    try {
      return await fn();
    } finally {
      this.activeLocks.delete(key);
      resolve();
    }
  }
}

const groupingMutex = new AsyncKeyedMutex();

export const findGroupingsForMembers = async (
  memberIds: number[],
  displayId: number,
) => {
  const ids = Array.from(new Set([...memberIds, displayId]));
  return await prisma.animeGrouping.findMany({
    where: {
      OR: [
        { items: { some: { anilistId: { in: ids } } } },
        { displayAnimeId: { in: ids } },
      ],
    },
    include: {
      items: {
        select: { anilistId: true },
      },
    },
    orderBy: { id: "asc" },
  });
};

export const consolidateGroupings = async (
  groupings: Array<{ id: number; items?: { anilistId: number }[] }>,
  targetDisplayAnimeId: number,
  memberIds: number[],
) => {
  if (groupings.length === 0) return null;

  const [primary, ...duplicates] = groupings;
  const allItemIds = new Set<number>(memberIds);
  allItemIds.add(targetDisplayAnimeId);
  for (const g of groupings) {
    for (const item of g.items ?? []) {
      allItemIds.add(item.anilistId);
    }
  }

  await prisma.animeGrouping.update({
    where: { id: primary.id },
    data: {
      displayAnimeId: targetDisplayAnimeId,
      items: {
        set: Array.from(allItemIds).map((id) => ({ anilistId: id })),
      },
    },
  });

  if (duplicates.length > 0) {
    await prisma.animeGrouping.deleteMany({
      where: { id: { in: duplicates.map((d) => d.id) } },
    });
  }

  return primary;
};

import { getAuthenticatedUser } from "$src/auth";

export const apiDetailsAnilistIdGetRoute = app.get(
  "/api/details/:anilistId",
  anilistParamValidator,
  async (c) => {
    const params = c.req.valid("param");

    try {
      const user = await getAuthenticatedUser(c);
      const details = await getAnimeDetails(params.anilistId);

      const [userRating, userBookmark] = await Promise.all([
        prisma.userAnimeRating.findUnique({
          where: {
            userId_anilistId: {
              userId: user.id,
              anilistId: params.anilistId,
            },
          },
        }),
        prisma.userBookmark.findUnique({
          where: {
            userId_anilistId: {
              userId: user.id,
              anilistId: params.anilistId,
            },
          },
        }),
      ]);

      const isBookmarked = Boolean(userBookmark);

      const filteredDetails = {
        anilistId: details.baseAnime.anilistId,
        titleEnglish: details.baseAnime.titleEnglish,
        titleRomanji: details.baseAnime.titleRomanji,
        titleNative: details.baseAnime.titleNative,
        description: details.description,
        thumbnailUrl: details.thumbnailUrl,
        groupingId: isBookmarked ? (details.baseAnime.groupings?.[0]?.id ?? 1) : null,
        isDisplayAnime: details.baseAnime.groupings?.[0]?.displayAnimeId === details.baseAnime.anilistId,
        rating: userRating?.rating ?? details.rating ?? "NEUTRAL",
      };
      return c.json(filteredDetails);
    } catch (error) {
      return c.json(
        {
          error: "Failed to get details",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
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
      await syncAnimePipeline(params.anilistId);
      return c.body(null, 204);
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

    try {
      const user = await getAuthenticatedUser(c);
      // Only bookmark once the grouping exists, otherwise a failed grouping
      // leaves an orphan bookmark that never shows up in the sidebar.
      const bookmark = () =>
        prisma.userBookmark.upsert({
          where: {
            userId_anilistId: { userId: user.id, anilistId: params.anilistId },
          },
          create: { userId: user.id, anilistId: params.anilistId },
          update: {},
        });

      const groupingMemberIds = await collectGroupingMemberIds(params.anilistId);
      const franchiseKey =
        groupingMemberIds.length > 0 ? Math.min(...groupingMemberIds) : params.anilistId;

      await groupingMutex.runExclusive(franchiseKey, async () => {
        const existingGroupings = await findGroupingsForMembers(
          groupingMemberIds,
          params.anilistId,
        );

        // If the anime or any member is already grouped, update display anime / consolidate
        if (existingGroupings.length > 0) {
          await consolidateGroupings(
            existingGroupings,
            params.anilistId,
            groupingMemberIds,
          );
          await bookmark();
          return;
        }

        // Make sure all members have details
        await fillAnimeGroupingDetails(groupingMemberIds);

        // Re-check if a grouping was already created while fillAnimeGroupingDetails was running!
        const recheckedGroupings = await findGroupingsForMembers(
          groupingMemberIds,
          params.anilistId,
        );

        if (recheckedGroupings.length > 0) {
          await consolidateGroupings(
            recheckedGroupings,
            params.anilistId,
            groupingMemberIds,
          );
          await bookmark();
          return;
        }

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

        await bookmark();
      });

      return c.body(null, 204);
    } catch (error) {
      log.error({ anilistId: params.anilistId, error }, "Failed to bookmark anime");
      return c.json(
        {
          error: "Failed to bookmark anime",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

export const apiDetailsAnilistIdGroupingDeleteRoute = app.delete(
  "/api/details/:anilistId/grouping",
  anilistParamValidator,
  async (c) => {
    const params = c.req.valid("param");

    try {
      const user = await getAuthenticatedUser(c);
      await prisma.userBookmark.deleteMany({
        where: {
          userId: user.id,
          anilistId: params.anilistId,
        },
      });

      return c.body(null, 204);
    } catch (error) {
      log.error({ anilistId: params.anilistId, error }, "Failed to remove bookmark");
      return c.json(
        {
          error: "Failed to remove bookmark",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);
