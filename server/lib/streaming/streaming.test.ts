import { describe, it, expect } from "vitest";
import { AnimeHubProvider } from "./providers/animehub";
import { HiAnimeProvider } from "./providers/hianime";
import { JustAnimeProvider } from "./providers/justanime";
import { ProviderRegistry } from "./registry";
import { getServiceScore } from "./qualityScore";
import { probeStreamHealth } from "./healthCheck";
import type { AvailableService } from "./types";

describe("Streaming Providers & Quality Benchmarks", () => {
  describe("Quality Score & Server Prioritization", () => {
    it("strictly prioritizes MegaPlay over all other servers", () => {
      const megaPlayService: AvailableService = {
        providerId: "justanime",
        providerName: "JustAnime",
        serverId: "megaplay",
        serverName: "HD - MegaPlay",
        language: "sub",
        identifier: "154587",
      };

      const zokoService: AvailableService = {
        providerId: "justanime",
        providerName: "JustAnime",
        serverId: "zokoanime",
        serverName: "HD - ZokoAnime",
        language: "sub",
        identifier: "154587",
      };

      const animeHubF5Service: AvailableService = {
        providerId: "animehub",
        providerName: "AnimeHub",
        serverId: "0",
        serverName: "F5 - HQ",
        language: "sub",
        identifier: "sousou-no-frieren",
      };

      const animeHubNoAdsService: AvailableService = {
        providerId: "animehub",
        providerName: "AnimeHub",
        serverId: "10",
        serverName: "No Ads 4",
        language: "sub",
        identifier: "sousou-no-frieren",
      };

      const megaScore = getServiceScore(megaPlayService);
      const zokoScore = getServiceScore(zokoService);
      const f5Score = getServiceScore(animeHubF5Service);
      const noAdsScore = getServiceScore(animeHubNoAdsService);

      expect(megaScore).toBeGreaterThan(zokoScore);
      expect(zokoScore).toBeGreaterThan(f5Score);
      expect(zokoScore).toBeGreaterThan(noAdsScore);

      // Verify sorting orders MegaPlay first, then Zoko, then demoted servers
      const list = [animeHubF5Service, zokoService, animeHubNoAdsService, megaPlayService];
      list.sort((a, b) => getServiceScore(b) - getServiceScore(a));

      expect(list[0].serverName).toContain("MegaPlay");
      expect(list[1].serverName).toContain("Zoko");
    });

    it("applies resolution bonuses correctly", () => {
      const hd1080Service: AvailableService = {
        providerId: "justanime",
        providerName: "JustAnime",
        serverId: "megaplay",
        serverName: "1080p MegaPlay",
        language: "sub",
        identifier: "1",
      };

      const hd720Service: AvailableService = {
        providerId: "justanime",
        providerName: "JustAnime",
        serverId: "megaplay",
        serverName: "720p MegaPlay",
        language: "sub",
        identifier: "1",
      };

      expect(getServiceScore(hd1080Service)).toBeGreaterThan(getServiceScore(hd720Service));
    });
  });

  describe("Deep Pre-Flight Health Check Probe", () => {
    it("validates healthy MegaPlay stream down to segment delivery", async () => {
      const provider = new JustAnimeProvider();
      const stream = await provider.getStream("154587", 1, "sub", "megaplay");
      expect(stream).not.toBeNull();

      const isHealthy = await probeStreamHealth(stream!, 4000);
      expect(isHealthy).toBe(true);
    }, 15000);

    it("validates healthy ZokoAnime stream down to segment delivery", async () => {
      const provider = new JustAnimeProvider();
      const stream = await provider.getStream("154587", 1, "sub", "zokoanime");
      expect(stream).not.toBeNull();

      const isHealthy = await probeStreamHealth(stream!, 4000);
      expect(isHealthy).toBe(true);
    }, 15000);

    it("rejects invalid or unreachable stream URLs gracefully", async () => {
      const badStream = {
        url: "https://invalid-non-existent-domain-404.buzz/master.m3u8",
        container: "hls" as const,
      };

      const isHealthy = await probeStreamHealth(badStream, 1500);
      expect(isHealthy).toBe(false);
    });
  });

  describe("JustAnimeProvider (Top-Tier Verified Provider)", () => {
    it("can search and find diverse anime", async () => {
      const provider = new JustAnimeProvider();
      const results = await provider.search("Frieren");

      expect(results.length).toBeGreaterThan(0);
      const frieren = results.find((r) => r.name.toLowerCase().includes("frieren"));
      expect(frieren).toBeDefined();
      expect(frieren?.identifier).toBeDefined();
    }, 15000);

    it("can get episodes and both MegaPlay and ZokoAnime servers", async () => {
      const provider = new JustAnimeProvider();
      const { episodes, servers } = await provider.getEpisodes("154587", "sub");

      expect(episodes.length).toBeGreaterThan(0);
      expect(episodes).toContain(1);
      expect(servers.some((s) => s.id === "megaplay")).toBe(true);
      expect(servers.some((s) => s.id === "zokoanime")).toBe(true);
    }, 15000);

    it("can resolve MegaPlay in 1080p full HD with multiple subtitles", async () => {
      const provider = new JustAnimeProvider();
      const stream = await provider.getStream("154587", 1, "sub", "megaplay");

      expect(stream).not.toBeNull();
      expect(stream?.url).toContain("http");
      expect(stream?.container).toBe("hls");
      expect(stream?.serverName).toContain("MegaPlay");
      expect(stream?.subtitles).toBeDefined();
      expect(stream?.subtitles!.length).toBeGreaterThan(0);
      expect(stream?.subtitles!.some((s) => s.language === "en")).toBe(true);
    }, 20000);

    it("can resolve ZokoAnime backup stream", async () => {
      const provider = new JustAnimeProvider();
      const stream = await provider.getStream("154587", 1, "sub", "zokoanime");

      expect(stream).not.toBeNull();
      expect(stream?.url).toContain("http");
      expect(stream?.serverName).toContain("ZokoAnime");
    }, 20000);

    it("achieves high-throughput streaming (>15 Mbps) on video segments", async () => {
      const provider = new JustAnimeProvider();
      const stream = await provider.getStream("154587", 1, "sub", "megaplay");
      expect(stream).not.toBeNull();

      // Fetch master manifest
      const masterRes = await fetch(stream!.url, { headers: stream!.headers });
      expect(masterRes.ok).toBe(true);
      const masterText = await masterRes.text();

      // Resolve variant playlist
      let mediaUrl = stream!.url;
      const lines = masterText.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
          const next = lines[i + 1]?.trim();
          if (next && !next.startsWith("#")) {
            mediaUrl = new URL(next, stream!.url).toString();
            break;
          }
        }
      }

      const mediaRes = await fetch(mediaUrl, { headers: stream!.headers });
      expect(mediaRes.ok).toBe(true);
      const mediaText = await mediaRes.text();

      const segLine = mediaText.split("\n").find((l) => !l.startsWith("#") && l.trim());
      expect(segLine).toBeDefined();
      const segUrl = new URL(segLine!.trim(), mediaUrl).toString();

      // Benchmark downloading the first video segment
      const t0 = Date.now();
      const segRes = await fetch(segUrl, { headers: stream!.headers });
      expect(segRes.ok).toBe(true);
      const buf = await segRes.arrayBuffer();
      const durationMs = Date.now() - t0;

      const sizeMb = buf.byteLength / (1024 * 1024);
      const throughputMbps = (buf.byteLength * 8) / (durationMs / 1000) / 1_000_000;

      expect(sizeMb).toBeGreaterThan(0.2); // Segment should be real media data (>200KB)
      expect(throughputMbps).toBeGreaterThan(15); // Must deliver >15 Mbps for smooth 1080p playback
    }, 25000);
  });

  describe("HiAnimeProvider", () => {
    it("can search and find an anime", async () => {
      const provider = new HiAnimeProvider();
      const results = await provider.search("Frieren Beyond Journey's End");

      expect(results.length).toBeGreaterThan(0);
      const frieren = results.find((r) => r.identifier.includes("frieren"));
      expect(frieren).toBeDefined();
      expect(frieren?.identifier).toBeDefined();
      expect(frieren?.languages).toContain("sub");
    }, 15000);

    it("can get episodes and servers", async () => {
      const provider = new HiAnimeProvider();
      const { episodes, servers } = await provider.getEpisodes("frieren-beyond-journeys-end-481", "sub");

      expect(episodes.length).toBeGreaterThan(0);
      expect(episodes).toContain(1);
      expect(servers.length).toBeGreaterThan(0);
      expect(servers[0].id).toBe("zoko");
    }, 15000);

    it("can resolve SUB stream source", async () => {
      const provider = new HiAnimeProvider();
      const stream = await provider.getStream("frieren-beyond-journeys-end-481", 1, "sub");

      expect(stream).not.toBeNull();
      expect(stream?.url).toContain(".m3u8");
      expect(stream?.container).toBe("hls");
      expect(stream?.headers?.Referer).toBeDefined();
    }, 20000);

    it("can resolve DUB stream source", async () => {
      const provider = new HiAnimeProvider();
      const stream = await provider.getStream("frieren-beyond-journeys-end-481", 1, "dub");

      expect(stream).not.toBeNull();
      expect(stream?.url).toContain(".m3u8");
      expect(stream?.container).toBe("hls");
    }, 20000);
  });

  describe("AnimeHubProvider", () => {
    it("can search and find an anime", async () => {
      const provider = new AnimeHubProvider();
      const results = await provider.search("Sousou no Frieren");

      expect(results.length).toBeGreaterThan(0);
      const frieren = results.find((r) => r.identifier.includes("frieren"));
      expect(frieren).toBeDefined();
      expect(frieren?.identifier).toBeDefined();
    }, 15000);

    it("can get episodes and servers", async () => {
      const provider = new AnimeHubProvider();
      const { episodes, servers } = await provider.getEpisodes("sousou-no-frieren", "sub");

      expect(episodes.length).toBeGreaterThan(0);
      expect(episodes).toContain(1);
      expect(servers.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe("ProviderRegistry & Stream Proxy", () => {
    it("returns available services ranked with top performance servers first", async () => {
      const registry = new ProviderRegistry();
      const services = await registry.checkAvailability(
        ["Sousou no Frieren", "Frieren: Beyond Journey's End"],
        1,
      );

      expect(services.length).toBeGreaterThan(0);
      const providerIds = new Set(services.map((s) => s.providerId));
      expect(providerIds.has("justanime")).toBe(true);

      // Verify the top ranked service is a high-performance HD server (MegaPlay or ZokoAnime)
      const topService = services[0];
      expect(topService.serverName.toLowerCase()).toMatch(/megaplay|zoko/);
    }, 25000);

    it("apiStream proxy rewrites master and child m3u8 playlists correctly", async () => {
      const { app } = await import("$src/app");
      await import("$src/routes/apiStream");
      const { generateStreamSignature } = await import("./hmac");

      const masterUrl = "https://hls2.aniwatchtv.uk/v/scxqicy/huanbc9tmy/nyvrcjopy8/xaprjusg9l2rwy/master.m3u8";
      const referer = "https://zokoanime.video/";
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const sig = generateStreamSignature(masterUrl, expires);

      // 1. Request master playlist via proxy
      const proxyUrl = `/api/stream/proxy?url=${encodeURIComponent(masterUrl)}&ref=${encodeURIComponent(referer)}&expires=${expires}&sig=${sig}`;
      const res = await app.request(proxyUrl);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("mpegurl");
      const body = await res.text();
      expect(body).toContain("#EXTM3U");
      expect(body).toContain("/api/stream/proxy/index.m3u8?url=");

      // 2. Extract first child playlist URL
      const childLine = body.split("\n").find((l) => l.includes("/api/stream/proxy/index.m3u8?url="));
      expect(childLine).toBeDefined();

      // 3. Request child playlist via proxy
      const childRes = await app.request(childLine!.trim());
      expect(childRes.status).toBe(200);
      expect(childRes.headers.get("content-type")).toContain("mpegurl");
      const childBody = await childRes.text();
      expect(childBody).toContain("#EXTM3U");
      expect(childBody).toMatch(/\/api\/stream\/proxy\/seg_\d+\.ts\?url=/);

      // 4. Test OPTIONS request for CORS preflight
      const optionsRes = await app.request("/api/stream/proxy", { method: "OPTIONS" });
      expect(optionsRes.status).toBe(204);
      expect(optionsRes.headers.get("access-control-allow-origin")).toBe("*");

      // 5. Test HEAD request on master playlist
      const headRes = await app.request(proxyUrl, { method: "HEAD" });
      expect(headRes.status).toBe(200);
      expect(headRes.headers.get("content-type")).toContain("mpegurl");
    }, 25000);

    it("apiStream proxy serves virtual WebVTT subtitle playlist", async () => {
      const { app } = await import("../../src/app");
      await import("../../src/routes/apiStream");
      const { generateStreamSignature } = await import("./hmac");

      const subUrl = "https://example.com/subs/eng.vtt";
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const sig = generateStreamSignature(subUrl, expires);

      const subPlaylistRes = await app.request(
        `/api/stream/proxy/sub_en.m3u8?sub_vtt=${encodeURIComponent(subUrl)}&ref=${encodeURIComponent("https://example.com")}&expires=${expires}&sig=${sig}`,
      );
      expect(subPlaylistRes.status).toBe(200);
      expect(subPlaylistRes.headers.get("content-type")).toContain("mpegurl");
      const subBody = await subPlaylistRes.text();
      expect(subBody).toContain("#EXT-X-TARGETDURATION");
      expect(subBody).toContain("/api/stream/proxy/subtitle.vtt?url=");
    });

    it("apiStream proxy handles disguised Content-Type (image/jpeg) child playlists and segment types", async () => {
      const { app } = await import("$src/app");
      await import("$src/routes/apiStream");
      const { generateStreamSignature } = await import("./hmac");

      const childUrl = "https://imgcdn44.dpopdrop89.store/cdn/092e3d2d14736a0ad5386790ceacb405f2c00bf1259443f3ff8bca9c318cd299f0667764f651a8e8cf994633faa91c7b8a85a1dc91893631b78d626e62";
      const referer = "https://play2.echovideo.ru/";
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const sig = generateStreamSignature(childUrl, expires);

      const childProxyUrl = `/api/stream/proxy/media.m3u8?url=${encodeURIComponent(childUrl)}&ref=${encodeURIComponent(referer)}&expires=${expires}&sig=${sig}`;
      const res = await app.request(childProxyUrl);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("mpegurl");
      const body = await res.text();
      expect(body).toContain("#EXTM3U");
      expect(body).toContain("/api/stream/proxy/");

      // Find first proxied segment and verify it's proxied with video/mp2t MIME type
      const segLine = body.split("\n").find((l) => l.includes("/api/stream/proxy/"));
      expect(segLine).toBeDefined();

      const segRes = await app.request(segLine!.trim(), { method: "HEAD" });
      expect(segRes.status).toBe(200);
      expect(segRes.headers.get("content-type")).toBe("video/mp2t");
    }, 25000);

    it("apiStream proxy correctly injects subtitles into master playlist and sets correct DEFAULT track", async () => {
      const { app } = await import("$src/app");
      await import("$src/routes/apiStream");
      const { generateStreamSignature } = await import("./hmac");

      const masterUrl = "https://hls2.aniwatchtv.uk/v/scxqicy/huanbc9tmy/nyvrcjopy8/xaprjusg9l2rwy/master.m3u8";
      const referer = "https://zokoanime.video/";
      const subs = [
        { l: "Arabic", lang: "ar", u: "https://example.com/ar.vtt", d: false },
        { l: "English", lang: "en", u: "https://example.com/en.vtt", d: true },
        { l: "Spanish", lang: "es", u: "https://example.com/es.vtt", d: false },
      ];
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const sig = generateStreamSignature(masterUrl, expires);

      const proxyUrl = `/api/stream/proxy?url=${encodeURIComponent(masterUrl)}&ref=${encodeURIComponent(referer)}&subs=${encodeURIComponent(JSON.stringify(subs))}&expires=${expires}&sig=${sig}`;
      const res = await app.request(proxyUrl);

      expect(res.status).toBe(200);
      const body = await res.text();

      // Ensure subtitle media tags are injected
      expect(body).toContain('#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Arabic",DEFAULT=NO,AUTOSELECT=NO,FORCED=NO,LANGUAGE="ar"');
      expect(body).toContain('#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",DEFAULT=YES,AUTOSELECT=YES,FORCED=NO,LANGUAGE="en"');
      expect(body).toContain('#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Spanish",DEFAULT=NO,AUTOSELECT=NO,FORCED=NO,LANGUAGE="es"');

      // Ensure variant stream lines reference SUBTITLES="subs"
      const streamInfLines = body.split("\n").filter((l) => l.startsWith("#EXT-X-STREAM-INF"));
      expect(streamInfLines.length).toBeGreaterThan(0);
      for (const line of streamInfLines) {
        expect(line).toContain('SUBTITLES="subs"');
      }
    }, 25000);

    it("apiStream proxy wraps media playlists into master playlist when subtitles are present", async () => {
      const { app } = await import("$src/app");
      await import("$src/routes/apiStream");
      const { generateStreamSignature } = await import("./hmac");

      // Child media playlist (non-master)
      const childUrl = "https://imgcdn44.dpopdrop89.store/cdn/092e3d2d14736a0ad5386790ceacb405f2c00bf1259443f3ff8bca9c318cd299f0667764f651a8e8cf994633faa91c7b8a85a1dc91893631b78d626e62";
      const referer = "https://play2.echovideo.ru/";
      const subs = [
        { l: "English", lang: "en", u: "https://example.com/en.vtt", d: true },
      ];
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const sig = generateStreamSignature(childUrl, expires);

      // Request media playlist with subs attached - should be wrapped in master playlist
      const masterProxyUrl = `/api/stream/proxy/media.m3u8?url=${encodeURIComponent(childUrl)}&ref=${encodeURIComponent(referer)}&subs=${encodeURIComponent(JSON.stringify(subs))}&expires=${expires}&sig=${sig}`;
      const res = await app.request(masterProxyUrl);

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",DEFAULT=YES,AUTOSELECT=YES');
      expect(body).toContain('#EXT-X-STREAM-INF:BANDWIDTH=5000000,SUBTITLES="subs"');
      expect(body).toContain("/api/stream/proxy/media.m3u8?url=");
      expect(body).toContain("&child=true");

      // Now request the child media playlist
      const childProxyUrlLine = body.split("\n").find((l) => l.includes("&child=true"));
      expect(childProxyUrlLine).toBeDefined();

      const childRes = await app.request(childProxyUrlLine!.trim());
      expect(childRes.status).toBe(200);
      const childBody = await childRes.text();
      // Child media playlist has segments and not #EXT-X-STREAM-INF
      expect(childBody).not.toContain("#EXT-X-STREAM-INF");
      expect(childBody).toContain("#EXTM3U");
    }, 25000);
  });
});
