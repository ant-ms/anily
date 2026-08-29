import { app } from "$src/app";
import { prisma } from "$src/prisma";
import { logger } from "$src/logger";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  getEpisodeTorrentOptions,
  startEpisodeDownload,
  syncDownloadStatuses,
  getMediaUrl,
} from "$lib/media/mediaManager";
import { qbit } from "$lib/media/qbittorrent";
import { searchTorrents } from "$lib/media/jackett";
import { rankTorrents } from "$lib/media/torrentAI";
import { anilistParamValidator } from "$src/validators/anilistId";
import { MediaStatus } from "../../../generated/prisma/client";

const log = logger.child({ module: "apiMedia" });

const episodeIdParamValidator = zValidator(
  "param",
  z.object({ episodeId: z.coerce.number().int() }),
);

// GET /api/media/search/:episodeId
// Search Jackett for torrents for this episode and get AI recommendation
export const apiMediaSearchGetRoute = app.get(
  "/api/media/search/:episodeId",
  episodeIdParamValidator,
  async (c) => {
    const { episodeId } = c.req.valid("param");
    try {
      const result = await getEpisodeTorrentOptions(episodeId);
      return c.json(result);
    } catch (error) {
      log.error({ error, episodeId }, "Failed to search torrents");
      return c.json(
        {
          error: "Failed to search torrents",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

// POST /api/media/download
// Start downloading a specific torrent for an episode
export const apiMediaDownloadPostRoute = app.post(
  "/api/media/download",
  zValidator(
    "json",
    z.object({
      episodeId: z.number().int(),
      torrentIndex: z.number().int().min(0).optional(),
      torrent: z
        .object({
          title: z.string(),
          link: z.string(),
          size: z.number(),
          seeders: z.number(),
          peers: z.number(),
          source: z.string(),
          publishDate: z.string(),
          category: z.string(),
          infoHash: z.string().optional(),
        })
        .optional(),
    }),
  ),
  async (c) => {
    const { episodeId, torrentIndex, torrent: directTorrent } = c.req.valid("json");
    try {
      let torrent = directTorrent;
      if (!torrent) {
        const { results } = await getEpisodeTorrentOptions(episodeId);
        const idx = torrentIndex ?? 0;
        if (idx >= results.length) {
          return c.json({ error: `torrentIndex ${idx} out of range (${results.length} results)` }, 400);
        }
        torrent = results[idx];
      }

      const { hash, mediaPath } = await startEpisodeDownload(episodeId, torrent, false);

      return c.json({ hash, mediaPath, mediaStatus: "QUEUED" });
    } catch (error) {
      log.error({ error, episodeId }, "Failed to start download");
      return c.json(
        {
          error: "Failed to start download",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

// POST /api/media/stream/:episodeId
// Start streaming an episode (sequential download) or return existing URL
export const apiMediaStreamPostRoute = app.post(
  "/api/media/stream/:episodeId",
  episodeIdParamValidator,
  async (c) => {
    const { episodeId } = c.req.valid("param");
    try {
      const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: { animeDetails: { include: { baseAnime: true } } },
      });

      if (!episode) {
        return c.json({ error: "Episode not found" }, 404);
      }

      // If already available, return the nginx URL directly
      if (episode.mediaStatus === MediaStatus.AVAILABLE && episode.mediaPath) {
        const url = getMediaUrl(episode.mediaPath);
        return c.json({ url, mediaStatus: "AVAILABLE" });
      }

      // If already downloading/queued, return expected URL (streaming in progress)
      if (
        (episode.mediaStatus === MediaStatus.QUEUED ||
          episode.mediaStatus === MediaStatus.DOWNLOADING) &&
        episode.mediaTorrentHash &&
        episode.mediaPath
      ) {
        const url = getMediaUrl(episode.mediaPath);
        return c.json({ url, mediaStatus: episode.mediaStatus });
      }

      // Otherwise search + AI select + sequential download
      const { results, recommendation } = await getEpisodeTorrentOptions(episodeId);

      if (
        results.length === 0 ||
        recommendation.index === -1 ||
        recommendation.confidence === "low"
      ) {
        return c.json(
          {
            error: "No suitable torrent found for streaming",
            reason: recommendation.reason,
          },
          422,
        );
      }

      const torrent = results[recommendation.index];
      const { mediaPath } = await startEpisodeDownload(episodeId, torrent, true);
      const url = getMediaUrl(mediaPath);

      return c.json({ url, mediaStatus: "QUEUED" });
    } catch (error) {
      log.error({ error, episodeId }, "Failed to start streaming");
      return c.json(
        {
          error: "Failed to start streaming",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

// POST /api/media/download-season/:anilistId
// Kick off background auto-download for all un-downloaded aired episodes of an anime
export const apiMediaDownloadSeasonPostRoute = app.post(
  "/api/media/download-season/:anilistId",
  anilistParamValidator,
  async (c) => {
    const { anilistId } = c.req.valid("param");
    const now = new Date();

    // Find all aired episodes that are not yet downloaded/queued
    const episodes = await prisma.episode.findMany({
      where: {
        mediaStatus: MediaStatus.NONE,
        airingAt: { lte: now },
        animeDetails: { baseAnimeAnilistId: anilistId },
      },
      include: { animeDetails: { include: { baseAnime: true } } },
      orderBy: { number: "asc" },
    });

    // Mark them as QUEUED immediately so UI reflects downloading state
    await prisma.episode.updateMany({
      where: {
        id: { in: episodes.map((e) => e.id) },
        mediaStatus: MediaStatus.NONE,
      },
      data: { mediaStatus: MediaStatus.QUEUED },
    });

    // Run download orchestrator in the background without blocking the HTTP response
    (async () => {
      log.info({ anilistId, count: episodes.length }, "Starting background season download");
      for (const episode of episodes) {
        try {
          const { results, recommendation } = await getEpisodeTorrentOptions(episode.id);
          if (results.length > 0 && recommendation.index >= 0) {
            const torrent = results[recommendation.index];
            await startEpisodeDownload(episode.id, torrent, false);
          } else if (results.length > 0) {
            // If AI is low confidence, pick highest seeded torrent
            await startEpisodeDownload(episode.id, results[0], false);
          } else {
            // Reset status if no torrents found
            await prisma.episode.update({
              where: { id: episode.id },
              data: { mediaStatus: MediaStatus.NONE },
            });
          }
        } catch (error) {
          log.warn({ error, episodeId: episode.id }, "Failed background download for episode");
          await prisma.episode.update({
            where: { id: episode.id },
            data: { mediaStatus: MediaStatus.NONE },
          }).catch(() => {});
        }
      }
      log.info({ anilistId }, "Finished background season download batch");
    })().catch((err) => {
      log.error({ err, anilistId }, "Background season download error");
    });

    return c.json({ success: true, count: episodes.length });
  },
);

// DELETE /api/media/delete/:episodeId
// Delete downloaded media, remove torrent from qBittorrent, and reset episode mediaStatus to NONE
export const apiMediaDeleteDeleteRoute = app.delete(
  "/api/media/delete/:episodeId",
  episodeIdParamValidator,
  async (c) => {
    const { episodeId } = c.req.valid("param");
    try {
      const episode = await prisma.episode.findUnique({ where: { id: episodeId } });

      if (!episode) {
        return c.json({ error: "Episode not found" }, 404);
      }

      // If a torrent hash exists in qBittorrent, delete torrent and its local files
      if (episode.mediaTorrentHash) {
        try {
          await qbit.deleteTorrent(episode.mediaTorrentHash, true);
        } catch (error) {
          log.warn({ error, hash: episode.mediaTorrentHash }, "Failed to delete torrent in qBittorrent");
        }
      }

      // Reset episode record in database
      await prisma.episode.update({
        where: { id: episodeId },
        data: {
          mediaStatus: MediaStatus.NONE,
          mediaPath: null,
          mediaTorrentHash: null,
          mediaSize: null,
          mediaSelectedTorrent: null,
        },
      });

      return c.json({ success: true, mediaStatus: "NONE" });
    } catch (error) {
      log.error({ error, episodeId }, "Failed to delete media for episode");
      return c.json(
        {
          error: "Failed to delete media",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

// GET /api/media/status/:episodeId
// Get download status for a single episode, including live qBittorrent progress
export const apiMediaStatusGetRoute = app.get(
  "/api/media/status/:episodeId",
  episodeIdParamValidator,
  async (c) => {
    const { episodeId } = c.req.valid("param");
    try {
      const episode = await prisma.episode.findUnique({ where: { id: episodeId } });

      if (!episode) {
        return c.json({ error: "Episode not found" }, 404);
      }

      let progress = 0;
      const mediaUrl =
        episode.mediaStatus === MediaStatus.AVAILABLE && episode.mediaPath
          ? getMediaUrl(episode.mediaPath)
          : null;

      if (episode.mediaTorrentHash && episode.mediaStatus !== MediaStatus.AVAILABLE) {
        try {
          const info = await qbit.getTorrentInfo(episode.mediaTorrentHash);
          if (info) {
            progress = info.progress;
          }
        } catch (error) {
          log.warn({ error, episodeId }, "Failed to fetch live qBittorrent status");
        }
      } else if (episode.mediaStatus === MediaStatus.AVAILABLE) {
        progress = 1;
      }

      return c.json({ mediaStatus: episode.mediaStatus, progress, mediaUrl });
    } catch (error) {
      log.error({ error, episodeId }, "Failed to get media status");
      return c.json(
        {
          error: "Failed to get media status",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

// GET /api/media/search-season/:anilistId
// Search + AI rank for all undownloaded aired episodes of an anime
export const apiMediaSearchSeasonGetRoute = app.get(
  "/api/media/search-season/:anilistId",
  anilistParamValidator,
  async (c) => {
    const { anilistId } = c.req.valid("param");
    const now = new Date();

    try {
      const episodes = await prisma.episode.findMany({
        where: {
          mediaStatus: MediaStatus.NONE,
          airingAt: { lte: now },
          animeDetails: { baseAnimeAnilistId: anilistId },
        },
        include: { animeDetails: { include: { baseAnime: true } } },
        orderBy: { number: "asc" },
      });

      const results = await Promise.all(
        episodes.map(async (episode) => {
          const baseAnime = episode.animeDetails.baseAnime;
          const animeName =
            baseAnime.titleEnglish ?? baseAnime.titleRomanji ?? baseAnime.titleNative ?? "Unknown";

          try {
            const torrents = await searchTorrents(
              `${animeName.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} ${episode.number}`,
            );
            const recommendation = await rankTorrents(animeName, episode.number, torrents);
            return {
              episodeId: episode.id,
              episodeNumber: episode.number,
              results: torrents,
              recommendation,
            };
          } catch (error) {
            log.warn({ error, episodeId: episode.id }, "Failed to search torrents for episode");
            return {
              episodeId: episode.id,
              episodeNumber: episode.number,
              results: [],
              recommendation: { index: -1, confidence: "low" as const, reason: "Search failed" },
            };
          }
        }),
      );

      return c.json({ episodes: results });
    } catch (error) {
      log.error({ error, anilistId }, "Failed to search season torrents");
      return c.json(
        {
          error: "Failed to search season torrents",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

// GET /api/media/stats
// Return media statistics: storage usage per grouping, qBittorrent seeding stats, and orphan unbookmarked files
export const apiMediaStatsGetRoute = app.get("/api/media/stats", async (c) => {
  try {
    // 1. Fetch all anime groupings with their member anime and episodes
    const groupings = await prisma.animeGrouping.findMany({
      include: {
        displayAnime: true,
        items: {
          include: {
            animeDetails: {
              include: {
                episodes: true,
              },
            },
          },
        },
      },
    });

    // 2. Fetch all qBittorrent torrents
    let qbitTorrents: any[] = [];
    try {
      qbitTorrents = await qbit.getAllTorrents();
    } catch (err) {
      log.warn({ err }, "Failed to fetch torrent list from qBittorrent for stats");
    }

    const qbitMap = new Map<string, any>();
    for (const t of qbitTorrents) {
      if (t.hash) qbitMap.set(t.hash.toLowerCase(), t);
    }

    const bookmarkedAnilistIds = new Set<number>();
    const groupingStats = groupings.map((grouping) => {
      let totalBytes = BigInt(0);
      let episodeCount = 0;
      let downloadedCount = 0;
      let uploadingCount = 0;
      let totalUploadedBytes = BigInt(0);
      let uploadSpeed = 0;

      for (const item of grouping.items) {
        bookmarkedAnilistIds.add(item.anilistId);
        const eps = item.animeDetails?.episodes ?? [];
        episodeCount += eps.length;

        for (const ep of eps) {
          if (ep.mediaSize) totalBytes += ep.mediaSize;
          if (ep.mediaStatus === MediaStatus.AVAILABLE) downloadedCount++;

          if (ep.mediaTorrentHash) {
            const t = qbitMap.get(ep.mediaTorrentHash.toLowerCase());
            if (t) {
              if (t.state === "uploading" || t.state === "stalledUP" || t.state === "queuedUP") {
                uploadingCount++;
              }
              if (t.uploaded) totalUploadedBytes += BigInt(t.uploaded);
              if (t.upspeed) uploadSpeed += t.upspeed;
            }
          }
        }
      }

      return {
        id: grouping.id,
        title:
          grouping.displayAnime.titleEnglish ??
          grouping.displayAnime.titleRomanji ??
          grouping.displayAnime.titleNative ??
          "Unknown",
        thumbnailUrl: grouping.items.find((i) => i.animeDetails?.thumbnailUrl)?.animeDetails?.thumbnailUrl ?? null,
        itemsCount: grouping.items.length,
        episodeCount,
        downloadedCount,
        totalBytes: totalBytes.toString(),
        uploadingCount,
        totalUploadedBytes: totalUploadedBytes.toString(),
        uploadSpeed,
      };
    });

    // 3. Find unbookmarked / orphan torrents or media in qBittorrent
    const orphanTorrents: Array<{
      hash: string;
      name: string;
      size: number;
      savePath: string;
    }> = [];

    for (const t of qbitTorrents) {
      // Check if this torrent is tracked by any bookmarked episode
      const savePath = t.save_path || "";
      // Extract anilistId if path is /downloads/<anilistId>/...
      const match = savePath.match(/\/downloads\/(\d+)/);
      const folderAnilistId = match ? parseInt(match[1], 10) : null;

      if (!folderAnilistId || !bookmarkedAnilistIds.has(folderAnilistId)) {
        orphanTorrents.push({
          hash: t.hash,
          name: t.name,
          size: t.size,
          savePath: t.save_path,
        });
      }
    }

    return c.json({
      groupings: groupingStats,
      orphanTorrents,
      totalTorrents: qbitTorrents.length,
    });
  } catch (error) {
    log.error({ error }, "Failed to get media stats");
    return c.json(
      {
        error: "Failed to get media stats",
        reason: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// GET /api/media/missing
// Return all episodes that aired > 8 days ago and are still missing for bookmarked anime
export const apiMediaMissingGetRoute = app.get("/api/media/missing", async (c) => {
  try {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    const episodes = await prisma.episode.findMany({
      where: {
        mediaStatus: MediaStatus.NONE,
        airingAt: { lte: eightDaysAgo },
        animeDetails: {
          baseAnime: {
            animeDetails: {
              groupingId: { not: null },
            },
          },
        },
      },
      include: {
        animeDetails: {
          include: {
            baseAnime: true,
          },
        },
      },
      orderBy: { airingAt: "desc" },
    });

    const formatted = episodes.map((ep) => {
      const base = ep.animeDetails.baseAnime;
      return {
        id: ep.id,
        number: ep.number,
        title: ep.titleEnglish ?? `Episode ${ep.number}`,
        airingAt: ep.airingAt,
        animeTitle: base.titleEnglish ?? base.titleRomanji ?? base.titleNative ?? "Unknown",
        thumbnailUrl: ep.thumbnailUrl ?? ep.animeDetails.thumbnailUrl ?? null,
        lastSearchAt: ep.mediaLastSearchAt,
      };
    });

    return c.json(formatted);
  } catch (error) {
    log.error({ error }, "Failed to fetch missing episodes");
    return c.json(
      {
        error: "Failed to fetch missing episodes",
        reason: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
