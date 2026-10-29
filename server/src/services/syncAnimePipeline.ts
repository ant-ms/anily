import { getAnimeDetailsFromAPI } from "$lib/anilistApi/animeDetails/getAnimeDetails";
import { upsertAnimeDetailsFromApiData } from "$lib/anilistApi/getAnimeDetailsFromApiAndUpsert";
import { upsertEpisodesForAnime } from "$lib/thetvdb/upsertEpisodesForAnime";

export const syncAnimePipeline = async (anilistId: number) => {
  const animeDetails = await getAnimeDetailsFromAPI(anilistId);

  if (!animeDetails) {
    throw new Error("Failed to fetch anime details");
  }

  const upserted = await upsertAnimeDetailsFromApiData(anilistId, animeDetails);

  let startDate: Date | null = null;
  if (
    animeDetails.startDate?.year &&
    animeDetails.startDate?.month &&
    animeDetails.startDate?.day
  ) {
    startDate = new Date(
      animeDetails.startDate.year,
      animeDetails.startDate.month - 1,
      animeDetails.startDate.day,
    );
  }

  // Fetch and upsert episodes using the correct episode count cap from AniList.
  await upsertEpisodesForAnime(anilistId, animeDetails.episodes, startDate);

  return upserted;
};
