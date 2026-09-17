import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import type { Context } from "hono";
import { prisma } from "$src/prisma";
import { registry } from "$lib/streaming/registry";
import { logger } from "$src/logger";
import type { StreamLanguage } from "$lib/streaming/types";

const log = logger.child({ module: "downloadStream" });

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function getQualityScore(serviceName: string): number {
  const text = serviceName.toLowerCase();
  if (/\b1080p\b/i.test(text)) return 3;
  if (/\b720p\b/i.test(text)) return 2;
  if (/\b(hd|hq)\b/i.test(text)) return 1;
  return 0;
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

  let chosenProviderId = providerId;
  let chosenIdentifier = identifier;
  let chosenServer = server;

  if (!chosenProviderId || !chosenIdentifier) {
    const baseAnime = episode.animeDetails.baseAnime;
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
    candidates.sort(
      (a, b) =>
        getQualityScore(`${b.serverName} ${b.providerName}`) -
        getQualityScore(`${a.serverName} ${a.providerName}`),
    );

    const best = candidates[0];
    chosenProviderId = best.providerId;
    chosenIdentifier = best.identifier;
    chosenServer = best.serverId;
  }

  const streamSource = await registry.resolveStream(
    chosenProviderId,
    chosenIdentifier,
    episode.number,
    language,
    chosenServer,
  );

  if (!streamSource || !streamSource.url) {
    return c.json({ error: "No stream available from selected provider" }, 404);
  }

  const baseAnime = episode.animeDetails.baseAnime;
  const rawTitle = baseAnime.titleEnglish || baseAnime.titleRomanji || "Anime";
  const sanitizedTitle = rawTitle.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
  const filename = `${sanitizedTitle}_EP${episode.number}.mp4`;

  const args = [
    "-loglevel",
    "error",
    "-hide_banner",
    "-reconnect",
    "1",
    "-reconnect_at_eof",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "5",
  ];

  let headerStr = `User-Agent: ${DEFAULT_USER_AGENT}\r\n`;
  if (streamSource.headers?.Referer) {
    headerStr += `Referer: ${streamSource.headers.Referer}\r\n`;
    try {
      headerStr += `Origin: ${new URL(streamSource.headers.Referer).origin}\r\n`;
    } catch {}
  }
  args.push("-headers", headerStr);
  args.push("-i", streamSource.url);
  args.push(
    "-c",
    "copy",
    "-movflags",
    "frag_keyframe+empty_moov+default_base_moof",
    "-f",
    "mp4",
    "pipe:1",
  );

  const ffmpeg = spawn("ffmpeg", args);

  c.req.raw.signal.addEventListener("abort", () => {
    try {
      ffmpeg.kill("SIGKILL");
    } catch {}
  });

  ffmpeg.stderr.on("data", (data) => {
    log.warn({ episodeId, stderr: data.toString() }, "ffmpeg download warning");
  });

  ffmpeg.on("error", (err) => {
    log.error({ episodeId, err }, "ffmpeg process error");
  });

  const webStream = Readable.toWeb(ffmpeg.stdout);

  return new Response(webStream as any, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache",
    },
  });
}
