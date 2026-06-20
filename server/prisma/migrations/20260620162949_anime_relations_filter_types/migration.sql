/*
  Warnings:

  - The values [CHARACTER,SUMMARY,COMPILATION] on the enum `AnimeRelationType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AnimeRelationType_new" AS ENUM ('ADAPTATION', 'PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'ALTERNATIVE', 'SPIN_OFF', 'OTHER', 'SOURCE', 'CONTAINS');
ALTER TABLE "AnimeRelation" ALTER COLUMN "relationType" TYPE "AnimeRelationType_new" USING ("relationType"::text::"AnimeRelationType_new");
ALTER TYPE "AnimeRelationType" RENAME TO "AnimeRelationType_old";
ALTER TYPE "AnimeRelationType_new" RENAME TO "AnimeRelationType";
DROP TYPE "public"."AnimeRelationType_old";
COMMIT;
