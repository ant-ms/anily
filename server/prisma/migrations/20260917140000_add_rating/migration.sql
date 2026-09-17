-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Rating') THEN
    CREATE TYPE "Rating" AS ENUM ('LIKE', 'NEUTRAL', 'DISLIKE');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "AnimeDetails" ADD COLUMN IF NOT EXISTS "rating" "Rating" NOT NULL DEFAULT 'NEUTRAL';
