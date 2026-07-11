import { expect, test } from "vitest";
import { getEpisodes } from "./getEpisodes";
import { getAnimeDetailsFromApiAndUpsert } from "$lib/anilistApi/getAnimeDetailsFromApiAndUpsert";
import { upsertEpisodesForAnime } from "$lib/thetvdb/upsertEpisodesForAnime";

const FRIEREN = 154587;

test("getEpisodes(frieren)", async () => {
  await getAnimeDetailsFromApiAndUpsert(FRIEREN);
  await upsertEpisodesForAnime(FRIEREN);

  const episodes = await getEpisodes(FRIEREN);

  expect(episodes.length).toBeGreaterThanOrEqual(28);
  expect(episodes[0].number).toBe(1);
  expect(episodes[0].titleEnglish).toBeTruthy();

  const numbers = episodes.map((episode) => episode.number);
  expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
}, 60000);
