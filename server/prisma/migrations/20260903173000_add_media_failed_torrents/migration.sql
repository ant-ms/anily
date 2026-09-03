-- AlterTable
ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "mediaFailedTorrents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
