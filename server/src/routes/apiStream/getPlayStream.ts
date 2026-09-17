import { prisma } from "$src/prisma";
import { registry } from "$lib/streaming/registry";
import { extractFilename } from "$lib/streaming/proxy";
import type { StreamLanguage } from "$lib/streaming/types";

export interface PlayStreamResult {
  streamUrl?: string;
  container?: "hls" | "mp4";
  serverName?: string;
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
  const streamUrl = `${origin}/api/stream/proxy/${filename}?url=${encodeURIComponent(
    streamSource.url,
  )}${refParam}`;

  return {
    streamUrl,
    container: streamSource.container,
    serverName: streamSource.serverName,
  };
}
