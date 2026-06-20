import { prisma } from "../../src/prisma";
import { getAllAnimeTitlesForYear } from "$lib/anilistApi/baseAnime/getAllAnimeTitlesForYear";

export default async (
  baseAnime: Awaited<ReturnType<typeof getAllAnimeTitlesForYear>>[number],
) => {
  const synonyms = baseAnime.synonyms
    ? baseAnime.synonyms.filter((a) => a !== null)
    : null;

  const relationIds = baseAnime.relations?.nodes
    ? baseAnime.relations.nodes
        .filter((n) => n !== null && n.type === "ANIME")
        .map((n) => n.id)
    : [];

  // Create stubs for any related anime that don't exist yet so relations are
  // always fully set from both sides without needing a second pass.
  if (relationIds.length > 0) {
    await prisma.baseAnime.createMany({
      data: relationIds.map((id) => ({ anilistId: id, lastUpdated: 0 })),
      skipDuplicates: true,
    });
  }

  const sharedData = {
    malId: baseAnime.idMal,
    titleEnglish: baseAnime.title?.english ?? null,
    titleNative: baseAnime.title?.native ?? null,
    titleRomanji: baseAnime.title?.romaji ?? null,
    synonyms: synonyms
      ? {
          createMany: {
            data: synonyms.map((text) => ({ text })),
            skipDuplicates: true,
          },
        }
      : undefined,
  };

  await prisma.baseAnime.upsert({
    where: {
      anilistId: baseAnime.id,
    },
    create: {
      ...sharedData,
      anilistId: baseAnime.id,
      lastUpdated: baseAnime.updatedAt ?? 0,
      relatedAnime: {
        connect: relationIds.map((id) => ({ anilistId: id })),
      },
    },
    update: {
      ...sharedData,
      lastUpdated: baseAnime.updatedAt ?? undefined,
      relatedAnime: {
        set: relationIds.map((id) => ({ anilistId: id })),
      },
    },
  });
};
