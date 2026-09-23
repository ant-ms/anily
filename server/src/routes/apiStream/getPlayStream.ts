import { prisma } from "$src/prisma";
import { registry } from "$lib/streaming/registry";
import { extractFilename } from "$lib/streaming/proxy";
import type { StreamLanguage } from "$lib/streaming/types";
import {
  generateStreamSignature,
  DEFAULT_STREAM_EXPIRY_SECONDS,
} from "$lib/streaming/hmac";

export interface PlayStreamResult {
  streamUrl?: string;
  container?: "hls" | "mp4";
  serverName?: string;
  subtitles?: Array<{
    label: string;
    language: string;
    url: string;
    default?: boolean;
  }>;
  notFound?: boolean;
  unavailable?: boolean;
}

export async function resolvePlayStream(
  episodeId: number,
  options: {
    providerId: string;
    identifier: string;
    language: StreamLanguage;
    server?: string;
    origin: string;
  },
): Promise<PlayStreamResult> {
  const { providerId, identifier, language, server, origin } = options;

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
  });

  if (!episode) {
    return { notFound: true };
  }

  const streamSource = await registry.resolveStream(
    providerId,
    identifier,
    episode.number,
    language,
    server,
  );

  if (!streamSource) {
    return { unavailable: true };
  }

  const ext = streamSource.container === "hls" ? "master.m3u8" : "video.mp4";
  const filename = extractFilename(streamSource.url) || ext;
  const refParam = streamSource.headers?.Referer
    ? `&ref=${encodeURIComponent(streamSource.headers.Referer)}`
    : "";

  const nowUnix = Math.floor(Date.now() / 1000);
  const streamExpires = nowUnix + DEFAULT_STREAM_EXPIRY_SECONDS;
  const streamSig = generateStreamSignature(streamSource.url, streamExpires);

  let subsParam = "";
  if (streamSource.subtitles && streamSource.subtitles.length > 0) {
    const subsPayload = streamSource.subtitles.map((s) => ({
      l: s.label,
      lang: s.language,
      u: s.url,
      d: s.default,
    }));
    subsParam = `&subs=${encodeURIComponent(JSON.stringify(subsPayload))}`;
  }

  const streamUrl = `${origin}/api/stream/proxy/${filename}?url=${encodeURIComponent(
    streamSource.url,
  )}${refParam}${subsParam}&expires=${streamExpires}&sig=${streamSig}`;

  const subtitles = (streamSource.subtitles || []).map((sub) => {
    const subFilename = `sub_${sub.language || "en"}.vtt`;
    const subSig = generateStreamSignature(sub.url, streamExpires);
    const subUrl = `${origin}/api/stream/proxy/${subFilename}?url=${encodeURIComponent(
      sub.url,
    )}${refParam}&expires=${streamExpires}&sig=${subSig}`;
    return {
      label: sub.label,
      language: sub.language,
      url: subUrl,
      default: sub.default,
    };
  });

  return {
    streamUrl,
    container: streamSource.container,
    serverName: streamSource.serverName,
    subtitles,
  };
}
