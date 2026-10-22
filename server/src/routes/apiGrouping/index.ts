import { buildAnimeGroupingDetails } from "./buildAnimeGroupings";
import { app } from "$src/app";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getAuthenticatedUser } from "$src/auth";
import { prisma } from "$src/prisma";

// TODO: This grouping should actually be stored in the database

type NonChainEntry = Awaited<
  ReturnType<typeof buildAnimeGroupingDetails>
>["notInChain"][number];
type ChainEntry = Awaited<
  ReturnType<typeof buildAnimeGroupingDetails>
>["chains"][number];

type FilteredChainNode = {
  anilistId: number;
  titleEnglish: string | null;
  titleRomanji: string | null;
  titleNative: string | null;
  thumbnailUrl: string | null;
  progress: {
    anilistId: number;
    watched: number;
    total: number;
    released: number;
  };
  children: FilteredChainNode[];
};

const filterAnimeDetails = (
  a: NonChainEntry | ChainEntry["anime"],
  progressMap?: Map<number, boolean>,
) => {
  const episodes = a.animeDetails?.episodes ?? [];
  return {
    anilistId: a.anilistId,
    titleEnglish: a.titleEnglish,
    titleRomanji: a.titleRomanji,
    titleNative: a.titleNative,
    thumbnailUrl: a.animeDetails?.thumbnailUrl || null,
    progress: {
      anilistId: a.anilistId,
      watched: episodes.filter((e: any) =>
        progressMap?.get(e.id) ?? false,
      ).length,
      total: episodes.length,
      released: episodes.filter(
        (e: any) => e.airingAt && e.airingAt <= new Date(),
      ).length,
    },
  };
};

const recursivelyFilterChainEntry = (
  node: ChainEntry,
  progressMap?: Map<number, boolean>,
): FilteredChainNode => ({
  ...filterAnimeDetails(node.anime, progressMap),
  children: node.children.map((child) =>
    recursivelyFilterChainEntry(child, progressMap),
  ),
});

export const apiGroupingGetRoute = app.get(
  "/api/grouping",
  zValidator(
    "query",
    z.object({
      baseAnilistId: z.coerce.number().int(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("query");

    try {
      const [user, chains] = await Promise.all([
        getAuthenticatedUser(c),
        buildAnimeGroupingDetails(query.baseAnilistId),
      ]);

      // Collect all episode IDs across chains and notInChain
      const allEpisodeIds: number[] = [];
      const collectEpisodeIds = (node: ChainEntry) => {
        for (const ep of node.anime.animeDetails?.episodes ?? []) {
          allEpisodeIds.push((ep as any).id);
        }
        for (const child of node.children) {
          collectEpisodeIds(child);
        }
      };
      for (const chain of chains.chains) {
        collectEpisodeIds(chain);
      }
      for (const entry of chains.notInChain) {
        for (const ep of entry.animeDetails?.episodes ?? []) {
          allEpisodeIds.push((ep as any).id);
        }
      }

      const userProgress = allEpisodeIds.length > 0
        ? await prisma.userEpisodeProgress.findMany({
            where: {
              userId: user.id,
              episodeId: { in: allEpisodeIds },
            },
            select: { episodeId: true, watched: true },
          })
        : [];
      const progressMap = new Map(
        userProgress.map((p) => [p.episodeId, p.watched]),
      );

      const output = {
        chains: chains.chains.map((chain) =>
          recursivelyFilterChainEntry(chain, progressMap),
        ),
        notInChain: chains.notInChain.map((entry) =>
          filterAnimeDetails(entry, progressMap),
        ),
      };

      return c.json(output);
    } catch (error) {
      return c.json(
        {
          error: "Failed to get build grouping",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);
