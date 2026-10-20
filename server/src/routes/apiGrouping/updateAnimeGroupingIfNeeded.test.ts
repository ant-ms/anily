import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getNumberOfAnimeGroupings,
  updateAnimeGroupingIfNeeded,
} from "./updateAnimeGroupingIfNeeded";
import { prisma } from "$src/prisma";
import { logger } from "$src/logger";
import * as memberModule from "./collectGroupingMemberIds";

describe("updateAnimeGroupingIfNeeded", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getNumberOfAnimeGroupings returns matching groupings for franchise members", async () => {
    vi.spyOn(memberModule, "collectGroupingMemberIds").mockResolvedValueOnce([10, 20]);
    vi.spyOn(prisma.animeGrouping, "findMany").mockResolvedValueOnce([
      { id: 1, displayAnimeId: 10 } as any,
    ]);

    const groupings = await getNumberOfAnimeGroupings(10);
    expect(groupings.length).toBe(1);
    expect(groupings[0].id).toBe(1);
    expect(prisma.animeGrouping.findMany).toHaveBeenCalledWith({
      where: {
        items: {
          some: {
            anilistId: {
              in: [10, 20],
            },
          },
        },
      },
    });
  });

  it("does nothing when no anime groupings exist for the franchise", async () => {
    vi.spyOn(memberModule, "collectGroupingMemberIds").mockResolvedValue([100]);
    vi.spyOn(prisma.animeGrouping, "findMany").mockResolvedValueOnce([]);
    const updateSpy = vi.spyOn(prisma.animeGrouping, "update");

    await updateAnimeGroupingIfNeeded(100);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("logs a warning and skips update when multiple conflicting groupings exist", async () => {
    vi.spyOn(memberModule, "collectGroupingMemberIds").mockResolvedValue([100, 101]);
    vi.spyOn(prisma.animeGrouping, "findMany").mockResolvedValueOnce([
      { id: 1, displayAnimeId: 100 } as any,
      { id: 2, displayAnimeId: 101 } as any,
    ]);
    const warnSpy = vi.spyOn(logger, "warn");
    const updateSpy = vi.spyOn(prisma.animeGrouping, "update");

    await updateAnimeGroupingIfNeeded(100);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Multiple anime groupings found"));
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("updates the single grouping to include all collected member IDs", async () => {
    vi.spyOn(memberModule, "collectGroupingMemberIds").mockResolvedValue([10, 20, 30]);
    vi.spyOn(prisma.animeGrouping, "findMany").mockResolvedValueOnce([
      { id: 42, displayAnimeId: 10 } as any,
    ]);
    const updateSpy = vi.spyOn(prisma.animeGrouping, "update").mockResolvedValueOnce({} as any);

    await updateAnimeGroupingIfNeeded(10);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 42 },
      data: {
        items: {
          set: [{ anilistId: 10 }, { anilistId: 20 }, { anilistId: 30 }],
        },
      },
    });
  });
});
