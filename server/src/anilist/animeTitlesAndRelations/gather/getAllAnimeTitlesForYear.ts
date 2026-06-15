import { fetchGraphQL } from "../../genericAnilistCall";
import { GET_ANIME_TITLES_QUERY } from "./query";

export async function getAllAnimeTitlesForYear(year: number) {
  const perPage = 50;

  const getPagesRecursively = async (page: number = 0) => {
    const result = await fetchGraphQL(GET_ANIME_TITLES_QUERY, {
      type: "ANIME",
      perPage,
      page,
      startDateGreater: `${year}0101`,
      startDateLesser: `${year + 1}0101`,
      sort: "UPDATED_AT_DESC",
    });

    if (!result.Page) {
      throw "[getAllAnimeTitlesForYear] got no result.Page in response";
    }

    if (!result.Page.pageInfo) {
      throw "[getAllAnimeTitlesForYear] got no result.Page.pageInfo in response";
    }

    if (!result.Page.pageInfo.currentPage) {
      throw "[getAllAnimeTitlesForYear] got no result.Page.pageInfo.currentPage in response";
    }

    console.debug(
      "[getAllAnimeTitlesForYear] processed page",
      result.Page.pageInfo.currentPage,
    );

    let media = result.Page.media;

    if (media === null) {
      throw "[getAllAnimeTitlesForYear] got null result.Page.media in response";
    }

    if (result.Page.pageInfo.hasNextPage) {
      const nextMedia = await getPagesRecursively(
        result.Page.pageInfo.currentPage + 1,
      );
      media.push(...nextMedia);
    }

    return media;
  };

  return (await getPagesRecursively()).filter((a) => a != null);
}
