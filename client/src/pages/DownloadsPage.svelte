<script lang="ts">
    import { onMount } from "svelte";
    import { fade } from "svelte/transition";
    import { downloadManager, type DownloadState } from "$lib/download/downloadManager.svelte";
    import { selectedAnimeAnilistId } from "$lib/context.svelte";
    import { isNative, AnilyNative } from "$lib/native/anilyNative";
    import { Capacitor } from "@capacitor/core";
    import { getStoredPlayer } from "../types/Media";
    import { videoPlayerState } from "$lib/player/videoPlayer.svelte";
    import { buildDetailsCacheKey } from "$lib/storageKeys";
    import Button from "$lib/Button.svelte";
    import IconButton from "$lib/IconButton.svelte";
    import Badge from "$lib/Badge.svelte";
    import Tag from "$lib/Tag.svelte";
    import EmptyState from "$lib/EmptyState.svelte";
    import BottomSheet from "$lib/BottomSheet.svelte";
    import DownloadSimpleIcon from "phosphor-svelte/lib/DownloadSimpleIcon";
    import TrashSimpleIcon from "phosphor-svelte/lib/TrashSimpleIcon";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";
    import CaretDownIcon from "phosphor-svelte/lib/CaretDownIcon";
    import CaretUpIcon from "phosphor-svelte/lib/CaretUpIcon";
    import ArrowsClockwiseIcon from "phosphor-svelte/lib/ArrowsClockwiseIcon";
    import DatabaseIcon from "phosphor-svelte/lib/DatabaseIcon";
    import TelevisionIcon from "phosphor-svelte/lib/TelevisionIcon";
    import XIcon from "phosphor-svelte/lib/XIcon";

    const COLOR_PALETTE = [
        "#ffd52c", // Gold / Amber
        "#38bdf8", // Sky Blue
        "#a855f7", // Purple
        "#34d399", // Emerald
        "#f43f5e", // Rose
        "#fb923c", // Orange
        "#818cf8", // Indigo
        "#2dd4bf", // Teal
        "#e879f9", // Fuchsia
        "#a3e635", // Lime
    ];

    interface DownloadedEpisodeItem {
        episodeId: number;
        episodeNumber?: number;
        filename: string;
        size: number;
    }

    interface AnimeDownloadGroup {
        key: string;
        anilistId?: number;
        title: string;
        thumbnailUrl?: string;
        totalBytes: number;
        episodes: DownloadedEpisodeItem[];
        color: string;
    }

    let isRefreshing = $state(false);
    let deviceStorage = $state<{ freeSpace: number; totalSpace: number; usedByApp: number }>({
        freeSpace: 0,
        totalSpace: 0,
        usedByApp: 0,
    });

    let expandedAnimeKeys: Record<string, boolean> = $state({});

    // Confirmation sheets
    let isConfirmDeleteAnimeOpen = $state(false);
    let animeToDelete: AnimeDownloadGroup | null = $state(null);

    let isConfirmDeleteAllOpen = $state(false);

    function formatBytes(bytes: number): string {
        if (!bytes || bytes <= 0) return "0 B";
        const units = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const val = bytes / Math.pow(1024, i);
        return `${val.toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
    }

    function getCachedDetails(anilistId?: number) {
        if (!anilistId) return null;
        try {
            const raw = localStorage.getItem(buildDetailsCacheKey(anilistId));
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    const activeDownloadingEpisodes = $derived.by((): DownloadState[] => {
        return Object.values(downloadManager.states).filter(
            (s) => s.status === "downloading",
        );
    });

    const animeGroups = $derived.by((): AnimeDownloadGroup[] => {
        const completed = Object.values(downloadManager.states).filter(
            (s) => s.status === "completed" && (s.bytesDownloaded > 0 || s.totalBytes > 0),
        );

        const groupsMap = new Map<string, {
            anilistId?: number;
            title: string;
            thumbnailUrl?: string;
            totalBytes: number;
            episodes: DownloadedEpisodeItem[];
        }>();

        for (const s of completed) {
            const groupKey = s.anilistId ? `anime_${s.anilistId}` : (s.animeTitle || `ep_${s.episodeId}`);
            const cached = getCachedDetails(s.anilistId);

            const title = s.animeTitle || cached?.titleNative || cached?.titleEnglish || cached?.titleRomanji || (s.anilistId ? `Anime #${s.anilistId}` : "Downloaded Anime");
            const thumb = s.thumbnailUrl || cached?.thumbnailUrl;
            const size = s.bytesDownloaded || s.totalBytes || 0;

            let epNum = s.episodeNumber;
            if (epNum === undefined) {
                const match = s.filename.match(/num_(\d+)/);
                if (match) epNum = Number(match[1]);
            }

            if (!groupsMap.has(groupKey)) {
                groupsMap.set(groupKey, {
                    anilistId: s.anilistId,
                    title,
                    thumbnailUrl: thumb,
                    totalBytes: 0,
                    episodes: [],
                });
            }

            const g = groupsMap.get(groupKey)!;
            g.totalBytes += size;
            if (!g.thumbnailUrl && thumb) g.thumbnailUrl = thumb;
            if (title && g.title.startsWith("Anime #")) g.title = title;

            g.episodes.push({
                episodeId: s.episodeId,
                episodeNumber: epNum,
                filename: s.filename,
                size,
            });
        }

        // Convert map to array with colors & sorted episodes
        const result: AnimeDownloadGroup[] = [];
        let colorIdx = 0;

        for (const [key, g] of groupsMap.entries()) {
            g.episodes.sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0));
            result.push({
                key,
                anilistId: g.anilistId,
                title: g.title,
                thumbnailUrl: g.thumbnailUrl,
                totalBytes: g.totalBytes,
                episodes: g.episodes,
                color: COLOR_PALETTE[colorIdx % COLOR_PALETTE.length],
            });
            colorIdx++;
        }

        // Sort anime groups descending by storage usage
        return result.sort((a, b) => b.totalBytes - a.totalBytes);
    });

    const totalDownloadedBytes = $derived(
        animeGroups.reduce((acc, g) => acc + g.totalBytes, 0),
    );

    const totalEpisodesCount = $derived(
        animeGroups.reduce((acc, g) => acc + g.episodes.length, 0),
    );

    async function refreshStorage() {
        isRefreshing = true;
        try {
            deviceStorage = await downloadManager.syncNativeStorage();
        } finally {
            isRefreshing = false;
        }
    }

    onMount(() => {
        refreshStorage();
    });

    function toggleAnimeExpand(key: string) {
        expandedAnimeKeys[key] = !expandedAnimeKeys[key];
    }

    function promptDeleteAnime(group: AnimeDownloadGroup) {
        animeToDelete = group;
        isConfirmDeleteAnimeOpen = true;
    }

    async function confirmDeleteAnime() {
        if (animeToDelete) {
            await downloadManager.deleteAnimeDownloads(animeToDelete.anilistId, animeToDelete.title);
            animeToDelete = null;
            await refreshStorage();
        }
        isConfirmDeleteAnimeOpen = false;
    }

    function promptDeleteAll() {
        isConfirmDeleteAllOpen = true;
    }

    async function confirmDeleteAll() {
        await downloadManager.deleteAllDownloads();
        isConfirmDeleteAllOpen = false;
        await refreshStorage();
    }

    async function playEpisodeOffline(episodeId: number, episodeNumber?: number, animeTitle?: string, anilistId?: number) {
        if (getStoredPlayer() === "builtin") {
            const filename = `anily_ep_${episodeId}_num_${episodeNumber ?? 0}.mp4`;
            try {
                const res = await AnilyNative.getLocalEpisodePath({ filename });
                if (res.exists && res.path) {
                    const localUrl = Capacitor.convertFileSrc(res.path);
                    const epData: any = {
                        id: episodeId,
                        number: episodeNumber ?? 1,
                        titleNative: `Episode ${episodeNumber ?? 1}`,
                        watched: true,
                    };
                    await videoPlayerState.playOfflineEpisode(
                        epData,
                        animeTitle || "Downloaded Anime",
                        anilistId,
                        [epData],
                        localUrl,
                    );
                    return;
                }
            } catch (err) {
                console.warn("Failed to get local episode path for in-app player:", err);
            }
        }
        await downloadManager.playOffline(episodeId, episodeNumber);
    }

    async function deleteSingleEpisode(episode: DownloadedEpisodeItem, anilistId?: number) {
        await downloadManager.deleteDownload(episode.episodeId, episode.episodeNumber, anilistId);
        await refreshStorage();
    }

    function openAnimeDetails(anilistId?: number) {
        if (anilistId !== undefined) {
            selectedAnimeAnilistId.set(anilistId);
        }
    }
