import type { MediaStatus } from './Media';

export default interface EpisodeData {
  id: number;
  number: number;
  airingAt: string | null;
  watched: boolean;
  titleEnglish: string | null;
  titleNative: string | null;
  titleRomanji: string | null;
  thumbnailUrl: string | null;
  mediaStatus: MediaStatus;
  mediaPath?: string;
}
