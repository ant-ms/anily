import { describe, it, expect } from "vitest";
import { buildChains } from "./buildAnimeGroupings";
import { AnimeRelationType } from "../../../generated/prisma/enums";

describe("buildAnimeGroupings - buildChains", () => {
  it("returns empty grouping for empty array", () => {
    const result = buildChains([]);
    expect(result.chains).toEqual([]);
    expect(result.notInChain).toEqual([]);
  });

  it("places standalone anime with no relations into notInChain", () => {
    const anime1 = { anilistId: 101, relationsOut: [] };
    const anime2 = { anilistId: 102, relationsOut: [] };

    const result = buildChains([anime1, anime2]);
    expect(result.chains.length).toBe(0);
    expect(result.notInChain.map((a) => a.anilistId)).toEqual([101, 102]);
  });

  it("builds a linear chain of seasons (S1 -> S2 -> S3)", () => {
    const s1 = {
      anilistId: 1,
      relationsOut: [
        { relationType: AnimeRelationType.SEQUEL, toAnimeId: 2 },
      ],
    };
    const s2 = {
      anilistId: 2,
      relationsOut: [
        { relationType: AnimeRelationType.PREQUEL, toAnimeId: 1 },
        { relationType: AnimeRelationType.SEQUEL, toAnimeId: 3 },
      ],
    };
    const s3 = {
      anilistId: 3,
      relationsOut: [
        { relationType: AnimeRelationType.PREQUEL, toAnimeId: 2 },
      ],
    };

    const result = buildChains([s3, s1, s2]); // test order independence
    expect(result.chains.length).toBe(1);
    expect(result.notInChain.length).toBe(0);

    const head = result.chains[0];
    expect(head.anime.anilistId).toBe(1);
    expect(head.children.length).toBe(1);

    const second = head.children[0];
    expect(second.anime.anilistId).toBe(2);
    expect(second.children.length).toBe(1);

    const third = second.children[0];
    expect(third.anime.anilistId).toBe(3);
    expect(third.children.length).toBe(0);
  });

  it("handles a forked chain (e.g. S1 branching into S2 and a concurrent Movie)", () => {
    const s1 = {
      anilistId: 10,
      relationsOut: [
        { relationType: AnimeRelationType.SEQUEL, toAnimeId: 11 },
        { relationType: AnimeRelationType.SEQUEL, toAnimeId: 12 },
      ],
    };
    const s2 = {
      anilistId: 11,
      relationsOut: [
        { relationType: AnimeRelationType.PREQUEL, toAnimeId: 10 },
      ],
    };
    const movie = {
      anilistId: 12,
      relationsOut: [
        { relationType: AnimeRelationType.PREQUEL, toAnimeId: 10 },
      ],
    };

    const result = buildChains([s1, s2, movie]);
    expect(result.chains.length).toBe(1);
    expect(result.notInChain.length).toBe(0);

    const head = result.chains[0];
    expect(head.anime.anilistId).toBe(10);
    expect(head.children.length).toBe(2);
    const childIds = head.children.map((c) => c.anime.anilistId).sort();
    expect(childIds).toEqual([11, 12]);
  });

  it("separates valid chains from unrelated standalone entries in the same grouping", () => {
    const s1 = {
      anilistId: 201,
      relationsOut: [
        { relationType: AnimeRelationType.SEQUEL, toAnimeId: 202 },
      ],
    };
    const s2 = {
      anilistId: 202,
      relationsOut: [
        { relationType: AnimeRelationType.PREQUEL, toAnimeId: 201 },
      ],
    };
    const standalone = {
      anilistId: 300,
      relationsOut: [],
    };

    const result = buildChains([s2, standalone, s1]);
    expect(result.chains.length).toBe(1);
    expect(result.chains[0].anime.anilistId).toBe(201);
    expect(result.chains[0].children[0].anime.anilistId).toBe(202);

    expect(result.notInChain.length).toBe(1);
    expect(result.notInChain[0].anilistId).toBe(300);
  });

  it("does not duplicate re-converging sequels in a diamond graph (S1 -> S2A & S2B -> S3)", () => {
    const s1 = {
      anilistId: 1001,
      relationsOut: [
        { relationType: AnimeRelationType.SEQUEL, toAnimeId: 1002 },
        { relationType: AnimeRelationType.SEQUEL, toAnimeId: 1003 },
      ],
    };
    const s2a = {
      anilistId: 1002,
      relationsOut: [
        { relationType: AnimeRelationType.PREQUEL, toAnimeId: 1001 },
        { relationType: AnimeRelationType.SEQUEL, toAnimeId: 1004 },
      ],
    };
    const s2b = {
      anilistId: 1003,
      relationsOut: [
        { relationType: AnimeRelationType.PREQUEL, toAnimeId: 1001 },
        { relationType: AnimeRelationType.SEQUEL, toAnimeId: 1004 },
      ],
    };
    const s3 = {
      anilistId: 1004,
      relationsOut: [
        { relationType: AnimeRelationType.PREQUEL, toAnimeId: 1002 },
        { relationType: AnimeRelationType.PREQUEL, toAnimeId: 1003 },
      ],
    };

    const result = buildChains([s3, s2b, s1, s2a]);
    expect(result.chains.length).toBe(1);
    expect(result.notInChain.length).toBe(0);

    // Flatten all anilistIds in the chain tree and ensure 1004 appears only once
    const collectIds = (node: any): number[] => [
      node.anime.anilistId,
      ...node.children.flatMap(collectIds),
    ];
    const allIds = collectIds(result.chains[0]);
    expect(allIds.filter((id) => id === 1004).length).toBe(1);
    expect(allIds.sort()).toEqual([1001, 1002, 1003, 1004]);
  });
});
