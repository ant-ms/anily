import { prisma } from "$src/prisma";
import { resolveTvdbMapping } from "./animeTvdbMapping";
import { getSeriesEpisodes } from "./getSeriesEpisodes";

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
): Promise<void> => {
  const details = await prisma.animeDetails.findUnique({
    where: { baseAnimeAnilistId: anilistId },
  });
  if (!details) return;

  const mapping = await resolveTvdbMapping(anilistId);
  if (!mapping) return;

  const [englishEpisodes, japaneseEpisodes] = await Promise.all([
    getSeriesEpisodes(mapping.tvdbSeriesId, ENGLISH),
    getSeriesEpisodes(mapping.tvdbSeriesId, JAPANESE),
  ]);

  const nativeNameById = new Map(
    japaneseEpisodes.map((episode) => [episode.id, episode.name]),
  );

  for (const episode of englishEpisodes) {
    if (episode.seasonNumber !== mapping.tvdbSeason) continue;

    const number = episode.number - mapping.tvdbEpisodeOffset;
    if (number < 1) continue;

    const data = {
      airingAt: parseAiredDate(episode.aired),
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
