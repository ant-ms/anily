import { describe, it, expect, vi, beforeEach } from "vitest";
import { collectGroupingMemberIds } from "./collectGroupingMemberIds";
import { prisma } from "$src/prisma";
import { AnimeRelationType } from "../../../generated/prisma/enums";

describe("collectGroupingMemberIds", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns only the root anime when there are no relations", async () => {
    vi.spyOn(prisma.baseAnime, "findUniqueOrThrow").mockResolvedValueOnce({
      anilistId: 100,
      relationsIn: [],
      relationsOut: [],
    } as any);

    const members = await collectGroupingMemberIds(100);
    expect(members).toEqual([100]);
  });

  it("traverses franchise relations across relationsIn and relationsOut", async () => {
    vi.spyOn(prisma.baseAnime, "findUniqueOrThrow").mockImplementation((async ({ where }: any) => {
      const id = where.anilistId;
      if (id === 1) {
        return {
          anilistId: 1,
          relationsIn: [],
          relationsOut: [
            { fromAnimeId: 1, toAnimeId: 2, relationType: AnimeRelationType.SEQUEL },
          ],
        } as any;
      }
      if (id === 2) {
        return {
          anilistId: 2,
          relationsIn: [
            { fromAnimeId: 1, toAnimeId: 2, relationType: AnimeRelationType.SEQUEL },
          ],
          relationsOut: [
            { fromAnimeId: 2, toAnimeId: 3, relationType: AnimeRelationType.SIDE_STORY },
          ],
        } as any;
      }
      if (id === 3) {
        return {
          anilistId: 3,
          relationsIn: [
            { fromAnimeId: 2, toAnimeId: 3, relationType: AnimeRelationType.SIDE_STORY },
          ],
          relationsOut: [],
        } as any;
      }
      throw new Error(`Unexpected id: ${id}`);
    }) as any);

    const members = await collectGroupingMemberIds(1);
    expect(members.sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("ignores non-grouping relation types like ADAPTATION and OTHER", async () => {
    vi.spyOn(prisma.baseAnime, "findUniqueOrThrow").mockResolvedValueOnce({
      anilistId: 10,
      relationsIn: [],
      relationsOut: [
        { fromAnimeId: 10, toAnimeId: 999, relationType: AnimeRelationType.ADAPTATION },
        { fromAnimeId: 10, toAnimeId: 888, relationType: AnimeRelationType.OTHER },
        { fromAnimeId: 10, toAnimeId: 20, relationType: AnimeRelationType.ALTERNATIVE },
      ],
    } as any);

    vi.spyOn(prisma.baseAnime, "findUniqueOrThrow").mockResolvedValueOnce({
      anilistId: 20,
      relationsIn: [
        { fromAnimeId: 10, toAnimeId: 20, relationType: AnimeRelationType.ALTERNATIVE },
      ],
      relationsOut: [],
    } as any);

    const members = await collectGroupingMemberIds(10);
    expect(members.sort((a, b) => a - b)).toEqual([10, 20]);
    expect(members).not.toContain(999);
    expect(members).not.toContain(888);
  });

  it("handles cyclical relations without infinite recursion", async () => {
    vi.spyOn(prisma.baseAnime, "findUniqueOrThrow").mockImplementation((async ({ where }: any) => {
      const id = where.anilistId;
      if (id === 1) {
        return {
          anilistId: 1,
          relationsIn: [{ fromAnimeId: 2, toAnimeId: 1, relationType: AnimeRelationType.PREQUEL }],
          relationsOut: [{ fromAnimeId: 1, toAnimeId: 2, relationType: AnimeRelationType.SEQUEL }],
        } as any;
      }
      if (id === 2) {
        return {
          anilistId: 2,
          relationsIn: [{ fromAnimeId: 1, toAnimeId: 2, relationType: AnimeRelationType.SEQUEL }],
          relationsOut: [{ fromAnimeId: 2, toAnimeId: 1, relationType: AnimeRelationType.PREQUEL }],
        } as any;
      }
      throw new Error(`Unexpected id: ${id}`);
    }) as any);

    const members = await collectGroupingMemberIds(1);
    expect(members.sort((a, b) => a - b)).toEqual([1, 2]);
  });
});
