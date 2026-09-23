-- CreateTable: User
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sub" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_sub_key" ON "User"("sub");

-- CreateTable: UserEpisodeProgress
CREATE TABLE IF NOT EXISTS "UserEpisodeProgress" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeId" INTEGER NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT true,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEpisodeProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserEpisodeProgress_userId_episodeId_key" ON "UserEpisodeProgress"("userId", "episodeId");
CREATE INDEX IF NOT EXISTS "UserEpisodeProgress_userId_idx" ON "UserEpisodeProgress"("userId");
CREATE INDEX IF NOT EXISTS "UserEpisodeProgress_episodeId_idx" ON "UserEpisodeProgress"("episodeId");

ALTER TABLE "UserEpisodeProgress" DROP CONSTRAINT IF EXISTS "UserEpisodeProgress_userId_fkey";
ALTER TABLE "UserEpisodeProgress" ADD CONSTRAINT "UserEpisodeProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserEpisodeProgress" DROP CONSTRAINT IF EXISTS "UserEpisodeProgress_episodeId_fkey";
ALTER TABLE "UserEpisodeProgress" ADD CONSTRAINT "UserEpisodeProgress_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: UserBookmark
CREATE TABLE IF NOT EXISTS "UserBookmark" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "anilistId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBookmark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserBookmark_userId_anilistId_key" ON "UserBookmark"("userId", "anilistId");
CREATE INDEX IF NOT EXISTS "UserBookmark_userId_idx" ON "UserBookmark"("userId");
CREATE INDEX IF NOT EXISTS "UserBookmark_anilistId_idx" ON "UserBookmark"("anilistId");

ALTER TABLE "UserBookmark" DROP CONSTRAINT IF EXISTS "UserBookmark_userId_fkey";
ALTER TABLE "UserBookmark" ADD CONSTRAINT "UserBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBookmark" DROP CONSTRAINT IF EXISTS "UserBookmark_anilistId_fkey";
ALTER TABLE "UserBookmark" ADD CONSTRAINT "UserBookmark_anilistId_fkey" FOREIGN KEY ("anilistId") REFERENCES "BaseAnime"("anilistId") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: UserAnimeRating
CREATE TABLE IF NOT EXISTS "UserAnimeRating" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "anilistId" INTEGER NOT NULL,
    "rating" "Rating" NOT NULL DEFAULT 'NEUTRAL',

    CONSTRAINT "UserAnimeRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserAnimeRating_userId_anilistId_key" ON "UserAnimeRating"("userId", "anilistId");
CREATE INDEX IF NOT EXISTS "UserAnimeRating_userId_idx" ON "UserAnimeRating"("userId");
CREATE INDEX IF NOT EXISTS "UserAnimeRating_anilistId_idx" ON "UserAnimeRating"("anilistId");

ALTER TABLE "UserAnimeRating" DROP CONSTRAINT IF EXISTS "UserAnimeRating_userId_fkey";
ALTER TABLE "UserAnimeRating" ADD CONSTRAINT "UserAnimeRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserAnimeRating" DROP CONSTRAINT IF EXISTS "UserAnimeRating_anilistId_fkey";
ALTER TABLE "UserAnimeRating" ADD CONSTRAINT "UserAnimeRating_anilistId_fkey" FOREIGN KEY ("anilistId") REFERENCES "BaseAnime"("anilistId") ON DELETE CASCADE ON UPDATE CASCADE;

-- DATA MIGRATION: Ensure existing data is preserved and assigned to yanik@ant.ms
DO $$
DECLARE
    owner_user_id TEXT;
BEGIN
    -- Delete dummy user without data if it was auto-created
    DELETE FROM "User" WHERE "email" = 'owner@anily.local';

    -- Ensure yanik@ant.ms user exists
    INSERT INTO "User" ("id", "email", "name")
    VALUES (gen_random_uuid()::text, 'yanik@ant.ms', 'Yanik')
    ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name"
    RETURNING "id" INTO owner_user_id;

    IF owner_user_id IS NULL THEN
        SELECT "id" INTO owner_user_id FROM "User" WHERE "email" = 'yanik@ant.ms';
    END IF;

    -- Migrate watched episodes without deleting existing data
    INSERT INTO "UserEpisodeProgress" ("userId", "episodeId", "watched", "watchedAt")
    SELECT owner_user_id, "id", true, NOW()
    FROM "Episode"
    WHERE "watched" = true
    ON CONFLICT ("userId", "episodeId") DO NOTHING;

    -- Migrate ratings without deleting existing data
    INSERT INTO "UserAnimeRating" ("userId", "anilistId", "rating")
    SELECT owner_user_id, "baseAnimeAnilistId", "rating"
    FROM "AnimeDetails"
    WHERE "rating" IS NOT NULL AND "rating" != 'NEUTRAL'
    ON CONFLICT ("userId", "anilistId") DO NOTHING;

    -- Migrate bookmarks from _GroupingItems join table (all 85 tracked anime)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_GroupingItems') THEN
        INSERT INTO "UserBookmark" ("userId", "anilistId", "createdAt")
        SELECT DISTINCT owner_user_id, "B", NOW()
        FROM "_GroupingItems"
        ON CONFLICT ("userId", "anilistId") DO NOTHING;
    END IF;

    -- Also ensure displayAnimeId is bookmarked if any was missing
    INSERT INTO "UserBookmark" ("userId", "anilistId", "createdAt")
    SELECT DISTINCT owner_user_id, "displayAnimeId", NOW()
    FROM "AnimeGrouping"
    WHERE "displayAnimeId" IS NOT NULL
    ON CONFLICT ("userId", "anilistId") DO NOTHING;

    -- Migrate bookmarks from anime with groupingId
    INSERT INTO "UserBookmark" ("userId", "anilistId", "createdAt")
    SELECT DISTINCT owner_user_id, "baseAnimeAnilistId", NOW()
    FROM "AnimeDetails"
    WHERE "groupingId" IS NOT NULL
    ON CONFLICT ("userId", "anilistId") DO NOTHING;
END $$;
