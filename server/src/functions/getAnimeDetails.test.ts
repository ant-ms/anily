// TODO: Test to get anime details that are not yet downloaded
// TODO: Test to get anime details that are downloaded

import { expect, test } from "vitest";
import { getAnimeDetails } from "./getAnimeDetails";

test("getAnimeDetails(frieren)", async () => {
  const response = await getAnimeDetails(154587);

  expect(response).toBeDefined();

  expect(response).toHaveProperty("baseAnimeAnilistId", 154587);
  expect(response).toHaveProperty("description");
  expect(response.description).toContain("Decades after their victory,");
  expect(response).toHaveProperty("thumbnailUrl");
  expect(response.thumbnailUrl).not.toBeNull();
  expect(response.thumbnailUrl?.startsWith("https://")).toBeTruthy();

  expect(response).toHaveProperty("baseAnime");
  expect(response.baseAnime).toHaveProperty("anilistId", 154587);
  expect(response.baseAnime).toHaveProperty("malId", 52991);
  expect(response.baseAnime).toHaveProperty(
    "titleEnglish",
    "Frieren: Beyond Journey’s End",
  );
  expect(response.baseAnime).toHaveProperty(
    "titleRomanji",
    "Sousou no Frieren",
  );
});
