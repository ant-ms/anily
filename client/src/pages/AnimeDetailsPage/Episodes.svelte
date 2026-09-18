<script lang="ts">
    import { onMount } from "svelte";
    import { fade } from "svelte/transition";
    import { watch } from "runed";
    import Button from "../../lib/Button.svelte";
    import Skeleton from "../../lib/Skeleton.svelte";
    import SegmentedControl from "../../lib/SegmentedControl.svelte";
    import Tag from "../../lib/Tag.svelte";
    import {
        apiBaseUrl,
        selectedAnimeAnilistId,
        sidebarDataRefreshSeed,
    } from "../../lib/context.svelte";
    import { snackbar } from "../../lib/snackbar.svelte";
    import type EpisodeData from "../../types/Episode";
    import {
        getStoredPlayer,
        getStoredLanguagePreference,
        buildPlayerUrl,
        isHdService,
        sortServicesWithHdFirst,
        pickBestService,
        type MediaPlayer,
        type AvailableService,
    } from "../../types/Media";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";
    import CaretDownIcon from "phosphor-svelte/lib/CaretDownIcon";
    import ClipboardIcon from "phosphor-svelte/lib/ClipboardIcon";
    import CheckIcon from "phosphor-svelte/lib/CheckIcon";
    import EyeIcon from "phosphor-svelte/lib/EyeIcon";
    import ImageIcon from "phosphor-svelte/lib/ImageIcon";
    import ThumbsUpIcon from "phosphor-svelte/lib/ThumbsUpIcon";
    import ThumbsDownIcon from "phosphor-svelte/lib/ThumbsDownIcon";
    import MinusIcon from "phosphor-svelte/lib/MinusIcon";
    import DownloadSimpleIcon from "phosphor-svelte/lib/DownloadSimpleIcon";
    import CheckCircleIcon from "phosphor-svelte/lib/CheckCircleIcon";
    import TrashSimpleIcon from "phosphor-svelte/lib/TrashSimpleIcon";
    import { AnilyNative, isNative } from "../../lib/native/anilyNative";
    import { syncQueue } from "../../lib/sync/syncQueue.svelte";
    import { downloadManager } from "../../lib/download/downloadManager.svelte";
    import BottomSheet from "../../lib/BottomSheet.svelte";
    import { networkState } from "../../lib/network.svelte";
    import type AnimeDetailsData from "../../types/AnimeDetails";
    import type { Rating } from "../../types/AnimeDetails";

    let {
        updateSeed,
        animeName = "",
        animeDetails = undefined,
    }: {
        updateSeed: number;
        animeName?: string;
        animeDetails?: AnimeDetailsData;
    } = $props();

    let episodes: EpisodeData[] = $state([]);
    let releasedEpisodes = $derived(episodes.filter((e) => !isFuture(e.airingAt)));
    let allReleasedWatched = $derived(
        releasedEpisodes.length > 0 && releasedEpisodes.every((e) => e.watched),
    );
    let loading = $state(true);

    let player: MediaPlayer = $state(getStoredPlayer());

    onMount(() => {
        const updatePlayer = () => {
            player = getStoredPlayer();
        };
        window.addEventListener("focus", updatePlayer);
        window.addEventListener("storage", updatePlayer);
        return () => {
            window.removeEventListener("focus", updatePlayer);
            window.removeEventListener("storage", updatePlayer);
        };
    });

    // Streaming & dropdown state
    let checkingEpisodeId: number | null = $state(null);
    let resolvingEpisodeId: number | null = $state(null);
    let autoPlayingEpisodeId: number | null = $state(null);
    let dropdownOpenEpisodeId: number | null = $state(null);
    let servicesCache: Record<number, AvailableService[]> = $state({});
    let selectedServices: Record<number, AvailableService> = $state({});

    let isConfirmDeleteOpen = $state(false);
    let episodeToDelete: EpisodeData | null = $state(null);

    function promptDeleteDownload(episode: EpisodeData) {
        if (!networkState.isOnline) {
            episodeToDelete = episode;
            isConfirmDeleteOpen = true;
        } else {
            downloadManager.deleteDownload(
                episode.id,
                episode.number,
                selectedAnimeAnilistId.current,
            );
        }
    }

    function confirmDelete() {
        if (episodeToDelete) {
            downloadManager.deleteDownload(
                episodeToDelete.id,
                episodeToDelete.number,
                selectedAnimeAnilistId.current,
            );
            episodeToDelete = null;
        }
        isConfirmDeleteOpen = false;
    }

    async function refreshEpisodes() {
        const anilistId = selectedAnimeAnilistId.current;
        if (anilistId === undefined) return;

        const cacheKey = `anily:cache:episodes:${anilistId}`;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    episodes = parsed;
                    episodes.forEach((e) =>
                        downloadManager.checkEpisode(e.id, e.number, anilistId),
                    );
                    loading = false;
                }
            }
        } catch {}

        if (!apiBaseUrl.current) return;
        try {
            const url = new URL(`/api/episodes/${anilistId}`, apiBaseUrl.current);
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            if (selectedAnimeAnilistId.current !== anilistId) return;
            episodes = Array.isArray(data) ? data : [];
            episodes.forEach((e) =>
                downloadManager.checkEpisode(e.id, e.number, anilistId),
            );
            try {
                localStorage.setItem(cacheKey, JSON.stringify(episodes));
            } catch {}
        } catch (err) {
            console.warn("Failed to fetch episodes online, using cached episodes if available:", err);
            if (episodes.length === 0 && networkState.isOnline) {
                snackbar.error("Failed to load episodes");
            }
        } finally {
            loading = false;
        }
    }

    let currentRating: Rating = $state("NEUTRAL");
    let isUpdatingRating = $state(false);

    $effect(() => {
        if (animeDetails?.rating) {
            currentRating = animeDetails.rating;
        }
    });

    const setRating = async (nextRating: Rating) => {
        if (isUpdatingRating || currentRating === nextRating) return;

        const previousRating = currentRating;
        currentRating = nextRating;
        isUpdatingRating = true;

        try {
            const url = new URL(
                `/api/details/${selectedAnimeAnilistId.current}/rating`,
                apiBaseUrl.current,
            );
            const res = await fetch(url.toString(), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ rating: nextRating }),
                credentials: "include",
            });
            if (!res.ok) {
                throw new Error("Failed to update rating");
            }
            if (animeDetails) {
                animeDetails.rating = nextRating;
            }
        } catch (err) {
            console.error("Failed to update rating:", err);
            currentRating = previousRating;
            snackbar.error("Failed to update rating");
        } finally {
            isUpdatingRating = false;
        }
    };

    watch(
        () => [selectedAnimeAnilistId.current, updateSeed],
        () => {
            const anilistId = selectedAnimeAnilistId.current;
            if (anilistId === undefined) return;

            dropdownOpenEpisodeId = null;
            loading = episodes.length === 0;
            refreshEpisodes();
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
        await syncQueue.recordWatchStatus(episode.id, newStatus);
    };

    const toggleAllWatch = async () => {
        const anilistId = selectedAnimeAnilistId.current;
        if (anilistId === undefined) return;

        const newStatus = !allReleasedWatched;
        for (const episode of episodes) {
            if (!isFuture(episode.airingAt)) {
                episode.watched = newStatus;
                await syncQueue.recordWatchStatus(episode.id, newStatus);
            }
        }
    };

    // ── Streaming & provider resolution ──────────────────────────────────────

    async function checkServices(episode: EpisodeData): Promise<AvailableService[]> {
        if (servicesCache[episode.id]) {
            return servicesCache[episode.id];
        }

        checkingEpisodeId = episode.id;
        try {
            const url = new URL(`/api/stream/services/${episode.id}`, apiBaseUrl.current);
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const rawServices: AvailableService[] = Array.isArray(data.services) ? data.services : [];
            const services = sortServicesWithHdFirst(rawServices);
            servicesCache[episode.id] = services;
            return services;
        } catch (err) {
            console.error("Failed to check streaming services", err);
            snackbar.error("Failed to check streaming services");
            return [];
        } finally {
            checkingEpisodeId = null;
        }
    }

    async function handlePlay(episode: EpisodeData) {
        if (dropdownOpenEpisodeId === episode.id) {
            dropdownOpenEpisodeId = null;
        }

        if (isNative && downloadManager.states[episode.id]?.status === "completed") {
            await downloadManager.playOffline(episode.id, episode.number);
            return;
        }

        autoPlayingEpisodeId = episode.id;

        try {
            const services = await checkServices(episode);
            if (services.length === 0) {
                snackbar.error("No streaming services available for this episode");
                return;
            }

            const preferredLang = getStoredLanguagePreference();
            // Prioritize preferred language candidates first, keeping others as fallback
            const matchingLanguage = sortServicesWithHdFirst(
                services.filter((s) => s.language === preferredLang),
            );
            const otherLanguage = sortServicesWithHdFirst(
                services.filter((s) => s.language !== preferredLang),
            );
            const candidateQueue = [...matchingLanguage, ...otherLanguage];

            if (candidateQueue.length === 0) {
                snackbar.error("No suitable stream found for this episode");
                return;
            }

            let played = false;
            for (const candidate of candidateQueue) {
                const success = await playService(episode, candidate, false);
                if (success) {
                    played = true;
                    break;
                }
                console.warn(
                    `Streaming server ${candidate.providerName} (${candidate.serverName}) failed, trying next candidate...`,
                );
            }

            if (!played) {
                snackbar.error("Failed to load stream from any available server");
            }
        } finally {
            autoPlayingEpisodeId = null;
        }
    }

    async function handleToggleDropdown(episode: EpisodeData) {
        // Toggle the provider dropdown
        if (dropdownOpenEpisodeId === episode.id) {
            dropdownOpenEpisodeId = null;
            return;
        }

        dropdownOpenEpisodeId = episode.id;

        if (!servicesCache[episode.id]) {
            const services = await checkServices(episode);
            if (services.length === 0) {
                snackbar.error("No streaming services available for this episode");
            }
        }
    }

    async function playService(
        episode: EpisodeData,
        service: AvailableService,
        showErrorMessage = true,
    ): Promise<boolean> {
        selectedServices[episode.id] = service;
        dropdownOpenEpisodeId = null;
        resolvingEpisodeId = episode.id;

        try {
            const params = new URLSearchParams({
                providerId: service.providerId,
                identifier: service.identifier,
                language: service.language,
                server: service.serverId,
            });
            const url = new URL(`/api/stream/play/${episode.id}?${params.toString()}`, apiBaseUrl.current);
            const res = await fetch(url.toString(), { credentials: "include" });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            const streamUrl = data.streamUrl;

            if (!streamUrl) {
                throw new Error("No stream URL returned");
            }

            if (isNative) {
                await AnilyNative.openExternalPlayer({
                    url: streamUrl,
                    mimeType: data.container === "hls" ? "application/x-mpegURL" : "video/*",
                });
            } else {
                const playerUrl = buildPlayerUrl(streamUrl, player);

                if (player === "copy" || player === "mpv") {
                    await navigator.clipboard.writeText(playerUrl);
                    const message =
                        player === "mpv"
                            ? "Stream URL copied! Run in mpv"
                            : "Stream URL copied to clipboard!";
                    snackbar.success(message);
                } else {
                    window.location.href = playerUrl;
                }
            }
            return true;
        } catch (err) {
            console.error("Failed to play service stream", err);
            if (showErrorMessage) {
                snackbar.error("Failed to load stream from provider");
            }
            return false;
        } finally {
            resolvingEpisodeId = null;
        }
    }

    function handleWindowClick(e: MouseEvent) {
        const path = e.composedPath();
        const isInside = path.some(
            (node) =>
                node instanceof HTMLElement &&
                node.closest?.(".stream-action-group"),
        );
        if (!isInside) {
            dropdownOpenEpisodeId = null;
        }
    }
</script>

<svelte:window onclick={handleWindowClick} />

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
        {#if episodes.length > 0 || !loading}
            <div class="toolbar" transition:fade={{ duration: 200 }}>
                {#if episodes.length > 0}
                    <Button
                        Icon={allReleasedWatched ? CheckIcon : EyeIcon}
                        active={allReleasedWatched}
                        disabled={releasedEpisodes.length === 0}
                        onclick={toggleAllWatch}
                        title={allReleasedWatched ? "Mark all released episodes as unplayed" : "Mark all released episodes as played"}
                    >
                        <span class="mark-all-text">
                            {allReleasedWatched ? "Mark all as unplayed" : "Mark all as played"}
                        </span>
                    </Button>
                {/if}
                <div class="spacer"></div>
                <SegmentedControl
                    variant="connected"
                    disabled={isUpdatingRating}
                    ariaLabel="Season rating"
                    value={currentRating}
                    onchange={(val) => setRating(val)}
                    items={[
                        {
                            value: "DISLIKE",
                            title: "Thumbs down",
                            Icon: ThumbsDownIcon,
                            activeIconWeight: "fill",
                            activeColor: "dislike",
                        },
                        {
                            value: "NEUTRAL",
                            title: "No rating yet",
                            Icon: MinusIcon,
                            iconWeight: "bold",
                            activeIconWeight: "bold",
                            activeColor: "neutral",
                        },
                        {
                            value: "LIKE",
                            title: "Thumbs up",
                            Icon: ThumbsUpIcon,
                            activeIconWeight: "fill",
                            activeColor: "like",
                        },
                    ]}
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
                    <Button
                        Icon={episode.watched ? CheckIcon : EyeIcon}
                        active={episode.watched}
                        disabled={isFuture(episode.airingAt)}
                        onclick={() => toggleWatch(episode)}
                    />

                    <!-- Offline Download action -->
                    {#if isNative && !isFuture(episode.airingAt)}
                        {@const dlState = downloadManager.states[episode.id]}
                        {#if dlState?.status === "completed"}
                            <Button
                                Icon={CheckCircleIcon}
                                active={true}
                                title="Downloaded offline. Click to delete"
                                onclick={() => promptDeleteDownload(episode)}
                            />
                        {:else if dlState?.status === "downloading"}
                            <Button
                                disabled={true}
                                loading={true}
                                title={`Downloading: ${dlState.progress}%`}
                            >
                                <span class="download-progress-text">{dlState.progress}%</span>
                            </Button>
                        {:else}
                            <Button
                                Icon={DownloadSimpleIcon}
                                title="Download episode for offline viewing"
                                onclick={() => downloadManager.startDownload(episode.id, episode.number, animeName, getStoredLanguagePreference(), selectedAnimeAnilistId.current)}
                            />
                        {/if}
                    {/if}

                    <!-- Stream via service split action -->
                    <div class="stream-action-group">
                        <Button
                            Icon={player === "copy" ? ClipboardIcon : PlayIcon}
                            disabled={isFuture(episode.airingAt)}
                            loading={autoPlayingEpisodeId === episode.id || (resolvingEpisodeId === episode.id && dropdownOpenEpisodeId === null)}
                            onclick={() => handlePlay(episode)}
                            title={player === "copy" ? "Copy stream URL" : "Play episode"}
                        >
                            {#if selectedServices[episode.id]}
                                <span class="selected-provider-label">
                                    {selectedServices[episode.id].providerName}
                                </span>
                            {/if}
                        </Button>

                        <Button
                            Icon={CaretDownIcon}
                            iconSize="0.85rem"
                            class="dropdown-chevron-btn"
                            active={dropdownOpenEpisodeId === episode.id}
                            disabled={isFuture(episode.airingAt)}
                            loading={checkingEpisodeId === episode.id && autoPlayingEpisodeId !== episode.id}
                            onclick={(e: MouseEvent) => {
                                e.stopPropagation();
                                handleToggleDropdown(episode);
                            }}
                            title="Select streaming provider"
                        />

                        {#if dropdownOpenEpisodeId === episode.id}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="services-dropdown"
                                transition:fade={{ duration: 120 }}
                                onclick={(e) => e.stopPropagation()}
                            >
                                <div class="dropdown-header">
                                    <span>Stream Provider</span>
                                </div>
                                {#if checkingEpisodeId === episode.id && autoPlayingEpisodeId !== episode.id}
                                    <div class="dropdown-loading">
                                        Checking available services…
                                    </div>
                                {:else if (servicesCache[episode.id] || []).length === 0}
                                    <div class="dropdown-empty">
                                        No services found for this episode
                                    </div>
                                {:else}
                                    <div class="services-list">
                                        {#each servicesCache[episode.id] as service}
                                            {@const isSelected = selectedServices[episode.id]?.providerId === service.providerId && selectedServices[episode.id]?.serverId === service.serverId && selectedServices[episode.id]?.language === service.language}
                                            <button
                                                type="button"
                                                class="service-item"
                                                class:selected={isSelected}
                                                onclick={() => playService(episode, service)}
                                            >
                                                <div class="service-meta">
                                                    <span class="provider-name">{service.providerName}</span>
                                                    <span class="server-name">· {service.serverName}</span>
                                                </div>
                                                <div class="service-tags">
                                                    {#if isHdService(service)}
                                                        <Tag variant="hd">HD</Tag>
                                                    {/if}
                                                    <Tag variant={service.language === "dub" ? "dub" : "sub"}>
                                                        {service.language.toUpperCase()}
                                                    </Tag>
                                                </div>
                                            </button>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        {/each}
    {/if}
</div>

<BottomSheet bind:isOpen={isConfirmDeleteOpen} ariaLabel="Confirm Delete Download">
    <div class="confirm-delete-sheet">
        <h3 class="sheet-title">Delete offline download?</h3>
        <p class="sheet-desc">
            You are currently <strong>offline</strong>. If you delete <strong>Episode {episodeToDelete?.number}</strong>, you will not be able to re-download or watch it until you reconnect to the internet.
        </p>
        <div class="sheet-actions">
            <Button
                style="ghost"
                onclick={() => {
                    isConfirmDeleteOpen = false;
                    episodeToDelete = null;
                }}
            >
                Cancel
            </Button>
            <Button
                class="btn-danger"
                Icon={TrashSimpleIcon}
                onclick={confirmDelete}
            >
                Delete Episode
            </Button>
        </div>
    </div>
</BottomSheet>

<style lang="scss">
    .episodes {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        overflow-y: auto;
        padding: 0.85rem 1.25rem;
        flex: 1 1 0;
        min-height: 0;

        @media (max-width: 768px) {
            padding: 0.65rem 0.75rem;
            gap: 0.6rem;
        }

        .toolbar {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            flex-shrink: 0;

            .mark-all-text {
                font-size: 13px;
                font-weight: 500;
                padding: 0 4px;
                white-space: nowrap;

                @media (max-width: 640px) {
                    font-size: 12px;
                    padding: 0 2px;
                }
            }

            .spacer {
                flex-grow: 1;
            }

        }

        .episode-card {
            display: flex;
            gap: 0.85rem;
            align-items: center;

            @media (max-width: 768px) {
                gap: 0.5rem;
            }

            .number {
                background-color: #1d1a17;
                display: flex;
                gap: 0.5rem;
                height: 35px;
                width: 35px;
                border-radius: 5px;
                justify-content: center;
                align-items: center;
                flex-shrink: 0;

                @media (max-width: 640px) {
                    height: 28px;
                    width: 28px;
                    font-size: 12px;
                }

                span {
                    margin-top: 2px;
                    margin-left: 1px;
                }
            }

            .thumbnail-container {
                position: relative;
                width: 140px;
                height: 79px;
                border-radius: 4px;
                overflow: hidden;
                flex-shrink: 0;

                @media (max-width: 768px) {
                    width: 110px;
                    height: 62px;
                }

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
                min-width: 0;

                .title-1 {
                    font-size: 14px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .title-2 {
                    font-size: 13px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .date {
                    font-size: 12px;
                    color: #999;
                }
            }

            .actions {
                display: flex;
                gap: 0.5rem;
                align-items: center;
                flex-shrink: 0;

                @media (max-width: 640px) {
                    gap: 0.25rem;
                }
            }
        }
    }

    .stream-action-group {
        position: relative;
        display: inline-flex;
        align-items: stretch;

        :global(button.style-normal:first-child) {
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
            border-right: none;
        }

        :global(button.dropdown-chevron-btn) {
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
            padding-left: 4px;
            padding-right: 4px;
            min-width: 22px;
            border-left: 1px solid hsl(36, 5.7%, 18%);

            &:hover:not(:disabled) {
                border-left-color: hsl(36, 5.7%, 26%);
            }

            &.active {
                border-left-color: #ffd52c;
            }

            :global(.button-spinner) {
                width: 0.85rem;
                height: 0.85rem;
                border-width: 1.5px;
            }
        }

        .selected-provider-label {
            font-size: 12px;
            color: #ffd52c;
            margin-left: 2px;
            max-width: 90px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;

            @media (max-width: 640px) {
                display: none;
            }
        }

        .services-dropdown {
            position: absolute;
            right: 0;
            top: calc(100% + 6px);
            z-index: 100;
            min-width: 210px;
            background: hsl(20, 17.6%, 11%);
            border: 1px solid hsl(36, 5.7%, 22%);
            border-radius: 7px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
            padding: 6px;
            display: flex;
            flex-direction: column;
            gap: 4px;

            .dropdown-header {
                padding: 4px 8px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: #857f78;
                border-bottom: 1px solid hsl(36, 5.7%, 18%);
                margin-bottom: 2px;
            }

            .dropdown-loading,
            .dropdown-empty {
                padding: 10px 8px;
                font-size: 12px;
                color: #999;
                text-align: center;
            }

            .dropdown-empty {
                color: #e57373;
            }

            .services-list {
                display: flex;
                flex-direction: column;
                gap: 2px;
                max-height: 200px;
                overflow-y: auto;
            }

            .service-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 6px 8px;
                background: transparent;
                border: 1px solid transparent;
                border-radius: 5px;
                color: #e8e4df;
                font-size: 13px;
                cursor: pointer;
                text-align: left;
                transition: background 0.15s, border-color 0.15s;

                &:hover {
                    background: hsl(20, 17.6%, 17%);
                    border-color: hsl(36, 5.7%, 26%);
                }

                &.selected {
                    background: hsl(44, 80%, 15%);
                    border-color: #ffd52c55;
                    color: #ffd52c;
                }

                .service-meta {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    overflow: hidden;

                    .provider-name {
                        font-weight: 500;
                    }

                    .server-name {
                        font-size: 12px;
                        color: #999;
                    }
                }

                .service-tags {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    flex-shrink: 0;
                }
            }
        }
    }

    .download-progress-text {
        font-size: 11px;
        margin-left: 2px;
        font-weight: 600;
        color: #ffd52c;
    }

    .confirm-delete-sheet {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 8px 4px;

        .sheet-title {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: #ffffff;
        }

        .sheet-desc {
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
            color: #b0aba4;

            strong {
                color: #ffffff;
            }
        }

        .sheet-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 8px;

            :global(button.btn-danger) {
                background: #dc2626 !important;
                border-color: #ef4444 !important;
                color: #ffffff !important;

                &:hover {
                    background: #b91c1c !important;
                }
            }
        }
    }
</style>
