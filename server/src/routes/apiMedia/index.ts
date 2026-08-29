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
      torrentIndex: z.number().int().min(0),
    }),
  ),
  async (c) => {
    const { episodeId, torrentIndex } = c.req.valid("json");
    try {
      const { results } = await getEpisodeTorrentOptions(episodeId);

      if (torrentIndex >= results.length) {
        return c.json({ error: `torrentIndex ${torrentIndex} out of range (${results.length} results)` }, 400);
      }

      const torrent = results[torrentIndex];
      const { hash } = await startEpisodeDownload(episodeId, torrent, false);

      return c.json({ hash, mediaStatus: "QUEUED" });
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
// Queue downloads for a batch of episode selections
export const apiMediaDownloadSeasonPostRoute = app.post(
  "/api/media/download-season/:anilistId",
  anilistParamValidator,
  zValidator(
    "json",
    z.object({
      selections: z.array(
        z.object({
          episodeId: z.number().int(),
          torrentIndex: z.number().int().min(0),
        }),
      ),
    }),
  ),
  async (c) => {
    const { selections } = c.req.valid("json");
    let queued = 0;

    for (const { episodeId, torrentIndex } of selections) {
      try {
        const { results } = await getEpisodeTorrentOptions(episodeId);
        if (torrentIndex < results.length) {
          await startEpisodeDownload(episodeId, results[torrentIndex], false);
          queued++;
        } else {
          log.warn({ episodeId, torrentIndex }, "torrentIndex out of range, skipping");
        }
      } catch (error) {
        log.warn({ error, episodeId }, "Failed to queue episode download in season batch");
      }
    }

    return c.json({ queued });
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
