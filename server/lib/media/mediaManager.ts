import { prisma } from "$src/prisma";
import { searchTorrents, type TorrentResult } from "./jackett";
import { qbit } from "./qbittorrent";
import { rankTorrents, type TorrentAIResult } from "./torrentAI";
import { logger } from "$src/logger";
import { MediaStatus } from "../../generated/prisma/client";

const log = logger.child({ module: "mediaManager" });

const VIDEO_EXTENSIONS = new Set([
  ".mkv", ".mp4", ".avi", ".m4v", ".mov", ".wmv", ".flv", ".webm",
]);

/**
 * Build a Jackett search query for an episode.
 * Strips special characters that would confuse the query.
 */
export function buildSearchQuery(animeName: string, episodeNumber: number | null): string {
  // Remove special characters, keep alphanumerics and spaces
  const cleanName = animeName.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (episodeNumber === null) {
    return cleanName;
  }
  return `${cleanName} ${episodeNumber}`;
}

/**
 * Get torrents + AI recommendation for an episode.
 */
export async function getEpisodeTorrentOptions(episodeId: number): Promise<{
  episode: { id: number; number: number; animeTitle: string; anilistId: number };
  results: TorrentResult[];
  recommendation: TorrentAIResult;
}> {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      animeDetails: {
        include: {
          baseAnime: true,
        },
      },
    },
  });

  if (!episode) {
    throw new Error(`Episode ${episodeId} not found`);
  }

  const baseAnime = episode.animeDetails.baseAnime;
  const animeName =
    baseAnime.titleEnglish ?? baseAnime.titleRomanji ?? baseAnime.titleNative ?? "Unknown";
  const anilistId = baseAnime.anilistId;

  const epStr = episode.number !== null ? String(episode.number) : null;
  const epPadded = episode.number !== null ? String(episode.number).padStart(2, "0") : null;

  // Extract Season number if in title (e.g. "Season 4" -> 4, "3rd Season" -> 3)
  const seasonMatch = (animeName + " " + (baseAnime.titleRomanji ?? "")).match(/(?:Season|S)\s*(\d+)/i) || (animeName + " " + (baseAnime.titleRomanji ?? "")).match(/(\d+)(?:st|nd|rd|th)\s*Season/i);
  const seasonNum = seasonMatch ? parseInt(seasonMatch[1], 10) : null;

  // Base title without season suffix for SxxExx format (e.g. "Tensei Shitara Slime Datta Ken")
  const cleanBaseTitle = (title: string) =>
    title
      .replace(/(?:Season|\bS)\s*\d+/gi, "")
      .replace(/\d+(?:st|nd|rd|th)\s*Season/gi, "")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const titlesToTry = new Set<string>();
  if (animeName) titlesToTry.add(animeName);
  if (baseAnime.titleRomanji) titlesToTry.add(baseAnime.titleRomanji);

  const queries: string[] = [];

  for (const t of titlesToTry) {
    const cleanT = t.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (episode.number !== null) {
      queries.push(`${cleanT} ${epPadded ?? episode.number}`);
      if (epPadded && epPadded !== epStr) {
        queries.push(`${cleanT} ${episode.number}`);
      }
    } else {
      queries.push(cleanT);
    }

    // Add SxxExx format if season number exists (e.g. "Tensei Shitara Slime Datta Ken S04E01")
    if (seasonNum !== null && epPadded) {
      const baseClean = cleanBaseTitle(t);
      const sPadded = String(seasonNum).padStart(2, "0");
      queries.push(`${baseClean} S${sPadded}E${epPadded}`);
    }
  }

  // Search all query variations in parallel with Jackett
  log.info({ queries, episodeId }, "Searching Jackett in parallel");
  const queryPromises = queries.map((q) => searchTorrents(q));
  const settled = await Promise.allSettled(queryPromises);

  let results: TorrentResult[] = [];
  const seen = new Set<string>();

  for (const res of settled) {
    if (res.status === "fulfilled") {
      for (const r of res.value) {
        const key = r.link || r.title;
        if (!seen.has(key)) {
          results.push(r);
          seen.add(key);
        }
      }
    }
  }

  results.sort((a, b) => b.seeders - a.seeders);
  const recommendation = await rankTorrents(animeName, episode.number, results);

  return {
    episode: { id: episode.id, number: episode.number, animeTitle: animeName, anilistId },
    results,
    recommendation,
  };
}

/**
 * Start downloading/streaming an episode with a chosen torrent.
 */
