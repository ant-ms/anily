import type { AvailableService, BaseProvider, StreamLanguage, StreamSource } from "./types";
import { AnimeHubProvider } from "./providers/animehub";
import { HiAnimeProvider } from "./providers/hianime";
import { JustAnimeProvider } from "./providers/justanime";
import { logger } from "$src/logger";

const log = logger.child({ module: "streamingRegistry" });

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
              const cleanTitle = title.toLowerCase().replace(/[’‘]/g, "'").trim();
              // Find best match
              const match =
                searchResults.find((r) => {
                  const cleanName = r.name.toLowerCase().replace(/[’‘]/g, "'").trim();
                  return (
                    cleanName === cleanTitle ||
                    cleanName.includes(cleanTitle) ||
                    cleanTitle.includes(cleanName)
                  );
                }) || searchResults[0];

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
