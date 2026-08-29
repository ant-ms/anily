-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('NONE', 'QUEUED', 'DOWNLOADING', 'AVAILABLE');

-- AlterTable
ALTER TABLE "Episode" ADD COLUMN "mediaPath" TEXT,
ADD COLUMN "mediaSelectedTorrent" JSONB,
ADD COLUMN "mediaSize" BIGINT,
ADD COLUMN "mediaTorrentHash" TEXT,
ADD COLUMN "mediaStatus" "MediaStatus" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE INDEX "Episode_mediaTorrentHash_idx" ON "Episode"("mediaTorrentHash");
