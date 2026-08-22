import { logger } from "$src/logger";

interface AnimeTitles {
  anilistId: number;
  titleRomanji?: string | null;
  titleEnglish?: string | null;
  titleNative?: string | null;
}

interface AnimeScheduleSearchResult {
  anime?: AnimeScheduleAnime[];
}

interface AnimeScheduleAnime {
  premier: string;
  subTime?: string;
  jpnTime?: string;
  episodes?: number;
  delayedFrom?: string;
  delayedUntil?: string;
  delayedTimetable?: string;
  mediaTypes?: { name: string }[];
  websites?: {
    aniList?: string;
  };
}

const ANIMESCHEDULE_API_URL = "https://animeschedule.net/api/v3/anime";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const INVALID_DATE_PREFIXES = ["0001-01-01", "0002-01-01"];

const buildSearchQuery = (anime: AnimeTitles): string => {
  return encodeURIComponent(anime.titleRomanji || anime.titleEnglish || anime.titleNative || "");
};

const fetchAnimeData = async (query: string): Promise<AnimeScheduleSearchResult | null> => {
  const headers: Record<string, string> = {};
  if (process.env.ANIMESCHEDULE_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.ANIMESCHEDULE_TOKEN}`;
  }

  const res = await fetch(`${ANIMESCHEDULE_API_URL}?q=${query}`, { headers });
  if (!res.ok) return null;

  return (await res.json()) as AnimeScheduleSearchResult;
};

const findMatchingAnime = (
  data: AnimeScheduleSearchResult,
  anilistId: number
): AnimeScheduleAnime | undefined => {
  return data.anime?.find((a) => a.websites?.aniList?.includes(`/${anilistId}`));
};

const isValidDate = (dateString?: string): boolean => {
  if (!dateString) return false;
  return !INVALID_DATE_PREFIXES.some((prefix) => dateString.startsWith(prefix));
};

const determineStartDate = (asAnime: AnimeScheduleAnime): Date | null => {
  if (!asAnime.premier) return null;

  const startDate = new Date(asAnime.premier);
  if (isNaN(startDate.getTime())) return null;

  const timeString = isValidDate(asAnime.subTime)
    ? asAnime.subTime
    : isValidDate(asAnime.jpnTime)
    ? asAnime.jpnTime
    : null;

  if (timeString) {
    const timeDate = new Date(timeString);
    if (!isNaN(timeDate.getTime())) {
      startDate.setUTCHours(
        timeDate.getUTCHours(),
        timeDate.getUTCMinutes(),
        timeDate.getUTCSeconds()
      );
    }
  }

  return startDate;
};

const getDelayInfo = (asAnime: AnimeScheduleAnime) => {
  const hasDelay =
    asAnime.delayedTimetable === "Delayed" &&
    isValidDate(asAnime.delayedFrom) &&
    isValidDate(asAnime.delayedUntil);

  if (!hasDelay || !asAnime.delayedFrom || !asAnime.delayedUntil) {
    return { hasDelay: false, delayStart: new Date(0), delayDurationMs: 0 };
  }

  const delayStart = new Date(asAnime.delayedFrom);
  const delayEnd = new Date(asAnime.delayedUntil);
  const delayDurationMs = delayEnd.getTime() - delayStart.getTime();

  return { hasDelay: true, delayStart, delayDurationMs };
};

const calculateEpisodeDates = (
  startDate: Date,
  episodes: number,
  asAnime: AnimeScheduleAnime
): Map<number, Date> => {
  const dates = new Map<number, Date>();
  const isMovie = asAnime.mediaTypes?.some((m) => m.name === "Movie");

  if (isMovie || episodes === 1) {
    dates.set(1, startDate);
    return dates;
  }

  const { hasDelay, delayStart, delayDurationMs } = getDelayInfo(asAnime);

  for (let episodeNumber = 1; episodeNumber <= episodes; episodeNumber++) {
    const weeksOffset = episodeNumber - 1;
    let episodeDate = new Date(startDate.getTime() + weeksOffset * ONE_WEEK_MS);

    if (hasDelay && episodeDate >= delayStart) {
      episodeDate = new Date(episodeDate.getTime() + delayDurationMs);
    }

    dates.set(episodeNumber, episodeDate);
  }

  return dates;
};

export const getAnimeScheduleDates = async (
  anime: AnimeTitles,
  expectedEpisodeCount: number | null
): Promise<Map<number, Date> | null> => {
  const query = buildSearchQuery(anime);
  if (!query) return null;

  try {
    const data = await fetchAnimeData(query);
    if (!data) return null;

    const asAnime = findMatchingAnime(data, anime.anilistId);
    if (!asAnime) return null;

    const startDate = determineStartDate(asAnime);
    if (!startDate) return null;

    const episodes = expectedEpisodeCount || asAnime.episodes || 1;

    return calculateEpisodeDates(startDate, episodes, asAnime);
  } catch (err) {
    logger.error({ err, anilistId: anime.anilistId }, "Failed to fetch AnimeSchedule dates");
    return null;
  }
};
