import { logger } from "$src/logger";

export interface TorrentResult {
  title: string;
  link: string;
  size: number;
  seeders: number;
  peers: number;
  source: string;
  publishDate: string;
  category: string;
  infoHash?: string;
}

interface JackettResultItem {
  Title: string;
  Link: string;
  MagnetUri?: string | null;
  Size: number;
  Seeders: number;
  Peers: number;
  Tracker: string;
  PublishDate: string;
  CategoryDesc: string;
  InfoHash?: string | null;
}

interface JackettResponse {
  Results: JackettResultItem[];
}

/**
 * Search for torrents on Jackett. Returns array of results sorted by seeders desc.
 * Query example: "Frieren Beyond Journey's End S01E12" or "Frieren 12"
 */
export async function searchTorrents(query: string): Promise<TorrentResult[]> {
  const jackettUrl = process.env.JACKETT_URL;
  const apiKey = process.env.JACKETT_API_KEY;

  if (!jackettUrl || !apiKey) {
    logger.warn("JACKETT_URL or JACKETT_API_KEY not configured, skipping torrent search");
    return [];
  }

  const url = new URL(`${jackettUrl}/api/v2.0/indexers/all/results`);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("Query", query);

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      logger.warn(
        { status: response.status, query },
        "Jackett search returned non-OK status",
      );
      return [];
    }

    const data = (await response.json()) as JackettResponse;

    const results: TorrentResult[] = (data.Results ?? []).map((item) => ({
      title: item.Title,
      link: item.MagnetUri ? item.MagnetUri : item.Link,
      size: item.Size,
      seeders: item.Seeders,
      peers: item.Peers,
      source: item.Tracker,
      publishDate: item.PublishDate,
      category: item.CategoryDesc,
      infoHash: item.InfoHash ?? undefined,
    }));

    results.sort((a, b) => b.seeders - a.seeders);

    return results;
  } catch (error) {
    logger.warn({ error, query }, "Jackett search failed, returning empty results");
    return [];
  }
}
