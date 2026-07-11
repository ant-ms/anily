import { tvdbRequest } from "./genericTvdbCall";

export type TvdbEpisode = {
  id: number;
  number: number;
  seasonNumber: number;
  name: string | null;
  aired: string | null;
  image: string | null;
};

type SeriesEpisodesData = {
  episodes: TvdbEpisode[] | null;
};

export const getSeriesEpisodes = async (
  seriesId: number,
  language: string,
  seasonType = "official",
): Promise<TvdbEpisode[]> => {
  const episodes: TvdbEpisode[] = [];

  for (let page = 0; ; page += 1) {
    const { data, links } = await tvdbRequest<SeriesEpisodesData>(
      `/series/${seriesId}/episodes/${seasonType}/${language}`,
      { page },
    );

    episodes.push(...(data.episodes ?? []));

    if (!links?.next) break;
  }

  return episodes;
};
