import { app } from "$src/app";
import { prisma } from "$src/prisma";
import { SidebarCardData } from "./sidebarCardData";

const getInboxAnimesFromDB = async (): Promise<SidebarCardData[]> => {
  const animeGroupings = await prisma.animeGrouping.findMany({
    where: {},
    include: {
      items: {
        select: {
          anilistId: true,
        },
      },
      displayAnime: {
        include: {
          animeDetails: true,
        },
      },
    },
  });

  return animeGroupings.map((a) => ({
    displayAnilistId: a.displayAnime.anilistId,
    allAnilistIds: a.items.map((i) => i.anilistId),
    titleEnglish: a.displayAnime.titleEnglish,
    titleRomanji: a.displayAnime.titleRomanji,
    titleNative: a.displayAnime.titleNative,
    thumbnailUrl: a.displayAnime.animeDetails?.thumbnailUrl || null,
    nextEpisodeDate: new Date(),
  }));
};

export const apiSidebarInboxGetRoute = app.get(
  "/api/sidebar/inbox",
  async (c) => {
    const data = await getInboxAnimesFromDB();
    return c.json(data);
  },
);
