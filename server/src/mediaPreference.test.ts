import { describe, it, expect, beforeEach } from "vitest";
import {
  pickBestService,
  buildPlayerUrl,
  getStoredLanguagePreference,
  setStoredLanguagePreference,
  type AvailableService,
} from "../../client/src/types/Media";

describe("Media preferences and native audio option", () => {
  beforeEach(() => {
    // Mock localStorage in node environment
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    };
  });

  describe("getStoredLanguagePreference & setStoredLanguagePreference", () => {
    it("defaults to 'sub' when nothing is stored", () => {
      expect(getStoredLanguagePreference()).toBe("sub");
    });

    it("stores and retrieves 'native'", () => {
      setStoredLanguagePreference("native");
      expect(getStoredLanguagePreference()).toBe("native");
    });

    it("stores and retrieves 'sub' and 'dub'", () => {
      setStoredLanguagePreference("dub");
      expect(getStoredLanguagePreference()).toBe("dub");

      setStoredLanguagePreference("sub");
      expect(getStoredLanguagePreference()).toBe("sub");
    });

    it("defaults to 'sub' on invalid values", () => {
      localStorage.setItem("anily_lang_pref", "invalid_value");
      expect(getStoredLanguagePreference()).toBe("sub");
    });
  });

  describe("pickBestService with native preference", () => {
    const mockServices: AvailableService[] = [
      {
        providerId: "prov1",
        providerName: "Provider 1",
        serverId: "hd-1",
        serverName: "HD 1080p",
        identifier: "id-1",
        language: "sub",
      },
      {
        providerId: "prov2",
        providerName: "Provider 2",
        serverId: "hd-2",
        serverName: "HD 1080p",
        identifier: "id-2",
        language: "dub",
      },
      {
        providerId: "prov1",
        providerName: "Provider 1",
        serverId: "sd-1",
        serverName: "SD 480p",
        identifier: "id-3",
        language: "sub",
      },
    ];

    it("picks highest quality 'sub' service when preference is 'native'", () => {
      const best = pickBestService(mockServices, "native");
      expect(best).not.toBeNull();
      expect(best?.language).toBe("sub");
      expect(best?.serverName).toBe("HD 1080p");
    });

    it("picks 'sub' service when preference is 'sub'", () => {
      const best = pickBestService(mockServices, "sub");
      expect(best).not.toBeNull();
      expect(best?.language).toBe("sub");
      expect(best?.serverName).toBe("HD 1080p");
    });

    it("picks 'dub' service when preference is 'dub'", () => {
      const best = pickBestService(mockServices, "dub");
      expect(best).not.toBeNull();
      expect(best?.language).toBe("dub");
      expect(best?.serverName).toBe("HD 1080p");
    });

    it("falls back to available service if requested language not present", () => {
      const dubOnly: AvailableService[] = [
        {
          providerId: "prov1",
          providerName: "Provider 1",
          serverId: "s1",
          serverName: "Server 1",
          identifier: "id-1",
          language: "dub",
        },
      ];
      const best = pickBestService(dubOnly, "native");
      expect(best).not.toBeNull();
      expect(best?.language).toBe("dub");
    });
  });

  describe("buildPlayerUrl with native preference", () => {
    const mediaUrl = "https://example.com/stream.m3u8";
    const subtitles = [
      { url: "https://example.com/sub.vtt", label: "English", language: "en", default: true },
    ];

    it("sets sub-visibility to 'no' for mpv when preference is native", () => {
      setStoredLanguagePreference("native");
      const url = buildPlayerUrl(mediaUrl, "mpv", subtitles);
      expect(url).toContain('--sub-file="https://example.com/sub.vtt"');
      expect(url).toContain("--sub-visibility=no");
      expect(url).not.toContain("--sub-visibility=yes");
    });

    it("sets sub-visibility to 'yes' for mpv when preference is sub", () => {
      setStoredLanguagePreference("sub");
      const url = buildPlayerUrl(mediaUrl, "mpv", subtitles);
      expect(url).toContain('--sub-file="https://example.com/sub.vtt"');
      expect(url).toContain("--sub-visibility=yes");
      expect(url).not.toContain("--sub-visibility=no");
    });

    it("sets mpv_sub-visibility to 'no' for iina when preference is native", () => {
      setStoredLanguagePreference("native");
      const url = buildPlayerUrl(mediaUrl, "iina", subtitles);
      expect(url).toContain("mpv_sub-visibility=no");
      expect(url).toContain("mpv_sub-files=");
    });

    it("sets mpv_sub-visibility to 'yes' for iina when preference is sub", () => {
      setStoredLanguagePreference("sub");
      const url = buildPlayerUrl(mediaUrl, "iina", subtitles);
      expect(url).toContain("mpv_sub-visibility=yes");
      expect(url).toContain("mpv_sub-files=");
    });
  });

  describe("player subtitle selection behavior", () => {
    function computeInitialSubtitleIndex(
      prefLang: "sub" | "dub" | "native",
      subtitles?: Array<{ default?: boolean; language?: string; label?: string }>,
    ): number {
      if (prefLang !== "native" && subtitles && subtitles.length > 0) {
        const defIdx = subtitles.findIndex((s) => s.default);
        if (defIdx >= 0) {
          return defIdx;
        } else {
          const enIdx = subtitles.findIndex(
            (s) =>
              (s.language || "").toLowerCase().startsWith("en") ||
              (s.label || "").toLowerCase().includes("english"),
          );
          return enIdx >= 0 ? enIdx : 0;
        }
      }
      return -1;
    }

    const testSubtitles = [
      { default: false, language: "ja", label: "Japanese" },
      { default: true, language: "en", label: "English" },
    ];

    it("does not enable subtitles by default (-1) when preference is native", () => {
      const idx = computeInitialSubtitleIndex("native", testSubtitles);
      expect(idx).toBe(-1);
    });

    it("enables default subtitle when preference is sub", () => {
      const idx = computeInitialSubtitleIndex("sub", testSubtitles);
      expect(idx).toBe(1);
    });
  });
});
