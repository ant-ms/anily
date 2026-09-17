import { AnilyNative, isNative } from "../native/anilyNative";
import { apiBaseUrl } from "../context.svelte";
import { snackbar } from "../snackbar.svelte";

export interface DownloadState {
  episodeId: number;
  anilistId?: number;
  filename: string;
  downloadId?: string;
  status: "idle" | "downloading" | "completed" | "failed";
  progress: number; // 0 to 100
  totalBytes: number;
  bytesDownloaded: number;
}

const ACTIVE_DOWNLOADS_KEY = "anily:active_downloads";
const DOWNLOADED_ANIME_IDS_KEY = "anily:downloaded_anime_ids";

class DownloadManager {
  public states: Record<number, DownloadState> = $state({});
  public downloadedAnilistIds: number[] = $state([]);
  private pollInterval: any = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.loadPersistedDownloads();
    }
  }

  private getFilename(episodeId: number, episodeNumber?: number): string {
    return `anily_ep_${episodeId}_num_${episodeNumber ?? 0}.mp4`;
  }

  private loadPersistedDownloads() {
    try {
      const raw = localStorage.getItem(ACTIVE_DOWNLOADS_KEY);
      if (raw) {
        this.states = JSON.parse(raw);
      }
    } catch {}

    try {
      const rawIds = localStorage.getItem(DOWNLOADED_ANIME_IDS_KEY);
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
      localStorage.setItem(ACTIVE_DOWNLOADS_KEY, JSON.stringify(this.states));
    } catch {}
    try {
      localStorage.setItem(
        DOWNLOADED_ANIME_IDS_KEY,
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
  ): Promise<boolean> {
    const filename = this.getFilename(episodeId, episodeNumber);

    if (isNative) {
      try {
        const check = await AnilyNative.checkDownloadedEpisode({ filename });
        if (check.exists) {
          this.states[episodeId] = {
            episodeId,
            anilistId: anilistId ?? this.states[episodeId]?.anilistId,
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

    const token = localStorage.getItem("authToken");
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
            `anily:cache:grouping:${anilistId}`,
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
              `anily:cache:grouping:${id}`,
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
                `anily:cache:details:${id}`,
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
                `anily:cache:episodes:${id}`,
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

    const token = localStorage.getItem("authToken");
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
            state.status = "completed";
            state.progress = 100;
            state.bytesDownloaded = status.bytesDownloaded;
            state.totalBytes = status.totalBytes;
            if (state.anilistId) {
              this.addDownloadedAnimeId(state.anilistId);
            }
            snackbar.success(`Episode download completed!`);
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
