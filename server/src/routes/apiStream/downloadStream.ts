import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import type { Context } from 'hono';
import { prisma } from '$src/prisma';
import {
  registry,
  getServiceScore,
  type StreamLanguage,
  type SubtitleTrack,
} from "@ant.ms/anily-providers";
import { logger } from '$src/logger';
import { errorTracker } from '$src/errorTracker';

const log = logger.child({ module: "downloadStream" });

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// In-memory cache of servers that recently hit HTTP 429 rate limits, with expiration timestamp
const rateLimitedServers = new Map<string, number>();

export function getRateLimitServerKey(candidate: { providerId: string; serverId?: string; serverName?: string }): string {
  return `${candidate.providerId}:${candidate.serverId || candidate.serverName || "default"}`.toLowerCase();
}

export function markServerRateLimited(
  providerId: string,
  serverId?: string,
  serverName?: string,
  cooldownMs = 15 * 60 * 1000,
): void {
  const key = getRateLimitServerKey({ providerId, serverId, serverName });
  rateLimitedServers.set(key, Date.now() + cooldownMs);
  log.warn({ key, cooldownMs }, "Marked server as rate-limited for downloads");
}

export function isServerRateLimited(
  providerId: string,
  serverId?: string,
  serverName?: string,
): boolean {
  const key = getRateLimitServerKey({ providerId, serverId, serverName });
  const expires = rateLimitedServers.get(key);
  if (!expires) return false;
  if (Date.now() > expires) {
    rateLimitedServers.delete(key);
    return false;
  }
  return true;
}

export function clearRateLimitedServers(): void {
  rateLimitedServers.clear();
}

interface StartedFfmpeg {
  process: ReturnType<typeof spawn>;
  webStream: ReadableStream<Uint8Array>;
}

interface StartFfmpegOptions {
  signal?: AbortSignal;
  trace?: ReturnType<typeof errorTracker.startTrace>;
  providerName?: string;
  serverName?: string;
  onRateLimited?: () => void;
}

function checkStderrForFatalErrors(chunkStr: string): { isFatal: boolean; message: string; isRateLimit: boolean } {
  if (
    chunkStr.includes("429 Too Many Requests") ||
    chunkStr.includes("HTTP error 429") ||
    chunkStr.includes("Server returned 429")
  ) {
    return {
      isFatal: true,
      isRateLimit: true,
      message: "Upstream CDN returned HTTP 429 Too Many Requests (rate limit reached)",
    };
  }

  if (
    /Segment \d+ of playlist \d+ failed too many times, skipping/i.test(chunkStr) ||
    /failed too many times, skipping/i.test(chunkStr)
  ) {
    return {
      isFatal: true,
      isRateLimit: false,
      message: "HLS segment skipped due to download failure; aborting to prevent truncated video",
    };
  }

  return { isFatal: false, message: "", isRateLimit: false };
}

