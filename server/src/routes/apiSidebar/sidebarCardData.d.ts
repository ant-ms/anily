export interface SidebarCardData {
  anilistId: number;
  titleEnglish: string | null;
  titleRomanji: string | null;
  titleNative: string | null;
  thumbnailUrl: string | null;

  nextEpisodeDate?: Date;
  // TODO: If in past, show season e.g. "Winter 2025"
}
