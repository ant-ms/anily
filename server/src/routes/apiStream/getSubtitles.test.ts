import { expect, test, describe, vi, beforeEach } from "vitest";
import { resolveEpisodeSubtitles } from "./getSubtitles";
import { app } from "$src/app";
import { registry } from "@ant.ms/anily-providers";
import "./index";

describe("Subtitles Service & Route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("resolveEpisodeSubtitles returns notFound=true for non-existent episode ID", async () => {
    const result = await resolveEpisodeSubtitles(99999999, {
      origin: "http://localhost:3000",
    });
    expect(result.notFound).toBe(true);
  });

  test("GET /api/stream/subtitles/:episodeId returns 404 for unknown episode", async () => {
    const res = await app.request("/api/stream/subtitles/99999999");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Episode not found");
  });

  test("resolveEpisodeSubtitles correctly formats subtitle tracks with HMAC signed proxy URLs", async () => {
    vi.spyOn(registry, "resolveStream").mockResolvedValueOnce({
      url: "https://example.com/video.mp4",
      container: "mp4",
      headers: { Referer: "https://example.com/ref" },
      subtitles: [
        {
          label: "English",
          language: "en",
          url: "https://example.com/sub/en.vtt",
          default: true,
        },
        {
          label: "Spanish",
          language: "es",
          url: "https://example.com/sub/es.vtt",
          default: false,
        },
      ],
    } as any);

    const result = await resolveEpisodeSubtitles(27809, {
      providerId: "mock-provider",
      identifier: "mock-id",
      language: "sub",
      origin: "http://localhost:3000",
    });

    expect(result.notFound).toBeUndefined();
    expect(result.subtitles).toBeDefined();
    expect(result.subtitles!.length).toBe(2);

    const enSub = result.subtitles![0];
    expect(enSub.label).toBe("English");
    expect(enSub.language).toBe("en");
    expect(enSub.default).toBe(true);
    expect(enSub.url).toContain("http://localhost:3000/api/stream/proxy/sub_en.vtt");
    expect(enSub.url).toContain("sig=");
    expect(enSub.url).toContain("expires=");
    expect(enSub.url).toContain(encodeURIComponent("https://example.com/sub/en.vtt"));

    const esSub = result.subtitles![1];
    expect(esSub.label).toBe("Spanish");
    expect(esSub.language).toBe("es");
    expect(esSub.default).toBe(false);
  });
});
