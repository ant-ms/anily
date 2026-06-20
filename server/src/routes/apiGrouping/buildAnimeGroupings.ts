// Disclaimer: AI helped with this file

import { AnimeRelationType } from "../../../generated/prisma/enums";
import { prisma } from "$src/prisma";
import { getAnimeDetailsFromApiAndUpsert } from "$lib/anilistApi/getAnimeDetailsFromApiAndUpsert";

// Relation types whose edges stay inside a single franchise. CHARACTER / OTHER /
// ADAPTATION / SOURCE are excluded so cameos and crossovers don't merge
// unrelated franchises into one grouping.
const GROUPING_RELATION_TYPES = new Set<AnimeRelationType>([
  AnimeRelationType.PREQUEL,
  AnimeRelationType.SEQUEL,
  AnimeRelationType.PARENT,
  AnimeRelationType.SIDE_STORY,
  AnimeRelationType.SPIN_OFF,
  AnimeRelationType.ALTERNATIVE,
  AnimeRelationType.CONTAINS,
]);

type ChainableAnime = {
  anilistId: number;
  relationsOut: { relationType: AnimeRelationType; toAnimeId: number }[];
};

// A node in a chain. Children are the SEQUEL continuations of `anime`. Multiple
// children represent a fork (e.g. a season and a concurrent recap movie).
export type ChainNode<T extends ChainableAnime> = {
  anime: T;
  children: ChainNode<T>[];
};

export type AnimeGrouping<T extends ChainableAnime> = {
  chains: ChainNode<T>[];
  notInChain: T[];
};

const isGroupingRelation = (relation: { relationType: AnimeRelationType }) =>
  GROUPING_RELATION_TYPES.has(relation.relationType);

const collectGroupingMemberIds = async (rootAnilistId: number) => {
  const memberIds = new Set<number>();

  const visit = async (anilistId: number) => {
    if (memberIds.has(anilistId)) return;
    memberIds.add(anilistId);

    const anime = await prisma.baseAnime.findUniqueOrThrow({
      where: { anilistId },
      include: { relationsIn: true, relationsOut: true },
    });

    const neighbourIds = [
      ...anime.relationsIn.filter(isGroupingRelation).map((r) => r.fromAnimeId),
      ...anime.relationsOut.filter(isGroupingRelation).map((r) => r.toAnimeId),
    ];

    for (const neighbourId of neighbourIds) await visit(neighbourId);
  };

  await visit(rootAnilistId);
  return [...memberIds];
};

const buildChains = <T extends ChainableAnime>(
  animes: T[],
): AnimeGrouping<T> => {
  const pool = new Map(animes.map((anime) => [anime.anilistId, anime]));

  const relatedInPool = (anime: T, relationType: AnimeRelationType) =>
    anime.relationsOut
      .filter((r) => r.relationType === relationType && pool.has(r.toAnimeId))
      .map((r) => pool.get(r.toAnimeId)!);

  const findChainHead = (seed: T) => {
    let head = seed;
    const seen = new Set([head.anilistId]);
    for (;;) {
      const prequels = relatedInPool(head, AnimeRelationType.PREQUEL).filter(
        (anime) => !seen.has(anime.anilistId),
      );
      if (prequels.length !== 1) return head;
      head = prequels[0];
      seen.add(head.anilistId);
    }
  };

  const buildNode = (anime: T): ChainNode<T> => {
    pool.delete(anime.anilistId);
    return {
      anime,
      // A sibling branch may have already consumed a re-converging sequel, so
      // resolve children from the pool after removing this node.
      children: relatedInPool(anime, AnimeRelationType.SEQUEL).map(buildNode),
    };
  };

  const lowestRemaining = () => pool.get(Math.min(...pool.keys()))!;

  const grouping: AnimeGrouping<T> = { chains: [], notInChain: [] };
  while (pool.size > 0) {
    const tree = buildNode(findChainHead(lowestRemaining()));
    if (tree.children.length > 0) grouping.chains.push(tree);
    else grouping.notInChain.push(tree.anime);
  }

  return grouping;
};

export const buildAnimeGroupingIds = async (rootAnilistId: number) => {
  const memberIds = await collectGroupingMemberIds(rootAnilistId);
  const members = await prisma.baseAnime.findMany({
    where: { anilistId: { in: memberIds } },
    include: { relationsOut: true },
    orderBy: { anilistId: "asc" },
  });
  return buildChains(members);
};

export const buildAnimeGroupingDetails = async (rootAnilistId: number) => {
  const memberIds = await collectGroupingMemberIds(rootAnilistId);

  const existingDetails = await prisma.animeDetails.findMany({
    where: { baseAnimeAnilistId: { in: memberIds } },
  });

  // Collect member IDs that don't have existing details and fetch them from the API
  const memberIdsWithoutFetchedDetails = new Set(memberIds);
  for (const detail of existingDetails) {
    memberIdsWithoutFetchedDetails.delete(detail.baseAnimeAnilistId);
  }
  for (const anilistId of memberIdsWithoutFetchedDetails) {
    await getAnimeDetailsFromApiAndUpsert(anilistId);
  }

  const members = await prisma.baseAnime.findMany({
    where: { anilistId: { in: memberIds } },
    include: { relationsOut: true, animeDetails: true },
    orderBy: { anilistId: "asc" },
  });
  return buildChains(members);
};
