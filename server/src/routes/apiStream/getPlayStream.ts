import { prisma } from "$src/prisma";
import { registry, type StreamLanguage } from "@ant.ms/anily-providers";
import {
  extractFilename,
  generateStreamSignature,
  DEFAULT_STREAM_EXPIRY_SECONDS,
} from "@medialy/stream-core";
import { getJimakuSubtitlesForEpisode } from "$src/services/jimaku";

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
    language: "sub" | "dub" | "native";
    server?: string;
    origin: string;
  },
): Promise<PlayStreamResult> {
  const { providerId, identifier, language, server, origin } = options;
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

  const streamSource = await registry.resolveStream(
    providerId,
    identifier,
    episode.number,
    providerLang,
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

  const providerSubtitles = (streamSource.subtitles || []).map((sub) => {
    const subFilename = `sub_${sub.language || "en"}.vtt`;
    const subSig = generateStreamSignature(sub.url, streamExpires);
    const subUrl = `${origin}/api/stream/proxy/${subFilename}?url=${encodeURIComponent(
      sub.url,
    )}${refParam}&expires=${streamExpires}&sig=${subSig}`;
    return {
      label: sub.label,
      language: sub.language,
      url: subUrl,
      default: isNative ? false : sub.default,
    };
  });

  const refSub =
    providerSubtitles.find((s) => s.default || s.language === "en") || providerSubtitles[0];

  let jimakuSubtitles: Array<{
    label: string;
    language: string;
    url: string;
    default?: boolean;
  }> = [];

  if (episode.animeDetails?.baseAnime) {
    const baseAnime = episode.animeDetails.baseAnime;
    const titles = [
      baseAnime.titleEnglish,
      baseAnime.titleRomanji,
      baseAnime.titleNative,
    ].filter((t): t is string => Boolean(t));

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
  }

  const allSubtitles = [...providerSubtitles, ...jimakuSubtitles];

  let subsParam = "";
  if (allSubtitles.length > 0) {
    const subsPayload = allSubtitles.map((s) => ({
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

  return {
    streamUrl,
    container: streamSource.container,
    serverName: streamSource.serverName,
    subtitles: allSubtitles,
  };
}
