import { prisma } from "../src/prisma";

export async function deduplicateAnimeGroupings() {
  console.log("Deduplicating AnimeGrouping table...");

  // Keep min id for each displayAnimeId and delete duplicates
  const result = await prisma.$executeRaw`
    DELETE FROM "AnimeGrouping"
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM "AnimeGrouping"
      GROUP BY "displayAnimeId"
    );
  `;
  console.log(`Deleted ${result} duplicate AnimeGrouping rows.`);

  const orphanedItems = await prisma.$executeRaw`
    DELETE FROM "_GroupingItems"
    WHERE "A" NOT IN (
      SELECT id FROM "AnimeGrouping"
    );
  `;
  console.log(`Deleted ${orphanedItems} orphaned _GroupingItems rows.`);
}

if (process.argv[1]?.includes("deduplicateGroupings")) {
  deduplicateAnimeGroupings()
    .then(() => {
      console.log("Deduplication completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Deduplication failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
