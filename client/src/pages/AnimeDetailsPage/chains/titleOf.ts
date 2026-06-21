import type { CommonDetails } from "../../../types/AnimeGroupings";

type Titled = Pick<
  CommonDetails,
  "titleEnglish" | "titleRomanji" | "titleNative"
>;

export const titleOf = (n: Titled) =>
  n.titleEnglish ?? n.titleRomanji ?? n.titleNative ?? "Unknown";

// Strip the shared franchise prefix so cards show only the distinguishing part:
// prefer the subtitle after a colon, otherwise keep from a "Season" marker.
export const shortTitleOf = (n: Titled) => {
  const full = titleOf(n);

  const seasonMatch = full.match(/\bSeason\b.*/);
  if (seasonMatch) return seasonMatch[0].trim();

  const colonIndex = full.indexOf(":");
  if (colonIndex !== -1) {
    const subtitle = full.slice(colonIndex + 1).trim();
    if (subtitle) return subtitle;
  }

  return full;
};
