import { prisma } from "$src/prisma";
import { Hono } from "hono";
import { SidebarCardData } from "./sidebarCardData";

const getInboxAnimesFromDB = async (): Promise<SidebarCardData[]> => {
  const animeGroupings = await prisma.animeGrouping.findMany({
    where: {},
    include: {
      displayAnime: {
        include: {
          animeDetails: true,
        },
      },
    },
  });

  return animeGroupings.map((a) => ({
    anilistId: a.displayAnime.anilistId,
    titleEnglish: a.displayAnime.titleEnglish,
    titleRomanji: a.displayAnime.titleRomanji,
    titleNative: a.displayAnime.titleNative,
    thumbnailUrl: a.displayAnime.animeDetails?.thumbnailUrl || null,
    nextEpisodeDate: new Date(),
  }));
};

export const setupApiSidebarInbox = (app: Hono) => {
  app.get("/api/sidebar/inbox", async (c) => {
    const data = await getInboxAnimesFromDB();
    return c.json(data);
  });
};
