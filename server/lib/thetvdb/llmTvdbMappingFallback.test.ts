import { expect, test } from "vitest";
import { resolveTvdbMappingViaLLM } from "./llmTvdbMappingFallback";
import { getAnimeDetailsFromApiAndUpsert } from "$lib/anilistApi/getAnimeDetailsFromApiAndUpsert";

const HELL_MODE_S2 = 209983;

test.skipIf(!process.env.OPENROUTER_API_KEY)("resolveTvdbMappingViaLLM resolves Hell Mode S2 dynamically", async () => {
  // Ensure the anime is in the database for the fallback to fetch its title
  await getAnimeDetailsFromApiAndUpsert(HELL_MODE_S2);

  const mapping = await resolveTvdbMappingViaLLM(HELL_MODE_S2);

  expect(mapping).not.toBeNull();
  expect(mapping?.tvdbSeriesId).toBe(457532); // Expected TVDB ID for Hell Mode
}, 60000);
