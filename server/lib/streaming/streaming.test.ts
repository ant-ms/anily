import { describe, it, expect } from "vitest";
import { AnimeHubProvider } from "./providers/animehub";
import { HiAnimeProvider } from "./providers/hianime";
import { ProviderRegistry } from "./registry";

describe("Streaming Providers", () => {
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

    it("can resolve stream source", async () => {
      const provider = new AnimeHubProvider();
      const stream = await provider.getStream("sousou-no-frieren", 1, "sub", "0");

      expect(stream).not.toBeNull();
      expect(stream?.url).toContain("http");
      expect(stream?.headers?.Referer).toBeDefined();
    }, 20000);
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

  describe("JustAnimeProvider", () => {
    it("can search and find an anime", async () => {
      const { JustAnimeProvider } = await import("./providers/justanime");
      const provider = new JustAnimeProvider();
      const results = await provider.search("Frieren");

      expect(results.length).toBeGreaterThan(0);
      const frieren = results.find((r) => r.name.toLowerCase().includes("frieren"));
      expect(frieren).toBeDefined();
      expect(frieren?.identifier).toBeDefined();
    }, 15000);

    it("can get episodes and servers", async () => {
      const { JustAnimeProvider } = await import("./providers/justanime");
      const provider = new JustAnimeProvider();
      const { episodes, servers } = await provider.getEpisodes("154587", "sub");

      expect(episodes.length).toBeGreaterThan(0);
      expect(episodes).toContain(1);
      expect(servers.length).toBeGreaterThan(0);
      expect(servers.some((s) => s.id === "zokoanime")).toBe(true);
    }, 15000);

    it("can resolve stream source", async () => {
      const { JustAnimeProvider } = await import("./providers/justanime");
      const provider = new JustAnimeProvider();
      const stream = await provider.getStream("154587", 1, "sub", "zokoanime");

      expect(stream).not.toBeNull();
      expect(stream?.url).toContain("http");
      expect(stream?.headers?.Referer).toBeDefined();
    }, 20000);
  });

  describe("ProviderRegistry & Proxy", () => {
    it("returns available services across multiple providers", async () => {
      const registry = new ProviderRegistry();
      const services = await registry.checkAvailability(
        ["Sousou no Frieren", "Frieren: Beyond Journey's End"],
        1,
      );

      expect(services.length).toBeGreaterThan(0);
      const providerIds = new Set(services.map((s) => s.providerId));
      expect(providerIds.has("animehub")).toBe(true);
      expect(providerIds.has("hianime")).toBe(true);
      expect(providerIds.has("justanime")).toBe(true);
    }, 25000);

    it("apiStream proxy rewrites m3u8 playlists for AnimeHub", async () => {
      const { app } = await import("$src/app");
      await import("$src/routes/apiStream");

      const provider = new AnimeHubProvider();
      const stream = await provider.getStream("sousou-no-frieren", 1, "sub", "0");
      expect(stream).not.toBeNull();

      const proxyUrl = `/api/stream/proxy?url=${encodeURIComponent(stream!.url)}&ref=${encodeURIComponent(stream!.headers?.Referer || "")}`;
      const res = await app.request(proxyUrl);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("mpegurl");
      const body = await res.text();
      expect(body).toContain("#EXTM3U");
      expect(body).toContain("/api/stream/proxy/");
    }, 25000);

    it("apiStream proxy rewrites m3u8 playlists for HiAnime", async () => {
      const { app } = await import("$src/app");
      await import("$src/routes/apiStream");

      const provider = new HiAnimeProvider();
      const stream = await provider.getStream("frieren-beyond-journeys-end-481", 1, "sub");
      expect(stream).not.toBeNull();

      const proxyUrl = `/api/stream/proxy?url=${encodeURIComponent(stream!.url)}&ref=${encodeURIComponent(stream!.headers?.Referer || "")}`;
      const res = await app.request(proxyUrl);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("mpegurl");
      const body = await res.text();
      expect(body).toContain("#EXTM3U");
      expect(body).toContain("/api/stream/proxy/");
    }, 25000);

    it("apiStream proxy handles master.m3u8 and child playlists with file extensions", async () => {
      const { app } = await import("$src/app");
      await import("$src/routes/apiStream");

      const masterUrl = "https://hls2.aniwatchtv.uk/v/scxqicy/huanbc9tmy/nyvrcjopy8/xaprjusg9l2rwy/master.m3u8";
      const referer = "https://zokoanime.video/";

      // 1. Request master playlist via proxy
      const proxyUrl = `/api/stream/proxy?url=${encodeURIComponent(masterUrl)}&ref=${encodeURIComponent(referer)}`;
      const res = await app.request(proxyUrl);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("mpegurl");
      const body = await res.text();
      expect(body).toContain("#EXTM3U");
      // Should rewrite sub-playlists with filename extension (.m3u8) in path
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
      // Should rewrite segment lines with filename extension (.ts) in path
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

      const subPlaylistRes = await app.request(
        `/api/stream/proxy/sub_en.m3u8?sub_vtt=${encodeURIComponent("https://example.com/subs/eng.vtt")}&ref=${encodeURIComponent("https://example.com")}`,
      );
      expect(subPlaylistRes.status).toBe(200);
      expect(subPlaylistRes.headers.get("content-type")).toContain("mpegurl");
      const subBody = await subPlaylistRes.text();
      expect(subBody).toContain("#EXT-X-TARGETDURATION");
      expect(subBody).toContain("/api/stream/proxy/subtitle.vtt?url=");
    });
  });
});
