import { buildAnimeGroupingDetails } from "./buildAnimeGroupings";
import { app } from "$src/app";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

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

const filterAnimeDetails = (a: NonChainEntry | ChainEntry["anime"]) => {
  return {
    anilistId: a.anilistId,
    titleEnglish: a.titleEnglish,
    titleRomanji: a.titleRomanji,
    titleNative: a.titleNative,
    thumbnailUrl: a.animeDetails?.thumbnailUrl || null,
    progress: {
      anilistId: a.anilistId,
      watched: a.animeDetails?.episodes.filter((e) => e.watched).length || 0,
      total: a.animeDetails?.episodes.length || 0,
      released: a.animeDetails?.episodes.filter((e: any) => e.airingAt && e.airingAt <= new Date()).length || 0,
    }
  };
};

const recursivelyFilterChainEntry = (node: ChainEntry): FilteredChainNode => ({
  ...filterAnimeDetails(node.anime),
  children: node.children.map(recursivelyFilterChainEntry),
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
      const chains = await buildAnimeGroupingDetails(query.baseAnilistId);

      const output = {
        chains: chains.chains.map(recursivelyFilterChainEntry),
        notInChain: chains.notInChain.map(filterAnimeDetails),
      };

      return c.json(output);
    } catch (error) {
      return c.json({
        error: "Failed to get build grouping",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
