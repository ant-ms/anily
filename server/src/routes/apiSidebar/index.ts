import { app } from "$src/app";
import { prisma } from "$src/prisma";
import { SidebarCardData } from "./sidebarCardData";
import { buildChains, ChainNode } from "../apiGrouping/buildAnimeGroupings";

type GroupingItem = {
  animeDetails?: {
    episodes: {
      watched: boolean;
      airingAt: Date | null;
    }[];
  } | null;
};

function getEpisodeStats(items: GroupingItem[], now: Date) {
  let watched = 0;
  let releasedUnwatched = 0;
  let unreleasedUnwatched = 0;

  for (const item of items) {
    const episodes = item.animeDetails?.episodes ?? [];
    
    // Treat anime with 0 known episodes as having unreleased future content
    if (episodes.length === 0) {
      unreleasedUnwatched += 1;
      continue;
    }

    for (const episode of episodes) {
      if (episode.watched) {
        watched += 1;
      } else if (episode.airingAt && episode.airingAt <= now) {
        releasedUnwatched += 1;
      } else {
        unreleasedUnwatched += 1;
      }
    }
  }

  return { watched, releasedUnwatched, unreleasedUnwatched };
}

import { getAuthenticatedUser } from "$src/auth";

export const getSidebarAnimesFromDB = async (tab: string, userId: string): Promise<SidebarCardData[]> => {
  const userBookmarks = await prisma.userBookmark.findMany({
    where: { userId },
    select: { anilistId: true },
  });

  if (userBookmarks.length === 0) {
    return [];
  }

  const bookmarkedIds = userBookmarks.map((b) => b.anilistId);
  const bookmarkedSet = new Set(bookmarkedIds);

  const animeGroupings = await prisma.animeGrouping.findMany({
    where: {
      items: {
        some: {
          anilistId: { in: bookmarkedIds },
        },
      },
    },
    include: {
      items: {
        select: {
          anilistId: true,
          relationsOut: {
            select: {
              relationType: true,
              toAnimeId: true,
            },
          },
          animeDetails: {
            select: {
              episodes: {
                select: {
                  id: true,
                  airingAt: true,
                },
              },
            },
          },
        },
      },
      displayAnime: {
        include: {
          animeDetails: true,
        },
      },
    },
  });

  const relevantEpisodeIds: number[] = [];
  for (const grouping of animeGroupings) {
    for (const item of grouping.items) {
      for (const ep of item.animeDetails?.episodes ?? []) {
        relevantEpisodeIds.push(ep.id);
      }
    }
  }

  const userProgress = await prisma.userEpisodeProgress.findMany({
    where: {
      userId,
      episodeId: { in: relevantEpisodeIds },
    },
    select: { episodeId: true, watched: true },
  });

  const watchedMap = new Map(userProgress.map((p) => [p.episodeId, p.watched]));

  // Map each episode's watched status to this user
  const userScopedGroupings = animeGroupings
    .filter((grouping) =>
      grouping.items.some((item) => bookmarkedSet.has(item.anilistId)),
    )
    .map((grouping) => ({
      ...grouping,
      items: grouping.items.map((item) => ({
        ...item,
        animeDetails: item.animeDetails
          ? {
              ...item.animeDetails,
              episodes: item.animeDetails.episodes.map((ep) => ({
                ...ep,
                watched: watchedMap.get(ep.id) ?? false,
              })),
            }
          : null,
      })),
    }));

  const now = new Date();

  const filteredGroupings = userScopedGroupings.filter((grouping) => {
    const { watched, releasedUnwatched, unreleasedUnwatched } = getEpisodeStats(grouping.items, now);

    switch (tab) {
      case "inbox":
        return releasedUnwatched > 0;
      
      case "completed":
        return watched > 0 && releasedUnwatched === 0 && unreleasedUnwatched === 0;
      
      case "waiting": // Caught up
        return watched > 0 && releasedUnwatched === 0 && unreleasedUnwatched > 0;
      
      case "upcoming":
        return watched === 0 && releasedUnwatched === 0;
      
      default:
        return false;
    }
  });

  const cards: SidebarCardData[] = [];
  const seenDisplayAnimeIds = new Set<number>();

  for (const grouping of filteredGroupings) {
    const displayId = grouping.displayAnime.anilistId;
    if (seenDisplayAnimeIds.has(displayId)) {
      continue;
    }
    seenDisplayAnimeIds.add(displayId);

    const groupingChains = buildChains(grouping.items as any);
    
    // We flatten trees into simple arrays of AnimeProgress for the pill UI.
    // Each chain becomes one array of progress donuts.
    const extractProgress = (node: ChainNode<any>): any[] => {
      const episodes = node.anime.animeDetails?.episodes ?? [];
      const prog = {
        anilistId: node.anime.anilistId,
        watched: episodes.filter((ep: any) => ep.watched).length,
        total: episodes.length,
        released: episodes.filter((ep: any) => ep.airingAt && ep.airingAt <= now).length,
      };
      const childrenProg = node.children.flatMap(extractProgress);
      return [prog, ...childrenProg];
    };

    const progressChains = groupingChains.chains.map(tree => extractProgress(tree));
    const notInChainProgressFlat = groupingChains.notInChain.map((anime: any) => {
      const episodes = anime.animeDetails?.episodes ?? [];
      return {
        anilistId: anime.anilistId,
        watched: episodes.filter((ep: any) => ep.watched).length,
        total: episodes.length,
        released: episodes.filter((ep: any) => ep.airingAt && ep.airingAt <= now).length,
      };
    });

    const allProgressChains = [...progressChains];
    if (notInChainProgressFlat.length > 0) {
      allProgressChains.push(notInChainProgressFlat);
    }

    let earliestFutureDate: Date | null = null;
    for (const item of grouping.items) {
      for (const ep of item.animeDetails?.episodes ?? []) {
        if (ep.airingAt && ep.airingAt > now) {
          if (!earliestFutureDate || ep.airingAt < earliestFutureDate) {
            earliestFutureDate = ep.airingAt;
          }
        }
      }
    }

    cards.push({
      displayAnilistId: grouping.displayAnime.anilistId,
      allAnilistIds: grouping.items.map((item) => item.anilistId),
      progress: allProgressChains,
      titleEnglish: grouping.displayAnime.titleEnglish,
      titleRomanji: grouping.displayAnime.titleRomanji,
      titleNative: grouping.displayAnime.titleNative,
      thumbnailUrl: grouping.displayAnime.animeDetails?.thumbnailUrl ?? null,
      nextEpisodeDate: earliestFutureDate ?? now,
    });
  }

  return cards;
};

export const apiSidebarGetRoute = app.get(
  "/api/sidebar/:tab",
  async (c) => {
    const tab = c.req.param("tab");
    const user = await getAuthenticatedUser(c);
    const data = await getSidebarAnimesFromDB(tab, user.id);
    return c.json(data);
  },
);
