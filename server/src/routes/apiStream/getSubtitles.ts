import { prisma } from "$src/prisma";
import { registry, getServiceScore, type StreamLanguage } from "@ant.ms/anily-providers";
import {
  generateStreamSignature,
  DEFAULT_STREAM_EXPIRY_SECONDS,
} from "$lib/streaming/hmac";

export interface SubtitleTrackDto {
  label: string;
  language: string;
  url: string;
  default?: boolean;
}

export interface SubtitlesResult {
  notFound?: boolean;
  subtitles?: SubtitleTrackDto[];
}

export async function resolveEpisodeSubtitles(
  episodeId: number,
  options: {
    providerId?: string;
    identifier?: string;
    language?: StreamLanguage;
    server?: string;
    origin: string;
  },
): Promise<SubtitlesResult> {
  const { providerId, identifier, language = "sub", server, origin } = options;

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      animeDetails: {
        include: { baseAnime: true },
      },
    },
  });

  if (!episode) {
    return { notFound: true };
  }

  let streamSource: Awaited<ReturnType<typeof registry.resolveStream>> | null = null;

  if (providerId && identifier) {
    streamSource = await registry.resolveStream(
      providerId,
      identifier,
      episode.number,
      language,
      server,
    );
  } else {
    const baseAnime = episode.animeDetails.baseAnime;
    const titles = [
      baseAnime.titleEnglish,
      baseAnime.titleRomanji,
      baseAnime.titleNative,
    ].filter((t): t is string => Boolean(t));

    const services = await registry.checkAvailability(titles, episode.number);
    if (services.length > 0) {
      const langServices = services.filter((s) => s.language === language);
      const candidates = langServices.length > 0 ? langServices : services;
      candidates.sort((a, b) => getServiceScore(b) - getServiceScore(a));

      for (const candidate of candidates) {
        try {
          const resolved = await registry.resolveStream(
            candidate.providerId,
            candidate.identifier,
            episode.number,
            language,
            candidate.serverId,
          );
          if (resolved?.subtitles && resolved.subtitles.length > 0) {
            streamSource = resolved;
            break;
          }
          if (resolved && !streamSource) {
            streamSource = resolved;
          }
        } catch {}
      }
    }
  }

  if (!streamSource || !streamSource.subtitles || streamSource.subtitles.length === 0) {
    return { subtitles: [] };
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const streamExpires = nowUnix + DEFAULT_STREAM_EXPIRY_SECONDS;
  const refParam = streamSource.headers?.Referer
    ? `&ref=${encodeURIComponent(streamSource.headers.Referer)}`
    : "";

  const subtitles: SubtitleTrackDto[] = streamSource.subtitles.map((sub) => {
    const subFilename = `sub_${sub.language || "en"}.vtt`;
    const subSig = generateStreamSignature(sub.url, streamExpires);
    const subUrl = `${origin}/api/stream/proxy/${subFilename}?url=${encodeURIComponent(
      sub.url,
    )}${refParam}&expires=${streamExpires}&sig=${subSig}`;
    return {
      label: sub.label,
      language: sub.language || "en",
      url: subUrl,
      default: sub.default,
    };
  });

  return { subtitles };
}
