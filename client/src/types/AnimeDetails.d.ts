// TODO: can we share these for type safety?

export type Rating = "LIKE" | "NEUTRAL" | "DISLIKE";

export default interface AnimeDetailsData {
  anilistId: number;
  titleEnglish: string;
  titleRomanji: string;
  titleNative: string;
  description: string;
  thumbnailUrl: string;
  groupingId: number | null;
  isDisplayAnime: boolean;
  rating?: Rating;
}
