import { logger } from "$src/logger";
import { fetchGraphQL } from "../genericAnilistCall";
import { GET_ANIME_DETAILS_QUERY } from "./query";

export const getAnimeDetailsFromAPI = async (anilistId: number) => {
  logger.debug(`Fetching anime details for anilistId: ${anilistId}`);

  const result = await fetchGraphQL(GET_ANIME_DETAILS_QUERY, {
    mediaId: anilistId,
  });

  if (!result || !result.Media) {
    throw new Error("Failed to fetch anime details");
  }

  return result.Media;
};
