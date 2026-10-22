-- DropIndex
DROP INDEX IF EXISTS "Episode_mediaTorrentHash_idx";

-- AlterTable
ALTER TABLE "Episode" DROP COLUMN IF EXISTS "mediaFailedTorrents",
DROP COLUMN IF EXISTS "mediaSelectedTorrent",
DROP COLUMN IF EXISTS "mediaTorrentHash";
