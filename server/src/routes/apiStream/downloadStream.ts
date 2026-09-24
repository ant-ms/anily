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

const log = logger.child({ module: "downloadStream" });

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

interface StartedFfmpeg {
  process: ReturnType<typeof spawn>;
  webStream: ReadableStream<Uint8Array>;
}

function startFfmpegStream(
  streamSource: {
    url: string;
    container?: string;
    headers?: Record<string, string>;
    subtitles?: SubtitleTrack[];
  },
  signal?: AbortSignal,
): Promise<StartedFfmpeg> {
  return new Promise((resolve, reject) => {
    const isHls = streamSource.container === "hls" || streamSource.url.includes(".m3u8");

    const args = [
      "-loglevel",
      "error",
      "-hide_banner",
    ];

    if (isHls) {
      args.push("-extension_picky", "0");
    }

    args.push(
      "-reconnect",
      "1",
      "-reconnect_at_eof",
      "1",
      "-reconnect_streamed",
      "1",
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

    const killFfmpeg = () => {
      try {
        ffmpeg.kill("SIGKILL");
      } catch {}
    };

    if (signal) {
      signal.addEventListener("abort", killFfmpeg, { once: true });
    }

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
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
        reject(new Error("ffmpeg startup timed out"));
      }
    }, 15000);

    const onError = (err: Error) => {
      if (!started) {
        cleanup();
        reject(err);
      }
    };

    const onClose = (code: number | null) => {
      if (!started) {
        cleanup();
        reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
      }
    };

    const onData = (firstChunk: Buffer) => {
      started = true;
      cleanup();

      ffmpeg.stdout.pause();

      const webStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(firstChunk));

          ffmpeg.stdout.on("data", (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk));
          });

          ffmpeg.stdout.on("end", () => {
            try {
              controller.close();
            } catch {}
          });

          ffmpeg.stdout.on("error", (err) => {
            try {
              controller.error(err);
            } catch {}
          });

          ffmpeg.stdout.resume();
        },
        cancel() {
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
    return c.json({ error: "Episode not found" }, 404);
  }

  const baseAnime = episode.animeDetails.baseAnime;
  const rawTitle = baseAnime.titleEnglish || baseAnime.titleRomanji || "Anime";
  const sanitizedTitle = rawTitle.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
  const filename = `${sanitizedTitle}_EP${episode.number}.mp4`;

  let activeDownload: StartedFfmpeg | null = null;
  let lastError: Error | null = null;

  if (providerId && identifier) {
    const streamSource = await registry.resolveStream(
      providerId,
      identifier,
      episode.number,
      language,
      server,
    );

    if (!streamSource || !streamSource.url) {
      return c.json({ error: "No stream available from selected provider" }, 404);
    }

    try {
      activeDownload = await startFfmpegStream(streamSource, c.req.raw.signal);
    } catch (err) {
      log.error({ error: err, episodeId, providerId }, "Failed to start ffmpeg for selected provider");
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  } else {
    const titles = [
      baseAnime.titleEnglish,
      baseAnime.titleRomanji,
      baseAnime.titleNative,
    ].filter((t): t is string => Boolean(t));

    const services = await registry.checkAvailability(titles, episode.number);
    if (services.length === 0) {
      return c.json({ error: "No streaming services available for this episode" }, 404);
    }

    const langServices = services.filter((s) => s.language === language);
    const candidates = langServices.length > 0 ? langServices : services;
    candidates.sort((a, b) => getServiceScore(b) - getServiceScore(a));

    // Try candidates in order until ffmpeg starts successfully
    for (const candidate of candidates) {
      try {
        const streamSource = await registry.resolveStream(
          candidate.providerId,
          candidate.identifier,
          episode.number,
          language,
          candidate.serverId,
        );
        if (!streamSource || !streamSource.url) {
          continue;
        }

        activeDownload = await startFfmpegStream(streamSource, c.req.raw.signal);
        log.info(
          { episodeId, provider: candidate.providerName, server: candidate.serverName },
          "Successfully started download stream with provider",
        );
        break;
      } catch (err) {
        log.warn(
          { error: err, candidate: candidate.serverName, episodeId },
          "Candidate stream failed to start ffmpeg muxer, trying next candidate...",
        );
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  if (!activeDownload) {
    return c.json(
      {
        error: "Failed to download stream from available providers",
        reason: lastError?.message || "No streams produced playable output",
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
