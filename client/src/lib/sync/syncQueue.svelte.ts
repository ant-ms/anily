import { Network } from "@capacitor/network";
import { apiBaseUrl, sidebarDataRefreshSeed } from "../context.svelte";
import { snackbar } from "../snackbar.svelte";
import { STORAGE_KEYS } from "../storageKeys";

export interface PendingWatch {
  episodeId: number;
  watched: boolean;
  timestamp: number;
  retryCount: number;
}

class SyncQueue {
  public isOnline: boolean = $state(true);
  public pendingCount: number = $state(0);
  private isSyncing = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.init();
    }
  }

  private async init() {
    this.updatePendingCount();

    try {
      const status = await Network.getStatus();
      this.isOnline = status.connected;

      Network.addListener("networkStatusChange", (status) => {
        const wasOffline = !this.isOnline;
        this.isOnline = status.connected;
        if (status.connected && wasOffline) {
          this.flush();
        }
      });
    } catch {
      this.isOnline = navigator.onLine;
    }

    window.addEventListener("online", () => {
      this.isOnline = true;
      this.flush();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
    });

    if (this.isOnline) {
      this.flush();
    }
  }

  private getQueue(): PendingWatch[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PENDING_WATCH_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private setQueue(queue: PendingWatch[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.PENDING_WATCH_QUEUE, JSON.stringify(queue));
      this.pendingCount = queue.length;
    } catch (e) {
      console.error("Failed to save sync queue:", e);
    }
  }

  private updatePendingCount() {
    this.pendingCount = this.getQueue().length;
  }

  public async recordWatchStatus(
    episodeId: number,
    watched: boolean,
  ): Promise<boolean> {
    if (this.isOnline && apiBaseUrl.current) {
      try {
        const url = new URL(
          `/api/episodes/${episodeId}/watch`,
          apiBaseUrl.current,
        );
        const res = await fetch(url.toString(), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ watched }),
          credentials: "include",
        });

        if (res.ok) {
          sidebarDataRefreshSeed.set((sidebarDataRefreshSeed.current ?? 0) + 1);
          return true;
        }
      } catch {
        // Network failed, fall through to queue
      }
    }

    // Queue for later sync
    const queue = this.getQueue();
    // Replace any existing mutation for this episode or append
    const existingIndex = queue.findIndex((q) => q.episodeId === episodeId);
    if (existingIndex >= 0) {
      queue[existingIndex] = {
        episodeId,
        watched,
        timestamp: Date.now(),
        retryCount: 0,
      };
    } else {
      queue.push({
        episodeId,
        watched,
        timestamp: Date.now(),
        retryCount: 0,
      });
    }

    this.setQueue(queue);
    snackbar.info("Saved offline. Will sync watch status when reconnected.");
    return false;
  }

  public async flush(): Promise<void> {
    if (this.isSyncing || !apiBaseUrl.current || !this.isOnline) return;

    const queue = this.getQueue();
    if (queue.length === 0) return;

    this.isSyncing = true;
    const remaining: PendingWatch[] = [];
    let syncedCount = 0;

    for (const item of queue) {
      try {
        const url = new URL(
          `/api/episodes/${item.episodeId}/watch`,
          apiBaseUrl.current,
        );
        const res = await fetch(url.toString(), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ watched: item.watched }),
          credentials: "include",
        });

        if (res.ok) {
          syncedCount++;
        } else if (res.status >= 400 && res.status < 500) {
          // Client error, discard
          console.warn(`Watch sync dropped for episode ${item.episodeId}: HTTP ${res.status}`);
        } else {
          item.retryCount++;
          remaining.push(item);
        }
      } catch {
        item.retryCount++;
        remaining.push(item);
      }
    }

    this.setQueue(remaining);
    this.isSyncing = false;

    if (syncedCount > 0) {
      sidebarDataRefreshSeed.set((sidebarDataRefreshSeed.current ?? 0) + 1);
      snackbar.success(
        `Synced watch status for ${syncedCount} episode${syncedCount > 1 ? "s" : ""}`,
      );
    }
  }
}

export const syncQueue = new SyncQueue();
