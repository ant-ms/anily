/*
  Warnings:

  - You are about to drop the column `episodes` on the `AnimeDetails` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AnimeDetails" DROP COLUMN "episodes";

-- CreateTable
CREATE TABLE "Episode" (
    "id" SERIAL NOT NULL,
    "animeDetailsId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "airingAt" TIMESTAMP(3),
    "titleEnglish" TEXT,
    "titleNative" TEXT,
    "titleRomanji" TEXT,
    "thumbnailUrl" TEXT,
    "watched" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Episode_animeDetailsId_idx" ON "Episode"("animeDetailsId");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_animeDetailsId_number_key" ON "Episode"("animeDetailsId", "number");

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_animeDetailsId_fkey" FOREIGN KEY ("animeDetailsId") REFERENCES "AnimeDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
