import { prisma } from "../../src/prisma";
import { AnimeFormat, AnimeRelationType } from "../../generated/prisma/client";
import { getAllAnimeTitlesForYear } from "$lib/anilistApi/baseAnime/getAllAnimeTitlesForYear";

type AnilistAnime = Awaited<
  ReturnType<typeof getAllAnimeTitlesForYear>
>[number];

type AnimeRelation = {
  toAnimeId: number;
  relationType: AnimeRelationType;
  format: AnimeFormat;
};

const isAnimeFormat = (
  value: string | null | undefined,
): value is AnimeFormat =>
  value != null && (Object.values(AnimeFormat) as string[]).includes(value);

const isAnimeRelationType = (
  value: string | null | undefined,
): value is AnimeRelationType =>
  value != null &&
  (Object.values(AnimeRelationType) as string[]).includes(value);

const parseRelations = (anime: AnilistAnime): AnimeRelation[] => {
  const relations = new Map<string, AnimeRelation>();

  for (const edge of anime.relations?.edges ?? []) {
    if (!edge) continue;
    const node = edge.node;
    if (node?.type !== "ANIME") continue;
    if (!isAnimeFormat(node.format)) continue;
    if (!isAnimeRelationType(edge.relationType)) continue;

    relations.set(`${node.id}:${edge.relationType}`, {
      toAnimeId: node.id,
      relationType: edge.relationType,
      format: node.format,
    });
  }

  return [...relations.values()];
};

const parseSynonyms = (anime: AnilistAnime): string[] =>
  anime.synonyms?.filter((synonym) => synonym !== null) ?? [];

export default async (anime: AnilistAnime) => {
  // The sync query only requests supported formats, but guard anyway so we
  // never try to persist a format the schema can't represent.
  if (!isAnimeFormat(anime.format)) {
    console.debug(
      "[upsertAnimeTitlesAndRelations] skipping anime",
      anime.id,
      "with unsupported format",
      anime.format,
    );
    return;
  }

  const relations = parseRelations(anime);
  const synonyms = parseSynonyms(anime);

  // Related anime must exist before we can reference them. Each stub needs a
  // format, which we take from the relation node, deduplicated by anime id.
  const relatedStubs = new Map<number, AnimeFormat>(
    relations.map((relation) => [relation.toAnimeId, relation.format]),
  );

  const animeData = {
    malId: anime.idMal,
    format: anime.format,
    titleEnglish: anime.title?.english ?? null,
    titleNative: anime.title?.native ?? null,
    titleRomanji: anime.title?.romaji ?? null,
    synonyms: {
      createMany: {
        data: synonyms.map((text) => ({ text })),
        skipDuplicates: true,
      },
    },
  };

  await prisma.$transaction([
    // 1. Ensure every related anime exists before we reference it.
    prisma.baseAnime.createMany({
      data: [...relatedStubs].map(([anilistId, format]) => ({
        anilistId,
        format,
        lastUpdated: 0,
      })),
      skipDuplicates: true,
    }),
    // 2. Upsert the anime itself.
    prisma.baseAnime.upsert({
      where: { anilistId: anime.id },
      create: {
        ...animeData,
        anilistId: anime.id,
        lastUpdated: anime.updatedAt ?? 0,
      },
      update: {
        ...animeData,
        lastUpdated: anime.updatedAt ?? undefined,
      },
    }),
    // 3. Replace its outgoing relations with the current set.
    prisma.animeRelation.deleteMany({ where: { fromAnimeId: anime.id } }),
    prisma.animeRelation.createMany({
      data: relations.map((relation) => ({
        fromAnimeId: anime.id,
        toAnimeId: relation.toAnimeId,
        relationType: relation.relationType,
      })),
      skipDuplicates: true,
    }),
  ]);
};
