import { STORAGE_KEYS } from '../lib/storageKeys';
import type { AvailableService, StreamLanguage } from '@ant.ms/anily-providers';
import { getServiceScore as getQualityScore } from '@ant.ms/anily-providers';

export type { AvailableService, StreamLanguage };
export { getQualityScore };

export type MediaPlayer = 'builtin' | 'mpv' | 'iina' | 'vlc' | 'copy';

export type StreamLanguagePreference = 'sub' | 'dub';

export interface SubtitleOption {
  url: string;
  default?: boolean;
  language?: string;
  label?: string;
}

export const buildPlayerUrl = (
  mediaUrl: string,
  player: MediaPlayer,
  subtitleInput?: string | SubtitleOption[],
): string => {
  let subUrls: string[] = [];
  if (Array.isArray(subtitleInput)) {
    const sorted = [...subtitleInput].sort((a, b) => {
      if (a.default && !b.default) return -1;
      if (!a.default && b.default) return 1;
      const isEnA = a.language === 'en' || a.language === 'eng' || a.label?.toLowerCase().includes('english');
      const isEnB = b.language === 'en' || b.language === 'eng' || b.label?.toLowerCase().includes('english');
      if (isEnA && !isEnB) return -1;
      if (!isEnA && isEnB) return 1;
      return 0;
    });
    // Take top 3 subtitles to keep URL concise and responsive
    subUrls = sorted.map((s) => s.url).filter(Boolean).slice(0, 3);
  } else if (typeof subtitleInput === 'string' && subtitleInput) {
    subUrls = [subtitleInput];
  }

  switch (player) {
    case 'builtin':
      return mediaUrl;
    case 'iina': {
      let url = `iina://open?url=${encodeURIComponent(mediaUrl)}&mpv_demuxer-lavf-o=strict=experimental&mpv_sub-visibility=yes&mpv_slang=en,eng,English`;
      if (subUrls.length > 0) {
        // mpv StringList treats colons as separators on Unix; colons inside URLs must be escaped as \:
        const escapedSubFiles = subUrls.map((u) => u.replace(/:/g, '\\:')).join(':');
        url += `&mpv_sub-files=${encodeURIComponent(escapedSubFiles)}`;
      }
      return url;
    }
    case 'vlc': {
      // VLC's custom URL scheme handler prepends its own protocol (https://).
      // If mediaUrl has http:// or https://, VLC creates malformed URLs like https://http://...
      // Stripping the protocol prefix prevents this issue.
      const strippedUrl = mediaUrl.replace(/^https?:\/\//, '');
      return `vlc://${strippedUrl}`;
    }
    case 'mpv': {
      const subArgs = subUrls.map((u) => `--sub-file="${u}"`).join(' ');
      return subUrls.length > 0
        ? `mpv "${mediaUrl}" ${subArgs} --demuxer-lavf-o=strict=experimental --sub-visibility=yes`
        : `mpv "${mediaUrl}" --demuxer-lavf-o=strict=experimental`;
    }
    case 'copy':
      return mediaUrl;
  }
};

export const getStoredPlayer = (): MediaPlayer => {
  return (localStorage.getItem(STORAGE_KEYS.MEDIA_PLAYER) as MediaPlayer) ?? 'builtin';
};

export const setStoredPlayer = (player: MediaPlayer): void => {
  localStorage.setItem(STORAGE_KEYS.MEDIA_PLAYER, player);
};

export const getStoredLanguagePreference = (): StreamLanguagePreference => {
  return (localStorage.getItem(STORAGE_KEYS.LANGUAGE_PREFERENCE) as StreamLanguagePreference) ?? 'sub';
};

export const setStoredLanguagePreference = (pref: StreamLanguagePreference): void => {
  localStorage.setItem(STORAGE_KEYS.LANGUAGE_PREFERENCE, pref);
};

export const isHdService = (service: AvailableService): boolean => {
  return (
    /\b(hd|1080p|720p|hq|megaplay)\b/i.test(service.serverName) ||
    /\b(hd|1080p|720p|hq)\b/i.test(service.providerName)
  );
};

export const sortServicesWithHdFirst = (services: AvailableService[]): AvailableService[] => {
  return [...services].sort((a, b) => {
    const aScore = getQualityScore(a);
    const bScore = getQualityScore(b);
    if (bScore !== aScore) return bScore - aScore;
    return 0;
  });
};

export const pickBestService = (
  services: AvailableService[],
  preferredLang: StreamLanguagePreference = 'sub',
): AvailableService | null => {
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
};