export async function startEpisodeDownload(
  episodeId: number,
  torrent: TorrentResult,
  sequential: boolean,
): Promise<{ hash: string; mediaPath: string }> {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      animeDetails: {
        include: { baseAnime: true },
      },
    },
  });

  if (!episode) {
    throw new Error(`Episode ${episodeId} not found`);
  }

  const anilistId = episode.animeDetails.baseAnime.anilistId;
  const savePath = `/downloads/${anilistId}/ep${episode.number}`;

  log.info({ episodeId, savePath, sequential }, "Adding torrent to qBittorrent");

  const hash = await qbit.addTorrent(torrent.link, savePath, { sequential });

  // Try to inspect the torrent files right away to get the exact video filename
  let exactMediaPath = `${anilistId}/ep${episode.number}`;
  let foundVideo = false;

  try {
    // Poll up to 10 times (every 400ms = 4s total) for qBittorrent to fetch metadata & file names
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const files = await qbit.getTorrentFiles(hash);
      if (files && files.length > 0) {
        const videoFiles = files.filter((f) => {
          const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
          return VIDEO_EXTENSIONS.has(ext);
        });
        const mainFile =
          videoFiles.length > 0
            ? videoFiles.reduce((a, b) => (a.size > b.size ? a : b))
            : files.reduce((a, b) => (a.size > b.size ? a : b));

        if (mainFile && mainFile.name) {
          exactMediaPath = `${anilistId}/ep${episode.number}/${mainFile.name}`;
          foundVideo = true;
          break;
        }
      }
    }
  } catch (error) {
    log.warn({ error, hash }, "Failed to get immediate file name from qBittorrent");
  }

  // Fallback: If metadata took too long, infer a sanitized filename from the torrent title with .mkv extension
  if (!foundVideo) {
    const safeTitle = (torrent.title || `episode_${episode.number}`).replace(/[/\\?%*:|"<>]/g, "_").trim();
    const hasExt = Array.from(VIDEO_EXTENSIONS).some((ext) => safeTitle.toLowerCase().endsWith(ext));
    const inferredFilename = hasExt ? safeTitle : `${safeTitle}.mkv`;
    exactMediaPath = `${anilistId}/ep${episode.number}/${inferredFilename}`;
  }

  await prisma.episode.update({
    where: { id: episodeId },
    data: {
      mediaStatus: MediaStatus.QUEUED,
      mediaTorrentHash: hash,
      mediaPath: exactMediaPath,
      mediaSelectedTorrent: {
        title: torrent.title,
        link: torrent.link,
        size: torrent.size,
        seeders: torrent.seeders,
        source: torrent.source,
        publishDate: torrent.publishDate,
        category: torrent.category,
        infoHash: torrent.infoHash,
      },
    },
  });

  log.info({ episodeId, hash, mediaPath: exactMediaPath }, "Torrent queued");

  return { hash, mediaPath: exactMediaPath };
}

/**
 * Poll all QUEUED/DOWNLOADING episodes and update their status in DB.
 */
export async function syncDownloadStatuses(): Promise<void> {
  const episodes = await prisma.episode.findMany({
    where: {
      mediaStatus: { in: [MediaStatus.QUEUED, MediaStatus.DOWNLOADING] },
      mediaTorrentHash: { not: null },
    },
  });

  if (episodes.length === 0) return;

  log.info({ count: episodes.length }, "Syncing download statuses");

  for (const episode of episodes) {
    if (!episode.mediaTorrentHash) continue;

    try {
      const info = await qbit.getTorrentInfo(episode.mediaTorrentHash);

      if (!info) {
        log.warn({ episodeId: episode.id, hash: episode.mediaTorrentHash }, "Torrent info not found");
        continue;
      }

      const state = info.state;

      if (state === "uploading" || state === "stalledUP" || state === "pausedUP" || state === "checkingUP") {
        // Download complete — find the video file
        const files = await qbit.getTorrentFiles(episode.mediaTorrentHash);

        // Pick largest file that looks like a video
        const videoFiles = files.filter((f) => {
          const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
          return VIDEO_EXTENSIONS.has(ext);
        });

        const mainFile =
          videoFiles.length > 0
            ? videoFiles.reduce((a, b) => (a.size > b.size ? a : b))
            : files.reduce((a, b) => (a.size > b.size ? a : b));

        // Compute path relative to /downloads
        // save_path is e.g. "/downloads/21234/ep12/"
        const savePathRelative = info.save_path.replace(/^\/downloads\/?/, "");
        const cleanSave = savePathRelative.replace(/\/$/, "");
        // mainFile.name may include subdirectory inside the torrent
        const mediaPath = cleanSave ? `${cleanSave}/${mainFile.name}` : mainFile.name;

        await prisma.episode.update({
          where: { id: episode.id },
          data: {
            mediaStatus: MediaStatus.AVAILABLE,
            mediaPath,
            mediaSize: BigInt(mainFile.size),
          },
        });

        log.info({ episodeId: episode.id, mediaPath }, "Episode download complete");
      } else if (
        state === "downloading" ||
        state === "stalledDL" ||
        state === "queuedDL" ||
        state === "checkingDL" ||
        state === "moving"
      ) {
        if (episode.mediaStatus !== MediaStatus.DOWNLOADING) {
          await prisma.episode.update({
            where: { id: episode.id },
            data: { mediaStatus: MediaStatus.DOWNLOADING },
          });
        }
      } else if (state === "error" || state === "missingFiles") {
        log.warn(
          { episodeId: episode.id, hash: episode.mediaTorrentHash, state },
          "Torrent in error state",
        );
      }
    } catch (error) {
      log.warn({ episodeId: episode.id, error }, "Failed to sync download status for episode");
    }
  }
}

/**
 * Get the public HTTP URL for an episode's media file.
 */
export function getMediaUrl(mediaPath: string): string {
  const base = (process.env.MEDIA_SERVE_BASE_URL ?? "").replace(/\/$/, "");
  const path = mediaPath.startsWith("/") ? mediaPath : `/${mediaPath}`;
  return `${base}${path}`;
}

/**
 * Auto-download newly released episodes for all anime with AnimeDetails.
 * Called by scheduler. Skips already downloading/downloaded episodes.
 *
 * Rate limiting & backoff strategy:
 * - 1h to 2h after broadcast: try every 15 minutes.
 * - > 2h after broadcast: only try once per day (24h backoff).
 * - > 8 days after broadcast: stop trying automatically (surfaced in "Missing Episodes" log).
 */
export async function autoDownloadNewEpisodes(): Promise<{
  downloaded: number;
  skipped: number;
}> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Find episodes that aired >= 1h ago with mediaStatus NONE and either:
  // 1. Have NEVER been searched (mediaLastSearchAt: null) -> e.g. previously bookmarked older shows
  // 2. Aired within the last 8 days (gte: eightDaysAgo) -> ongoing shows within the retry window
  const episodes = await prisma.episode.findMany({
    where: {
      mediaStatus: MediaStatus.NONE,
      airingAt: { lte: oneHourAgo },
      OR: [
        { mediaLastSearchAt: null },
        { airingAt: { gte: eightDaysAgo } },
      ],
      animeDetails: {
        baseAnime: { animeDetails: { isNot: null } },
      },
    },
    include: {
      animeDetails: {
        include: { baseAnime: true },
      },
    },
    orderBy: { airingAt: "asc" },
  });

  log.info({ count: episodes.length }, "Checking candidate episodes for auto-download");

  let downloaded = 0;
  let skipped = 0;

  for (const episode of episodes) {
    // If episode aired > 2h ago and was searched within the last 24h, backoff to once per day
    if (
      episode.airingAt &&
      episode.airingAt < twoHoursAgo &&
      episode.mediaLastSearchAt &&
      episode.mediaLastSearchAt > twentyFourHoursAgo
    ) {
      skipped++;
      continue;
    }

    const baseAnime = episode.animeDetails.baseAnime;
    const animeName =
      baseAnime.titleEnglish ?? baseAnime.titleRomanji ?? baseAnime.titleNative ?? "Unknown";

    try {
      // Record last search timestamp
      await prisma.episode.update({
        where: { id: episode.id },
        data: { mediaLastSearchAt: now },
      });

      const { results, recommendation } = await getEpisodeTorrentOptions(episode.id);

      if (results.length === 0) {
        log.debug({ episodeId: episode.id, animeName }, "No results found, skipping");
        skipped++;
        continue;
      }

      if (recommendation.index === -1 || recommendation.confidence === "low") {
        log.debug(
          { episodeId: episode.id, confidence: recommendation.confidence, reason: recommendation.reason },
          "Low confidence recommendation, skipping auto-download",
        );
        skipped++;
        continue;
      }

      const torrent = results[recommendation.index];
      await startEpisodeDownload(episode.id, torrent, false);

      log.info(
        { episodeId: episode.id, animeName, episode: episode.number, torrent: torrent.title },
        "Auto-download started",
      );
      downloaded++;
    } catch (error) {
      log.warn({ episodeId: episode.id, error }, "Failed to auto-download episode");
      skipped++;
    }
  }

  return { downloaded, skipped };
}
