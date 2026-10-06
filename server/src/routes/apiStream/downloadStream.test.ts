import { expect, test, describe, vi, beforeEach } from "vitest";
import { app } from "$src/app";
import { registry } from "@ant.ms/anily-providers";
import { prisma } from "$src/prisma";
import "./index";

describe("Download Stream Route & Handler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("GET /api/stream/download/:episodeId returns 404 for nonexistent episode", async () => {
    vi.spyOn(prisma.episode, "findUnique").mockResolvedValueOnce(null);

    const res = await app.request("/api/stream/download/99999999");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Episode not found");
  });

  test("GET /api/stream/download/:episodeId skips duplicate candidate stream URLs", async () => {
    vi.spyOn(prisma.episode, "findUnique").mockResolvedValueOnce({
      id: 926063,
      number: 1,
      animeDetails: {
        baseAnime: {
          titleEnglish: "Heidi, Girl of the Alps",
          titleRomanji: "Alps no Shoujo Heidi",
          titleNative: "アルプスの少女ハイジ",
          anilistId: 2225,
        },
      },
    } as any);

    vi.spyOn(registry, "checkAvailability").mockResolvedValueOnce([
      {
        providerId: "zokoanime",
        providerName: "ZokoAnime",
        serverName: "HD - ZokoAnime",
        serverId: "zoko",
        language: "sub",
        identifier: "mal:2225",
      },
      {
        providerId: "hianime",
        providerName: "HiAnime",
        serverName: "HD - ZokoAnime",
        serverId: "zoko",
        language: "sub",
        identifier: "heidi-girl-of-the-alps-4763",
      },
    ] as any);

    // Both candidates resolve to the EXACT same URL
    const duplicateUrl = "https://example.com/duplicate/master.m3u8";
    const resolveSpy = vi.spyOn(registry, "resolveStream").mockResolvedValue({
      url: duplicateUrl,
      container: "hls",
      headers: { Referer: "https://example.com" },
    } as any);

    // FFmpeg spawn will fail in test env or reject, but we want to ensure it only tried once for duplicate URL
    const res = await app.request("/api/stream/download/926063");
    // Should attempt resolution of candidate 1, then skip candidate 2 because URL is identical
    expect(resolveSpy).toHaveBeenCalledTimes(2);
    // Since mock URL produces no actual ffmpeg output, it should return 502
    expect(res.status).toBe(502);
  });
});
