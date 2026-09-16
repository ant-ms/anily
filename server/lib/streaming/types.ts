export type StreamLanguage = 'sub' | 'dub';

export interface ProviderSearchResult {
  identifier: string;
  name: string;
  languages: StreamLanguage[];
}

export interface StreamSource {
  url: string;
  resolution?: number;
  container?: 'hls' | 'mp4';
  headers?: Record<string, string>;
  serverName?: string;
}

export interface AvailableService {
  providerId: string;
  providerName: string;
  serverName: string;
  serverId: string;
  language: StreamLanguage;
  identifier: string;
}

export interface BaseProvider {
  readonly id: string;
  readonly name: string;
  search(query: string): Promise<ProviderSearchResult[]>;
  getEpisodes(identifier: string, lang: StreamLanguage): Promise<{ episodes: number[]; servers: Array<{ id: string; name: string }> }>;
  getStream(identifier: string, episode: number, lang: StreamLanguage, server?: string): Promise<StreamSource | null>;
}
