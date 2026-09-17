import { prisma } from "$src/prisma";
import { resolveTvdbMapping, getSeriesEpisodes } from "@ant.ms/thetvdb";
import { getAnimeScheduleDates } from "../animeschedule/getAnimeScheduleDates";

const LANGUAGE_ENGLISH = "eng";
const LANGUAGE_JAPANESE = "jpn";
const TVDB_IMAGE_BASE_URL = "https://artworks.thetvdb.com";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const parseAiredDate = (aired: string | null): Date | null => {
  if (!aired) return null;
  const date = new Date(aired);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeImageUrl = (image: string | null): string | null => {
  if (!image) return null;
  return image.startsWith("http") ? image : `${TVDB_IMAGE_BASE_URL}${image}`;
};

const cleanupStrayEpisodes = async (detailsId: number, effectiveEpisodeCount?: number | null) => {
  if (effectiveEpisodeCount && effectiveEpisodeCount > 0) {
    await prisma.episode.deleteMany({
      where: {
        animeDetailsId: detailsId,
        number: { gt: effectiveEpisodeCount },
      },
    });
  }
};

const upsertFallbackEpisodes = async (
  details: any,
  effectiveEpisodeCount: number | null | undefined,
  fallbackStartDate: Date | null | undefined
) => {
  const animeScheduleDates = await getAnimeScheduleDates(
    details.baseAnime,
    effectiveEpisodeCount ?? null
  );
  
  const existingCount = await prisma.episode.count({
    where: { animeDetailsId: details.id },
  });

  const fallbackCount =
    effectiveEpisodeCount && effectiveEpisodeCount > 0
      ? effectiveEpisodeCount
      : Math.max(animeScheduleDates?.size ?? 0, existingCount, 1);

  for (let number = 1; number <= fallbackCount; number++) {
    const airingAt =
      animeScheduleDates?.get(number) ??
      (number === 1 && fallbackStartDate ? fallbackStartDate : null);

    await prisma.episode.upsert({
      where: {
        animeDetailsId_number: { animeDetailsId: details.id, number },
      },
      update: {
        airingAt: airingAt ?? undefined,
      },
      create: {
        animeDetailsId: details.id,
        number,
        titleEnglish: `Episode ${number}`,
        airingAt,
      },
    });
  }
};

const calculateSyncedAiringDate = (asDate?: Date, tvdbDate?: Date | null): Date | null => {
  if (!asDate) return tvdbDate ?? null;
  if (!tvdbDate) return asDate;

  const diffTime = tvdbDate.getTime() - asDate.getTime();
  const weeksDiff = Math.round(diffTime / ONE_WEEK_MS);
  
  return new Date(asDate.getTime() + weeksDiff * ONE_WEEK_MS);
};

const fetchAndMapTvdbEpisodes = async (tvdbSeriesId: number) => {
  const [englishEpisodes, japaneseEpisodes] = await Promise.all([
    getSeriesEpisodes(tvdbSeriesId, LANGUAGE_ENGLISH),
    getSeriesEpisodes(tvdbSeriesId, LANGUAGE_JAPANESE),
  ]);

  const nativeNameById = new Map(
    japaneseEpisodes.map((episode) => [episode.id, episode.name])
  );

  return { englishEpisodes, nativeNameById };
};

export const upsertEpisodesForAnime = async (
  anilistId: number,
  expectedEpisodeCount?: number | null,
  fallbackStartDate?: Date | null
): Promise<void> => {
  const details = await prisma.animeDetails.findUnique({
    where: { baseAnimeAnilistId: anilistId },
    include: { baseAnime: true },
  });

  if (!details) return;

  let effectiveEpisodeCount = expectedEpisodeCount;
  if (effectiveEpisodeCount === undefined) {
    try {
      const { getAnimeDetailsFromAPI } = await import("$lib/anilistApi/animeDetails/getAnimeDetails");
      const apiDetails = await getAnimeDetailsFromAPI(anilistId);
      if (apiDetails) {
        effectiveEpisodeCount = apiDetails.episodes;
        if (!fallbackStartDate && apiDetails.startDate?.year && apiDetails.startDate?.month && apiDetails.startDate?.day) {
          fallbackStartDate = new Date(apiDetails.startDate.year, apiDetails.startDate.month - 1, apiDetails.startDate.day);
        }
      }
    } catch {
      effectiveEpisodeCount = null;
    }
  }

  if (effectiveEpisodeCount != null) {
    await cleanupStrayEpisodes(details.id, effectiveEpisodeCount);
  }

  if (!mapping) {
    await upsertFallbackEpisodes(details, effectiveEpisodeCount, fallbackStartDate);
    return;
  }

  const { englishEpisodes, nativeNameById } = await fetchAndMapTvdbEpisodes(mapping.tvdbSeriesId);
  
  const animeScheduleDates = await getAnimeScheduleDates(
    details.baseAnime,
    effectiveEpisodeCount ?? null
  );

  for (const episode of englishEpisodes) {
    if (episode.seasonNumber !== mapping.tvdbSeason) continue;

    const number = episode.number - mapping.tvdbEpisodeOffset;
    if (number < 1) continue;

    if (effectiveEpisodeCount != null && effectiveEpisodeCount > 0 && number > effectiveEpisodeCount) {
      continue;
    }

    const asDate = animeScheduleDates?.get(number);
    const tvdbDate = parseAiredDate(episode.aired);
    const airingAt = calculateSyncedAiringDate(asDate, tvdbDate);

    const episodeData = {
      airingAt,
      titleEnglish: episode.name || null,
      titleNative: nativeNameById.get(episode.id) || null,
      thumbnailUrl: normalizeImageUrl(episode.image),
    };

    await prisma.episode.upsert({
      where: {
        animeDetailsId_number: { animeDetailsId: details.id, number },
      },
      update: episodeData,
      create: { 
        animeDetailsId: details.id, 
        number, 
        ...episodeData 
      },
    });
  }
};
