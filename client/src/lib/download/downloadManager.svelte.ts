import { AnilyNative, isNative } from "../native/anilyNative";
import { apiBaseUrl } from "../context.svelte";
import { snackbar } from "../snackbar.svelte";

export interface DownloadState {
  episodeId: number;
  filename: string;
  downloadId?: string;
  status: "idle" | "downloading" | "completed" | "failed";
  progress: number; // 0 to 100
  totalBytes: number;
  bytesDownloaded: number;
}

const ACTIVE_DOWNLOADS_KEY = "anily:active_downloads";

class DownloadManager {
  public states: Record<number, DownloadState> = $state({});
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

    if (isNative) {
      this.checkAllActiveDownloads();
    }
  }

  private persist() {
    try {
      localStorage.setItem(ACTIVE_DOWNLOADS_KEY, JSON.stringify(this.states));
    } catch {}
  }

  public async checkEpisode(episodeId: number, episodeNumber?: number): Promise<boolean> {
    const filename = this.getFilename(episodeId, episodeNumber);

    if (isNative) {
      try {
        const check = await AnilyNative.checkDownloadedEpisode({ filename });
        if (check.exists) {
          this.states[episodeId] = {
            episodeId,
            filename,
            status: "completed",
            progress: 100,
            totalBytes: check.size,
            bytesDownloaded: check.size,
          };
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

  public async startDownload(
    episodeId: number,
    episodeNumber: number,
    animeName: string,
    lang: "sub" | "dub" = "sub",
  ) {
    if (!apiBaseUrl.current) {
      snackbar.error("Backend URL not configured");
      return;
    }

    const filename = this.getFilename(episodeId, episodeNumber);
    const downloadUrl = new URL(
      `/api/stream/download/${episodeId}?language=${lang}`,
      apiBaseUrl.current,
    ).toString();

    if (!isNative) {
      // Web fallback: trigger browser download
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
        filename,
        status: "downloading",
        progress: 0,
        totalBytes: 0,
        bytesDownloaded: 0,
      };
      this.persist();

      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
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
    } catch (err) {
      console.error("Download failed to start:", err);
      this.states[episodeId] = {
        episodeId,
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

  public async deleteDownload(episodeId: number, episodeNumber?: number) {
    const filename = this.getFilename(episodeId, episodeNumber);

    if (isNative) {
      try {
        await AnilyNative.deleteDownloadedEpisode({ filename });
      } catch (err) {
        console.error("Failed to delete episode file:", err);
      }
    }

    delete this.states[episodeId];
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
          });

          if (status.status === "SUCCESSFUL") {
            state.status = "completed";
            state.progress = 100;
            state.bytesDownloaded = status.bytesDownloaded;
            state.totalBytes = status.totalBytes;
            snackbar.success(`Episode download completed!`);
          } else if (status.status === "FAILED") {
            state.status = "failed";
            snackbar.error("Episode download failed");
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
