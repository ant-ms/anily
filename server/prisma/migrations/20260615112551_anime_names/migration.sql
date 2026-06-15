-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateTable
CREATE TABLE "BaseAnime" (
    "anilistId" INTEGER NOT NULL,
    "malId" INTEGER,
    "lastUpdated" BIGINT NOT NULL,
    "titleEnglish" TEXT,
    "titleNative" TEXT,
    "titleRomanji" TEXT,

    CONSTRAINT "BaseAnime_pkey" PRIMARY KEY ("anilistId")
);

-- CreateTable
CREATE TABLE "AnimeSynonym" (
    "id" SERIAL NOT NULL,
    "animeId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "AnimeSynonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BaseAnimeRelations" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_BaseAnimeRelations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "BaseAnime_titleEnglish_idx" ON "BaseAnime" USING GIN ("titleEnglish" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "BaseAnime_titleRomanji_idx" ON "BaseAnime" USING GIN ("titleRomanji" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "BaseAnime_titleNative_idx" ON "BaseAnime" USING GIN ("titleNative" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "AnimeSynonym_text_idx" ON "AnimeSynonym" USING GIN ("text" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "AnimeSynonym_animeId_idx" ON "AnimeSynonym"("animeId");

-- CreateIndex
CREATE INDEX "_BaseAnimeRelations_B_index" ON "_BaseAnimeRelations"("B");

-- AddForeignKey
ALTER TABLE "AnimeSynonym" ADD CONSTRAINT "AnimeSynonym_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "BaseAnime"("anilistId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BaseAnimeRelations" ADD CONSTRAINT "_BaseAnimeRelations_A_fkey" FOREIGN KEY ("A") REFERENCES "BaseAnime"("anilistId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BaseAnimeRelations" ADD CONSTRAINT "_BaseAnimeRelations_B_fkey" FOREIGN KEY ("B") REFERENCES "BaseAnime"("anilistId") ON DELETE CASCADE ON UPDATE CASCADE;
