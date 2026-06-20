import { Hono } from "hono";
import { buildAnimeGroupingDetails } from "./buildAnimeGroupings";

// TODO: This grouping should actually be stored in the database

type NonChainEntry = Awaited<
  ReturnType<typeof buildAnimeGroupingDetails>
>["notInChain"][number];
type ChainEntry = Awaited<
  ReturnType<typeof buildAnimeGroupingDetails>
>["chains"][number];

type FilteredChainNode = {
  titleRomanji: string | null;
  children: FilteredChainNode[];
};

const filterAnimeDetails = (a: NonChainEntry | ChainEntry["anime"]) => {
  return {
    titleEnglish: a.titleEnglish,
    titleRomanji: a.titleRomanji,
    titleNative: a.titleNative,
    thumbnailUrl: a.animeDetails?.thumbnailUrl,
  };
};

const recursivelyFilterChainEntry = (node: ChainEntry): FilteredChainNode => ({
  ...filterAnimeDetails(node.anime),
  children: node.children.map(recursivelyFilterChainEntry),
});

export const setupApiGrouping = (app: Hono) => {
  app.get("/api/grouping", async (c) => {
    const baseAnilistId = c.req.query("baseAnilistId");
    if (!baseAnilistId) return c.json({ error: "No baseAnilistId provided" });

    let baseAnilistIdInt: number;
    try {
      baseAnilistIdInt = parseInt(baseAnilistId);
    } catch (error) {
      return c.json({
        error: "Invalid baseAnilistId",
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const chains = await buildAnimeGroupingDetails(baseAnilistIdInt);

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
  });
};
