import { prisma } from "$src/prisma";
import { AnimeRelationType } from "generated/prisma/enums";

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

const isGroupingRelation = (relation: { relationType: AnimeRelationType }) =>
  GROUPING_RELATION_TYPES.has(relation.relationType);

export const collectGroupingMemberIds = async (rootAnilistId: number) => {
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
