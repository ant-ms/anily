import { fetchGraphQL } from "../genericAnilistCall";
import { GET_ANIME_TITLES_QUERY } from "./query";

export async function getRecentlyUpdatedAnime(page: number = 1) {
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() - 3);
  const endMonth = String(endDate.getMonth() + 1).padStart(2, "0");
  const endDay = String(endDate.getDate()).padStart(2, "0");

  const result = await fetchGraphQL(GET_ANIME_TITLES_QUERY, {
    perPage: 50,
    page,
    sort: "UPDATED_AT_DESC",
    // In order to cut down on the number of queries and the maximum allowed down time,
    // we ignore any changes to anime that hasn't had an episode release in 3 years
    // TODO: Quadrouple check that this will still update old relations when a new
    //       anime references the old one
    endDateGreater: `${endDate.getFullYear()}${endMonth}${endDay}`,
  });

  if (!result.Page) {
    throw "[getRecentlyUpdatedAnime] got no result.Page in response";
  }

  if (!result.Page.pageInfo) {
    throw "[getRecentlyUpdatedAnime] got no result.Page.pageInfo in response";
  }

  console.debug(
    "[getRecentlyUpdatedAnime] processed page",
    result.Page.pageInfo.currentPage,
  );

  const media = result.Page.media;

  if (media === null) {
    throw "[getRecentlyUpdatedAnime] got null result.Page.media in response";
  }

  return {
    media: media.filter((a) => a != null),
    pageInfo: result.Page.pageInfo,
  };
}
