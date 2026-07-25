export interface AnimeProgress {
  anilistId: number;
  watched: number;
  total: number;
}

export interface SidebarCardData {
  displayAnilistId: number;
  allAnilistIds: number[];
  progress: AnimeProgress[];

  titleEnglish: string | null;
  titleRomanji: string | null;
  titleNative: string | null;
  thumbnailUrl: string | null;

  nextEpisodeDate?: Date;
}
