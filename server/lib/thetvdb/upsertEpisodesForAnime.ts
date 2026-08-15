import { prisma } from "$src/prisma";
import { resolveTvdbMapping } from "./animeTvdbMapping";
import { getSeriesEpisodes } from "./getSeriesEpisodes";
import { logger } from "$src/logger";
import { getAnimeScheduleDates } from "../animeschedule/getAnimeScheduleDates";

const ENGLISH = "eng";
const JAPANESE = "jpn";

const parseAiredDate = (aired: string | null): Date | null => {
  if (!aired) return null;
  const date = new Date(aired);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeImageUrl = (image: string | null): string | null => {
  if (!image) return null;
  return image.startsWith("http")
    ? image
    : `https://artworks.thetvdb.com${image}`;
};

export const upsertEpisodesForAnime = async (
  anilistId: number,
  expectedEpisodeCount?: number | null,
  fallbackStartDate?: Date | null,
): Promise<void> => {
  const details = await prisma.animeDetails.findUnique({
    where: { baseAnimeAnilistId: anilistId },
    include: { baseAnime: true },
  });
  if (!details) return;

  const mapping = await resolveTvdbMapping(anilistId);

  let effectiveEpisodeCount = expectedEpisodeCount;
  
  if (effectiveEpisodeCount === undefined) {
    // During manual refresh, we don't query Anilist to avoid API spam.
    // Instead, we use the highest episode number currently in the DB as the cap.
    // The periodic sync is responsible for increasing this cap when new episodes air.
    const maxEp = await prisma.episode.findFirst({
      where: { animeDetailsId: details.id },
      orderBy: { number: 'desc' }
    });
    effectiveEpisodeCount = maxEp?.number;
  }

  // Cleanup stray episodes that may have been previously created beyond the cap
  if (effectiveEpisodeCount != null && effectiveEpisodeCount > 0) {
    await prisma.episode.deleteMany({
      where: {
        animeDetailsId: details.id,
        number: { gt: effectiveEpisodeCount },
      },
    });
  }

  if (!mapping) {
    const animeScheduleDates = await getAnimeScheduleDates(details.baseAnime, effectiveEpisodeCount ?? null);
    const fallbackCount = effectiveEpisodeCount && effectiveEpisodeCount > 0 ? effectiveEpisodeCount : 1;
    for (let number = 1; number <= fallbackCount; number++) {
      await prisma.episode.upsert({
        where: {
          animeDetailsId_number: { animeDetailsId: details.id, number },
        },
        update: {
          airingAt: animeScheduleDates?.get(number) ?? (number === 1 && fallbackStartDate ? fallbackStartDate : undefined),
        }, 
        create: {
          animeDetailsId: details.id,
          number,
          titleEnglish: `Episode ${number}`,
          airingAt: animeScheduleDates?.get(number) ?? (number === 1 && fallbackStartDate ? fallbackStartDate : null),
        },
      });
    }
    return;
  }

  const [englishEpisodes, japaneseEpisodes] = await Promise.all([
    getSeriesEpisodes(mapping.tvdbSeriesId, ENGLISH),
    getSeriesEpisodes(mapping.tvdbSeriesId, JAPANESE),
  ]);

  const nativeNameById = new Map(
    japaneseEpisodes.map((episode) => [episode.id, episode.name]),
  );

  const animeScheduleDates = await getAnimeScheduleDates(details.baseAnime, effectiveEpisodeCount ?? null);

  for (const episode of englishEpisodes) {
    if (episode.seasonNumber !== mapping.tvdbSeason) continue;

    const number = episode.number - mapping.tvdbEpisodeOffset;
    if (number < 1) continue;

    if (effectiveEpisodeCount != null && number > effectiveEpisodeCount) {
      continue;
    }

    const data = {
      airingAt: animeScheduleDates?.get(number) ?? parseAiredDate(episode.aired),
      titleEnglish: episode.name || null,
      titleNative: nativeNameById.get(episode.id) || null,
      thumbnailUrl: normalizeImageUrl(episode.image),
    };

    await prisma.episode.upsert({
      where: {
        animeDetailsId_number: { animeDetailsId: details.id, number },
      },
      update: data,
      create: { animeDetailsId: details.id, number, ...data },
    });
  }
};
