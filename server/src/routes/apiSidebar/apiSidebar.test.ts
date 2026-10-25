import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { app } from "$src/app";
import { prisma } from "$src/prisma";
import { getSidebarAnimesFromDB } from "./index";

describe("apiSidebar deduplication", () => {
  let testUserId: string;

  beforeEach(async () => {
    const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (!user) {
      throw new Error("No test user found in DB");
    }
    testUserId = user.id;
  });

  it("duplicate groupings in DB do not produce duplicate entries in sidebar inbox (DB integration)", async () => {
    // Find an anime that has released episodes and is in a grouping (excluding anime used by other tests)
    const existingGrouping = await prisma.animeGrouping.findFirst({
      where: {
        displayAnimeId: { notIn: [154587, 269] },
        items: {
          some: {
            animeDetails: {
              episodes: {
                some: {
                  airingAt: { lte: new Date() },
                },
              },
            },
          },
        },
      },
      include: {
        items: {
          select: { anilistId: true },
        },
      },
    });

    expect(existingGrouping).not.toBeNull();
    const displayAnimeId = existingGrouping!.displayAnimeId;
    const memberIds = existingGrouping!.items.map((i) => i.anilistId);

    // Ensure the anime is bookmarked by test user
    await prisma.userBookmark.upsert({
      where: {
        userId_anilistId: {
          userId: testUserId,
          anilistId: displayAnimeId,
        },
      },
      create: {
        userId: testUserId,
        anilistId: displayAnimeId,
      },
      update: {},
    });

    // Create a temporary duplicate AnimeGrouping for the same displayAnimeId
    const duplicateGrouping = await prisma.animeGrouping.create({
      data: {
        displayAnimeId,
        items: {
          connect: memberIds.map((id) => ({ anilistId: id })),
        },
      },
    });

    try {
      // Fetch sidebar inbox via route
      const res = await app.request("/api/sidebar/inbox");
      expect(res.status).toBe(200);
      const cards = (await res.json()) as any[];

      // Filter cards matching this displayAnilistId
      const matchingCards = cards.filter(
        (c) => c.displayAnilistId === displayAnimeId,
      );

      // Verify it appears at most once in the inbox response
      expect(matchingCards.length).toBeLessThanOrEqual(1);

      // Directly verify getSidebarAnimesFromDB as well
      const dbCards = await getSidebarAnimesFromDB("inbox", testUserId);
      const matchingDbCards = dbCards.filter(
        (c) => c.displayAnilistId === displayAnimeId,
      );
      expect(matchingDbCards.length).toBeLessThanOrEqual(1);
    } finally {
      // Clean up the temporary duplicate grouping
      await prisma.animeGrouping.deleteMany({
        where: { id: duplicateGrouping.id },
      });
    }
  });

  it("getSidebarAnimesFromDB deduplicates by displayAnilistId even if multiple groupings pass filters", async () => {
    const mockNow = new Date("2026-10-25T12:00:00Z");
    const mockItem = {
      anilistId: 999991,
      relationsOut: [],
      animeDetails: {
        episodes: [
          { id: 10001, airingAt: new Date("2026-01-01T00:00:00Z") },
        ],
      },
    };

    const mockGrouping1 = {
      id: 9991,
      displayAnimeId: 999991,
      displayAnime: {
        anilistId: 999991,
        titleEnglish: "Duplicate Show",
        titleRomanji: "Duplicate Show",
        titleNative: "Duplicate Show",
        animeDetails: null,
      },
      items: [mockItem],
    };

    const mockGrouping2 = {
      id: 9992,
      displayAnimeId: 999991,
      displayAnime: {
        anilistId: 999991,
        titleEnglish: "Duplicate Show",
        titleRomanji: "Duplicate Show",
        titleNative: "Duplicate Show",
        animeDetails: null,
      },
      items: [mockItem],
    };

    // Spy on prisma findMany to return mock duplicates
    const findManySpy = vi.spyOn(prisma.animeGrouping, "findMany").mockResolvedValueOnce([
      mockGrouping1 as any,
      mockGrouping2 as any,
    ]);
    const bookmarkSpy = vi.spyOn(prisma.userBookmark, "findMany").mockResolvedValueOnce([
      { anilistId: 999991, userId: "test-user" } as any,
    ]);
    const progressSpy = vi.spyOn(prisma.userEpisodeProgress, "findMany").mockResolvedValueOnce([]);

    const cards = await getSidebarAnimesFromDB("inbox", "test-user");

    expect(cards.length).toBe(1);
    expect(cards[0].displayAnilistId).toBe(999991);
    expect(cards[0].titleEnglish).toBe("Duplicate Show");
  });
});
