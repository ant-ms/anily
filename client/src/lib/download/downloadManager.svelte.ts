import { AnilyNative, isNative } from "../native/anilyNative";
import { Capacitor } from "@capacitor/core";
import { apiBaseUrl } from "../context.svelte";
import { snackbar } from "../snackbar.svelte";
import {
  STORAGE_KEYS,
  buildEpisodeCacheKey,
  buildDetailsCacheKey,
  buildGroupingCacheKey,
} from "../storageKeys";
import type { EpisodeSkipTimes } from "../../types/SkipTimes";
import type { SubtitleTrackInfo } from "../player/videoPlayer.svelte";

export interface OfflineSubtitleTrack {
  label: string;
  language?: string;
  filename: string;
  default?: boolean;
}

export function ensureWebVTT(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("WEBVTT")) return trimmed;
  // Convert SRT timestamps (00:00:01,000) to WebVTT (00:00:01.000)
  const converted = trimmed.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    "$1.$2",
  );
  return `WEBVTT\n\n${converted}`;
}

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
  skipTimes?: EpisodeSkipTimes;
  subtitles?: OfflineSubtitleTrack[];
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

  private reportDownloadError(options: {
    action: string;
    message: string;
    params?: Record<string, unknown>;
  }) {
    if (!apiBaseUrl.current) return;
    try {
      fetch(new URL("/api/errors/report", apiBaseUrl.current).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category: "DOWNLOAD",
          action: options.action,
          message: options.message,
          params: options.params,
        }),
      }).catch(() => {});
    } catch {}
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
      snackbar.success("Download started in browser (view Error Dashboard if it fails)");
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

      // Pre-fetch skip times in the background for offline skipping
      if (apiBaseUrl.current) {
        fetch(new URL(`/api/stream/skip-times/${episodeId}`, apiBaseUrl.current).toString(), {
          credentials: "include",
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.found && this.states[episodeId]) {
              this.states[episodeId].skipTimes = data;
              this.persist();
            }
          })
          .catch(() => {});
      }

      // Pre-fetch and save subtitles for offline playback
      if (apiBaseUrl.current && isNative) {
        const subApiUrl = new URL(
          `/api/stream/subtitles/${episodeId}?language=${lang}`,
          apiBaseUrl.current,
        );
        if (service?.providerId && service?.identifier) {
          subApiUrl.searchParams.set("providerId", service.providerId);
          subApiUrl.searchParams.set("identifier", service.identifier);
          if (service.serverId) {
            subApiUrl.searchParams.set("server", service.serverId);
          }
        }
        if (token) {
          subApiUrl.searchParams.set("token", token);
        }

        fetch(subApiUrl.toString(), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        })
          .then((r) => (r.ok ? r.json() : null))
          .then(async (data) => {
            if (data?.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
              const savedTracks: OfflineSubtitleTrack[] = [];
              for (let i = 0; i < data.subtitles.length; i++) {
                const sub = data.subtitles[i];
                if (!sub.url) continue;
                try {
                  const subRes = await fetch(sub.url);
                  if (subRes.ok) {
                    const rawText = await subRes.text();
                    const vttContent = ensureWebVTT(rawText);
                    const subFilename = (sub.default || i === 0)
                      ? `anily_ep_${episodeId}_num_${episodeNumber}.vtt`
                      : `anily_ep_${episodeId}_num_${episodeNumber}_${sub.language || i}.vtt`;

                    await AnilyNative.saveSubtitleFile({
                      filename: subFilename,
                      content: vttContent,
                    });

                    savedTracks.push({
                      label: sub.label || "English",
                      language: sub.language || "en",
                      filename: subFilename,
                      default: Boolean(sub.default || i === 0),
                    });
                  }
                } catch (subErr) {
                  console.warn("Failed to download subtitle track:", sub.label, subErr);
                }
              }
              if (savedTracks.length > 0 && this.states[episodeId]) {
                this.states[episodeId].subtitles = savedTracks;
                this.persist();
              }
            }
          })
          .catch((err) => {
            console.warn("Failed to fetch subtitles for download:", err);
          });
      }

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
      this.reportDownloadError({
        action: `Start Download: ${animeName} - Ep ${episodeNumber}`,
        message: err instanceof Error ? err.message : String(err),
        params: { episodeId, episodeNumber, animeTitle: animeName, filename },
      });
      snackbar.error("Failed to start download (check Error Dashboard)");
    }
  }

  public async getOfflineSubtitles(
    episodeId: number,
    episodeNumber?: number,
  ): Promise<SubtitleTrackInfo[]> {
    if (!isNative) return [];

    const tracks: SubtitleTrackInfo[] = [];
    const state = this.states[episodeId];

    // 1. Check stored subtitle tracks from state
    if (state?.subtitles && state.subtitles.length > 0) {
      for (const sub of state.subtitles) {
        try {
          const res = await AnilyNative.getLocalEpisodePath({ filename: sub.filename });
          if (res.exists && res.path) {
            tracks.push({
              label: sub.label,
              language: sub.language,
              url: Capacitor.convertFileSrc(res.path),
              default: sub.default,
            });
          }
        } catch {}
      }
    }

    // 2. Fallback check for default anily_ep_${episodeId}_num_${episodeNumber ?? 0}.vtt
    if (tracks.length === 0) {
      const defaultFilename = `anily_ep_${episodeId}_num_${episodeNumber ?? 0}.vtt`;
      try {
        const res = await AnilyNative.getLocalEpisodePath({ filename: defaultFilename });
        if (res.exists && res.path) {
          tracks.push({
            label: "English",
            language: "en",
            url: Capacitor.convertFileSrc(res.path),
            default: true,
          });
        }
      } catch {}
    }

    // 3. Fallback: if no local subtitle file exists but online and backend configured, attempt on-demand fetch
    if (tracks.length === 0 && apiBaseUrl.current && typeof navigator !== "undefined" && navigator.onLine) {
      try {
        const subApiUrl = new URL(`/api/stream/subtitles/${episodeId}`, apiBaseUrl.current);
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (token) subApiUrl.searchParams.set("token", token);

        const r = await fetch(subApiUrl.toString(), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });
        if (r.ok) {
          const data = await r.json();
          if (data?.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
            const best = data.subtitles.find((s: any) => s.default) || data.subtitles[0];
            if (best?.url) {
              const subRes = await fetch(best.url);
              if (subRes.ok) {
                const text = await subRes.text();
                const defaultFilename = `anily_ep_${episodeId}_num_${episodeNumber ?? 0}.vtt`;
                const saveRes = await AnilyNative.saveSubtitleFile({
                  filename: defaultFilename,
                  content: ensureWebVTT(text),
                });
                if (saveRes.path) {
                  tracks.push({
                    label: best.label || "English",
                    language: best.language || "en",
                    url: Capacitor.convertFileSrc(saveRes.path),
                    default: true,
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("Failed to fetch on-demand subtitle for offline playback:", err);
      }
    }

    return tracks;
  }

  public async playOffline(episodeId: number, episodeNumber?: number) {
    const filename = this.getFilename(episodeId, episodeNumber);

    if (!isNative) {
      snackbar.info("Offline playback is only supported in the Android app");
      return;
    }

    try {
      const subFilename = `anily_ep_${episodeId}_num_${episodeNumber ?? 0}.vtt`;
      let subUri: string | undefined;
      try {
        const subRes = await AnilyNative.getLocalEpisodePath({ filename: subFilename });
        if (subRes.exists && subRes.path) {
          subUri = Capacitor.convertFileSrc(subRes.path);
        }
      } catch {}

      await AnilyNative.openExternalPlayer({
        filename,
        isLocalFile: true,
        mimeType: "video/mp4",
        subtitleUrl: subUri,
        subtitleTitle: "English",
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
        // Clean up any extra subtitle files if tracked
        if (this.states[episodeId]?.subtitles) {
          for (const sub of this.states[episodeId].subtitles!) {
            if (sub.filename !== filename) {
              await AnilyNative.deleteDownloadedEpisode({ filename: sub.filename }).catch(() => {});
            }
          }
        }
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
              if (!state.skipTimes && apiBaseUrl.current) {
                fetch(new URL(`/api/stream/skip-times/${state.episodeId}`, apiBaseUrl.current).toString(), {
                  credentials: "include",
                })
                  .then((r) => (r.ok ? r.json() : null))
                  .then((data) => {
                    if (data?.found && this.states[epId]) {
                      this.states[epId].skipTimes = data;
                      this.persist();
                    }
                  })
                  .catch(() => {});
              }
              snackbar.success(`Episode download completed!`);
            } else {
              state.status = "failed";
              this.reportDownloadError({
                action: `Download Zero Bytes: ${state.animeTitle || "Episode"} - Ep ${state.episodeNumber}`,
                message: "Download completed but received 0 bytes (upstream stream failed or returned error)",
                params: {
                  episodeId: state.episodeId,
                  episodeNumber: state.episodeNumber,
                  animeTitle: state.animeTitle,
                  downloadId: state.downloadId,
                  filename: state.filename,
                },
              });
              snackbar.error("Episode download failed: received 0 bytes (check Error Dashboard)");
            }
          } else if (status.status === "FAILED") {
            state.status = "failed";
            const failureReason = String(status.reason || "Episode download failed");
            this.reportDownloadError({
              action: `Download Failed: ${state.animeTitle || "Episode"} - Ep ${state.episodeNumber}`,
              message: failureReason,
              params: {
                episodeId: state.episodeId,
                episodeNumber: state.episodeNumber,
                animeTitle: state.animeTitle,
                downloadId: state.downloadId,
                filename: state.filename,
              },
            });
            snackbar.error(`${failureReason} (check Error Dashboard)`);
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
