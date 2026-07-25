// TODO: can we share these for type safety?

export default interface AnimeDetailsData {
  anilistId: int;
  titleEnglish: string;
  titleRomanji: string;
  titleNative: string;
  description: string;
  thumbnailUrl: string;
  groupingId: number | null;
  isDisplayAnime: boolean;
}
