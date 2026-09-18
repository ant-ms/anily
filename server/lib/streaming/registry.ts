import type { AvailableService, BaseProvider, StreamLanguage, StreamSource } from "./types";
import { AnimeHubProvider } from "./providers/animehub";
import { HiAnimeProvider } from "./providers/hianime";
import { JustAnimeProvider } from "./providers/justanime";
import { matchBestSearchResult } from "./titleMatcher";
import { logger } from "$src/logger";

const log = logger.child({ module: "streamingRegistry" });

/**
 * Reliability and quality weights for ranking available stream servers.
 *
 * Rationale:
 * - MegaPlay (+6): Benchmark testing showed 100% success rate with <150ms start time.
 * - AnimeHub Internal (+4): F5 - HQ and No Ads 4 deliver steady ~900ms CDN streams.
 * - Explicit resolutions (+3 for 1080p, +2 for 720p, +1 for generic HD/HQ).
 * - Fallbacks (0): Standard servers (e.g. ZokoAnime) are kept as backups.
 */
const SCORE_WEIGHT_MEGAPLAY = 6;
const SCORE_WEIGHT_ANIMEHUB_INTERNAL = 4;
const SCORE_WEIGHT_1080P = 3;
const SCORE_WEIGHT_720P = 2;
const SCORE_WEIGHT_GENERIC_HD = 1;

function getServiceScore(s: AvailableService): number {
  const text = `${s.serverName} ${s.providerName}`.toLowerCase();
  let score = 0;

  if (text.includes("megaplay")) {
    score += SCORE_WEIGHT_MEGAPLAY;
  } else if (text.includes("f5 - hq") || text.includes("no ads")) {
    score += SCORE_WEIGHT_ANIMEHUB_INTERNAL;
  }

  if (/\b1080p\b/i.test(text)) {
    score += SCORE_WEIGHT_1080P;
  } else if (/\b720p\b/i.test(text)) {
    score += SCORE_WEIGHT_720P;
  } else if (/\b(hd|hq)\b/i.test(text)) {
    score += SCORE_WEIGHT_GENERIC_HD;
  }

  return score;
}

export class ProviderRegistry {
  private providers = new Map<string, BaseProvider>();

  constructor() {
    // Register standard providers
    this.register(new AnimeHubProvider());
    this.register(new HiAnimeProvider());
    this.register(new JustAnimeProvider());
  }

  register(provider: BaseProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): BaseProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): BaseProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Check which providers and servers have the given episode available.
   */
  async checkAvailability(
    titles: string[],
    episodeNumber: number,
  ): Promise<AvailableService[]> {
    const validTitles = titles
      .map((t) => t?.trim())
      .filter((t): t is string => Boolean(t && t.length > 0));

    if (validTitles.length === 0) return [];

    const results: AvailableService[] = [];
    const providers = this.getAllProviders();

    await Promise.all(
      providers.map(async (provider) => {
        try {
          // Find matching identifier in this provider
          let matchedIdentifier: string | null = null;
          let matchedLanguages: StreamLanguage[] = ["sub"];

          for (const title of validTitles) {
            const searchResults = await provider.search(title);
            if (searchResults.length > 0) {
              const match = await matchBestSearchResult(validTitles, searchResults);
              if (match) {
                matchedIdentifier = match.identifier;
                matchedLanguages = match.languages;
                break;
              }
            }
          }

          if (!matchedIdentifier) return;

          // Check availability for each language supported, prioritizing sub then dub
          const sortedLanguages = Array.from(new Set(matchedLanguages)).sort((a, b) =>
            a === "sub" ? -1 : 1,
          );

          for (const lang of sortedLanguages) {
            const { episodes, servers } = await provider.getEpisodes(
              matchedIdentifier,
              lang,
            );

            // Check if episode number exists in episodes list
            if (episodes.includes(episodeNumber)) {
              for (const server of servers) {
                results.push({
                  providerId: provider.id,
                  providerName: provider.name,
                  serverName: server.name,
                  serverId: server.id,
                  language: lang,
                  identifier: matchedIdentifier,
                });
              }
            }
          }
        } catch (err) {
          log.warn({ err, provider: provider.name }, "Provider check failed");
        }
      }),
    );

    // Prioritize fastest, verified reliable HD servers first
    results.sort((a, b) => {
      const scoreDiff = getServiceScore(b) - getServiceScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return 0;
    });

    return results;
  }

  /**
   * Resolve a stream for a specific service.
   */
  async resolveStream(
    providerId: string,
    identifier: string,
    episodeNumber: number,
    language: StreamLanguage,
    server?: string,
  ): Promise<StreamSource | null> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      log.warn({ providerId }, "Provider not found");
      return null;
    }

    return await provider.getStream(identifier, episodeNumber, language, server);
  }
}

export const registry = new ProviderRegistry();
