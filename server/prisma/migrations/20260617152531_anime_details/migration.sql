-- CreateTable
CREATE TABLE "AnimeDetails" (
    "id" SERIAL NOT NULL,
    "baseAnimeAnilistId" INTEGER NOT NULL,
    "groupingOrder" INTEGER,
    "groupingId" INTEGER,
    "thumbnailUrl" TEXT,
    "description" TEXT,
    "markedForLater" BOOLEAN NOT NULL,

    CONSTRAINT "AnimeDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnimeDetails_baseAnimeAnilistId_key" ON "AnimeDetails"("baseAnimeAnilistId");

-- CreateIndex
CREATE INDEX "AnimeDetails_groupingId_idx" ON "AnimeDetails"("groupingId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeDetails_groupingId_groupingOrder_key" ON "AnimeDetails"("groupingId", "groupingOrder");

-- AddForeignKey
ALTER TABLE "AnimeDetails" ADD CONSTRAINT "AnimeDetails_baseAnimeAnilistId_fkey" FOREIGN KEY ("baseAnimeAnilistId") REFERENCES "BaseAnime"("anilistId") ON DELETE RESTRICT ON UPDATE CASCADE;
