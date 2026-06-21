export default interface SidebarCardData {
  displayAnilistId: number;
  allAnilistIds: number[];

  titleEnglish: string | null;
  titleRomanji: string | null;
  titleNative: string | null;
  thumbnailUrl: string | null;

  nextEpisodeDate?: Date; // TODO
}
