import { logger } from "$src/logger";

interface AnimeTitles {
  anilistId: number;
  titleRomanji?: string | null;
  titleEnglish?: string | null;
  titleNative?: string | null;
}

export const getAnimeScheduleDates = async (
  anime: AnimeTitles,
  expectedEpisodeCount: number | null
): Promise<Map<number, Date> | null> => {
  const query = encodeURIComponent(
    anime.titleRomanji || anime.titleEnglish || anime.titleNative || ""
  );
  if (!query) return null;

  try {
    const headers: Record<string, string> = {};
    if (process.env.ANIMESCHEDULE_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.ANIMESCHEDULE_TOKEN}`;
    }

    const res = await fetch(`https://animeschedule.net/api/v3/anime?q=${query}`, {
      headers,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as any;
    const asAnime = data.anime?.find((a: any) =>
      a.websites?.aniList?.includes(`/${anime.anilistId}`)
    );

    if (!asAnime) return null;

    const isValidDate = (dStr: string) => {
      return dStr && !dStr.startsWith("0001-01-01") && !dStr.startsWith("0002-01-01");
    };

    let startStr = asAnime.premier;
    if (isValidDate(asAnime.subTime)) startStr = asAnime.subTime;
    else if (isValidDate(asAnime.jpnTime)) startStr = asAnime.jpnTime;

    const startDate = new Date(startStr);
    if (isNaN(startDate.getTime())) return null;

    const episodes = expectedEpisodeCount || asAnime.episodes || 1;
    const isMovie = asAnime.mediaTypes?.some((m: any) => m.name === "Movie");

    const dates = new Map<number, Date>();

    if (isMovie || episodes === 1) {
      dates.set(1, startDate);
      return dates;
    }

    const delayStart = new Date(asAnime.delayedFrom);
    const delayEnd = new Date(asAnime.delayedUntil);
    const hasDelay =
      asAnime.delayedTimetable === "Delayed" &&
      isValidDate(asAnime.delayedFrom) &&
      isValidDate(asAnime.delayedUntil);

    let delayDuration = 0;
    if (hasDelay) {
      delayDuration = delayEnd.getTime() - delayStart.getTime();
    }

    for (let i = 1; i <= episodes; i++) {
      let epDate = new Date(startDate.getTime() + (i - 1) * 7 * 24 * 60 * 60 * 1000);

      if (hasDelay && epDate >= delayStart) {
        epDate = new Date(epDate.getTime() + delayDuration);
      }

      dates.set(i, epDate);
    }

    return dates;
  } catch (err) {
    logger.error({ err, anilistId: anime.anilistId }, "Failed to fetch AnimeSchedule dates");
    return null;
  }
};
