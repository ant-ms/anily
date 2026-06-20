import { expect, test } from "vitest";
import { searchForAnime } from "./searchForAnime";

test.each(["Heidi, Girl of the Alps", "Heidi", "heidi", "alps"])(
  "searchForAnime(%s)",
  async (q) => {
    const results = await searchForAnime(q);
    const match = results.find((a) => a.anilistId === 2225);
    expect(match).toBeDefined();
  },
);

test("searchForAnime(slime)", async () => {
  const results = await searchForAnime("slime");
  // 101280 That Time I Got Reincarnated as a Slime
  expect(results.find((a) => a.anilistId === 101280)).toBeDefined();
  // 106509 That Time I Got Reincarnated as a Slime OAD
  expect(results.find((a) => a.anilistId === 101280)).toBeDefined();
  // 112608 I've Been Killing Slimes for 300 Years and Maxed Out My Level
  expect(results.find((a) => a.anilistId === 101280)).toBeDefined();
  // 139498 That Time I Got Reincarnated as a Slime the Movie: Scarlet Bond
  expect(results.find((a) => a.anilistId === 101280)).toBeDefined();
});
