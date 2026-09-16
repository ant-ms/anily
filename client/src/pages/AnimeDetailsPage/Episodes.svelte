<script lang="ts">
    import { fade } from "svelte/transition";
    import { watch } from "runed";
    import Button from "../../lib/Button.svelte";
    import Skeleton from "../../lib/Skeleton.svelte";
    import {
        apiBaseUrl,
        selectedAnimeAnilistId,
        sidebarDataRefreshSeed,
        isSeasonsSidebarOpen,
    } from "../../lib/context.svelte";
    import type EpisodeData from "../../types/Episode";
    import {
        getStoredPlayer,
        buildPlayerUrl,
        type MediaPlayer,
        type AvailableService,
    } from "../../types/Media";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";
    import CheckIcon from "phosphor-svelte/lib/CheckIcon";
    import EyeIcon from "phosphor-svelte/lib/EyeIcon";
    import ImageIcon from "phosphor-svelte/lib/ImageIcon";
    import CaretDownIcon from "phosphor-svelte/lib/CaretDownIcon";
    import TreeStructureIcon from "phosphor-svelte/lib/TreeStructureIcon";

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

    let player: MediaPlayer = $state(getStoredPlayer());

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
            const services: AvailableService[] = Array.isArray(data.services) ? data.services : [];
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
        // If the dropdown is already open for this episode, toggle it closed
        if (dropdownOpenEpisodeId === episode.id) {
            dropdownOpenEpisodeId = null;
            return;
        }

        // If a service was already picked for this episode, play directly
        if (selectedServices[episode.id]) {
            await playService(episode, selectedServices[episode.id]);
            return;
        }

        // Check which services have this episode
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

    async function toggleDropdown(episode: EpisodeData, e: MouseEvent) {
        e.stopPropagation();
        if (dropdownOpenEpisodeId === episode.id) {
            dropdownOpenEpisodeId = null;
            return;
        }

        await checkServices(episode);
        dropdownOpenEpisodeId = episode.id;
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
        <div class="toolbar" transition:fade={{ duration: 200 }}>
            <Button
                Icon={TreeStructureIcon}
                active={isSeasonsSidebarOpen.current}
                style="ghost"
                onclick={() =>
                    isSeasonsSidebarOpen.set(!isSeasonsSidebarOpen.current)}
            >
                <span class="seasons-btn-label">Seasons</span>
            </Button>
            <div class="spacer"></div>
            {#if episodes.length > 0}
                <Button
                    Icon={allReleasedWatched ? CheckIcon : EyeIcon}
                    active={allReleasedWatched}
                    style="ghost"
                    onclick={toggleAllWatch}
                />
            {/if}
        </div>
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

                    <!-- Stream via service split / dropdown action -->
                    <div class="stream-action-group">
                        <div class="stream-btn-wrapper">
                            <Button
                                Icon={PlayIcon}
                                disabled={isFuture(episode.airingAt)}
                                loading={checkingEpisodeId === episode.id || resolvingEpisodeId === episode.id}
                                onclick={() => handlePlayButtonClick(episode)}
                            >
                                {#if selectedServices[episode.id]}
                                    <span class="selected-provider-label">
                                        {selectedServices[episode.id].providerName}
                                    </span>
                                {/if}
                            </Button>
                            <button
                                type="button"
                                class="dropdown-trigger"
                                disabled={isFuture(episode.airingAt) || checkingEpisodeId === episode.id}
                                onclick={(e) => toggleDropdown(episode, e)}
                                title="Select streaming provider"
                            >
                                <CaretDownIcon size="0.85rem" />
                            </button>
                        </div>

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
                                                <span class="lang-tag {service.language}">
                                                    {service.language.toUpperCase()}
                                                </span>
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

            .seasons-btn-label {
                font-size: 13px;
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

        .stream-btn-wrapper {
            display: flex;
            align-items: center;
            background: hsl(20, 17.6%, 8.5%);
            border: 1px solid hsl(36, 5.7%, 20%);
            border-radius: 6px;
            overflow: hidden;

            :global(button.style-normal) {
                border: none;
                border-radius: 0;
                background: transparent;
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

            .dropdown-trigger {
                background: transparent;
                border: none;
                border-left: 1px solid hsl(36, 5.7%, 18%);
                color: #bbb;
                padding: 7px 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s, color 0.15s;

                &:hover:not(:disabled) {
                    background: hsl(20, 17.6%, 16%);
                    color: #ffd52c;
                }

                &:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }
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
