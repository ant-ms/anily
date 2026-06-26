-- CreateEnum
CREATE TYPE "AnimeSeason" AS ENUM ('WINTER', 'SPRING', 'SUMMER', 'FALL');

-- AlterTable
ALTER TABLE "BaseAnime" ADD COLUMN     "season" "AnimeSeason",
ADD COLUMN     "seasonYear" INTEGER;