function startFfmpegStream(
  streamSource: {
    url: string;
    container?: string;
    headers?: Record<string, string>;
    subtitles?: SubtitleTrack[];
  },
  options?: StartFfmpegOptions,
): Promise<StartedFfmpeg> {
  return new Promise((resolve, reject) => {
    const isHls = streamSource.container === "hls" || streamSource.url.includes(".m3u8");

    const args = [
      "-loglevel",
      "warning",
      "-hide_banner",
    ];

    if (isHls) {
      args.push("-extension_picky", "0");
      // Throttle HLS chunk requests to prevent triggering CDN burst rate limits (e.g. HTTP 429)
      args.push("-readrate", "12");
      args.push("-seg_max_retry", "5");
    }

    args.push(
      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_on_http_error",
      "4xx,5xx",
      "-reconnect_delay_max",
      "5",
    );

    let headerStr = `User-Agent: ${DEFAULT_USER_AGENT}\r\n`;
    if (streamSource.headers?.Referer) {
      headerStr += `Referer: ${streamSource.headers.Referer}\r\n`;
      try {
        headerStr += `Origin: ${new URL(streamSource.headers.Referer).origin}\r\n`;
      } catch {}
    }
    args.push("-headers", headerStr);
    args.push("-i", streamSource.url);

    const bestSub = streamSource.subtitles?.find((s) => s.default) ||
      streamSource.subtitles?.find((s) => s.language === "en" || s.language === "eng") ||
      streamSource.subtitles?.[0];

    if (bestSub?.url) {
      args.push("-headers", headerStr);
      args.push("-i", bestSub.url);
      args.push("-map", "0:v:0");
      args.push("-map", "0:a:0?");
      args.push("-map", "1:s:0?");
      args.push("-c:v", "copy");
      args.push("-c:a", "copy");
      args.push("-c:s", "mov_text");
      args.push("-metadata:s:s:0", `language=${bestSub.language || "eng"}`);
      args.push("-metadata:s:s:0", `title=${bestSub.label || "English"}`);
    } else {
      args.push("-c", "copy");
    }

    args.push(
      "-bsf:a",
      "aac_adtstoasc",
      "-movflags",
      "frag_keyframe+empty_moov+default_base_moof",
      "-f",
      "mp4",
      "pipe:1",
    );

    const ffmpeg = spawn("ffmpeg", args);
    let stderr = "";
    let started = false;
    let streamClosed = false;
    let stdoutEnded = false;
    let processClosed = false;
    let exitCode: number | null = null;
    let hasFatalError = false;
    let fatalErrorMessage = "";
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

    const killFfmpeg = () => {
      try {
        ffmpeg.kill("SIGKILL");
      } catch {}
    };

    if (options?.signal) {
      options.signal.addEventListener("abort", killFfmpeg, { once: true });
    }

    const finish = () => {
      if (streamClosed) return;
      streamClosed = true;
      killFfmpeg();

      if (hasFatalError || (exitCode !== null && exitCode !== 0)) {
        const errorDetail = fatalErrorMessage || (stderr.trim() ? stderr.trim().slice(-300) : `ffmpeg exited with code ${exitCode}`);
        const err = new Error(errorDetail);
        log.error(
          { error: err, exitCode, provider: options?.providerName, server: options?.serverName },
          "Download stream terminated with error",
        );
        options?.trace?.fail(err, { message: errorDetail, statusCode: 502 });
        if (streamController) {
          try {
            streamController.error(err);
          } catch {}
        }
      } else {
        options?.trace?.step("FFmpeg stream completed successfully");
        if (streamController) {
          try {
            streamController.close();
          } catch {}
        }
      }
    };

    ffmpeg.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      const errorCheck = checkStderrForFatalErrors(text);
      if (errorCheck.isFatal && !hasFatalError) {
        hasFatalError = true;
        fatalErrorMessage = errorCheck.message;
        if (errorCheck.isRateLimit) {
          options?.onRateLimited?.();
        }
        if (started && streamController && !streamClosed) {
          finish();
        }
      }
    });

    const cleanup = () => {
      clearTimeout(timer);
      ffmpeg.stdout.removeListener("data", onData);
      ffmpeg.removeListener("error", onError);
      ffmpeg.removeListener("close", onClose);
    };

    const timer = setTimeout(() => {
      if (!started) {
        cleanup();
        killFfmpeg();
        const errDetail = stderr.trim() ? `: ${stderr.trim().slice(-300)}` : "";
        reject(new Error(`ffmpeg startup timed out${errDetail}`));
      }
    }, 25000);

    const onError = (err: Error) => {
      if (!started) {
        cleanup();
        reject(err);
      } else {
        hasFatalError = true;
        fatalErrorMessage = err.message;
        finish();
      }
    };

    const onClose = (code: number | null) => {
      if (!started) {
        cleanup();
        reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
      }
    };

    ffmpeg.on("close", (code) => {
      processClosed = true;
      exitCode = code;
      if (started) {
        finish();
      }
    });

    const onData = (firstChunk: Buffer) => {
      started = true;
      cleanup();

      ffmpeg.stdout.pause();

      const webStream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
          controller.enqueue(new Uint8Array(firstChunk));

          ffmpeg.stdout.on("data", (chunk: Buffer) => {
            if (!streamClosed) {
              try {
                controller.enqueue(new Uint8Array(chunk));
              } catch {}
            }
          });

          ffmpeg.stdout.on("end", () => {
            stdoutEnded = true;
            if (processClosed || hasFatalError) {
              finish();
            }
          });

          ffmpeg.stdout.on("error", (err) => {
            hasFatalError = true;
            fatalErrorMessage = err.message;
            finish();
          });

          ffmpeg.stdout.resume();
        },
        cancel() {
          streamClosed = true;
          killFfmpeg();
        },
      });

      resolve({ process: ffmpeg, webStream });
    };

    ffmpeg.stdout.once("data", onData);
    ffmpeg.once("error", onError);
    ffmpeg.once("close", onClose);
  });
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
    },
  });
}
