<script lang="ts">
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import Button from '../../lib/Button.svelte';
    import Skeleton from '../../lib/Skeleton.svelte';
    import SegmentedControl from '../../lib/SegmentedControl.svelte';
    import EpisodeCard from './EpisodeCard.svelte';
    import DeleteConfirmSheet from './DeleteConfirmSheet.svelte';
    import { selectedAnimeAnilistId, sidebarDataRefreshSeed } from '../../lib/context.svelte';
    import { snackbar } from '../../lib/snackbar.svelte';
    import { EpisodesState } from './useEpisodes.svelte';
    import {
        getStoredPlayer,
        getStoredLanguagePreference,
        buildPlayerUrl,
        sortServicesWithHdFirst,
        type MediaPlayer,
        type AvailableService,
    } from '../../types/Media';
    import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
    import EyeIcon from 'phosphor-svelte/lib/EyeIcon';
    import ThumbsUpIcon from 'phosphor-svelte/lib/ThumbsUpIcon';
    import ThumbsDownIcon from 'phosphor-svelte/lib/ThumbsDownIcon';
    import MinusIcon from 'phosphor-svelte/lib/MinusIcon';
    import { AnilyNative, isNative } from '../../lib/native/anilyNative';
    import { syncQueue } from '../../lib/sync/syncQueue.svelte';
    import { downloadManager } from '../../lib/download/downloadManager.svelte';
    import { networkState } from '../../lib/network.svelte';
    import { apiBaseUrl } from '../../lib/context.svelte';
    import type AnimeDetailsData from '../../types/AnimeDetails';
    import type { Rating } from '../../types/AnimeDetails';
    import type EpisodeData from '../../types/Episode';

    let {
        updateSeed,
        animeName = '',
        animeDetails = undefined,
    }: {
        updateSeed: number;
        animeName?: string;
        animeDetails?: AnimeDetailsData;
    } = $props();

    // ── Episode data ────────────────────────────────────────────────────────────

    const episodesState = new EpisodesState(() => updateSeed);

    const isFuture = (airingAt: string | null): boolean => {
        if (!airingAt) return true;
        return new Date(airingAt).getTime() > Date.now();
    };

    const releasedEpisodes = $derived(episodesState.episodes.filter((e) => !isFuture(e.airingAt)));
    const allReleasedWatched = $derived(
        releasedEpisodes.length > 0 && releasedEpisodes.every((e) => e.watched),
    );

    // ── Player preference ────────────────────────────────────────────────────────

    let player: MediaPlayer = $state(getStoredPlayer());

    onMount(() => {
        const updatePlayer = () => { player = getStoredPlayer(); };
        window.addEventListener('focus', updatePlayer);
        window.addEventListener('storage', updatePlayer);
        return () => {
            window.removeEventListener('focus', updatePlayer);
            window.removeEventListener('storage', updatePlayer);
        };
    });

    // ── Watch status ─────────────────────────────────────────────────────────────

    import { api } from '../../lib/api';

    const toggleWatch = async (episode: EpisodeData): Promise<void> => {
        const newStatus = !episode.watched;
        episode.watched = newStatus;
        await syncQueue.recordWatchStatus(episode.id, newStatus);
    };

    const toggleAllWatch = async (): Promise<void> => {
        const anilistId = selectedAnimeAnilistId.current;
        if (anilistId === undefined) return;

        const newStatus = !allReleasedWatched;
        for (const episode of episodesState.episodes) {
            if (!isFuture(episode.airingAt)) {
                episode.watched = newStatus;
            }
        }

        try {
            await api.setAllEpisodesWatch(anilistId, newStatus);
            sidebarDataRefreshSeed.set((sidebarDataRefreshSeed.current ?? 0) + 1);
        } catch {
            for (const episode of episodesState.episodes) {
                if (!isFuture(episode.airingAt)) {
                    await syncQueue.recordWatchStatus(episode.id, newStatus);
                }
            }
        }
    };

    // ── Rating ───────────────────────────────────────────────────────────────────

    let currentRating: Rating = $state('NEUTRAL');
    let isUpdatingRating = $state(false);

    $effect(() => {
        if (animeDetails?.rating) {
            currentRating = animeDetails.rating;
        }
    });

    const setRating = async (nextRating: Rating): Promise<void> => {
        if (isUpdatingRating || currentRating === nextRating) return;
        const anilistId = selectedAnimeAnilistId.current;
        if (anilistId === undefined) return;

        const previousRating = currentRating;
        currentRating = nextRating;
        isUpdatingRating = true;

        try {
            await api.setRating(anilistId, nextRating);
            if (animeDetails) animeDetails.rating = nextRating;
        } catch (err) {
            console.error('Failed to update rating:', err);
            currentRating = previousRating;
            snackbar.error('Failed to update rating');
        } finally {
            isUpdatingRating = false;
        }
    };

    // ── Streaming & provider resolution ──────────────────────────────────────────

    let checkingEpisodeId: number | null = $state(null);
    let resolvingEpisodeId: number | null = $state(null);
    let autoPlayingEpisodeId: number | null = $state(null);
    let dropdownOpenEpisodeId: number | null = $state(null);
    let servicesCache: Record<number, AvailableService[]> = $state({});
    let selectedServices: Record<number, AvailableService> = $state({});

    const fetchServices = async (episode: EpisodeData): Promise<AvailableService[]> => {
        if (servicesCache[episode.id]) return servicesCache[episode.id];

        checkingEpisodeId = episode.id;
        try {
            const url = new URL(`/api/stream/services/${episode.id}`, apiBaseUrl.current);
            const res = await fetch(url.toString(), { credentials: 'include' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const rawServices: AvailableService[] = Array.isArray(data.services) ? data.services : [];
            const services = sortServicesWithHdFirst(rawServices);
            servicesCache[episode.id] = services;
            return services;
        } catch (err) {
            console.error('Failed to check streaming services', err);
            snackbar.error('Failed to check streaming services');
            return [];
        } finally {
            checkingEpisodeId = null;
        }
    };

    const resolveAndPlay = async (episode: EpisodeData, service: AvailableService, showError = true): Promise<boolean> => {
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
            const res = await fetch(url.toString(), { credentials: 'include' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json() as {
                streamUrl?: string;
                container?: 'hls' | 'mp4';
                serverName?: string;
                subtitles?: Array<{ label: string; language?: string; url: string; default?: boolean }>;
            };
            if (!data.streamUrl) throw new Error('No stream URL returned');

            const bestSub = data.subtitles?.find((s) => s.default) ||
                data.subtitles?.find((s) => s.language === 'en' || s.language === 'eng') ||
                data.subtitles?.[0];

            if (isNative) {
                await AnilyNative.openExternalPlayer({
                    url: data.streamUrl,
                    mimeType: data.container === 'hls' ? 'application/x-mpegURL' : 'video/*',
                    subtitleUrl: bestSub?.url,
                    subtitleTitle: bestSub?.label ?? 'English',
                });
            } else {
                const playerUrl = buildPlayerUrl(data.streamUrl, player, data.subtitles?.length ? data.subtitles : bestSub?.url);
                if (player === 'copy' || player === 'mpv') {
                    await navigator.clipboard.writeText(playerUrl);
                    snackbar.success(player === 'mpv' ? 'mpv command copied to clipboard!' : 'Stream URL copied to clipboard!');
                } else {
                    window.location.href = playerUrl;
                }
            }
            return true;
        } catch (err) {
            console.error('Failed to play service stream', err);
            if (showError) snackbar.error('Failed to load stream from provider');
            return false;
        } finally {
            resolvingEpisodeId = null;
        }
    };

    const handlePlay = async (episode: EpisodeData): Promise<void> => {
        if (dropdownOpenEpisodeId === episode.id) dropdownOpenEpisodeId = null;

        if (isNative && downloadManager.states[episode.id]?.status === 'completed') {
            await downloadManager.playOffline(episode.id, episode.number);
            return;
        }

        autoPlayingEpisodeId = episode.id;

        try {
            const services = await fetchServices(episode);
            if (services.length === 0) {
                snackbar.error('No streaming services available for this episode');
                return;
            }

            const preferredLang = getStoredLanguagePreference();
            const queue = [
                ...sortServicesWithHdFirst(services.filter((s) => s.language === preferredLang)),
                ...sortServicesWithHdFirst(services.filter((s) => s.language !== preferredLang)),
            ];

            if (queue.length === 0) {
                snackbar.error('No suitable stream found for this episode');
                return;
            }

            let played = false;
            for (const candidate of queue) {
                const success = await resolveAndPlay(episode, candidate, false);
                if (success) { played = true; break; }
                console.warn(`Streaming server ${candidate.providerName} (${candidate.serverName}) failed, trying next candidate...`);
            }

            if (!played) snackbar.error('Failed to load stream from any available server');
        } finally {
            autoPlayingEpisodeId = null;
        }
    };

    const handleToggleDropdown = async (episode: EpisodeData): Promise<void> => {
        if (dropdownOpenEpisodeId === episode.id) {
            dropdownOpenEpisodeId = null;
            return;
        }

        dropdownOpenEpisodeId = episode.id;
        if (!servicesCache[episode.id]) {
            const services = await fetchServices(episode);
            if (services.length === 0) snackbar.error('No streaming services available for this episode');
        }
    };

    const closeDropdownOnOutsideClick = (e: MouseEvent): void => {
        const clickedInsideDropdown = e.composedPath().some(
            (node) => node instanceof HTMLElement && node.closest?.('.stream-action-group'),
        );
        if (!clickedInsideDropdown) dropdownOpenEpisodeId = null;
    };

    // ── Offline delete ───────────────────────────────────────────────────────────

    let isConfirmDeleteOpen = $state(false);
    let episodeToDelete: EpisodeData | null = $state(null);

    const promptDeleteDownload = (episode: EpisodeData): void => {
        if (!networkState.isOnline) {
            episodeToDelete = episode;
            isConfirmDeleteOpen = true;
        } else {
            downloadManager.deleteDownload(episode.id, episode.number, selectedAnimeAnilistId.current);
        }
    };

    const confirmDelete = (): void => {
        if (episodeToDelete) {
            downloadManager.deleteDownload(
                episodeToDelete.id,
                episodeToDelete.number,
                selectedAnimeAnilistId.current,
            );
            episodeToDelete = null;
        }
        isConfirmDeleteOpen = false;
    };

    const cancelDelete = (): void => {
        isConfirmDeleteOpen = false;
        episodeToDelete = null;
    };
</script>

<svelte:window onclick={closeDropdownOnOutsideClick} />

<div class="episodes">
    {#if episodesState.loading}
        <div class="episodes-list">
            {#each Array(8) as _}
                <div class="episode-card-skeleton">
                    <div class="thumb-skeleton">
                        <Skeleton width="100%" height="100%" radius="8px" />
                    </div>
                    <div class="skeleton-content">
                        <div class="titles">
                            <Skeleton width="80%" height="14px" />
                            <Skeleton width="55%" height="12px" />
                            <Skeleton width="35%" height="11px" />
                        </div>
                        <div class="actions-skeleton">
                            <Skeleton width="36px" height="36px" radius="50%" />
                            <Skeleton width="36px" height="36px" radius="50%" />
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        {#if episodesState.episodes.length > 0 || !episodesState.loading}
            <div class="toolbar" transition:fade={{ duration: 200 }}>
                {#if episodesState.episodes.length > 0}
                    <Button
                        Icon={allReleasedWatched ? CheckIcon : EyeIcon}
                        active={allReleasedWatched}
                        disabled={releasedEpisodes.length === 0}
                        onclick={toggleAllWatch}
                        title={allReleasedWatched
                            ? 'Mark all released episodes as unplayed'
                            : 'Mark all released episodes as played'}
                    >
                        <span class="mark-all-text">
                            {allReleasedWatched ? 'Mark all as unplayed' : 'Mark all as played'}
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
                        { value: 'DISLIKE', title: 'Thumbs down', Icon: ThumbsDownIcon, activeIconWeight: 'fill', activeColor: 'dislike' },
                        { value: 'NEUTRAL', title: 'No rating yet', Icon: MinusIcon, iconWeight: 'bold', activeIconWeight: 'bold', activeColor: 'neutral' },
                        { value: 'LIKE', title: 'Thumbs up', Icon: ThumbsUpIcon, activeIconWeight: 'fill', activeColor: 'like' },
                    ]}
                />
            </div>
        {/if}

        <div class="episodes-list">
            {#each episodesState.episodes as episode (episode.number)}
                <EpisodeCard
                    {episode}
                    {player}
                    {animeName}
                    isDropdownOpen={dropdownOpenEpisodeId === episode.id}
                    {servicesCache}
                    selectedService={selectedServices[episode.id]}
                    {checkingEpisodeId}
                    {autoPlayingEpisodeId}
                    {resolvingEpisodeId}
                    onToggleWatch={toggleWatch}
                    onPromptDelete={promptDeleteDownload}
                    onToggleDropdown={handleToggleDropdown}
                    onPlayService={resolveAndPlay}
                    onPlay={handlePlay}
                />
            {/each}
        </div>
    {/if}
</div>

<DeleteConfirmSheet
    bind:isOpen={isConfirmDeleteOpen}
    episode={episodeToDelete}
    onConfirm={confirmDelete}
    onCancel={cancelDelete}
/>

<style lang="scss">
    .episodes {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        overflow-y: auto;
        padding: 0.85rem 1.25rem;
        flex: 1 1 0;
        min-height: 0;
        width: 100%;
        box-sizing: border-box;
        container-type: inline-size;
        container-name: episodes-pane;

        @media (max-width: 768px) {
            padding: 0.5rem 0.85rem;
            gap: 0.5rem;
        }

        .toolbar {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            flex-shrink: 0;
            margin-bottom: 0.25rem;

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

        .episodes-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem; /* M3 whitespace separation between list items */

            @container episodes-pane (min-width: 540px) {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                gap: 1rem;
                align-items: stretch;
            }
        }

        .episode-card-skeleton {
            display: flex;
            gap: 0.85rem;
            align-items: center;
            padding: 0.5rem 0.35rem;
            border-radius: 10px;

            @media (max-width: 640px) {
                gap: 0.65rem;
                padding: 0.45rem 0.2rem;
            }

            .thumb-skeleton {
                width: 114px;
                aspect-ratio: 16 / 9;
                height: auto;
                flex-shrink: 0;
                border-radius: 8px;
                overflow: hidden;

                @media (max-width: 480px) {
                    width: 104px;
                }
            }

            .skeleton-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex: 1;
                min-width: 0;
                gap: 0.5rem;

                .titles {
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                    flex: 1;
                    min-width: 0;
                }

                .actions-skeleton {
                    display: flex;
                    gap: 4px;
                    flex-shrink: 0;
                }
            }

            @container episodes-pane (min-width: 540px) {
                flex-direction: column;
                align-items: stretch;
                background: #1c1917;
                border: 1px solid #36322e;
                border-radius: 12px;
                padding: 0;
                gap: 0;
                overflow: hidden;

                .thumb-skeleton {
                    width: 100%;
                    height: auto;
                    aspect-ratio: 16 / 9;
                    border-radius: 0;
                }

                .skeleton-content {
                    flex-direction: column;
                    align-items: stretch;
                    padding: 12px 14px 12px 14px;
                    gap: 8px;

                    .titles {
                        gap: 0.4rem;
                    }

                    .actions-skeleton {
                        justify-content: flex-end;
                        padding-top: 4px;
                        border-top: none;
                    }
                }
            }
        }
    }
</style>
