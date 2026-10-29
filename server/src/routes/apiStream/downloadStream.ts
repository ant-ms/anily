import type { Context } from 'hono';
import { prisma } from '$src/prisma';
import {
  registry,
  getServiceScore,
  type StreamLanguage,
  type SubtitleTrack,
} from "@ant.ms/anily-providers";
import {
  getRateLimitServerKey,
  markServerRateLimited as coreMarkServerRateLimited,
  isServerRateLimited,
  clearRateLimitedServers,
  startFfmpegStream,
  type StartedFfmpeg,
} from "@medialy/stream-core";
import { logger } from '$src/logger';
import { errorTracker } from '$src/errorTracker';

const log = logger.child({ module: "downloadStream" });

export { getRateLimitServerKey, isServerRateLimited, clearRateLimitedServers };

export function markServerRateLimited(
  providerId: string,
  serverId?: string,
  serverName?: string,
  cooldownMs = 15 * 60 * 1000,
): void {
  const key = getRateLimitServerKey({ providerId, serverId, serverName });
  coreMarkServerRateLimited(providerId, serverId, serverName, cooldownMs);
  log.warn({ key, cooldownMs }, "Marked server as rate-limited for downloads");
}

export async function handleStreamDownload(
  c: Context,
  episodeId: number,
  options: {
    providerId?: string;
    identifier?: string;
    language: StreamLanguage;
    server?: string;
  },
): Promise<Response> {
  const { providerId, identifier, language, server } = options;

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      animeDetails: {
        include: { baseAnime: true },
      },
    },
  });

  if (!episode) {
    errorTracker.recordError({
      category: "DOWNLOAD",
      action: `Download Episode ${episodeId}`,
      message: `Episode #${episodeId} not found in database`,
      statusCode: 404,
      endpoint: c.req.url,
      method: "GET",
      params: { episodeId },
    });
    return c.json({ error: "Episode not found" }, 404);
  }

  const baseAnime = episode.animeDetails.baseAnime;
  const rawTitle = baseAnime.titleEnglish || baseAnime.titleRomanji || "Anime";
  const sanitizedTitle = rawTitle.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
  const filename = `${sanitizedTitle}_EP${episode.number}.mp4`;

  const trace = errorTracker.startTrace(
    "DOWNLOAD",
    `Download ${rawTitle} - Episode ${episode.number}`,
    {
      episodeId,
      episodeNumber: episode.number,
      animeTitle: rawTitle,
      anilistId: baseAnime.anilistId,
      language,
      providerId,
      identifier,
      server,
      filename,
    },
  );

  let activeDownload: StartedFfmpeg | null = null;
  let lastError: Error | null = null;

  if (providerId && identifier) {
    trace.step("Resolving stream from specified provider", { providerId, identifier, server, language });
    const streamSource = await registry.resolveStream(
      providerId,
      identifier,
      episode.number,
      language,
      server,
    );

    if (!streamSource || !streamSource.url) {
      trace.fail(new Error("No stream available from selected provider"), {
        statusCode: 404,
        endpoint: c.req.url,
        method: "GET",
        message: `Provider ${providerId} returned no playable stream URL`,
      });
      return c.json({ error: "No stream available from selected provider" }, 404);
    }

    try {
      trace.step("Starting FFmpeg muxer for stream", {
        container: streamSource.container,
        hasSubtitles: Boolean(streamSource.subtitles?.length),
      });
      activeDownload = await startFfmpegStream(streamSource, {
        signal: c.req.raw.signal,
        trace,
        providerName: providerId,
        serverName: server,
        onRateLimited: () => markServerRateLimited(providerId, server),
      });
      trace.step("FFmpeg stream established successfully");
    } catch (err) {
      log.error({ error: err, episodeId, providerId }, "Failed to start ffmpeg for selected provider");
      lastError = err instanceof Error ? err : new Error(String(err));
      trace.warn("FFmpeg failed to start for selected provider", {
        error: lastError.message,
      });
    }
  } else {
    const titles = [
      baseAnime.titleEnglish,
      baseAnime.titleRomanji,
      baseAnime.titleNative,
    ].filter((t): t is string => Boolean(t));

    trace.step("Searching provider availability for titles", { titles, episodeNumber: episode.number });

    const services = await registry.checkAvailability(titles, episode.number);
    if (services.length === 0) {
      trace.fail(new Error("No streaming services available for this episode"), {
        statusCode: 404,
        endpoint: c.req.url,
        method: "GET",
        message: `No streaming services found matching titles: ${titles.join(", ")}`,
      });
      return c.json({ error: "No streaming services available for this episode" }, 404);
    }

    const langServices = services.filter((s) => s.language === language);
    const candidates = langServices.length > 0 ? langServices : services;

    // Sort candidates for download:
    // 1. Move recently rate-limited servers to the back.
    // 2. Prefer providers that do not throttle/rate-limit downloads (e.g. ZokoAnime).
    candidates.sort((a, b) => {
      const aRateLimited = isServerRateLimited(a.providerId, a.serverId, a.serverName);
      const bRateLimited = isServerRateLimited(b.providerId, b.serverId, b.serverName);
      if (aRateLimited && !bRateLimited) return 1;
      if (!aRateLimited && bRateLimited) return -1;

      // Bonus for known high-throughput unthrottled servers for downloads
      const aIsZoko = a.serverName?.toLowerCase().includes("zoko") || a.providerId === "zokoanime";
      const bIsZoko = b.serverName?.toLowerCase().includes("zoko") || b.providerId === "zokoanime";
      const aBonus = aIsZoko ? 6 : 0;
      const bBonus = bIsZoko ? 6 : 0;

      return (getServiceScore(b) + bBonus) - (getServiceScore(a) + aBonus);
    });

    trace.step("Found candidates", {
      totalFound: services.length,
      candidatesInOrder: candidates.map((c) => ({
        provider: c.providerName,
        server: c.serverName,
        language: c.language,
        score: getServiceScore(c),
        isRateLimited: isServerRateLimited(c.providerId, c.serverId, c.serverName),
      })),
    });

    const triedUrls = new Set<string>();

    // Try candidates in order until ffmpeg starts successfully
    for (const candidate of candidates) {
      try {
        trace.step(`Resolving candidate stream: ${candidate.providerName} (${candidate.serverName})`);
        const streamSource = await registry.resolveStream(
          candidate.providerId,
          candidate.identifier,
          episode.number,
          language,
          candidate.serverId,
        );
        if (!streamSource || !streamSource.url) {
          trace.warn(`Candidate ${candidate.providerName} returned empty stream URL`);
          continue;
        }

        if (triedUrls.has(streamSource.url)) {
          trace.step(
            `Skipping candidate ${candidate.providerName} (${candidate.serverName}): identical stream URL already attempted`,
          );
          continue;
        }
        triedUrls.add(streamSource.url);

        trace.step(`Spawning FFmpeg for ${candidate.providerName} (${candidate.serverName})`, {
          container: streamSource.container,
          hasSubtitles: Boolean(streamSource.subtitles?.length),
        });

        activeDownload = await startFfmpegStream(streamSource, {
          signal: c.req.raw.signal,
          trace,
          providerName: candidate.providerName,
          serverName: candidate.serverName,
          onRateLimited: () => markServerRateLimited(candidate.providerId, candidate.serverId, candidate.serverName),
        });
        log.info(
          { episodeId, provider: candidate.providerName, server: candidate.serverName },
          "Successfully started download stream with provider",
        );
        trace.step(`Successfully started stream with ${candidate.providerName} (${candidate.serverName})`);
        break;
      } catch (err) {
        log.warn(
          { error: err, candidate: candidate.serverName, episodeId },
          "Candidate stream failed to start ffmpeg muxer, trying next candidate...",
        );
        lastError = err instanceof Error ? err : new Error(String(err));
        trace.warn(`Candidate ${candidate.providerName} failed to mux stream`, {
          error: lastError.message,
        });
      }
    }
  }

  if (!activeDownload) {
    const errorMsg = lastError?.message || "No streams produced playable output";
    trace.fail(lastError || new Error(errorMsg), {
      statusCode: 502,
      endpoint: c.req.url,
      method: "GET",
      message: `Failed to download stream: ${errorMsg}`,
    });
    return c.json(
      {
        error: "Failed to download stream from available providers",
        reason: errorMsg,
      },
      502,
    );
  }

  return new Response(activeDownload.webStream as any, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache",
      "Accept-Ranges": "none",
    },
  });
}
