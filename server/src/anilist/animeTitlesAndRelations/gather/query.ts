import { graphql } from "../../../gql";

export const GET_ANIME_TITLES_QUERY = graphql(`
  query Query(
    $page: Int
    $sort: [MediaSort]
    $startDateGreater: FuzzyDateInt
    $startDateLesser: FuzzyDateInt
    $endDateGreater: FuzzyDateInt
    $perPage: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      media(
        sort: $sort
        type: ANIME
        startDate_greater: $startDateGreater
        startDate_lesser: $startDateLesser
        endDate_greater: $endDateGreater
      ) {
        id
        idMal
        title {
          english
          native
          romaji
        }
        relations {
          nodes {
            id
            type
          }
        }
        synonyms
        updatedAt
      }
      pageInfo {
        currentPage
        hasNextPage
        lastPage
        perPage
        total
      }
    }
  }
`);
