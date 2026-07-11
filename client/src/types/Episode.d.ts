export default interface EpisodeData {
  number: number;
  airingAt: string | null;
  watched: boolean;
  titleEnglish: string | null;
  titleNative: string | null;
  titleRomanji: string | null;
  thumbnailUrl: string | null;
}
