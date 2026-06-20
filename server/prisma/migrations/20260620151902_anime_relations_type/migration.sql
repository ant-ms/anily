/*
  Warnings:

  - You are about to drop the `_BaseAnimeRelations` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `format` to the `BaseAnime` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AnimeFormat" AS ENUM ('MOVIE', 'ONA', 'ONE_SHOT', 'OVA', 'SPECIAL', 'TV', 'TV_SHORT');

-- CreateEnum
CREATE TYPE "AnimeRelationType" AS ENUM ('ADAPTATION', 'PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'CHARACTER', 'SUMMARY', 'ALTERNATIVE', 'SPIN_OFF', 'OTHER', 'SOURCE', 'COMPILATION', 'CONTAINS');

-- DropForeignKey
ALTER TABLE "_BaseAnimeRelations" DROP CONSTRAINT "_BaseAnimeRelations_A_fkey";

-- DropForeignKey
ALTER TABLE "_BaseAnimeRelations" DROP CONSTRAINT "_BaseAnimeRelations_B_fkey";

-- AlterTable
ALTER TABLE "BaseAnime" ADD COLUMN     "format" "AnimeFormat" NOT NULL;

-- DropTable
DROP TABLE "_BaseAnimeRelations";

-- CreateTable
CREATE TABLE "AnimeRelation" (
    "id" SERIAL NOT NULL,
    "relationType" "AnimeRelationType" NOT NULL,
    "fromAnimeId" INTEGER NOT NULL,
    "toAnimeId" INTEGER NOT NULL,

    CONSTRAINT "AnimeRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimeRelation_fromAnimeId_idx" ON "AnimeRelation"("fromAnimeId");

-- CreateIndex
CREATE INDEX "AnimeRelation_toAnimeId_idx" ON "AnimeRelation"("toAnimeId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeRelation_fromAnimeId_toAnimeId_relationType_key" ON "AnimeRelation"("fromAnimeId", "toAnimeId", "relationType");

-- AddForeignKey
ALTER TABLE "AnimeRelation" ADD CONSTRAINT "AnimeRelation_fromAnimeId_fkey" FOREIGN KEY ("fromAnimeId") REFERENCES "BaseAnime"("anilistId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeRelation" ADD CONSTRAINT "AnimeRelation_toAnimeId_fkey" FOREIGN KEY ("toAnimeId") REFERENCES "BaseAnime"("anilistId") ON DELETE RESTRICT ON UPDATE CASCADE;
