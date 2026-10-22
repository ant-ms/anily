-- Ensure any watched status in Episode is migrated to UserEpisodeProgress
INSERT INTO "UserEpisodeProgress" ("userId", "episodeId", "watched", "watchedAt")
SELECT u.id, e.id, true, NOW()
FROM "Episode" e
CROSS JOIN "User" u
WHERE e.watched = true
  AND (u.email = 'yanik@ant.ms' OR u.id = (SELECT id FROM "User" ORDER BY "createdAt" ASC LIMIT 1))
ON CONFLICT ("userId", "episodeId") DO UPDATE SET "watched" = true;

-- AlterTable
ALTER TABLE "Episode" DROP COLUMN IF EXISTS "watched";
