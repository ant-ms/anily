import { selectedAnimeAnilistId, apiBaseUrl, sidebarDataRefreshSeed } from '../../lib/context.svelte';
import { snackbar } from '../../lib/snackbar.svelte';
import { downloadManager } from '../../lib/download/downloadManager.svelte';
import { networkState } from '../../lib/network.svelte';
import { STORAGE_KEYS, buildEpisodeCacheKey, buildDetailsCacheKey } from '../../lib/storageKeys';
import { watch } from 'runed';
import type EpisodeData from '../../types/Episode';

const isLoggedIn = (): boolean =>
    Boolean(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || localStorage.getItem(STORAGE_KEYS.PROFILE_DATA));

const bootstrapDownloadStates = (eps: EpisodeData[], anilistId: number): void => {
    let details: any = null;
    try {
        const raw = localStorage.getItem(buildDetailsCacheKey(anilistId));
        if (raw) details = JSON.parse(raw);
    } catch {}
    const title = details?.titleNative || details?.titleEnglish || details?.titleRomanji;
    const thumb = details?.thumbnailUrl;
    eps.forEach((e) => downloadManager.checkEpisode(e.id, e.number, anilistId, title, thumb));
};

const loadFromCache = (anilistId: number): EpisodeData[] => {
    try {
        const raw = localStorage.getItem(buildEpisodeCacheKey(anilistId));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const persistToCache = (anilistId: number, eps: EpisodeData[]): void => {
    try {
        localStorage.setItem(buildEpisodeCacheKey(anilistId), JSON.stringify(eps));
    } catch {}
};

export class EpisodesState {
    episodes: EpisodeData[] = $state([]);
    loading = $state(true);

    constructor(updateSeed: () => number) {
        watch(
            () => [selectedAnimeAnilistId.current, updateSeed(), sidebarDataRefreshSeed.current],
            () => {
                const anilistId = selectedAnimeAnilistId.current;
                if (anilistId === undefined) return;

                this.loading = this.episodes.length === 0;
                this.#refresh(anilistId);
            },
        );
    }

    async #refresh(anilistId: number): Promise<void> {
        const cached = loadFromCache(anilistId);
        if (cached.length > 0) {
            this.episodes = cached;
            bootstrapDownloadStates(cached, anilistId);
            this.loading = false;
        }

        if (!apiBaseUrl.current) return;

        try {
            const url = new URL(`/api/episodes/${anilistId}`, apiBaseUrl.current);
            const res = await fetch(url.toString(), { credentials: 'include' });
            if (!res.ok) return;

            const data = await res.json();
            if (selectedAnimeAnilistId.current !== anilistId) return;

            const fresh: EpisodeData[] = Array.isArray(data) ? data : [];
            this.episodes = fresh;
            bootstrapDownloadStates(fresh, anilistId);
            persistToCache(anilistId, fresh);
        } catch (err) {
            console.warn('Failed to fetch episodes online, using cached episodes if available:', err);
            if (this.episodes.length === 0 && networkState.isOnline && isLoggedIn()) {
                snackbar.error('Failed to load episodes');
            }
        } finally {
            this.loading = false;
        }
    }
}
