/*
  Warnings:

  - A unique constraint covering the columns `[animeId,text]` on the table `AnimeSynonym` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AnimeSynonym_animeId_text_key" ON "AnimeSynonym"("animeId", "text");
