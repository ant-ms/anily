import { registerPlugin, Capacitor } from "@capacitor/core";

export interface AnilyNativePlugin {
  openExternalPlayer(options: {
    url?: string;
    mimeType?: string;
    isLocalFile?: boolean;
    filename?: string;
  }): Promise<{ success: boolean }>;

  downloadEpisode(options: {
    url: string;
    filename: string;
    title?: string;
    animeTitle?: string;
    headers?: Record<string, string>;
  }): Promise<{ downloadId: string; filename: string }>;

  getDownloadStatus(options: {
    downloadId: string;
  }): Promise<{
    status:
      | "PENDING"
      | "RUNNING"
      | "PAUSED"
      | "SUCCESSFUL"
      | "FAILED"
      | "UNKNOWN"
      | "NOT_FOUND";
    bytesDownloaded: number;
    totalBytes: number;
    reason?: number;
  }>;

  cancelDownload(options: {
    downloadId: string;
  }): Promise<{ success: boolean }>;

  checkDownloadedEpisode(options: {
    filename: string;
  }): Promise<{ exists: boolean; size: number }>;

  deleteDownloadedEpisode(options: {
    filename: string;
  }): Promise<{ success: boolean; deleted: boolean }>;
}

export const AnilyNative = registerPlugin<AnilyNativePlugin>("AnilyNative", {
  web: {
    openExternalPlayer: async () => {
      throw new Error("openExternalPlayer is only supported on native Android");
    },
    downloadEpisode: async () => {
      throw new Error("downloadEpisode is only supported on native Android");
    },
    getDownloadStatus: async () => ({
      status: "NOT_FOUND",
      bytesDownloaded: 0,
      totalBytes: 0,
    }),
    cancelDownload: async () => ({ success: false }),
    checkDownloadedEpisode: async () => ({ exists: false, size: 0 }),
    deleteDownloadedEpisode: async () => ({ success: false, deleted: false }),
  },
});

export const isNative = Capacitor.isNativePlatform();
