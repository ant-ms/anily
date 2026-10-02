import {
    apiBaseUrl,
    selectedAnimeAnilistId,
    selectedAnimeDetails,
} from "./context.svelte";
import { snackbar } from "./snackbar.svelte";
import { buildDetailsCacheKey } from "./storageKeys";
import type { Rating } from "../types/AnimeDetails";
import type AnimeDetailsData from "../types/AnimeDetails";
import { api } from "./api";

class RatingManager {
    private _isUpdating = $state(false);

    public get isUpdating(): boolean {
        return this._isUpdating;
    }

    public get currentRating(): Rating {
        return selectedAnimeDetails.current?.rating ?? "NEUTRAL";
    }

    public async setRating(nextRating: Rating): Promise<void> {
        const details = selectedAnimeDetails.current;
        const anilistId = selectedAnimeAnilistId.current;
        if (!details || this._isUpdating || !apiBaseUrl.current || anilistId === undefined) {
            return;
        }

        const current = details.rating ?? "NEUTRAL";
        if (current === nextRating) return;

        const previousRating = current;
        this._isUpdating = true;

        const updatedDetails: AnimeDetailsData = {
            ...details,
            rating: nextRating,
        };
        selectedAnimeDetails.set(updatedDetails);

        try {
            await api.setRating(anilistId, nextRating);
            if (selectedAnimeAnilistId.current === anilistId) {
                try {
                    localStorage.setItem(
                        buildDetailsCacheKey(anilistId),
                        JSON.stringify(updatedDetails),
                    );
                } catch {}
            }
        } catch (err) {
            console.error("Failed to update rating:", err);
            if (selectedAnimeAnilistId.current === anilistId) {
                selectedAnimeDetails.set({
                    ...details,
                    rating: previousRating,
                });
            }
            snackbar.error("Failed to update rating");
        } finally {
            this._isUpdating = false;
        }
    }
}

export const ratingManager = new RatingManager();
