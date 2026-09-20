<script lang="ts">
    import { fade } from 'svelte/transition';
    import Button from '../../lib/Button.svelte';
    import Skeleton from '../../lib/Skeleton.svelte';
    import Tag from '../../lib/Tag.svelte';
    import StreamingDropdown from './StreamingDropdown.svelte';
    import { selectedAnimeAnilistId } from '../../lib/context.svelte';
    import { downloadManager } from '../../lib/download/downloadManager.svelte';
    import { networkState } from '../../lib/network.svelte';
    import {
        type AvailableService,
        type MediaPlayer,
        type StreamLanguagePreference,
        buildPlayerUrl,
        getStoredLanguagePreference,
        sortServicesWithHdFirst,
    } from '../../types/Media';
    import { AnilyNative, isNative } from '../../lib/native/anilyNative';
    import { snackbar } from '../../lib/snackbar.svelte';
    import { apiBaseUrl } from '../../lib/context.svelte';
    import type EpisodeData from '../../types/Episode';
    import PlayIcon from 'phosphor-svelte/lib/PlayIcon';
    import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
    import ClipboardIcon from 'phosphor-svelte/lib/ClipboardIcon';
    import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
    import EyeIcon from 'phosphor-svelte/lib/EyeIcon';
    import ImageIcon from 'phosphor-svelte/lib/ImageIcon';
    import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
    import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
    import XIcon from 'phosphor-svelte/lib/XIcon';

    let {
        episode,
        player,
        animeName,
        isDropdownOpen = $bindable(false),
        servicesCache,
        selectedService,
        checkingEpisodeId,
        autoPlayingEpisodeId,
        resolvingEpisodeId,
        onToggleWatch,
        onPromptDelete,
        onToggleDropdown,
        onPlayService,
        onPlay,
    }: {
        episode: EpisodeData;
        player: MediaPlayer;
        animeName: string;
        isDropdownOpen: boolean;
        servicesCache: Record<number, AvailableService[]>;
        selectedService?: AvailableService;
        checkingEpisodeId: number | null;
        autoPlayingEpisodeId: number | null;
        resolvingEpisodeId: number | null;
        onToggleWatch: (episode: EpisodeData) => void;
        onPromptDelete: (episode: EpisodeData) => void;
        onToggleDropdown: (episode: EpisodeData) => void;
        onPlayService: (episode: EpisodeData, service: AvailableService) => void;
        onPlay: (episode: EpisodeData) => void;
    } = $props();

    const isFuture = (airingAt: string | null): boolean => {
        if (!airingAt) return true;
        return new Date(airingAt).getTime() > Date.now();
    };

    const formatAiringDate = (airingAt: string | null): string => {
        if (!airingAt) return 'TBA';
        return new Date(airingAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatDownloadBytes = (bytes: number): string => {
        if (!bytes || bytes <= 0) return '...';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    };

    const isAutoPlaying = $derived(autoPlayingEpisodeId === episode.id);
    const isResolving = $derived(resolvingEpisodeId === episode.id);
    const isChecking = $derived(checkingEpisodeId === episode.id);
    const dlState = $derived(downloadManager.states[episode.id]);
    const episodeFuture = $derived(isFuture(episode.airingAt));

    let rawTitles = $derived([
        episode.titleNative,
        episode.titleEnglish,
        episode.titleRomanji,
    ]);
    let titles = $derived(
        [...new Set(rawTitles.filter((t): t is string => Boolean(t && t.trim())))],
    );
</script>

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
                onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
            />
        {/if}
    </div>

    <div class="titles">
        <span class="title-1">{titles[0] ?? `Episode ${episode.number}`}</span>
        <span class="title-2">{titles[1] ?? ''}</span>
        <span class="date">{formatAiringDate(episode.airingAt)}</span>
    </div>

    <div class="actions">
        <Button
            Icon={episode.watched ? CheckIcon : EyeIcon}
            active={episode.watched}
            disabled={episodeFuture}
            onclick={() => onToggleWatch(episode)}
        />

        <!-- Offline download action -->
        {#if isNative && !episodeFuture}
            {#if dlState?.status === 'completed'}
                <Button
                    Icon={CheckCircleIcon}
                    active={true}
                    title="Downloaded offline. Click to delete"
                    onclick={() => onPromptDelete(episode)}
                />
            {:else if dlState?.status === 'downloading'}
                <Button
                    Icon={XIcon}
                    title={dlState.progress > 0
                        ? `Downloading: ${dlState.progress}% (click to cancel)`
                        : `Downloading... (click to cancel)`}
                    onclick={() => downloadManager.cancelDownload(episode.id)}
                >
                    <span class="download-progress-text">
                        {dlState.progress > 0
                            ? `${dlState.progress}%`
                            : dlState.bytesDownloaded > 0
                              ? `${Math.round(dlState.bytesDownloaded / 1024 / 1024)}MB`
                              : '...'}
                    </span>
                </Button>
            {:else}
                <Button
                    Icon={DownloadSimpleIcon}
                    title="Download episode for offline viewing"
                    onclick={() =>
                        downloadManager.startDownload(
                            episode.id,
                            episode.number,
                            animeName,
                            getStoredLanguagePreference(),
                            selectedAnimeAnilistId.current,
                            selectedService,
                            episode.thumbnailUrl ?? undefined,
                        )}
                />
            {/if}
        {/if}

        <!-- Stream via service split-button -->
        <div class="stream-action-group">
            <Button
                Icon={player === 'copy' ? ClipboardIcon : PlayIcon}
                disabled={episodeFuture}
                loading={isAutoPlaying || (isResolving && !isDropdownOpen)}
                onclick={() => onPlay(episode)}
                title={player === 'copy' ? 'Copy stream URL' : 'Play episode'}
            >
                {#if selectedService}
                    <span class="selected-provider-label">{selectedService.providerName}</span>
                {/if}
            </Button>

            <Button
                Icon={CaretDownIcon}
                iconSize="0.85rem"
                class="dropdown-chevron-btn"
                active={isDropdownOpen}
                disabled={episodeFuture}
                loading={isChecking && !isAutoPlaying}
                onclick={(e: MouseEvent) => {
                    e.stopPropagation();
                    onToggleDropdown(episode);
                }}
                title="Select streaming provider"
            />

            {#if isDropdownOpen}
                <StreamingDropdown
                    episodeId={episode.id}
                    isChecking={isChecking && !isAutoPlaying}
                    services={servicesCache[episode.id] ?? []}
                    {selectedService}
                    onSelect={(service) => onPlayService(episode, service)}
                />
            {/if}
        </div>
    </div>
</div>

<style lang="scss">
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
    }

    .download-progress-text {
        font-size: 11px;
        margin-left: 2px;
        font-weight: 600;
        color: #ffd52c;
    }
</style>
