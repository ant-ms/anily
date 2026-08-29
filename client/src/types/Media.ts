export type MediaStatus = 'NONE' | 'QUEUED' | 'DOWNLOADING' | 'AVAILABLE';

export interface TorrentResult {
  title: string;
  link: string;
  size: number;       // bytes
  seeders: number;
  peers: number;
  source: string;
  publishDate: string;
  category: string;
  infoHash?: string;
}

export interface TorrentAIResult {
  index: number;          // -1 = no recommendation
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface EpisodeTorrentSearch {
  episode: {
    id: number;
    number: number;
    animeTitle: string;
    anilistId: number;
  };
  results: TorrentResult[];
  recommendation: TorrentAIResult;
}

export interface SeasonTorrentSearch {
  episodes: EpisodeTorrentSearch[];
}

export type MediaPlayer = 'mpv' | 'iina' | 'vlc' | 'copy';

// Build a player URL from a media URL and player type
export function buildPlayerUrl(mediaUrl: string, player: MediaPlayer): string {
  switch (player) {
    case 'iina':
      return `iina://open?url=${encodeURIComponent(mediaUrl)}`;
    case 'vlc':
      return `vlc://${mediaUrl}`;
    case 'mpv':
      // mpv doesn't have a standard URL scheme, return the raw URL
      // User should use mpv <url> in terminal
      return mediaUrl;
    case 'copy':
      return mediaUrl;
  }
}

export function getStoredPlayer(): MediaPlayer {
  return (localStorage.getItem('anily:mediaPlayer') as MediaPlayer) ?? 'iina';
}

export function setStoredPlayer(player: MediaPlayer): void {
  localStorage.setItem('anily:mediaPlayer', player);
}
