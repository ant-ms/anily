import { apiBaseUrl, sidebarDataRefreshSeed } from "./context.svelte";
import { networkState } from "./network.svelte";
import { clearAuthSession } from "./auth";
import { STORAGE_KEYS } from "./storageKeys";
import { snackbar } from "./snackbar.svelte";
import type ProfileData from "../types/ProfileData";
import { isNative } from "./native/anilyNative";
import { App } from "@capacitor/app";

export interface PingOptions {
  onProfileUpdate?: (profile: ProfileData) => void;
  force?: boolean;
}

class ServerPingManager {
  private lastPingTime = 0;
  private isPinging = false;
  private isInitialized = false;

  private lastSyncJobId: number | undefined;
  private lastSyncJobFinishedAt: string | undefined;
  private lastSyncJobStatus: string | undefined;
  private lastDataUpdate: string | undefined;

  private timer: ReturnType<typeof setInterval> | undefined;
  private onProfileUpdateCb?: (profile: ProfileData) => void;

  // Ping interval: 2.5 minutes (150 seconds)
  public readonly PING_INTERVAL_MS = 2.5 * 60 * 1000;
  // Minimum time between background pings: 20 seconds
  public readonly MIN_PING_INTERVAL_MS = 20 * 1000;

  public init(onProfileUpdate?: (profile: ProfileData) => void) {
    this.onProfileUpdateCb = onProfileUpdate;

    if (typeof window === "undefined") return;

    // Start periodic interval
    this.startInterval();

    // Trigger on visibility change (switching back to tab or unlocking screen)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.ping({ force: false });
      }
    });

    // Trigger on network reconnect
    window.addEventListener("online", () => {
      this.ping({ force: true });
    });

    // Trigger on native mobile app resume
    if (isNative) {
      App.addListener("resume", () => {
        this.ping({ force: false });
      }).catch(() => {});
    }

    // Run initial ping
    this.ping({ force: true });
  }

  public startInterval() {
    this.stopInterval();
    this.timer = setInterval(() => {
      this.ping({ force: false });
    }, this.PING_INTERVAL_MS);
  }

  public stopInterval() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  public async ping(options: { force?: boolean } = {}): Promise<void> {
    if (this.isPinging) return;
    if (!networkState.isOnline || !apiBaseUrl.current) return;

    // Only ping if user is signed in
    const hasSession =
      typeof localStorage !== "undefined" &&
      (Boolean(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)) ||
        Boolean(localStorage.getItem(STORAGE_KEYS.PROFILE_DATA)));

    if (!hasSession) return;

    const now = Date.now();
    if (!options.force && now - this.lastPingTime < this.MIN_PING_INTERVAL_MS) {
      return;
    }

    this.isPinging = true;

    try {
      const pingUrl = new URL("/api/ping", apiBaseUrl.current).toString();
      let res = await fetch(pingUrl, { credentials: "include" });

      // Fallback to /api/me if /api/ping is not found (e.g. on older servers)
      if (res.status === 404) {
        const meUrl = new URL("/api/me", apiBaseUrl.current).toString();
        res = await fetch(meUrl, { credentials: "include" });
      }

      this.lastPingTime = Date.now();

      if (res.status === 401 || res.type === "opaqueredirect" || (res.redirected && !res.url.includes("/api/"))) {
        console.warn("[ServerPing] Session expired (401 Unauthorized)");
        await clearAuthSession();
        return;
      }

      if (!res.ok) {
        return;
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return;
      }

      const data = await res.json();

      // 1. Process profile updates
      const userInfo = data.user || data;
      const displayName =
        userInfo?.name ||
        userInfo?.preferred_username ||
        userInfo?.email ||
        userInfo?.sub;

      if (displayName) {
        const profile: ProfileData = {
          name: typeof displayName === "string" ? displayName.split(" ")[0] : "User",
          pictureUrl: userInfo.picture || "",
        };
        if (this.onProfileUpdateCb) {
          this.onProfileUpdateCb(profile);
        }
      }

      // 2. Check for server data updates
      const latestJob = data.latestSyncJob;
      const currentJobId = latestJob?.id;
      const currentJobFinishedAt = latestJob?.finishedAt;
      const currentJobStatus = latestJob?.status;
      const currentDataUpdate = data.lastUpdated;

      if (this.isInitialized) {
        let hasUpdate = false;
        let updateMessage = "";

        // Check if a new sync job completed or status changed
        if (
          currentJobId !== undefined &&
          (currentJobId !== this.lastSyncJobId || currentJobFinishedAt !== this.lastSyncJobFinishedAt)
        ) {
          if (currentJobStatus === "SUCCESS") {
            hasUpdate = true;
            if (latestJob?.type === "EPISODE_METADATA") {
              updateMessage = "Episode metadata updated";
            } else {
              updateMessage = "Library updated with latest AniList sync";
            }
          }
        } else if (
          this.lastSyncJobStatus === "RUNNING" &&
          currentJobStatus === "SUCCESS"
        ) {
          hasUpdate = true;
          updateMessage = "Background sync completed";
        }

        // Check if database aggregate timestamp advanced
        if (
          currentDataUpdate &&
          this.lastDataUpdate &&
          currentDataUpdate !== this.lastDataUpdate
        ) {
          hasUpdate = true;
        }

        if (hasUpdate) {
          sidebarDataRefreshSeed.set((sidebarDataRefreshSeed.current ?? 0) + 1);
          if (updateMessage) {
            snackbar.info(updateMessage);
          }
        }
      }

      this.lastSyncJobId = currentJobId;
      this.lastSyncJobFinishedAt = currentJobFinishedAt;
      this.lastSyncJobStatus = currentJobStatus;
      this.lastDataUpdate = currentDataUpdate;
      this.isInitialized = true;
    } catch (err) {
      console.warn("[ServerPing] Failed to ping server:", err);
    } finally {
      this.isPinging = false;
    }
  }

  public destroy() {
    this.stopInterval();
    this.isInitialized = false;
  }
}

export const serverPing = new ServerPingManager();
