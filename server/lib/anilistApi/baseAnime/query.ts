import { graphql } from "../../../src/gql";

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
        format_in: [MOVIE, ONA, ONE_SHOT, OVA, SPECIAL, TV, TV_SHORT]
      ) {
        id
        idMal
        title {
          english
          native
          romaji
        }
        relations {
          edges {
            id
            relationType
            node {
              id
              type
              format
            }
          }
        }
        format
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
