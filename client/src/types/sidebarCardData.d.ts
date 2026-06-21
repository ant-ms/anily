export default interface SidebarCardData {
  anilistId: number;
  titleEnglish: string | null;
  titleRomanji: string | null;
  titleNative: string | null;
  thumbnailUrl: string | null;

  nextEpisodeDate?: Date; // TODO
}
