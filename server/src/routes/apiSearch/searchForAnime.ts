import { prisma } from "../../prisma";

export const searchForAnime = async (q: string) =>
  await prisma.baseAnime.findMany({
    where: {
      OR: [
        { titleEnglish: { contains: q, mode: "insensitive" } },
        { titleRomanji: { contains: q, mode: "insensitive" } },
        { titleNative: { contains: q, mode: "insensitive" } },
        {
          synonyms: {
            some: {
              text: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    },
    include: {
      synonyms: true,
    },
    take: 20,
  });
