import { expect, test } from "vitest";
import { getAnimeDetailsFromApiAndUpsert } from "$lib/anilistApi/getAnimeDetailsFromApiAndUpsert";
import { upsertEpisodesForAnime } from "./upsertEpisodesForAnime";
import { prisma } from "$src/prisma";

const FRIEREN = 154587;

test("upsertEpisodesForAnime(frieren) stores episodes from TheTVDB", async () => {
  await getAnimeDetailsFromApiAndUpsert(FRIEREN);
  await upsertEpisodesForAnime(FRIEREN);

  const details = await prisma.animeDetails.findUniqueOrThrow({
    where: { baseAnimeAnilistId: FRIEREN },
    include: { episodes: { orderBy: { number: "asc" } } },
  });

  expect(details.episodes.length).toBeGreaterThanOrEqual(28);

  const firstEpisode = details.episodes[0];
  expect(firstEpisode.number).toBe(1);
  expect(firstEpisode.titleEnglish).toBe("The Journey's End");
  expect(firstEpisode.titleNative).toBeTruthy();
  expect(firstEpisode.airingAt).toBeInstanceOf(Date);
  expect(firstEpisode.thumbnailUrl?.startsWith("https://")).toBeTruthy();

  const numbers = details.episodes.map((episode) => episode.number);
  expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
}, 60000);

test("upsertEpisodesForAnime(frieren) preserves watched state", async () => {
  await getAnimeDetailsFromApiAndUpsert(FRIEREN);
  await upsertEpisodesForAnime(FRIEREN);

  const details = await prisma.animeDetails.findUniqueOrThrow({
    where: { baseAnimeAnilistId: FRIEREN },
    include: { episodes: { orderBy: { number: "asc" } } },
  });

  const episodeId = details.episodes[0].id;
  await prisma.episode.update({
    where: { id: episodeId },
    data: { watched: true },
  });

  await upsertEpisodesForAnime(FRIEREN);

  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: episodeId },
  });
  expect(episode.watched).toBe(true);

  await prisma.episode.update({
    where: { id: episodeId },
    data: { watched: false },
  });
}, 60000);
