const MAPPING_URL =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json";

export type TvdbMapping = {
  tvdbSeriesId: number;
  tvdbSeason: number;
  tvdbEpisodeOffset: number;
};

type AnimeListEntry = {
  anilist_id?: number;
  tvdb_id?: number;
  season?: { tvdb?: number };
  episode_offset?: { tvdb?: number };
};

let mappingRequest: Promise<Map<number, TvdbMapping>> | null = null;

const loadMapping = async (): Promise<Map<number, TvdbMapping>> => {
  const response = await fetch(MAPPING_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to load anime mapping list: ${response.status} ${response.statusText}`,
    );
  }

  const entries = (await response.json()) as AnimeListEntry[];
  const mapping = new Map<number, TvdbMapping>();

  for (const entry of entries) {
    if (
      entry.anilist_id == null ||
      entry.tvdb_id == null ||
      entry.season?.tvdb == null
    ) {
      continue;
    }

    mapping.set(entry.anilist_id, {
      tvdbSeriesId: entry.tvdb_id,
      tvdbSeason: entry.season.tvdb,
      tvdbEpisodeOffset: entry.episode_offset?.tvdb ?? 0,
    });
  }

  return mapping;
};

const getMapping = async (): Promise<Map<number, TvdbMapping>> => {
  try {
    return await (mappingRequest ??= loadMapping());
  } catch (error) {
    mappingRequest = null;
    throw error;
  }
};

export const resolveTvdbMapping = async (
  anilistId: number,
): Promise<TvdbMapping | null> => {
  const mapping = await getMapping();
  return mapping.get(anilistId) ?? null;
};

export const refreshTvdbMappingCache = async (): Promise<void> => {
  mappingRequest = loadMapping();
  await mappingRequest;
};
