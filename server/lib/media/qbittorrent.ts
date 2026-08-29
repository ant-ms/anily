import { logger } from "$src/logger";

export interface QBitTorrentInfo {
  hash: string;
  name: string;
  state: string;
  progress: number;
  size: number;
  save_path: string;
  content_path: string;
  num_seeds: number;
  num_leechs: number;
  dlspeed: number;
  uploaded: number;
}

export interface QBitFileInfo {
  index: number;
  name: string;
  size: number;
  progress: number;
  priority: number;
}

class QBittorrentClient {
  private sessionCookie: string | null = null;
  private readonly log = logger.child({ module: "qbittorrent" });

  private get baseUrl(): string {
    return (process.env.QBITTORRENT_URL ?? "").replace(/\/$/, "");
  }

  private get username(): string {
    return process.env.QBITTORRENT_USERNAME ?? "admin";
  }

  private get password(): string {
    return process.env.QBITTORRENT_PASSWORD ?? "";
  }

  private async login(): Promise<void> {
    if (!this.baseUrl) {
      throw new Error("QBITTORRENT_URL not configured");
    }

    const body = new URLSearchParams({
      username: this.username,
      password: this.password,
    });

    const response = await fetch(`${this.baseUrl}/api/v2/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: this.baseUrl,
        Origin: this.baseUrl,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`qBittorrent login failed: HTTP ${response.status}`);
    }

    const text = await response.text();
    // Some qBittorrent versions return 'Ok.' while others (or subnet whitelist) might return empty string or redirect
    if (text.trim() !== "Ok." && text.trim() !== "") {
      throw new Error(`qBittorrent login rejected: ${text}`);
    }

    // Extract the session cookie (SID=...)
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/SID=[^;]+/);
      if (match) {
        this.sessionCookie = match[0];
      }
    }
    this.log.debug("qBittorrent session established");
  }

  private async request(
    path: string,
    options: RequestInit = {},
    retry = true,
  ): Promise<Response> {
    if (!this.sessionCookie) {
      await this.login();
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Cookie: this.sessionCookie!,
        ...options.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(15_000),
    });

    // 403 means session expired — re-login once
    if (response.status === 403 && retry) {
      this.sessionCookie = null;
      await this.login();
      return this.request(path, options, false);
    }

    return response;
  }

  async addTorrent(
    magnetOrUrl: string,
    savePath: string,
    options?: { sequential?: boolean },
  ): Promise<string> {
    const form = new FormData();
    form.append("urls", magnetOrUrl);
    form.append("savepath", savePath);
    if (options?.sequential) {
      form.append("sequentialDownload", "true");
    }

    const response = await this.request("/api/v2/torrents/add", {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      throw new Error(`Failed to add torrent: HTTP ${response.status}`);
    }

    const text = await response.text();
    let torrentHash: string | null = null;

    // qBittorrent v5+ returns JSON: {"added_torrent_ids":["..."],"failure_count":0,"pending_count":0,"success_count":1}
    try {
      const json = JSON.parse(text);
      if (json.added_torrent_ids && Array.isArray(json.added_torrent_ids) && json.added_torrent_ids.length > 0) {
        torrentHash = json.added_torrent_ids[0];
      } else if (json.failure_count > 0 && json.success_count === 0) {
        throw new Error(`qBittorrent add torrent failed: ${text}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("qBittorrent add torrent failed")) {
        throw e;
      }
      // Older versions return string "Ok." or similar
      if (text.trim() !== "Ok." && text.trim() !== "") {
        throw new Error(`qBittorrent add torrent rejected: ${text}`);
      }
    }

    if (torrentHash) {
      return torrentHash;
    }

    // Fallback for older versions: retrieve hash by listing recently added torrents
    await new Promise((resolve) => setTimeout(resolve, 500));

    const listResponse = await this.request(
      "/api/v2/torrents/info?sort=added_on&reverse=true&limit=5",
    );
    if (!listResponse.ok) {
      throw new Error(`Failed to list torrents after add: HTTP ${listResponse.status}`);
    }

    const torrents = (await listResponse.json()) as QBitTorrentInfo[];

    if (torrents.length === 0) {
      throw new Error("No torrents found after adding — cannot determine hash");
    }

    // Return the most recently added torrent's hash
    return torrents[0].hash;
  }

  async getAllTorrents(): Promise<QBitTorrentInfo[]> {
    const response = await this.request("/api/v2/torrents/info");
    if (!response.ok) {
      this.log.warn(`getAllTorrents failed: HTTP ${response.status}`);
      return [];
    }

    return (await response.json()) as QBitTorrentInfo[];
  }

  async getTorrentInfo(hash: string): Promise<QBitTorrentInfo | null> {
    const response = await this.request(`/api/v2/torrents/info?hashes=${hash}`);
    if (!response.ok) {
      this.log.warn({ hash }, `getTorrentInfo failed: HTTP ${response.status}`);
      return null;
    }

    const list = (await response.json()) as QBitTorrentInfo[];
    return list[0] ?? null;
  }

  async getTorrentFiles(hash: string): Promise<QBitFileInfo[]> {
    const response = await this.request(`/api/v2/torrents/files?hash=${hash}`);
    if (!response.ok) {
      this.log.warn({ hash }, `getTorrentFiles failed: HTTP ${response.status}`);
      return [];
    }

    return (await response.json()) as QBitFileInfo[];
  }

  async setFilePriority(hash: string, fileIndex: number, priority: number): Promise<void> {
    const form = new URLSearchParams({
      hash,
      id: String(fileIndex),
      priority: String(priority),
    });

    const response = await this.request("/api/v2/torrents/filePrio", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    if (!response.ok) {
      throw new Error(`setFilePriority failed: HTTP ${response.status}`);
    }
  }

  async pauseTorrent(hash: string): Promise<void> {
    const form = new URLSearchParams({ hashes: hash });
    const response = await this.request("/api/v2/torrents/pause", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    if (!response.ok) {
      throw new Error(`pauseTorrent failed: HTTP ${response.status}`);
    }
  }

  async deleteTorrent(hash: string, deleteFiles: boolean): Promise<void> {
    const form = new URLSearchParams({
      hashes: hash,
      deleteFiles: deleteFiles ? "true" : "false",
    });

    const response = await this.request("/api/v2/torrents/delete", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    if (!response.ok) {
      throw new Error(`deleteTorrent failed: HTTP ${response.status}`);
    }
  }
}

export const qbit = new QBittorrentClient();
