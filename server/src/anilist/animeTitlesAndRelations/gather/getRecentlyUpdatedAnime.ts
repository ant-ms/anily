import { fetchGraphQL } from "../../genericAnilistCall";
import { GET_ANIME_TITLES_QUERY } from "./query";

export async function getRecentlyUpdatedAnime(page: number = 1) {
  const result = await fetchGraphQL(GET_ANIME_TITLES_QUERY, {
    type: "ANIME",
    perPage: 50,
    page,
    sort: "UPDATED_AT_DESC",
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
