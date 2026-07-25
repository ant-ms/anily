import { expect, test, beforeAll, afterAll } from "vitest";
import { getEpisodes } from "./getEpisodes";
import { getAnimeDetailsFromApiAndUpsert } from "$lib/anilistApi/getAnimeDetailsFromApiAndUpsert";
import { upsertEpisodesForAnime } from "$lib/thetvdb/upsertEpisodesForAnime";

import { prisma } from "$src/prisma";

let originalKey: string | undefined;
beforeAll(async () => {
  originalKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;

  // Clear Frieren ONA episodes to prevent test state pollution from previous runs
  const frierenOnaDetails = await prisma.animeDetails.findUnique({
    where: { baseAnimeAnilistId: 170068 }
  });
  if (frierenOnaDetails) {
    await prisma.episode.deleteMany({ where: { animeDetailsId: frierenOnaDetails.id } });
  }
});

afterAll(() => {
  if (originalKey) {
    process.env.OPENROUTER_API_KEY = originalKey;
  }
});

const FRIEREN = 154587;
const FRIEREN_ONA = 170068; // 12 episodes, no TVDB mapping
const SASAKI_OVA = 143082; // 1 episode, TVDB S00 mapping (has more than 1 in TVDB S00)

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

test("getEpisodes(frieren ONA - no mapping fallback)", async () => {
  await getAnimeDetailsFromApiAndUpsert(FRIEREN_ONA);
  await upsertEpisodesForAnime(FRIEREN_ONA, 12);

  const episodes = await getEpisodes(FRIEREN_ONA);

  // Should generate exactly 12 stub episodes
  expect(episodes.length).toBe(12);
  expect(episodes[0].number).toBe(1);
  expect(episodes[11].number).toBe(12);
  expect(episodes[0].titleEnglish).toBe("Episode 1");
}, 60000);

test("getEpisodes(sasaki OVA - mapping cap)", async () => {
  await getAnimeDetailsFromApiAndUpsert(SASAKI_OVA);
  await upsertEpisodesForAnime(SASAKI_OVA, 1);

  const episodes = await getEpisodes(SASAKI_OVA);

  // Should cap at exactly 1 episode, even though TVDB Season 0 has multiple
  expect(episodes.length).toBe(1);
  expect(episodes[0].number).toBe(1);
}, 60000);

const MUSHOKU_COUR_1 = 108465;
const MUSHOKU_COUR_2 = 127720;
const HELL_MODE_S2 = 209983;

test("Mushoku Tensei Cour 1 and 2 episodes do not bleed", async () => {
  await getAnimeDetailsFromApiAndUpsert(MUSHOKU_COUR_1);
  const ep1 = await getEpisodes(MUSHOKU_COUR_1);
  expect(ep1.length).toBe(11);

  await getAnimeDetailsFromApiAndUpsert(MUSHOKU_COUR_2);
  const ep2 = await getEpisodes(MUSHOKU_COUR_2);
  expect(ep2.length).toBe(12);
}, 60000);

test("Hell Mode S2 generates exactly 13 fallback episodes", async () => {
  await getAnimeDetailsFromApiAndUpsert(HELL_MODE_S2);
  
  const episodes = await getEpisodes(HELL_MODE_S2);

  // Since it has no TVDB mapping but Anilist says 13 episodes, it should create exactly 13 dummy episodes
  expect(episodes.length).toBe(13);
  expect(episodes[0].number).toBe(1);
  expect(episodes[12].number).toBe(13);
}, 60000);
