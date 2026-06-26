import { graphql } from "../../../src/gql";

export const GET_ANIME_DETAILS_QUERY = graphql(`
  query Media($mediaId: Int) {
    Media(id: $mediaId, type: ANIME) {
      id
      title {
        english
      }
      episodes
      coverImage {
        extraLarge
        large
        medium
        color
      }
      description(asHtml: true)
    }
  }
`);
