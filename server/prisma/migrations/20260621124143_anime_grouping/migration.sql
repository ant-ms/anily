/*
  Warnings:

  - You are about to drop the column `markedForLater` on the `AnimeDetails` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AnimeDetails" DROP COLUMN "markedForLater";

-- CreateTable
CREATE TABLE "AnimeGrouping" (
    "id" SERIAL NOT NULL,
    "displayAnimeId" INTEGER NOT NULL,

    CONSTRAINT "AnimeGrouping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GroupingItems" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_GroupingItems_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_GroupingItems_B_index" ON "_GroupingItems"("B");

-- AddForeignKey
ALTER TABLE "AnimeGrouping" ADD CONSTRAINT "AnimeGrouping_displayAnimeId_fkey" FOREIGN KEY ("displayAnimeId") REFERENCES "BaseAnime"("anilistId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroupingItems" ADD CONSTRAINT "_GroupingItems_A_fkey" FOREIGN KEY ("A") REFERENCES "AnimeGrouping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroupingItems" ADD CONSTRAINT "_GroupingItems_B_fkey" FOREIGN KEY ("B") REFERENCES "BaseAnime"("anilistId") ON DELETE CASCADE ON UPDATE CASCADE;
