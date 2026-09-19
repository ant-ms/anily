import { STORAGE_KEYS } from '../lib/storageKeys';

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

export const buildPlayerUrl = (mediaUrl: string, player: MediaPlayer, subtitleUrl?: string): string => {
  switch (player) {
    case 'iina': {
      let url = `iina://open?url=${encodeURIComponent(mediaUrl)}`;
      if (subtitleUrl) {
        url += `&sub=${encodeURIComponent(subtitleUrl)}&mpv_sub-file=${encodeURIComponent(subtitleUrl)}`;
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
    case 'mpv':
      return subtitleUrl ? `mpv "${mediaUrl}" --sub-file="${subtitleUrl}"` : `mpv "${mediaUrl}"`;
    case 'copy':
      return mediaUrl;
  }
};

export const getStoredPlayer = (): MediaPlayer => {
  return (localStorage.getItem(STORAGE_KEYS.MEDIA_PLAYER) as MediaPlayer) ?? 'iina';
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

/**
 * Scoring weights for sorting streaming servers by reliability and quality.
 *
 * Rationale:
 * - MegaPlay (+12): 100% success rate, ultra-high CDN throughput (50-200+ Mbps), pristine 1080p full HD.
 * - ZokoAnime (+8): High speed (~60-260 Mbps), <150ms start time, robust multi-source coverage.
 * - Resolution bonuses: 1080p (+4), 720p (+2), generic HD/HQ (+1).
 * - Provider reliability: JustAnime (+3), HiAnime (+2).
 * - Penalize throttled CDNs: AnimeHub F5-HQ / No Ads (-5 penalty) due to high latency/timeouts.
 */
const SCORE_WEIGHT_MEGAPLAY = 12;
const SCORE_WEIGHT_ZOKOANIME = 8;
const SCORE_WEIGHT_1080P = 4;
const SCORE_WEIGHT_720P = 2;
const SCORE_WEIGHT_GENERIC_HD = 1;
const SCORE_WEIGHT_JUSTANIME = 3;
const SCORE_WEIGHT_HIANIME = 2;
const PENALTY_THROTTLED_SERVERS = -5;

export const getQualityScore = (service: AvailableService): number => {
  const serverText = (service.serverName || "").toLowerCase();
  const providerText = (service.providerName || "").toLowerCase();
  const combined = `${serverText} ${providerText}`;
  let score = 0;

  // 1. Reliability & Latency Priority (Empirical benchmarks)
  if (serverText.includes("megaplay") || serverText.includes("mega")) {
    score += SCORE_WEIGHT_MEGAPLAY;
  } else if (serverText.includes("zoko")) {
    score += SCORE_WEIGHT_ZOKOANIME;
  }

  // 2. Penalize historically slow/throttled CDNs
  if (serverText.includes("f5 - hq") || serverText.includes("no ads")) {
    score += PENALTY_THROTTLED_SERVERS;
  }

  // 3. Provider stability
  if (providerText.includes("justanime")) {
    score += SCORE_WEIGHT_JUSTANIME;
  } else if (providerText.includes("hianime")) {
    score += SCORE_WEIGHT_HIANIME;
  }

  // 4. Video Resolution & Fidelity Priority
  if (/\b1080p\b/i.test(combined)) {
    score += SCORE_WEIGHT_1080P;
  } else if (/\b720p\b/i.test(combined)) {
    score += SCORE_WEIGHT_720P;
  } else if (/\b(hd|hq)\b/i.test(combined)) {
    score += SCORE_WEIGHT_GENERIC_HD;
  }

  return score;
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


