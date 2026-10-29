import { describe, it, expect, vi, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import {
  searchJimakuEntry,
  fetchJimakuFiles,
  downloadJimakuSubtitleText,
  getJimakuSubtitlesForEpisode,
  scoreJimakuFile,
  extractReleaseTag,
  clearEntryCache,
} from "./jimaku";

describe("Jimaku Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearEntryCache();
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

  it("prioritizes SubsPlease/Web-DL over TV broadcast files and creates multiple release tracks", async () => {
    process.env.JIMAKU_API_KEY = "test-token";

    expect(scoreJimakuFile("[SubsPlease] Ep 01.ass")).toBeGreaterThan(scoreJimakuFile("[Ohys-Raws] Ep 01 (TV).ass"));
    expect(extractReleaseTag("[SubsPlease] Ep 01.ass")).toBe("SubsPlease");
    expect(extractReleaseTag("Show - Ep 01 (Netflix).vtt")).toBe("Netflix");

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 54321 }]), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { name: "[Ohys-Raws] Ep 01 (TV).ass", url: "https://jimaku.cc/files/tv.ass", size: 500 },
            { name: "[SubsPlease] Ep 01.ass", url: "https://jimaku.cc/files/subsplease.ass", size: 600 },
            { name: "[Netflix] Ep 01.vtt", url: "https://jimaku.cc/files/netflix.vtt", size: 400 },
          ]),
          { status: 200 },
        ),
      );

    const tracks = await getJimakuSubtitlesForEpisode(154587, 1, ["Frieren"], {
      origin: "http://localhost:3000",
      expires: 1800000000,
      isNativeDefault: true,
      refSubUrl: "http://localhost:3000/api/stream/proxy/sub_en.vtt?url=https%3A%2F%2Fexample.com%2Fen.vtt",
    });

    // 2 candidates: SubsPlease (highest) and Netflix (2nd distinct), each with Furigana and Plain = 4 tracks
    expect(tracks.length).toBe(4);
    expect(tracks[0].label).toBe("Japanese [Furigana] (Jimaku - SubsPlease)");
    expect(tracks[0].default).toBe(true);
    expect(tracks[0].url).toContain("refSub=");
    expect(tracks[1].label).toBe("Japanese (Jimaku - SubsPlease)");
    expect(tracks[2].label).toBe("Japanese [Furigana] (Jimaku - Netflix)");
    expect(tracks[2].default).toBe(false);
    expect(tracks[3].label).toBe("Japanese (Jimaku - Netflix)");
  });
});
