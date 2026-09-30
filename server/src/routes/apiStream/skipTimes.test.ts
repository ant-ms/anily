import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  fetchAniSkipTimes,
  getEpisodeSkipTimes,
  skipTimesCache,
} from "./skipTimes";
import { app } from "$src/app";
import { prisma } from "$src/prisma";
import "./index";

describe("Skip Times Service & API", () => {
  beforeEach(() => {
    skipTimesCache.clear();
    vi.restoreAllMocks();
  });

  test("fetchAniSkipTimes correctly parses and structures AniSkip response", async () => {
    const mockApiResponse = {
      found: true,
      results: [
        {
          interval: { startTime: 120.5, endTime: 210.5 },
          skipType: "op",
          skipId: "test-op-1",
          episodeLength: 1440,
        },
        {
          interval: { startTime: 1350.0, endTime: 1435.0 },
          skipType: "ed",
          skipId: "test-ed-1",
          episodeLength: 1440,
        },
      ],
      statusCode: 200,
    };

    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async () => {
      return new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const result = await fetchAniSkipTimes(16498, 1, 1440);

    expect(result.found).toBe(true);
    expect(result.results.length).toBe(2);
    expect(result.op).toEqual({ startTime: 120.5, endTime: 210.5 });
    expect(result.ed).toEqual({ startTime: 1350.0, endTime: 1435.0 });
    expect(result.recap).toBeUndefined();
  });

  test("fetchAniSkipTimes falls back to episodeLength=0 when duration-specific query yields no results", async () => {
    const mockFallbackResponse = {
      found: true,
      results: [
        {
          interval: { startTime: 45.0, endTime: 135.0 },
          skipType: "op",
          skipId: "fallback-op-1",
          episodeLength: 1460,
        },
      ],
      statusCode: 200,
    };

    let fetchCallCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      fetchCallCount++;
      const urlStr = String(url);
      if (urlStr.includes("episodeLength=1440")) {
        return new Response(JSON.stringify({ found: false, results: [] }), { status: 404 });
      }
      if (urlStr.includes("episodeLength=0")) {
        return new Response(JSON.stringify(mockFallbackResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const result = await fetchAniSkipTimes(5114, 1, 1440);

    expect(fetchCallCount).toBe(2);
    expect(result.found).toBe(true);
    expect(result.op).toEqual({ startTime: 45.0, endTime: 135.0 });
  });

  test("fetchAniSkipTimes returns found=false gracefully on 404 or network errors", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify({ found: false, results: [] }), { status: 404 });
    });

    const result = await fetchAniSkipTimes(999999, 9999, 1440);

    expect(result.found).toBe(false);
    expect(result.results).toEqual([]);
    expect(result.op).toBeUndefined();
    expect(result.ed).toBeUndefined();
  });

  test("skipTimesCache caches results and avoids duplicate API calls", async () => {
    let apiCallCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      apiCallCount++;
      return new Response(
        JSON.stringify({
          found: true,
          results: [{ interval: { startTime: 10, endTime: 100 }, skipType: "op" }],
        }),
        { status: 200 },
      );
    });

    const first = await fetchAniSkipTimes(1234, 1, 1440);
    const second = await fetchAniSkipTimes(1234, 1, 1440);

    expect(apiCallCount).toBe(1);
    expect(first.op).toEqual(second.op);
  });

  test("getEpisodeSkipTimes returns notFound=true for non-existent episode ID", async () => {
    const result = await getEpisodeSkipTimes(99999999);
    expect(result.notFound).toBe(true);
    expect(result.found).toBe(false);
  });

  test("GET /api/stream/skip-times/:episodeId returns 404 for unknown episode", async () => {
    const res = await app.request("/api/stream/skip-times/99999999");
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Episode not found");
  });

  test("GET /api/stream/skip-times/:episodeId returns skip times for valid episode", async () => {
    // Check if an existing episode is in DB
    const episode = await prisma.episode.findFirst({
      include: {
        animeDetails: {
          include: {
            baseAnime: true,
          },
        },
      },
    });

    if (episode && episode.animeDetails.baseAnime.malId) {
      vi.spyOn(globalThis, "fetch").mockImplementationOnce(async () => {
        return new Response(
          JSON.stringify({
            found: true,
            results: [{ interval: { startTime: 30, endTime: 120 }, skipType: "op" }],
          }),
          { status: 200 },
        );
      });

      const res = await app.request(`/api/stream/skip-times/${episode.id}?duration=1440`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.found).toBe(true);
      expect(data.op).toEqual({ startTime: 30, endTime: 120 });
    }
  });
});
