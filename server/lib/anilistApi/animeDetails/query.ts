import { graphql } from "../../../src/gql";

export const GET_ANIME_DETAILS_QUERY = graphql(`
  query Media($mediaId: Int) {
    Media(id: $mediaId, type: ANIME) {
      id
      title {
        english
      }
      coverImage {
        extraLarge
        large
        medium
        color
      }
      episodes
      startDate {
        year
        month
        day
      }
      description(asHtml: true)
    }
  }
`);
