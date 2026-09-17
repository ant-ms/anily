<script lang="ts">
    import { onMount } from "svelte";
    import { fade } from "svelte/transition";
    import { watch } from "runed";
    import Button from "../../lib/Button.svelte";
    import Skeleton from "../../lib/Skeleton.svelte";
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
        type AvailableService,
    } from "../../types/Media";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";
    import ClipboardIcon from "phosphor-svelte/lib/ClipboardIcon";
    import CheckIcon from "phosphor-svelte/lib/CheckIcon";
    import EyeIcon from "phosphor-svelte/lib/EyeIcon";
    import ImageIcon from "phosphor-svelte/lib/ImageIcon";
    import ThumbsUpIcon from "phosphor-svelte/lib/ThumbsUpIcon";
    import ThumbsDownIcon from "phosphor-svelte/lib/ThumbsDownIcon";
    import MinusIcon from "phosphor-svelte/lib/MinusIcon";
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
    let dropdownOpenEpisodeId: number | null = $state(null);
    let servicesCache: Record<number, AvailableService[]> = $state({});
    let selectedServices: Record<number, AvailableService> = $state({});
    let statusMessage: { episodeId: number; text: string; isError?: boolean } | null = $state(null);

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

    let currentRating: Rating = $state("NEUTRAL");
    let isUpdatingRating = $state(false);

    watch(
        () => [selectedAnimeAnilistId.current, updateSeed, animeDetails?.rating],
        () => {
            const anilistId = selectedAnimeAnilistId.current;
            if (anilistId === undefined) return;
            const detailsRating = animeDetails?.rating;
            if (detailsRating) {
                currentRating = detailsRating;
            } else {
                fetch(new URL(`/api/rate/${anilistId}`, apiBaseUrl.current).toString(), {
                    credentials: "include",
                })
                    .then((res) => (res.ok ? res.json() : null))
                    .then((data) => {
                        if (selectedAnimeAnilistId.current === anilistId && data?.rating) {
                            currentRating = data.rating;
                        }
                    })
                    .catch(() => {});
            }
        },
    );

    const setRating = async (targetRating: Rating) => {
        const anilistId = selectedAnimeAnilistId.current;
        if (anilistId === undefined || isUpdatingRating) return;

        const nextRating =
            currentRating === targetRating && targetRating !== "NEUTRAL"
                ? "NEUTRAL"
                : targetRating;

        const previousRating = currentRating;
        currentRating = nextRating;
        isUpdatingRating = true;

        try {
            const url = new URL(`/api/rate/${anilistId}`, apiBaseUrl.current);
            const res = await fetch(url.toString(), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
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
        } finally {
            isUpdatingRating = false;
        }
    };

    watch(
        () => [selectedAnimeAnilistId.current, updateSeed],
        () => {
            const anilistId = selectedAnimeAnilistId.current;
            if (anilistId === undefined) return;

            loading = true;
            dropdownOpenEpisodeId = null;
            statusMessage = null;

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

    // ── Streaming & provider resolution ──────────────────────────────────────

    function isHdService(service: AvailableService): boolean {
        return (
            /\b(hd|1080p|720p)\b/i.test(service.serverName) ||
            /\b(hd|1080p|720p)\b/i.test(service.providerName)
        );
    }

    function sortServicesWithHdFirst(services: AvailableService[]): AvailableService[] {
        return [...services].sort((a, b) => {
            const aHd = isHdService(a);
            const bHd = isHdService(b);
            if (aHd && !bHd) return -1;
            if (!aHd && bHd) return 1;
            return 0;
        });
    }

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
            statusMessage = { episodeId: episode.id, text: "Failed to check services", isError: true };
            return [];
        } finally {
            checkingEpisodeId = null;
        }
    }

    async function handlePlayButtonClick(episode: EpisodeData) {
        // Toggle the provider dropdown
        if (dropdownOpenEpisodeId === episode.id) {
            dropdownOpenEpisodeId = null;
            return;
        }

        const services = await checkServices(episode);
        dropdownOpenEpisodeId = episode.id;

        if (services.length === 0) {
            statusMessage = {
                episodeId: episode.id,
                text: "No streaming services available for this episode",
                isError: true,
            };
        }
    }

    async function playService(episode: EpisodeData, service: AvailableService) {
        selectedServices[episode.id] = service;
        dropdownOpenEpisodeId = null;
        resolvingEpisodeId = episode.id;
        statusMessage = null;

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

            const playerUrl = buildPlayerUrl(streamUrl, player);

            if (player === "copy" || player === "mpv") {
                await navigator.clipboard.writeText(playerUrl);
                statusMessage = {
                    episodeId: episode.id,
                    text: player === "mpv" ? "Stream URL copied! Run in mpv" : "Stream URL copied to clipboard!",
                };
                setTimeout(() => {
                    if (statusMessage?.episodeId === episode.id) statusMessage = null;
                }, 4000);
            } else {
                window.location.href = playerUrl;
            }
        } catch (err) {
            console.error("Failed to play service stream", err);
            statusMessage = {
                episodeId: episode.id,
                text: "Failed to load stream from provider",
                isError: true,
            };
        } finally {
            resolvingEpisodeId = null;
        }
    }

    function handleWindowClick(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (!target.closest(".stream-action-group")) {
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
                <div class="rating-segmented-group" role="radiogroup" aria-label="Season rating">
                    <button
                        type="button"
                        role="radio"
                        aria-checked={currentRating === "DISLIKE"}
                        class="segment-button"
                        class:active-dislike={currentRating === "DISLIKE"}
                        onclick={() => setRating("DISLIKE")}
                        disabled={isUpdatingRating}
                        title="Thumbs down"
                        aria-label="Thumbs down"
                    >
                        <ThumbsDownIcon size="1.25rem" weight={currentRating === "DISLIKE" ? "fill" : "regular"} />
                    </button>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={currentRating === "NEUTRAL"}
                        class="segment-button"
                        class:active-neutral={currentRating === "NEUTRAL"}
                        onclick={() => setRating("NEUTRAL")}
                        disabled={isUpdatingRating}
                        title="No rating yet"
                        aria-label="No rating yet"
                    >
                        <MinusIcon size="1.25rem" weight={currentRating === "NEUTRAL" ? "bold" : "regular"} />
                    </button>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={currentRating === "LIKE"}
                        class="segment-button"
                        class:active-like={currentRating === "LIKE"}
                        onclick={() => setRating("LIKE")}
                        disabled={isUpdatingRating}
                        title="Thumbs up"
                        aria-label="Thumbs up"
                    >
                        <ThumbsUpIcon size="1.25rem" weight={currentRating === "LIKE" ? "fill" : "regular"} />
                    </button>
                </div>
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
                    {#if statusMessage && statusMessage.episodeId === episode.id}
                        <span class="status-feedback" class:error={statusMessage.isError}>
                            {statusMessage.text}
                        </span>
                    {/if}
                </div>
                <div class="actions">
                    <Button
                        Icon={episode.watched ? CheckIcon : EyeIcon}
                        active={episode.watched}
                        disabled={isFuture(episode.airingAt)}
                        onclick={() => toggleWatch(episode)}
                    />

                    <!-- Stream via service dropdown action -->
                    <div class="stream-action-group">
                        <Button
                            Icon={player === "copy" ? ClipboardIcon : PlayIcon}
                            active={dropdownOpenEpisodeId === episode.id}
                            disabled={isFuture(episode.airingAt)}
                            loading={checkingEpisodeId === episode.id || resolvingEpisodeId === episode.id}
                            onclick={() => handlePlayButtonClick(episode)}
                            title={player === "copy" ? "Select streaming provider to copy URL" : "Select streaming provider"}
                        >
                            {#if selectedServices[episode.id]}
                                <span class="selected-provider-label">
                                    {selectedServices[episode.id].providerName}
                                </span>
                            {/if}
                        </Button>

                        {#if dropdownOpenEpisodeId === episode.id}
                            <div class="services-dropdown" transition:fade={{ duration: 120 }}>
                                <div class="dropdown-header">
                                    <span>Stream Provider</span>
                                </div>
                                {#if checkingEpisodeId === episode.id}
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
                                                        <span class="hd-tag">HD</span>
                                                    {/if}
                                                    <span class="lang-tag {service.language}">
                                                        {service.language.toUpperCase()}
                                                    </span>
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

            .rating-segmented-group {
                display: inline-flex;
                align-items: center;
                background: hsl(20, 17.6%, 8.5%);
                border: 1px solid hsl(36, 5.7%, 20%);
                border-radius: 6px;
                overflow: hidden;
                flex-shrink: 0;

                .segment-button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    padding: 6px 10px;
                    background: transparent;
                    border: none;
                    border-right: 1px solid hsl(36, 5.7%, 20%);
                    color: #a8a29e;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition:
                        background 0.15s ease,
                        color 0.15s ease,
                        border-color 0.15s ease;
                    white-space: nowrap;
                    user-select: none;
                    line-height: 1;

                    @media (max-width: 640px) {
                        padding: 6px 8px;
                    }

                    &:last-child {
                        border-right: none;
                    }

                    &:hover:not(:disabled) {
                        background: hsl(20, 17.6%, 14%);
                        color: #e8e4df;
                    }

                    &:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }

                    &.active-like {
                        background: #ffd52c18;
                        color: #ffd52c;
                        font-weight: 600;
                    }

                    &.active-dislike {
                        background: rgba(229, 115, 115, 0.16);
                        color: #e57373;
                        font-weight: 600;
                    }

                    &.active-neutral {
                        background: hsl(20, 17.6%, 16%);
                        color: #e8e4df;
                        font-weight: 600;
                    }
                }
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

                .status-feedback {
                    font-size: 12px;
                    color: #ffd52c;
                    margin-top: 2px;

                    &.error {
                        color: #e57373;
                    }
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
        align-items: center;

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

                .hd-tag {
                    font-size: 9px;
                    font-weight: 700;
                    padding: 1px 4px;
                    border-radius: 3px;
                    background: hsl(44, 80%, 18%);
                    color: #ffd52c;
                    border: 1px solid #ffd52c55;
                    letter-spacing: 0.03em;
                }

                .lang-tag {
                    font-size: 10px;
                    font-weight: 700;
                    padding: 2px 5px;
                    border-radius: 4px;
                    text-transform: uppercase;
                    flex-shrink: 0;

                    &.sub {
                        background: #1b3d54;
                        color: #79c0ff;
                    }

                    &.dub {
                        background: #3e2723;
                        color: #ffb74d;
                    }
                }
            }
        }
    }
</style>
