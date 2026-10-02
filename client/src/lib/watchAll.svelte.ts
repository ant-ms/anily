import { api } from "./api";
import { selectedAnimeAnilistId, sidebarDataRefreshSeed } from "./context.svelte";
import { syncQueue } from "./sync/syncQueue.svelte";
import type EpisodeData from "../types/Episode";

const isFuture = (airingAt: string | null): boolean => {
    if (!airingAt) return true;
    return new Date(airingAt).getTime() > Date.now();
};

class WatchAllManager {
    private _episodes: EpisodeData[] = $state([]);
    private _isUpdating = $state(false);

    public setEpisodes(episodes: EpisodeData[]) {
        this._episodes = episodes;
    }

    public get releasedEpisodes(): EpisodeData[] {
        return this._episodes.filter((e) => !isFuture(e.airingAt));
    }

    public get allReleasedWatched(): boolean {
        const released = this.releasedEpisodes;
        return released.length > 0 && released.every((e) => e.watched);
    }

    public get canToggle(): boolean {
        return this.releasedEpisodes.length > 0 && !this._isUpdating;
    }

    public get isUpdating(): boolean {
        return this._isUpdating;
    }

    public async toggleAll(): Promise<void> {
        const anilistId = selectedAnimeAnilistId.current;
        if (anilistId === undefined || this._isUpdating || this.releasedEpisodes.length === 0) {
            return;
        }

        const newStatus = !this.allReleasedWatched;
        this._isUpdating = true;

        for (const episode of this._episodes) {
            if (!isFuture(episode.airingAt)) {
                episode.watched = newStatus;
            }
        }

        try {
            await api.setAllEpisodesWatch(anilistId, newStatus);
            sidebarDataRefreshSeed.set((sidebarDataRefreshSeed.current ?? 0) + 1);
        } catch {
            for (const episode of this._episodes) {
                if (!isFuture(episode.airingAt)) {
                    await syncQueue.recordWatchStatus(episode.id, newStatus);
                }
            }
        } finally {
            this._isUpdating = false;
        }
    }
}

export const watchAllManager = new WatchAllManager();
