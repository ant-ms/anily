import { prisma } from "$src/prisma";
import { registry, getServiceScore, type StreamLanguage } from "@ant.ms/anily-providers";
import {
  generateStreamSignature,
  DEFAULT_STREAM_EXPIRY_SECONDS,
} from "@medialy/stream-core";
import { getJimakuSubtitlesForEpisode } from "$src/services/jimaku";

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
    language?: "sub" | "dub" | "native";
    server?: string;
    origin: string;
  },
): Promise<SubtitlesResult> {
  const { providerId, identifier, language = "sub", server, origin } = options;
  const isNative = language === "native";
  const providerLang: StreamLanguage = isNative ? "sub" : language;

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
      providerLang,
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
      const langServices = services.filter((s) => s.language === providerLang);
      const candidates = langServices.length > 0 ? langServices : services;
      candidates.sort((a, b) => getServiceScore(b) - getServiceScore(a));

      for (const candidate of candidates) {
        try {
          const resolved = await registry.resolveStream(
            candidate.providerId,
            candidate.identifier,
            episode.number,
            providerLang,
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

  const nowUnix = Math.floor(Date.now() / 1000);
  const streamExpires = nowUnix + DEFAULT_STREAM_EXPIRY_SECONDS;
  const refParam = streamSource?.headers?.Referer
    ? `&ref=${encodeURIComponent(streamSource.headers.Referer)}`
    : "";

  const providerSubtitles: SubtitleTrackDto[] = (streamSource?.subtitles || []).map((sub) => {
    const subFilename = `sub_${sub.language || "en"}.vtt`;
    const subSig = generateStreamSignature(sub.url, streamExpires);
    const subUrl = `${origin}/api/stream/proxy/${subFilename}?url=${encodeURIComponent(
      sub.url,
    )}${refParam}&expires=${streamExpires}&sig=${subSig}`;
    return {
      label: sub.label,
      language: sub.language || "en",
      url: subUrl,
      // If native preset is active, disable default on provider (e.g. English) subs
      default: isNative ? false : sub.default,
    };
  });

  const refSub =
    providerSubtitles.find((s) => s.default || s.language === "en") || providerSubtitles[0];

  const baseAnime = episode.animeDetails.baseAnime;
  const titles = [
    baseAnime.titleEnglish,
    baseAnime.titleRomanji,
    baseAnime.titleNative,
  ].filter((t): t is string => Boolean(t));

  let jimakuSubtitles: SubtitleTrackDto[] = [];
  try {
    jimakuSubtitles = await getJimakuSubtitlesForEpisode(
      baseAnime.anilistId,
      episode.number,
      titles,
      {
        origin,
        expires: streamExpires,
        isNativeDefault: isNative,
        refSubUrl: refSub?.url,
      },
    );
  } catch {}

  const subtitles = [...providerSubtitles, ...jimakuSubtitles];

  return { subtitles };
}
