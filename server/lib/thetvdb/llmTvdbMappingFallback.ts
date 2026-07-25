import { tvdbRequest } from "./genericTvdbCall";
import type { TvdbMapping } from "./animeTvdbMapping";
import { prisma } from "$src/prisma";

export const resolveTvdbMappingViaLLM = async (
  anilistId: number,
): Promise<TvdbMapping | null> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const anime = await prisma.baseAnime.findUnique({
    where: { anilistId },
  });
  const anilistTitle = anime?.titleEnglish || anime?.titleRomanji;
  if (!anilistTitle) return null;

  const callLLM = async (prompt: string): Promise<string> => {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      },
    );

    if (!response.ok) throw new Error(`LLM Error: ${response.statusText}`);
    const data = await response.json();
    return data.choices[0].message.content;
  };

  const cleanPrompt = `I need to search TVDB for the anime "${anilistTitle}". 
TVDB search is very strict and groups all seasons under one base show name.
Extract the absolute shortest English or Romaji base name (e.g., just "Hell Mode"). 
Do not include sub-titles, season numbers, parts, or cours.
Reply with ONLY the short base name, no quotes.`;

  const baseTitle = (await callLLM(cleanPrompt)).trim();

  let searchResults: any[] = [];
  try {
    const response = await tvdbRequest<any[]>("/search", {
      query: baseTitle,
      type: "series",
    });
    searchResults = response.data || [];
  } catch (e) {
    return null;
  }

  if (searchResults.length === 0) return null;

  const resultsStr = searchResults
    .slice(0, 5)
    .map(
      (r, i) =>
        `[${i}] ID: ${r.tvdb_id} | Name: ${r.name} | Year: ${r.year} | English Translation: ${r.translations?.eng || "N/A"}`,
    )
    .join("\n");

  const pickPrompt = `I searched TVDB for the anime "${anilistTitle}". Here are the top results:
${resultsStr}
Which index is the correct TVDB show? Reply with ONLY the index number (e.g. 0). If none are correct, reply with "NONE".`;

  const pickIdxStr = (await callLLM(pickPrompt)).trim();
  const pickIdx = parseInt(pickIdxStr, 10);

  if (isNaN(pickIdx) || pickIdx < 0 || pickIdx >= searchResults.length) {
    return null;
  }

  const selectedSeries = searchResults[pickIdx];
  const seriesData = await tvdbRequest<any>(
    `/series/${selectedSeries.tvdb_id}/extended`,
  );
  const seasons = seriesData.data.seasons
    .filter((s: any) => s.type?.id === 1)
    .map((s: any) => `Season ${s.number}`);

  const offsetPrompt = `The anime is "${anilistTitle}". 
The correct TVDB show has these seasons: ${seasons.join(", ")}.
Based on the title "${anilistTitle}", what is the TVDB Season Number, and what is the episode offset (how many episodes to skip to reach this cour)? 
Format your reply strictly as: SEASON,OFFSET (e.g. "1,11" or "2,0"). 
If you are unsure or if this is too complex, reply "UNKNOWN".`;

  const offsetResult = (await callLLM(offsetPrompt)).trim();

  if (offsetResult === "UNKNOWN" || !offsetResult.includes(",")) {
    return {
      tvdbSeriesId: parseInt(selectedSeries.tvdb_id, 10),
      tvdbSeason: 1,
      tvdbEpisodeOffset: 0,
    };
  }

  const [seasonStr, offsetStr] = offsetResult.split(",");
  return {
    tvdbSeriesId: parseInt(selectedSeries.tvdb_id, 10),
    tvdbSeason: parseInt(seasonStr.trim(), 10) || 1,
    tvdbEpisodeOffset: parseInt(offsetStr.trim(), 10) || 0,
  };
};
