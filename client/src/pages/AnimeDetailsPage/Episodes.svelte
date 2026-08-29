<script lang="ts">
    import { fade } from "svelte/transition";
    import { watch } from "runed";
    import Button from "../../lib/Button.svelte";
    import Skeleton from "../../lib/Skeleton.svelte";
    import TorrentSelectionModal from "../../lib/TorrentSelectionModal.svelte";
    import SeasonDownloadModal from "../../lib/SeasonDownloadModal.svelte";
    import {
        apiBaseUrl,
        selectedAnimeAnilistId,
        sidebarDataRefreshSeed,
    } from "../../lib/context.svelte";
    import type EpisodeData from "../../types/Episode";
    import {
        getStoredPlayer,
        buildPlayerUrl,
        type MediaPlayer,
    } from "../../types/Media";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";
    import CheckIcon from "phosphor-svelte/lib/CheckIcon";
    import EyeIcon from "phosphor-svelte/lib/EyeIcon";
    import DownloadIcon from "phosphor-svelte/lib/DownloadIcon";
    import ImageIcon from "phosphor-svelte/lib/ImageIcon";
    import CopySimpleIcon from "phosphor-svelte/lib/CopySimpleIcon";
    import ArrowSquareOutIcon from "phosphor-svelte/lib/ArrowSquareOutIcon";

    let {
        updateSeed,
        animeName = "",
    }: {
        updateSeed: number;
        animeName?: string;
    } = $props();

    let episodes: EpisodeData[] = $state([]);
    let releasedEpisodes = $derived(episodes.filter((e) => !isFuture(e.airingAt)));
    let allReleasedWatched = $derived(
        releasedEpisodes.length > 0 && releasedEpisodes.every((e) => e.watched),
    );
    let loading = $state(true);

    // Torrent / media modal state
    let torrentModalEpisode: EpisodeData | null = $state(null);
    let seasonModalOpen = $state(false);
    let player: MediaPlayer = $state(getStoredPlayer());

    // Polling interval handle
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    function hasActiveDownloads(): boolean {
        return episodes.some(
            (e) => e.mediaStatus === "QUEUED" || e.mediaStatus === "DOWNLOADING",
        );
    }

    async function refreshEpisodes() {
        const anilistId = selectedAnimeAnilistId.current;
        if (anilistId === undefined) return;
        const url = new URL(`/api/episodes/${anilistId}`, apiBaseUrl.current);
        const data = await fetch(url.toString(), { credentials: "include" }).then(
            (r) => r.json(),
        );
        if (selectedAnimeAnilistId.current !== anilistId) return;
        episodes = Array.isArray(data) ? data : [];
    }

    function startPollingIfNeeded() {
        if (hasActiveDownloads() && !pollInterval) {
            pollInterval = setInterval(async () => {
                await refreshEpisodes();
                if (!hasActiveDownloads()) stopPolling();
            }, 10_000);
        }
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    watch(
        () => [selectedAnimeAnilistId.current, updateSeed],
        () => {
            const anilistId = selectedAnimeAnilistId.current;
            if (anilistId === undefined) return;

            stopPolling();
            loading = true;

            const url = new URL(
                `/api/episodes/${anilistId}`,
                apiBaseUrl.current,
            );
            fetch(url.toString(), { credentials: "include" })
                .then((results) => results.json())
                .then((data) => {
                    if (selectedAnimeAnilistId.current !== anilistId) return;
                    episodes = Array.isArray(data) ? data : [];
                    loading = false;
                    startPollingIfNeeded();
                });
        },
    );

    const formatAiringDate = (airingAt: string | null) => {
        if (!airingAt) return "TBA";
        return new Date(airingAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    function isFuture(airingAt: string | null) {
        if (!airingAt) return true;
        return new Date(airingAt).getTime() > Date.now();
    }

    const toggleWatch = async (episode: EpisodeData) => {
        const newStatus = !episode.watched;
        episode.watched = newStatus;

        try {
            const url = new URL(
                `/api/episodes/${episode.id}/watch`,
                apiBaseUrl.current,
            );
            const response = await fetch(url.toString(), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ watched: newStatus }),
                credentials: "include",
            });
            if (!response.ok) {
                throw new Error("Failed to update watch status");
            }
            sidebarDataRefreshSeed.set((sidebarDataRefreshSeed.current ?? 0) + 1);
        } catch (error) {
            console.error(error);
            episode.watched = !newStatus;
        }
    };

    const toggleAllWatch = async () => {
        const anilistId = selectedAnimeAnilistId.current;
        if (anilistId === undefined) return;

        const newStatus = !allReleasedWatched;

        const previousStatuses = episodes.map((e) => e.watched);
        episodes.forEach((e) => {
            if (!isFuture(e.airingAt)) {
                e.watched = newStatus;
            }
        });

        try {
            const url = new URL(
                `/api/episodes/${anilistId}/watch-all`,
                apiBaseUrl.current,
            );
            const response = await fetch(url.toString(), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ watched: newStatus }),
                credentials: "include",
            });
            if (!response.ok) {
                throw new Error("Failed to update all episodes watch status");
            }
            sidebarDataRefreshSeed.set((sidebarDataRefreshSeed.current ?? 0) + 1);
        } catch (error) {
            console.error(error);
            episodes.forEach((e, i) => (e.watched = previousStatuses[i]));
        }
    };

    // ── Torrent / download handlers ────────────────────────────────────────────

    function openTorrentModal(episode: EpisodeData) {
        torrentModalEpisode = episode;
    }

    async function handleTorrentConfirm(detail: {
        episodeId: number;
        torrentIndex: number;
    }) {
        torrentModalEpisode = null;
        const url = new URL(
            `/api/media/download/${detail.episodeId}`,
            apiBaseUrl.current,
        );
        try {
            const res = await fetch(url.toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ torrentIndex: detail.torrentIndex }),
                credentials: "include",
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            console.error("Failed to start download", e);
        }
        await refreshEpisodes();
        startPollingIfNeeded();
    }

    function handleTorrentCancel() {
        torrentModalEpisode = null;
    }

    async function handleSeasonConfirm() {
        seasonModalOpen = false;
        await refreshEpisodes();
        startPollingIfNeeded();
    }

    function handleSeasonCancel() {
        seasonModalOpen = false;
    }

    // ── Media URL / player helpers ─────────────────────────────────────────────

    async function fetchMediaUrl(episodeId: number): Promise<string | null> {
        try {
            const url = new URL(
                `/api/media/status/${episodeId}`,
                apiBaseUrl.current,
            );
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) return null;
            const data = await res.json();
            return data.mediaUrl ?? null;
        } catch {
            return null;
        }
    }

    const handleCopyUrl = async (episode: EpisodeData) => {
        const mediaUrl = await fetchMediaUrl(episode.id);
        if (mediaUrl) {
            await navigator.clipboard.writeText(mediaUrl);
        }
    };

    const handleOpenPlayer = async (episode: EpisodeData) => {
        const mediaUrl = await fetchMediaUrl(episode.id);
        if (!mediaUrl) return;
        const playerUrl = buildPlayerUrl(mediaUrl, player);
        if (player === "copy" || player === "mpv") {
            await navigator.clipboard.writeText(playerUrl);
        } else {
            window.location.href = playerUrl;
        }
    };

    /** Stream: POST /api/media/stream/{id} → get URL → open in player immediately */
    const handleStream = async (episode: EpisodeData) => {
        try {
            const url = new URL(
                `/api/media/stream/${episode.id}`,
                apiBaseUrl.current,
            );
            const res = await fetch(url.toString(), {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const mediaUrl = data.url ?? data.mediaUrl;
            if (mediaUrl) {
                const playerUrl = buildPlayerUrl(mediaUrl, player);
                if (player === "copy" || player === "mpv") {
                    await navigator.clipboard.writeText(playerUrl);
                } else {
                    window.location.href = playerUrl;
                }
            }
        } catch (e) {
            console.error("Failed to stream episode", e);
        }
        await refreshEpisodes();
        startPollingIfNeeded();
    };

    function statusDotClass(episode: EpisodeData): string {
        switch (episode.mediaStatus) {
            case "QUEUED": return "dot-queued";
            case "DOWNLOADING": return "dot-downloading";
            case "AVAILABLE": return "dot-available";
            default: return "";
        }
    }
</script>

<div class="episodes">
    {#if loading}
        {#each Array(6) as _}
            <div class="episode-card">
                <div class="number">
                    <Skeleton width="35px" height="35px" />
                </div>
                <Skeleton width="160px" height="90px" radius="0" />
                <div class="titles">
                    <Skeleton width="55%" height="14px" />
                    <Skeleton width="40%" height="14px" />
                    <Skeleton width="25%" height="13px" />
                </div>
            </div>
        {/each}
    {:else}
        {#if episodes.length > 0}
            <div class="toolbar" transition:fade={{ duration: 200 }}>
                <div class="spacer"></div>
                <Button
                    Icon={DownloadIcon}
                    style="ghost"
                    onclick={() => (seasonModalOpen = true)}
                />
                <Button
                    Icon={allReleasedWatched ? CheckIcon : EyeIcon}
                    active={allReleasedWatched}
                    style="ghost"
                    onclick={toggleAllWatch}
                />
            </div>
        {/if}
        {#each episodes as episode (episode.number)}
            <div class="episode-card" transition:fade={{ duration: 200 }}>
                <div class="number"><span>{episode.number}</span></div>
                <div class="thumbnail-container">
                    <div class="placeholder">
                        <ImageIcon size="2rem" color="#666" />
                    </div>
                    {#if episode.thumbnailUrl}
                        <img
                            src={episode.thumbnailUrl}
                            alt=""
                            class="episode-thumbnail"
                            onerror={(e) => (e.currentTarget as HTMLImageElement).style.display='none'}
                        />
                    {/if}
                </div>
                <div class="titles">
                    <span class="title-1"
                        >{episode.titleEnglish ??
                            `Episode ${episode.number}`}</span
                    >
                    <span class="title-2">{episode.titleNative ?? ""}</span>
                    <span class="date"
                        >{formatAiringDate(episode.airingAt)}</span
                    >
                </div>
                <div class="actions">
                    {#if episode.mediaStatus !== "NONE"}
                        <span class="status-dot {statusDotClass(episode)}" title={episode.mediaStatus}></span>
                    {/if}
                    <Button
                        Icon={DownloadIcon}
                        style="ghost"
                        disabled={isFuture(episode.airingAt) || episode.mediaStatus === "AVAILABLE" || episode.mediaStatus === "DOWNLOADING" || episode.mediaStatus === "QUEUED"}
                        onclick={() => openTorrentModal(episode)}
                    />
                    <Button
                        Icon={PlayIcon}
                        style="ghost"
                        disabled={isFuture(episode.airingAt) || episode.mediaStatus !== "NONE"}
                        onclick={() => handleStream(episode)}
                    />
                    <Button
                        Icon={CopySimpleIcon}
                        style="ghost"
                        disabled={episode.mediaStatus !== "AVAILABLE"}
                        onclick={() => handleCopyUrl(episode)}
                    />
                    <Button
                        Icon={ArrowSquareOutIcon}
                        style="ghost"
                        disabled={episode.mediaStatus !== "AVAILABLE"}
                        onclick={() => handleOpenPlayer(episode)}
                    />
                    <Button Icon={episode.watched ? CheckIcon : EyeIcon} active={episode.watched} disabled={isFuture(episode.airingAt)} onclick={() => toggleWatch(episode)} />
                </div>
            </div>
        {/each}
    {/if}
</div>

<TorrentSelectionModal
    show={torrentModalEpisode !== null}
    episodeId={torrentModalEpisode?.id ?? 0}
    episodeTitle={torrentModalEpisode
        ? (torrentModalEpisode.titleEnglish ?? `Episode ${torrentModalEpisode.number}`)
        : ""}
    onconfirm={handleTorrentConfirm}
    oncancel={handleTorrentCancel}
/>

<SeasonDownloadModal
    show={seasonModalOpen}
    anilistId={selectedAnimeAnilistId.current ?? 0}
    {animeName}
    onconfirm={handleSeasonConfirm}
    oncancel={handleSeasonCancel}
/>

<style lang="scss">
    .episodes {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        overflow: auto;
        padding: 1rem;

        .toolbar {
            display: flex;
            gap: 0.5rem;
            align-items: center;

            .spacer {
                flex-grow: 1;
            }
        }

        .episode-card {
            display: flex;
            gap: 1rem;
            align-items: center;

            .number {
                background-color: #1d1a17;
                display: flex;
                gap: 0.5rem;
                height: 35px;
                width: 35px;
                border-radius: 5px;
                justify-content: center;
                align-items: center;

                span {
                    margin-top: 2px;
                    margin-left: 1px;
                }
            }

            .thumbnail-container {
                position: relative;
                width: 160px;
                height: 90px;
                border-radius: 4px;
                overflow: hidden;
                flex-shrink: 0;

                .placeholder {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: #1d1a17;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .episode-thumbnail {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
            }

            .titles {
                flex-grow: 1;

                display: flex;
                flex-direction: column;
                gap: 0.25rem;

                .title-1 {
                    font-size: 14px;
                }

                .title-2 {
                    font-size: 14px;
                }

                .date {
                    font-size: 13px;
                    color: #999;
                }
            }

            .actions {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }
        }
    }

    .status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;

        &.dot-queued {
            background: #d4a843;
        }

        &.dot-downloading {
            background: #4a9fd4;
            animation: pulse 1.4s ease-in-out infinite;
        }

        &.dot-available {
            background: #6fbf6f;
        }
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
    }
</style>
