import {
    apiBaseUrl,
    selectedAnimeAnilistId,
    sidebarDataRefreshSeed,
    selectedAnimeDetails,
} from "./context.svelte";
import { snackbar } from "./snackbar.svelte";
import { buildDetailsCacheKey } from "./storageKeys";
import type AnimeDetailsData from "../types/AnimeDetails";
import { api } from "./api";

class BookmarkManager {
    private _isToggling = $state(false);

    public get isToggling(): boolean {
        return this._isToggling;
    }

    public get isBookmarked(): boolean {
        return (selectedAnimeDetails.current?.groupingId ?? null) !== null;
    }

    public get canToggle(): boolean {
        return (
            !this._isToggling &&
            selectedAnimeAnilistId.current !== undefined &&
            selectedAnimeDetails.current !== undefined &&
            Boolean(apiBaseUrl.current)
        );
    }

    public async toggle(): Promise<void> {
        const details = selectedAnimeDetails.current;
        const anilistId = selectedAnimeAnilistId.current;
        if (!details || this._isToggling || !apiBaseUrl.current || anilistId === undefined) {
            return;
        }

        const removing = details.groupingId !== null;
        this._isToggling = true;

        try {
            if (removing) {
                await api.removeGrouping(anilistId);
            } else {
                await api.addGrouping(anilistId);
            }

            if (selectedAnimeAnilistId.current === anilistId) {
                const updatedDetails: AnimeDetailsData = {
                    ...details,
                    groupingId: removing ? null : (details.groupingId ?? 1),
                };
                selectedAnimeDetails.set(updatedDetails);
                try {
                    localStorage.setItem(
                        buildDetailsCacheKey(anilistId),
                        JSON.stringify(updatedDetails),
                    );
                } catch {}
                sidebarDataRefreshSeed.set(Math.random());
            }
        } catch (err) {
            console.error(
                removing
                    ? "Failed to remove anime from chain:"
                    : "Failed to add anime to chain:",
                err,
            );
            snackbar.error(
                removing
                    ? "Failed to remove anime from chain"
                    : "Failed to add anime to chain",
            );
        } finally {
            if (selectedAnimeAnilistId.current === anilistId) {
                this._isToggling = false;
            }
        }
    }
}

export const bookmarkManager = new BookmarkManager();
