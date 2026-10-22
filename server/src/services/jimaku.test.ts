import { describe, it, expect, vi, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import {
  searchJimakuEntry,
  fetchJimakuFiles,
  downloadJimakuSubtitleText,
  getJimakuSubtitlesForEpisode,
} from "./jimaku";

describe("Jimaku Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("searches Jimaku entry by anilist_id and falls back to title", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("[]", { status: 200 })) // anilist_id not found
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 12345, name: "Sousou no Frieren" }]), {
          status: 200,
        }),
      ); // title match

    const id = await searchJimakuEntry(99999, ["Sousou no Frieren"], "mock-api-key");
    expect(id).toBe(12345);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("filters and resolves subtitle files for an episode", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { name: "[Fansub] Show - 01.ass", url: "/api/files/download/123", size: 1024 },
          { name: "image.png", url: "/api/files/download/456", size: 2048 },
          { name: "batch.zip", url: "https://jimaku.cc/api/files/download/789", size: 4096 },
        ]),
        { status: 200 },
      ),
    );

    const files = await fetchJimakuFiles(12345, 1, "mock-api-key");
    expect(files.length).toBe(2);
    expect(files[0].name).toBe("[Fansub] Show - 01.ass");
    expect(files[0].url).toBe("https://jimaku.cc/api/files/download/123");
    expect(files[1].name).toBe("batch.zip");
    expect(files[1].url).toBe("https://jimaku.cc/api/files/download/789");
  });

  it("extracts matching episode subtitle from a zip buffer", async () => {
    const zip = new AdmZip();
    zip.addFile("Show - Ep 01.ass", Buffer.from("Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,テスト1"));
    zip.addFile("Show - Ep 02.ass", Buffer.from("Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,テスト2"));
    const zipBuffer = zip.toBuffer();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(new Uint8Array(zipBuffer), {
        status: 200,
        headers: { "Content-Type": "application/zip" },
      }),
    );

    const result = await downloadJimakuSubtitleText("https://example.com/subs.zip", 2);
    expect(result).not.toBeNull();
    expect(result!.format).toBe("ass");
    expect(result!.text).toContain("テスト2");
  });

  it("generates signed subtitle tracks with furigana option and native default support", async () => {
    process.env.JIMAKU_API_KEY = "test-token";

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 54321 }]), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { name: "Ep 01.ass", url: "https://jimaku.cc/files/ep01.ass", size: 500 },
          ]),
          { status: 200 },
        ),
      );

    const tracks = await getJimakuSubtitlesForEpisode(154587, 1, ["Frieren"], {
      origin: "http://localhost:3000",
      expires: 1800000000,
      isNativeDefault: true,
    });

    expect(tracks.length).toBe(2);
    const furiTrack = tracks[0];
    expect(furiTrack.label).toContain("Furigana");
    expect(furiTrack.default).toBe(true);
    expect(furiTrack.url).toContain("furigana=1");
    expect(furiTrack.url).toContain("/api/stream/subtitles/track");
    expect(furiTrack.url).toContain("sig=");

    const plainTrack = tracks[1];
    expect(plainTrack.label).toBe("Japanese (Jimaku)");
    expect(plainTrack.default).toBe(false);
    expect(plainTrack.url).not.toContain("furigana=1");
  });
});
