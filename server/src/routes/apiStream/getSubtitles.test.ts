import { expect, test, describe, vi, beforeEach } from "vitest";
import { resolveEpisodeSubtitles } from "./getSubtitles";
import { app } from "$src/app";
import { registry } from "@ant.ms/anily-providers";
import * as jimakuModule from "$src/services/jimaku";
import { generateStreamSignature } from "@medialy/stream-core";
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
    expect(result.subtitles!.length).toBeGreaterThanOrEqual(2);

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

  test("resolveEpisodeSubtitles includes Jimaku Japanese subtitles and enables them by default in native mode", async () => {
    vi.spyOn(registry, "resolveStream").mockResolvedValueOnce({
      url: "https://example.com/video.mp4",
      container: "mp4",
      subtitles: [
        {
          label: "English",
          language: "en",
          url: "https://example.com/sub/en.vtt",
          default: true,
        },
      ],
    } as any);

    vi.spyOn(jimakuModule, "getJimakuSubtitlesForEpisode").mockResolvedValueOnce([
      {
        label: "Japanese [Furigana] (Jimaku)",
        language: "ja",
        url: "http://localhost:3000/api/stream/subtitles/track?url=https%3A%2F%2Fjimaku.cc%2Fsub.ass&furigana=1",
        default: true,
      },
      {
        label: "Japanese (Jimaku)",
        language: "ja",
        url: "http://localhost:3000/api/stream/subtitles/track?url=https%3A%2F%2Fjimaku.cc%2Fsub.ass",
        default: false,
      },
    ]);

    const result = await resolveEpisodeSubtitles(27809, {
      providerId: "mock-provider",
      identifier: "mock-id",
      language: "native",
      origin: "http://localhost:3000",
    });

    expect(result.subtitles).toBeDefined();
    expect(result.subtitles!.length).toBe(3);

    // In native mode, English subtitle must NOT be default
    const enSub = result.subtitles!.find((s) => s.language === "en");
    expect(enSub?.default).toBe(false);

    // Japanese Furigana subtitle must be default in native mode
    const furiSub = result.subtitles!.find((s) => s.label.includes("Furigana"));
    expect(furiSub).toBeDefined();
    expect(furiSub?.default).toBe(true);
  });

  test("GET /api/stream/subtitles/track serves WebVTT and transforms Japanese to Furigana", async () => {
    const rawAss = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:01:00.00,0:01:03.00,Default,,0,0,0,,魔法の杖`;

    vi.spyOn(jimakuModule, "downloadJimakuSubtitleText").mockResolvedValueOnce({
      text: rawAss,
      format: "ass",
    });

    const expires = Math.floor(Date.now() / 1000) + 3600;
    const testUrl = "https://example.com/sub.ass";
    const sig = generateStreamSignature(testUrl, expires);

    const res = await app.request(
      `/api/stream/subtitles/track?url=${encodeURIComponent(testUrl)}&furigana=1&expires=${expires}&sig=${sig}`,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/vtt");
    const body = await res.text();
    expect(body).toContain("WEBVTT");
    expect(body).toContain("00:01:00.000 --> 00:01:03.000");
    expect(body).toMatch(/<ruby>魔法<rt>まほう<\/rt><\/ruby>/);
  });
});
