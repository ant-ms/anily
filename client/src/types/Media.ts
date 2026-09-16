export type StreamLanguage = 'sub' | 'dub';

export interface AvailableService {
  providerId: string;
  providerName: string;
  serverName: string;
  serverId: string;
  language: StreamLanguage;
  identifier: string;
}

export type MediaPlayer = 'mpv' | 'iina' | 'vlc' | 'copy';

// Build a player URL from a media URL and player type
export function buildPlayerUrl(mediaUrl: string, player: MediaPlayer): string {
  switch (player) {
    case 'iina':
      return `iina://open?url=${encodeURIComponent(mediaUrl)}`;
    case 'vlc': {
      // VLC's custom URL scheme handler prepends its own protocol (https://).
      // If mediaUrl has http:// or https://, VLC creates malformed URLs like https://http://...
      // Stripping the protocol prefix prevents this issue.
      const strippedUrl = mediaUrl.replace(/^https?:\/\//, '');
      return `vlc://${strippedUrl}`;
    }
    case 'mpv':
      // mpv doesn't have a standard URL scheme, return the raw URL
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
