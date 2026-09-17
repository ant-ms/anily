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

export type StreamLanguagePreference = 'sub' | 'dub';

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

export function getStoredLanguagePreference(): StreamLanguagePreference {
  return (localStorage.getItem('anily:languagePreference') as StreamLanguagePreference) ?? 'sub';
}

export function setStoredLanguagePreference(pref: StreamLanguagePreference): void {
  localStorage.setItem('anily:languagePreference', pref);
}

export function isHdService(service: AvailableService): boolean {
  return (
    /\b(hd|1080p|720p|hq)\b/i.test(service.serverName) ||
    /\b(hd|1080p|720p|hq)\b/i.test(service.providerName)
  );
}

export function getQualityScore(service: AvailableService): number {
  const text = `${service.serverName} ${service.providerName}`.toLowerCase();
  if (/\b1080p\b/i.test(text)) return 3;
  if (/\b720p\b/i.test(text)) return 2;
  if (/\b(hd|hq)\b/i.test(text)) return 1;
  return 0;
}

export function sortServicesWithHdFirst(services: AvailableService[]): AvailableService[] {
  return [...services].sort((a, b) => {
    const aScore = getQualityScore(a);
    const bScore = getQualityScore(b);
    if (bScore !== aScore) return bScore - aScore;
    return 0;
  });
}

export function pickBestService(
  services: AvailableService[],
  preferredLang: StreamLanguagePreference = 'sub',
): AvailableService | null {
  if (!services || services.length === 0) return null;

  // Filter services that match the user's preferred language (sub or dub)
  const matchingLanguage = services.filter((s) => s.language === preferredLang);
  const candidates = matchingLanguage.length > 0 ? matchingLanguage : services;

  // Pick the highest quality service (prefer HD / 1080p / 720p)
  return [...candidates].sort((a, b) => {
    const scoreDiff = getQualityScore(b) - getQualityScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return 0;
  })[0];
}

