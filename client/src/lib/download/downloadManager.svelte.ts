import { AnilyNative, isNative } from "../native/anilyNative";
import { apiBaseUrl } from "../context.svelte";
import { snackbar } from "../snackbar.svelte";
import {
  STORAGE_KEYS,
  buildEpisodeCacheKey,
  buildDetailsCacheKey,
  buildGroupingCacheKey,
} from "../storageKeys";

export interface DownloadState {
  episodeId: number;
  episodeNumber?: number;
  animeTitle?: string;
  thumbnailUrl?: string;
  anilistId?: number;
  filename: string;
  downloadId?: string;
  status: "idle" | "downloading" | "completed" | "failed";
  progress: number; // 0 to 100
  totalBytes: number;
  bytesDownloaded: number;
}

class DownloadManager {
  public states: Record<number, DownloadState> = $state({});
  public downloadedAnilistIds: number[] = $state([]);
  private pollInterval: any = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.loadPersistedDownloads();

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && isNative) {
          this.checkAllActiveDownloads();
        }
      });

      window.addEventListener("focus", () => {
        if (isNative) {
          this.checkAllActiveDownloads();
        }
      });
    }
  }

  private getFilename(episodeId: number, episodeNumber?: number): string {
    return `anily_ep_${episodeId}_num_${episodeNumber ?? 0}.mp4`;
  }

  private loadPersistedDownloads() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_DOWNLOADS);
      if (raw) {
        this.states = JSON.parse(raw);
      }
    } catch {}

    try {
      const rawIds = localStorage.getItem(STORAGE_KEYS.DOWNLOADED_ANIME_IDS);
      if (rawIds) {
        this.downloadedAnilistIds = JSON.parse(rawIds);
      }
    } catch {}

    if (isNative) {
      this.checkAllActiveDownloads();
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_DOWNLOADS, JSON.stringify(this.states));
    } catch {}
    try {
      localStorage.setItem(
        STORAGE_KEYS.DOWNLOADED_ANIME_IDS,
        JSON.stringify(this.downloadedAnilistIds),
      );
    } catch {}
  }

  public addDownloadedAnimeId(anilistId: number) {
    if (!this.downloadedAnilistIds.includes(anilistId)) {
      this.downloadedAnilistIds = [...this.downloadedAnilistIds, anilistId];
      this.persist();
    }
  }

  public hasDownloads(allAnilistIds: number[]): boolean {
    if (!allAnilistIds || allAnilistIds.length === 0) return false;
    return allAnilistIds.some((id) => this.downloadedAnilistIds.includes(id));
  }

  public async checkEpisode(
    episodeId: number,
    episodeNumber?: number,
    anilistId?: number,
    animeName?: string,
    thumbnailUrl?: string,
  ): Promise<boolean> {
    const filename = this.getFilename(episodeId, episodeNumber);

    if (isNative) {
      try {
        const check = await AnilyNative.checkDownloadedEpisode({ filename });
        if (check.exists && check.size > 0) {
          const prev = this.states[episodeId];
          this.states[episodeId] = {
            episodeId,
            episodeNumber: episodeNumber ?? prev?.episodeNumber,
            animeTitle: animeName ?? prev?.animeTitle,
            thumbnailUrl: thumbnailUrl ?? prev?.thumbnailUrl,
            anilistId: anilistId ?? prev?.anilistId,
            filename,
            status: "completed",
            progress: 100,
            totalBytes: check.size,
            bytesDownloaded: check.size,
          };
          if (anilistId) {
            this.addDownloadedAnimeId(anilistId);
          }
          this.persist();
          return true;
        } else if (this.states[episodeId]?.status === "completed") {
          delete this.states[episodeId];
          this.persist();
        }
      } catch (err) {
        console.error("Failed to check episode file:", err);
      }
    }

    return false;
  }

  public async precacheGroupMetadata(anilistId?: number) {
    if (!anilistId || !apiBaseUrl.current) return;

    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const groupUrl = new URL(
        `/api/grouping?baseAnilistId=${anilistId}`,
        apiBaseUrl.current,
      );
      const groupRes = await fetch(groupUrl.toString(), {
        headers,
        credentials: "include",
      });

      if (groupRes.ok) {
        const groupData = await groupRes.json();
        try {
          localStorage.setItem(
            buildGroupingCacheKey(anilistId),
            JSON.stringify(groupData),
          );
        } catch {}

        const animeIds = new Set<number>([anilistId]);
        const extractNodeIds = (node: any) => {
          if (node?.anilistId) animeIds.add(node.anilistId);
          if (Array.isArray(node?.children)) {
            node.children.forEach(extractNodeIds);
          }
        };

        if (Array.isArray(groupData?.chains)) {
          groupData.chains.forEach(extractNodeIds);
        }
        if (Array.isArray(groupData?.notInChain)) {
          groupData.notInChain.forEach((item: any) => {
            if (item?.anilistId) animeIds.add(item.anilistId);
          });
        }

        for (const id of animeIds) {
          try {
            localStorage.setItem(
              buildGroupingCacheKey(id),
              JSON.stringify(groupData),
            );
          } catch {}
          this.addDownloadedAnimeId(id);

          try {
            const dUrl = new URL(`/api/details/${id}`, apiBaseUrl.current);
            const dRes = await fetch(dUrl.toString(), {
              headers,
              credentials: "include",
            });
            if (dRes.ok) {
              const dData = await dRes.json();
              localStorage.setItem(
                buildDetailsCacheKey(id),
                JSON.stringify(dData),
              );
            }
          } catch {}

          try {
            const eUrl = new URL(`/api/episodes/${id}`, apiBaseUrl.current);
            const eRes = await fetch(eUrl.toString(), {
              headers,
              credentials: "include",
            });
            if (eRes.ok) {
              const eData = await eRes.json();
              localStorage.setItem(
                buildEpisodeCacheKey(id),
                JSON.stringify(eData),
              );
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn("Failed to pre-cache group metadata:", err);
    }
  }

  public async startDownload(
    episodeId: number,
    episodeNumber: number,
    animeName: string,
    lang: "sub" | "dub" = "sub",
    anilistId?: number,
    service?: { providerId: string; identifier: string; serverId?: string },
    thumbnailUrl?: string,
  ) {
    if (!apiBaseUrl.current) {
      snackbar.error("Backend URL not configured");
      return;
    }

    const filename = this.getFilename(episodeId, episodeNumber);
    const downloadUrlObj = new URL(
      `/api/stream/download/${episodeId}?language=${lang}`,
      apiBaseUrl.current,
    );

    if (service?.providerId && service?.identifier) {
      downloadUrlObj.searchParams.set("providerId", service.providerId);
      downloadUrlObj.searchParams.set("identifier", service.identifier);
      if (service.serverId) {
        downloadUrlObj.searchParams.set("server", service.serverId);
      }
    }

    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      downloadUrlObj.searchParams.set("token", token);
    }
    const downloadUrl = downloadUrlObj.toString();

    if (!isNative) {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      snackbar.success("Download started in browser");
      return;
    }

    try {
      this.states[episodeId] = {
        episodeId,
        episodeNumber,
        animeTitle: animeName,
        thumbnailUrl,
        anilistId,
        filename,
        status: "downloading",
        progress: 0,
        totalBytes: 0,
        bytesDownloaded: 0,
      };
      this.persist();

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        headers["Cookie"] = `oidc-auth=${token}`;
      }

      const result = await AnilyNative.downloadEpisode({
        url: downloadUrl,
        filename,
        title: `Episode ${episodeNumber}`,
        animeTitle: animeName,
        headers,
      });

      this.states[episodeId].downloadId = result.downloadId;
      this.persist();

      snackbar.success(`Downloading Episode ${episodeNumber}...`);
      this.startPolling();

      // Pre-cache metadata for the entire anime group
      if (anilistId) {
        this.precacheGroupMetadata(anilistId);
      }
    } catch (err) {
      console.error("Download failed to start:", err);
      this.states[episodeId] = {
        episodeId,
        episodeNumber,
        animeTitle: animeName,
        thumbnailUrl,
        anilistId,
        filename,
        status: "failed",
        progress: 0,
        totalBytes: 0,
        bytesDownloaded: 0,
      };
      this.persist();
      snackbar.error("Failed to start download");
    }
  }

  public async playOffline(episodeId: number, episodeNumber?: number) {
    const filename = this.getFilename(episodeId, episodeNumber);

    if (!isNative) {
      snackbar.info("Offline playback is only supported in the Android app");
      return;
    }

    try {
      await AnilyNative.openExternalPlayer({
        filename,
        isLocalFile: true,
        mimeType: "video/mp4",
      });
    } catch (err) {
      console.error("Failed to launch offline player:", err);
      snackbar.error("Failed to open video player");
    }
  }

  public async cancelDownload(episodeId: number) {
    const state = this.states[episodeId];
    if (!state) return;

    if (isNative) {
      try {
        await AnilyNative.cancelDownload({
          downloadId: state.downloadId,
          filename: state.filename,
        });
      } catch (err) {
        console.error("Failed to cancel native download:", err);
      }
    }

    delete this.states[episodeId];
    this.persist();

    const hasActive = Object.values(this.states).some(
      (s) => s.status === "downloading",
    );
    if (!hasActive) {
      this.stopPolling();
    }

    snackbar.info("Download cancelled");
  }

  public async deleteDownload(
    episodeId: number,
    episodeNumber?: number,
    anilistId?: number,
  ) {
    const filename = this.getFilename(episodeId, episodeNumber);

    if (isNative) {
      try {
        await AnilyNative.deleteDownloadedEpisode({ filename });
      } catch (err) {
        console.error("Failed to delete episode file:", err);
      }
    }

    const currentAnilistId = anilistId ?? this.states[episodeId]?.anilistId;
    delete this.states[episodeId];

    if (currentAnilistId) {
      const hasOther = Object.values(this.states).some(
        (s) => s.status === "completed" && s.anilistId === currentAnilistId,
      );
      if (!hasOther) {
        this.downloadedAnilistIds = this.downloadedAnilistIds.filter(
          (id) => id !== currentAnilistId,
        );
      }
    }

    this.persist();
    snackbar.success("Deleted downloaded episode");
  }

  public async deleteAnimeDownloads(anilistId?: number, animeTitle?: string) {
    const toDelete = Object.values(this.states).filter((s) => {
      if (anilistId !== undefined && s.anilistId === anilistId) return true;
      if (animeTitle && s.animeTitle === animeTitle) return true;
      return false;
    });

    for (const item of toDelete) {
      if (isNative) {
        try {
          await AnilyNative.deleteDownloadedEpisode({ filename: item.filename });
        } catch (err) {
          console.error("Failed to delete file:", item.filename, err);
        }
      }
      delete this.states[item.episodeId];
    }

    if (anilistId !== undefined) {
      this.downloadedAnilistIds = this.downloadedAnilistIds.filter(
        (id) => id !== anilistId,
      );
    }
    this.persist();
    snackbar.success("Deleted all downloads for this anime");
  }

  public async deleteAllDownloads() {
    for (const item of Object.values(this.states)) {
      if (isNative) {
        try {
          await AnilyNative.deleteDownloadedEpisode({ filename: item.filename });
        } catch (err) {
          console.error("Failed to delete file:", item.filename, err);
        }
      }
    }
    this.states = {};
    this.downloadedAnilistIds = [];
    this.persist();
    snackbar.success("Deleted all downloaded episodes");
  }

  public async syncNativeStorage(): Promise<{
    freeSpace: number;
    totalSpace: number;
    usedByApp: number;
  }> {
    if (!isNative) {
      const usedByApp = Object.values(this.states)
        .filter((s) => s.status === "completed")
        .reduce((sum, s) => sum + (s.bytesDownloaded || s.totalBytes || 0), 0);
      return { freeSpace: 0, totalSpace: 0, usedByApp };
    }

    try {
      const info = await AnilyNative.getStorageInfo();
      if (Array.isArray(info.files)) {
        const fileMap = new Map(info.files.map((f) => [f.filename, f.size]));

        for (const epIdStr of Object.keys(this.states)) {
          const epId = Number(epIdStr);
          const state = this.states[epId];
          if (state.status === "completed") {
            const actualSize = fileMap.get(state.filename);
            if (!actualSize || actualSize === 0) {
              delete this.states[epId];
            } else {
              state.bytesDownloaded = actualSize;
              state.totalBytes = actualSize;
            }
          }
        }
        this.persist();
      }

      return {
        freeSpace: info.freeSpace,
        totalSpace: info.totalSpace,
        usedByApp: info.usedByApp,
      };
    } catch (err) {
      console.error("Failed to get storage info:", err);
      const usedByApp = Object.values(this.states)
        .filter((s) => s.status === "completed")
        .reduce((sum, s) => sum + (s.bytesDownloaded || s.totalBytes || 0), 0);
      return { freeSpace: 0, totalSpace: 0, usedByApp };
    }
  }

  private startPolling() {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(async () => {
      await this.checkAllActiveDownloads();
    }, 2000);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async checkAllActiveDownloads() {
    let hasActive = false;

    for (const epIdStr of Object.keys(this.states)) {
      const epId = Number(epIdStr);
      const state = this.states[epId];

      if (state.status === "downloading" && state.downloadId) {
        hasActive = true;
        try {
          const status = await AnilyNative.getDownloadStatus({
            downloadId: state.downloadId,
            filename: state.filename,
          });

          if (status.status === "SUCCESSFUL") {
            if (status.bytesDownloaded > 0) {
              state.status = "completed";
              state.progress = 100;
              state.bytesDownloaded = status.bytesDownloaded;
              state.totalBytes = status.totalBytes;
              if (state.anilistId) {
                this.addDownloadedAnimeId(state.anilistId);
              }
              snackbar.success(`Episode download completed!`);
            } else {
              state.status = "failed";
              snackbar.error("Episode download failed: received 0 bytes");
            }
          } else if (status.status === "FAILED") {
            state.status = "failed";
            snackbar.error(String(status.reason || "Episode download failed"));
          } else if (status.status === "RUNNING" || status.status === "PENDING") {
            state.bytesDownloaded = status.bytesDownloaded;
            state.totalBytes = status.totalBytes;
            if (status.totalBytes > 0) {
              state.progress = Math.min(
                99,
                Math.round((status.bytesDownloaded / status.totalBytes) * 100),
              );
            }
          }
          this.persist();
        } catch (err) {
          console.error("Error polling download status:", err);
        }
      }
    }

    if (!hasActive) {
      this.stopPolling();
    }
  }
}

export const downloadManager = new DownloadManager();
