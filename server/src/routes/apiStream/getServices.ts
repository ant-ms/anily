import { prisma } from "$src/prisma";
import { registry } from "$lib/streaming/registry";
import { probeStreamHealth } from "$lib/streaming/healthCheck";
import type { AvailableService } from "$lib/streaming/types";
import { logger } from "$src/logger";

const log = logger.child({ module: "getServices" });

// In-memory cache for verified services: episodeId -> { services, timestamp }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const verifiedServicesCache = new Map<
  number,
  { services: AvailableService[]; timestamp: number }
>();

export async function getAvailableStreamServices(
  episodeId: number,
): Promise<{ services?: AvailableService[]; notFound?: boolean }> {
  const cached = verifiedServicesCache.get(episodeId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { services: cached.services };
  }

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      animeDetails: {
        include: { baseAnime: true },
      },
    },
  });

  if (!episode) {
    return { notFound: true };
  }

  const baseAnime = episode.animeDetails.baseAnime;
  const titles = [
    baseAnime.titleEnglish,
    baseAnime.titleRomanji,
    baseAnime.titleNative,
  ].filter((t): t is string => Boolean(t));

  const rawServices = await registry.checkAvailability(titles, episode.number);
  if (rawServices.length === 0) {
    return { services: [] };
  }

  // Pre-flight check: Verify that servers actually resolve and respond with working media segments
  const verifiedResults = await Promise.all(
    rawServices.map(async (service) => {
      try {
        const streamSource = await registry.resolveStream(
          service.providerId,
          service.identifier,
          episode.number,
          service.language,
          service.serverId,
        );

        if (!streamSource || !streamSource.url) {
          log.info(
            { provider: service.providerName, server: service.serverName, episodeId },
            "Filtering out server: failed to resolve stream",
          );
          return null;
        }

        const isHealthy = await probeStreamHealth(streamSource, 2500);
        if (isHealthy) {
          return service;
        }

        log.warn(
          {
            provider: service.providerName,
            server: service.serverName,
            episodeId,
          },
          "Filtering out server: health probe failed or timed out",
        );
        return null;
      } catch (err: any) {
        log.warn(
          {
            provider: service.providerName,
            server: service.serverName,
            err: err.message,
            episodeId,
          },
          "Filtering out server: probe exception",
        );
        return null;
      }
    }),
  );

  const verifiedServices = verifiedResults.filter(
    (s): s is AvailableService => s !== null,
  );

  // If some servers verified successfully, use them; if network probe failed completely, fall back to raw
  const finalServices = verifiedServices.length > 0 ? verifiedServices : rawServices;

  verifiedServicesCache.set(episodeId, {
    services: finalServices,
    timestamp: Date.now(),
  });

  return { services: finalServices };
}
