import { getAllAnimeTitlesForYear } from "./gather/getAllAnimeTitlesForYear";
import upsertAnimeTitlesAndRelations from "./upsertAnimeTitlesAndRelations";

const startYear = 1984;
const endYear = 2026;
const yearsToProcess = Array.from(
  { length: endYear - startYear + 1 },
  (_, index) => startYear + index,
);

(async () => {
  console.log(
    "[animeTitles.initialSync] gathering all anime titles from year",
    startYear,
    "to year",
    endYear,
  );

  for (const year of yearsToProcess) {
    console.log("[animeTitles.initialSync] gathering all anime for year", year);
    const animes = await getAllAnimeTitlesForYear(year);

    for (const anime of animes) {
      await upsertAnimeTitlesAndRelations(anime);
    }
  }
})();