</script>

<div id="downloads-page">
    <header class="page-header">
        <div class="header-titles">
            <h2 class="page-title">Offline Downloads</h2>
            <span class="page-subtitle">Manage downloaded episodes and local storage</span>
        </div>
        <div class="header-actions">
            <Button
                Icon={ArrowsClockwiseIcon}
                style="ghost"
                loading={isRefreshing}
                onclick={refreshStorage}
                title="Refresh storage info"
            >
                Refresh
            </Button>
            {#if animeGroups.length > 0}
                <Button
                    Icon={TrashSimpleIcon}
                    style="ghost"
                    class="btn-danger-ghost"
                    onclick={promptDeleteAll}
                    title="Delete all downloads"
                >
                    Clear All
                </Button>
            {/if}
        </div>
    </header>

    {#if activeDownloadingEpisodes.length > 0}
        <!-- Active Downloads Section -->
        <section class="active-downloads-section">
            <div class="section-header">
                <h3>Active Downloads ({activeDownloadingEpisodes.length})</h3>
            </div>
            <div class="active-downloads-list">
                {#each activeDownloadingEpisodes as dl (dl.episodeId)}
                    <div class="active-dl-card">
                        <div class="active-dl-main">
                            <div class="active-dl-info">
                                <span class="active-dl-title">{dl.animeTitle || "Anime"} • EP {dl.episodeNumber ?? "?"}</span>
                                <span class="active-dl-meta">
                                    {dl.progress > 0 ? `${dl.progress}%` : formatBytes(dl.bytesDownloaded)}
                                    {#if dl.totalBytes > 0} / {formatBytes(dl.totalBytes)}{/if}
                                </span>
                            </div>
                            <div class="active-dl-bar-bg">
                                <div class="active-dl-bar-fill" style="width: {Math.max(dl.progress, 3)}%"></div>
                            </div>
                        </div>
                        <div class="active-dl-actions">
                            <Button
                                Icon={XIcon}
                                style="ghost"
                                class="btn-cancel-dl"
                                onclick={() => downloadManager.cancelDownload(dl.episodeId)}
                                title="Cancel download"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                {/each}
            </div>
        </section>
    {/if}

    {#if animeGroups.length > 0}
        <!-- Storage Overview Card with Segmented Linear Visual Bar -->
        <section class="storage-card">
            <div class="storage-card-header">
                <div class="storage-header-title">
                    <DatabaseIcon size={20} color="#ffd52c" weight="fill" />
                    <h3>Storage Breakdown</h3>
                </div>
                <div class="storage-stats-summary">
                    <span class="total-used-size">{formatBytes(totalDownloadedBytes)}</span>
                    <span class="total-used-label">Used by Anily</span>
                </div>
            </div>

            <!-- Segmented Horizontal Storage Bar -->
            <div class="storage-bar" role="progressbar" aria-label="Downloaded Content Breakdown" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}>
                {#each animeGroups as group}
                    {@const pct = totalDownloadedBytes > 0 ? (group.totalBytes / totalDownloadedBytes) * 100 : 0}
                    <div
                        class="storage-bar-segment"
                        style="width: {pct}%; background-color: {group.color};"
                        title="{group.title}: {formatBytes(group.totalBytes)} ({pct.toFixed(1)}%)"
                    ></div>
                {/each}
            </div>

            <!-- Meta details row below bar -->
            <div class="storage-meta-row">
                <span class="meta-item">
                    <strong>{totalEpisodesCount}</strong> episodes across <strong>{animeGroups.length}</strong> anime
                </span>
                {#if isNative && deviceStorage.freeSpace > 0}
                    <span class="meta-item free-space-meta">
                        <strong>{formatBytes(deviceStorage.freeSpace)}</strong> free on device
                    </span>
                {/if}
            </div>

            <!-- Visual Legend -->
            <div class="storage-legend">
                {#each animeGroups as group}
                    {@const pct = totalDownloadedBytes > 0 ? ((group.totalBytes / totalDownloadedBytes) * 100).toFixed(0) : "0"}
                    <div class="legend-item" title="{group.title}: {formatBytes(group.totalBytes)}">
                        <span class="legend-dot" style="background-color: {group.color};"></span>
                        <span class="legend-name">{group.title}</span>
                        <span class="legend-size">{formatBytes(group.totalBytes)} ({pct}%)</span>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Downloaded Anime List -->
        <section class="anime-list-section">
            <div class="section-header">
                <h3>Downloaded Anime ({animeGroups.length})</h3>
            </div>

            <div class="anime-cards-list">
                {#each animeGroups as group (group.key)}
                    {@const isExpanded = !!expandedAnimeKeys[group.key]}
                    <div class="anime-group-card" transition:fade={{ duration: 150 }}>
                        <div class="anime-card-main">
                            <!-- Thumbnail / Poster -->
                            <button
                                type="button"
                                class="thumbnail-wrapper"
                                onclick={() => openAnimeDetails(group.anilistId)}
                                aria-label="View {group.title} details"
                            >
                                {#if group.thumbnailUrl}
                                    <img
                                        src={group.thumbnailUrl}
                                        alt={group.title}
                                        class="anime-thumbnail"
                                        onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                                    />
                                {:else}
                                    <div class="thumbnail-placeholder">
                                        <TelevisionIcon size={24} color="#666" />
                                    </div>
                                {/if}
                                <span class="color-indicator" style="background-color: {group.color};"></span>
                            </button>

                            <!-- Anime Info -->
                            <div class="anime-info">
                                <div class="title-row">
                                    <button
                                        type="button"
                                        class="anime-title-btn"
                                        onclick={() => openAnimeDetails(group.anilistId)}
                                        title="View anime details"
                                    >
                                        {group.title}
                                    </button>
                                </div>
                                <div class="anime-meta-tags">
                                    <Tag variant="default">{group.episodes.length} {group.episodes.length === 1 ? "Episode" : "Episodes"}</Tag>
                                    <Tag variant="hd">{formatBytes(group.totalBytes)}</Tag>
                                </div>
                            </div>

                            <!-- Card Actions -->
                            <div class="anime-card-actions">
                                <Button
                                    Icon={TrashSimpleIcon}
                                    style="ghost"
                                    class="btn-delete-anime"
                                    onclick={() => promptDeleteAnime(group)}
                                    title="Delete all downloads for this anime"
                                >
                                    <span class="btn-action-label">Delete Anime</span>
                                </Button>

                                <IconButton
                                    Icon={isExpanded ? CaretUpIcon : CaretDownIcon}
                                    variant="ghost"
                                    onclick={() => toggleAnimeExpand(group.key)}
                                    title={isExpanded ? "Collapse episodes" : "View episodes"}
                                />
                            </div>
                        </div>

                        <!-- Collapsible Episode List -->
                        {#if isExpanded}
                            <div class="episodes-drawer" transition:fade={{ duration: 120 }}>
                                <div class="drawer-header">
                                    <span>Downloaded Episodes</span>
                                </div>
                                <div class="episodes-sublist">
                                    {#each group.episodes as ep (ep.episodeId)}
                                        <div class="episode-row">
                                            <div class="ep-left">
                                                <span class="ep-number-badge">
                                                    EP {ep.episodeNumber ?? "?"}
                                                </span>
                                                <span class="ep-size-text">{formatBytes(ep.size)}</span>
                                            </div>
                                            <div class="ep-right">
                                                <Button
                                                    Icon={PlayIcon}
                                                    style="ghost"
                                                    onclick={() => playEpisodeOffline(ep.episodeId, ep.episodeNumber, group.title, group.anilistId)}
                                                    title="Play offline"
                                                >
                                                    Play
                                                </Button>
                                                <IconButton
                                                    Icon={TrashSimpleIcon}
                                                    variant="ghost"
                                                    onclick={() => deleteSingleEpisode(ep, group.anilistId)}
                                                    title="Delete episode"
                                                />
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </section>
    {:else if activeDownloadingEpisodes.length === 0}
        <EmptyState
            Icon={DownloadSimpleIcon}
            iconSize="3.5rem"
            title="No downloaded episodes"
            description="You have not downloaded any anime episodes for offline viewing yet. Open any anime while online and click the download button on an episode to save it locally."
        />
    {/if}
</div>

<!-- Confirm Delete Anime BottomSheet -->
<BottomSheet bind:isOpen={isConfirmDeleteAnimeOpen} ariaLabel="Confirm Delete Anime Downloads">
    <div class="confirm-sheet-content">
        <h3 class="sheet-title">Delete all downloads for this anime?</h3>
        <p class="sheet-desc">
            This will permanently remove <strong>{animeToDelete?.episodes.length} downloaded episode(s)</strong> for
            <strong>{animeToDelete?.title}</strong> and free up <strong>{formatBytes(animeToDelete?.totalBytes ?? 0)}</strong>.
        </p>
        <div class="sheet-actions">
            <Button
                style="ghost"
                onclick={() => {
                    isConfirmDeleteAnimeOpen = false;
                    animeToDelete = null;
                }}
            >
                Cancel
            </Button>
            <Button
                class="btn-danger"
                Icon={TrashSimpleIcon}
                onclick={confirmDeleteAnime}
            >
                Delete Anime
            </Button>
        </div>
    </div>
</BottomSheet>

<!-- Confirm Delete All BottomSheet -->
<BottomSheet bind:isOpen={isConfirmDeleteAllOpen} ariaLabel="Confirm Delete All Downloads">
    <div class="confirm-sheet-content">
        <h3 class="sheet-title">Delete all offline downloads?</h3>
        <p class="sheet-desc">
            This will permanently remove all <strong>{totalEpisodesCount} downloaded episodes</strong> across
            <strong>{animeGroups.length} anime</strong> and free up <strong>{formatBytes(totalDownloadedBytes)}</strong> of storage.
        </p>
        <div class="sheet-actions">
            <Button
                style="ghost"
                onclick={() => {
                    isConfirmDeleteAllOpen = false;
                }}
            >
                Cancel
            </Button>
            <Button
                class="btn-danger"
                Icon={TrashSimpleIcon}
                onclick={confirmDeleteAll}
            >
                Delete All
            </Button>
        </div>
    </div>
</BottomSheet>

<style lang="scss">
    #downloads-page {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 24px 32px;
        max-width: 1000px;
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;

        @media (max-width: 768px) {
            padding: 16px;
            gap: 16px;
        }

        .page-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;

            .header-titles {
                display: flex;
                flex-direction: column;
                gap: 4px;

                .page-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin: 0;
                    color: #fff;
                }

                .page-subtitle {
                    font-size: 0.85rem;
                    color: #857f78;
                }
            }

            .header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }
        }

        /* Storage Overview Card */
        .storage-card {
            background: hsl(20, 17.6%, 8.5%);
            border: 1px solid hsl(36, 5.7%, 18%);
            border-radius: 12px;
            padding: 18px 20px;
            display: flex;
            flex-direction: column;
            gap: 14px;

            .storage-card-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 12px;

                .storage-header-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;

                    h3 {
                        margin: 0;
                        font-size: 1.05rem;
                        font-weight: 600;
                        color: #ded7ce;
                    }
                }

                .storage-stats-summary {
                    display: flex;
                    align-items: baseline;
                    gap: 6px;

                    .total-used-size {
                        font-size: 1.25rem;
                        font-weight: 700;
                        color: #ffd52c;
                    }

                    .total-used-label {
                        font-size: 0.82rem;
                        color: #857f78;
                    }
                }
            }

            /* Segmented Bar */
            .storage-bar {
                display: flex;
                height: 14px;
                border-radius: 7px;
                background: hsl(20, 17.6%, 14%);
                overflow: hidden;
                gap: 2px;
                box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);

                .storage-bar-segment {
                    height: 100%;
                    min-width: 4px;
                    transition: width 0.3s ease;

                    &:first-child {
                        border-top-left-radius: 7px;
                        border-bottom-left-radius: 7px;
                    }

                    &:last-child {
                        border-top-right-radius: 7px;
                        border-bottom-right-radius: 7px;
                    }
                }
            }

            .storage-meta-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 0.82rem;
                color: #857f78;
                flex-wrap: wrap;
                gap: 8px;

                strong {
                    color: #ded7ce;
                }

                .free-space-meta {
                    color: #a8a29e;
                }
            }

            /* Legend */
            .storage-legend {
                display: flex;
                flex-wrap: wrap;
                gap: 12px 18px;
                padding-top: 6px;
                border-top: 1px solid hsl(36, 5.7%, 14%);

                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8rem;
                    color: #c4bfb9;

                    .legend-dot {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        flex-shrink: 0;
                    }

                    .legend-name {
                        max-width: 180px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        font-weight: 500;
                    }

                    .legend-size {
                        color: #857f78;
                        font-size: 0.75rem;
                    }
                }
            }
        }

        /* Active Downloads Section */
        .active-downloads-section {
            display: flex;
            flex-direction: column;
            gap: 12px;

            .section-header {
                h3 {
                    margin: 0;
                    font-size: 1.05rem;
                    font-weight: 600;
                    color: #ded7ce;
                }
            }

            .active-downloads-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .active-dl-card {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                padding: 12px 16px;
                background: hsl(20, 17.6%, 8.5%);
                border: 1px solid hsl(36, 5.7%, 18%);
                border-radius: 10px;

                @media (max-width: 600px) {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 12px;
                }

                .active-dl-main {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    flex: 1;
                    min-width: 0;

                    .active-dl-info {
                        display: flex;
                        justify-content: space-between;
                        align-items: baseline;
                        gap: 12px;

                        .active-dl-title {
                            font-weight: 600;
                            font-size: 0.95rem;
                            color: #ded7ce;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        }

                        .active-dl-meta {
                            font-size: 0.8rem;
                            color: #ffd52c;
                            font-weight: 600;
                            flex-shrink: 0;
                        }
                    }

                    .active-dl-bar-bg {
                        height: 6px;
                        border-radius: 3px;
                        background: hsl(20, 17.6%, 14%);
                        overflow: hidden;

                        .active-dl-bar-fill {
                            height: 100%;
                            background: #ffd52c;
                            border-radius: 3px;
                            transition: width 0.3s ease;
                        }
                    }
                }

                .active-dl-actions {
                    flex-shrink: 0;
                    display: flex;
                    justify-content: flex-end;
                }
            }
        }

        /* Anime List Section */
        .anime-list-section {
            display: flex;
            flex-direction: column;
            gap: 12px;

            .section-header {
                h3 {
                    margin: 0;
                    font-size: 1.05rem;
                    font-weight: 600;
                    color: #ded7ce;
                }
            }

            .anime-cards-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .anime-group-card {
                background: hsl(20, 17.6%, 8.5%);
                border: 1px solid hsl(36, 5.7%, 18%);
                border-radius: 10px;
                overflow: hidden;
                transition: border-color 0.2s;

                &:hover {
                    border-color: hsl(36, 5.7%, 26%);
                }

                .anime-card-main {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    padding: 12px 16px;

                    @media (max-width: 600px) {
                        gap: 10px;
                        padding: 10px 12px;
                    }

                    .thumbnail-wrapper {
                        position: relative;
                        width: 54px;
                        height: 72px;
                        border-radius: 6px;
                        overflow: hidden;
                        flex-shrink: 0;
                        background: #111;
                        border: none;
                        padding: 0;
                        cursor: pointer;

                        .anime-thumbnail {
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                        }

                        .thumbnail-placeholder {
                            width: 100%;
                            height: 100%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background: hsl(20, 17.6%, 12%);
                        }

                        .color-indicator {
                            position: absolute;
                            bottom: 0;
                            left: 0;
                            right: 0;
                            height: 4px;
                        }
                    }

                    .anime-info {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                        flex: 1;
                        min-width: 0;

                        .title-row {
                            .anime-title-btn {
                                background: none;
                                border: none;
                                padding: 0;
                                font-size: 0.95rem;
                                font-weight: 600;
                                color: #fff;
                                text-align: left;
                                cursor: pointer;
                                white-space: nowrap;
                                overflow: hidden;
                                text-overflow: ellipsis;
                                display: block;
                                max-width: 100%;

                                &:hover {
                                    color: #ffd52c;
                                    text-decoration: underline;
                                }
                            }
                        }

                        .anime-meta-tags {
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            flex-wrap: wrap;
                        }
                    }

                    .anime-card-actions {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        flex-shrink: 0;

                        @media (max-width: 600px) {
                            .btn-action-label {
                                display: none;
                            }
                        }
                    }
                }

                /* Collapsible Episodes Drawer */
                .episodes-drawer {
                    background: hsl(20, 17.6%, 7%);
                    border-top: 1px solid hsl(36, 5.7%, 15%);
                    padding: 12px 16px 14px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;

                    .drawer-header {
                        font-size: 0.78rem;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        color: #857f78;
                        margin-bottom: 2px;
                    }

                    .episodes-sublist {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }

                    .episode-row {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        background: hsl(20, 17.6%, 10%);
                        border: 1px solid hsl(36, 5.7%, 14%);
                        border-radius: 6px;
                        padding: 8px 12px;
                        gap: 12px;

                        .ep-left {
                            display: flex;
                            align-items: center;
                            gap: 10px;

                            .ep-number-badge {
                                font-size: 0.85rem;
                                font-weight: 600;
                                color: #ded7ce;
                            }

                            .ep-size-text {
                                font-size: 0.78rem;
                                color: #857f78;
                            }
                        }

                        .ep-right {
                            display: flex;
                            align-items: center;
                            gap: 6px;
                        }
                    }
                }
            }
        }
    }

    /* Modals Content */
    .confirm-sheet-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 4px 0 12px 0;

        .sheet-title {
            margin: 0;
            font-size: 1.15rem;
            color: #fff;
        }

        .sheet-desc {
            margin: 0;
            font-size: 0.9rem;
            line-height: 1.5;
            color: #c4bfb9;

            strong {
                color: #fff;
            }
        }

        .sheet-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 8px;
        }
    }

    :global(.btn-danger) {
        background: #dc2626 !important;
        color: #fff !important;
        border-color: #dc2626 !important;

        &:hover {
            background: #b91c1c !important;
        }
    }

    :global(.btn-danger-ghost) {
        color: #f87171 !important;

        &:hover {
            background: rgba(239, 68, 68, 0.15) !important;
            color: #ef4444 !important;
        }
    }

    :global(.btn-delete-anime) {
        color: #f87171 !important;

        &:hover {
            background: rgba(239, 68, 68, 0.15) !important;
            color: #ef4444 !important;
        }
    }

    :global(.btn-cancel-dl) {
        color: #f87171 !important;

        &:hover {
            background: rgba(239, 68, 68, 0.15) !important;
            color: #ef4444 !important;
        }
    }
</style>
