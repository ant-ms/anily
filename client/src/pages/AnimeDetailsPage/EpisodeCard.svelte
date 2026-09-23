<script lang="ts">
    import { fade } from 'svelte/transition';
    import Button from '../../lib/Button.svelte';
    import IconButton from '../../lib/IconButton.svelte';
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
    import DotsThreeVerticalIcon from 'phosphor-svelte/lib/DotsThreeVerticalIcon';

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

<div
    class="episode-card"
    class:dropdown-open={isDropdownOpen}
    class:is-future={episodeFuture}
    transition:fade={{ duration: 200 }}
>
    <!-- ── Leading Slot: 16:9 Media with Standard M3 Scrim Badge ───────── -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
        class="thumbnail-container"
        class:clickable={!episodeFuture}
        role={!episodeFuture ? 'button' : undefined}
        tabindex={!episodeFuture ? 0 : undefined}
        aria-label={!episodeFuture ? `Play episode ${episode.number}` : undefined}
        onclick={() => {
            if (!episodeFuture) onPlay(episode);
        }}
        onkeydown={(e) => {
            if (!episodeFuture && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onPlay(episode);
            }
        }}
    >
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
        <div class="episode-badge">
            <span>EP {episode.number}</span>
        </div>
        {#if !episodeFuture}
            <div
                class="thumb-play-overlay"
                class:is-loading={isAutoPlaying || (isResolving && !isDropdownOpen)}
            >
                <div class="play-icon-circle">
                    {#if isAutoPlaying || (isResolving && !isDropdownOpen)}
                        <span class="icon-spinner"></span>
                    {:else if player === 'copy'}
                        <ClipboardIcon size="1.2rem" />
                    {:else}
                        <PlayIcon size="1.2rem" weight="fill" />
                    {/if}
                </div>
            </div>
        {/if}
    </div>

    <!-- ── Content Area & Trailing Actions ─────────────────────────────── -->
    <div class="card-content">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="titles"
            class:clickable={!episodeFuture}
            onclick={() => {
                if (!episodeFuture) onPlay(episode);
            }}
        >
            <span class="title-1" title={titles[0] ?? `Episode ${episode.number}`}>
                {titles[0] ?? `Episode ${episode.number}`}
            </span>
            {#if titles[1]}
                <span class="title-2" title={titles[1]}>
                    {titles[1]}
                </span>
            {/if}
            <span class="date">{formatAiringDate(episode.airingAt)}</span>
        </div>

        <div class="actions">
            <IconButton
                Icon={episode.watched ? CheckIcon : EyeIcon}
                active={episode.watched}
                disabled={episodeFuture}
                variant="standard"
                shape="circle"
                size="standard"
                onclick={() => onToggleWatch(episode)}
                title={episode.watched ? 'Mark as unplayed' : 'Mark as played'}
                ariaLabel={episode.watched ? 'Mark as unplayed' : 'Mark as played'}
            />

            <!-- Offline download action -->
            {#if isNative && !episodeFuture}
                {#if dlState?.status === 'completed'}
                    <IconButton
                        Icon={CheckCircleIcon}
                        active={true}
                        variant="standard"
                        shape="circle"
                        size="standard"
                        title="Downloaded offline. Click to delete"
                        ariaLabel="Downloaded offline. Click to delete"
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
                    <IconButton
                        Icon={DownloadSimpleIcon}
                        variant="standard"
                        shape="circle"
                        size="standard"
                        title="Download episode for offline viewing"
                        ariaLabel="Download episode for offline viewing"
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

            <!-- M3 MoreVert Overflow Menu -->
            <div class="more-menu-container">
                <IconButton
                    Icon={DotsThreeVerticalIcon}
                    variant="standard"
                    shape="circle"
                    size="standard"
                    active={isDropdownOpen}
                    disabled={episodeFuture}
                    loading={isChecking && !isAutoPlaying}
                    onclick={(e: MouseEvent) => {
                        e.stopPropagation();
                        onToggleDropdown(episode);
                    }}
                    title="Streaming options"
                    ariaLabel="Streaming options"
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
</div>

<style lang="scss">
    /* ── Mobile Layout: M3 List Item (Default / < 540px) ───────────────── */
    .episode-card {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.85rem;
        position: relative;
        padding: 0.5rem 0.35rem;
        background: transparent;
        border: none;
        border-radius: 10px;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        transition: background 0.15s ease;

        &.is-future {
            opacity: 0.65;
        }

        &.dropdown-open {
            z-index: 50;
        }

        @media (max-width: 640px) {
            gap: 0.65rem;
            padding: 0.45rem 0.2rem;
        }

        @media (hover: hover) and (pointer: fine) {
            &:hover {
                background: rgba(255, 255, 255, 0.03);
            }
        }

        &:active {
            background: rgba(255, 255, 255, 0.06);
        }

        .thumbnail-container {
            position: relative;
            width: 114px;
            aspect-ratio: 16 / 9;
            height: auto;
            border-radius: 8px; /* M3 corner-small */
            overflow: hidden;
            flex-shrink: 0;

            &.clickable {
                cursor: pointer;
            }

            @media (max-width: 480px) {
                width: 104px;
            }

            .placeholder {
                position: absolute;
                inset: 0;
                background-color: #1c1917;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .episode-thumbnail {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.2s ease;
            }

            .episode-badge {
                position: absolute;
                bottom: 5px;
                left: 5px;
                z-index: 2;
                background: rgba(0, 0, 0, 0.78);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                color: #ffffff;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.03em;
                padding: 1.5px 5px;
                border-radius: 4px;
                line-height: 1.2;
                pointer-events: none;
            }

            .thumb-play-overlay {
                display: none;
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.55);
                align-items: center;
                justify-content: center;
                transition: opacity 0.2s ease;

                .play-icon-circle {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: rgba(28, 25, 23, 0.95);
                    color: #ffd52c;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
                }

                &.is-loading {
                    display: flex;
                    opacity: 1;
                }
            }
        }

        .card-content {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            flex: 1;
            min-width: 0;
            gap: 0.5rem;

            .titles {
                display: flex;
                flex-direction: column;
                gap: 0.15rem;
                flex: 1;
                min-width: 0;
                user-select: none;
                -webkit-user-select: none;
                -webkit-tap-highlight-color: transparent;

                &.clickable {
                    cursor: pointer;

                    &:active {
                        opacity: 0.75;
                    }
                }

                .title-1 {
                    font-size: 13.5px;
                    font-weight: 600;
                    line-height: 1.3;
                    color: #f5efe9; /* M3 on-surface (15:1 contrast) */
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    transition: color 0.15s ease;
                }

                &:hover .title-1 {
                    color: #ffd52c;
                }

                .title-2 {
                    font-size: 12px;
                    color: #d4ccc5; /* M3 on-surface-variant (11.5:1 contrast) */
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .date {
                    font-size: 11px;
                    color: #b0a8a0; /* High-contrast tertiary metadata */
                }
            }

            .actions {
                display: flex;
                align-items: center;
                gap: 2px;
                flex-shrink: 0;

                .more-menu-container {
                    position: relative;
                    display: inline-flex;
                }
            }
        }

        /* ── Desktop Layout: M3 Media Card Grid (@container >= 540px) ───── */
        @container episodes-pane (min-width: 540px) {
            flex-direction: column;
            align-items: stretch;
            gap: 0;
            padding: 0;
            background: #1c1917; /* M3 surface-container-low */
            border: 1px solid #36322e; /* M3 outline-variant */
            border-radius: 12px; /* M3 shape.corner.medium */
            overflow: visible;
            transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;

            @media (hover: hover) and (pointer: fine) {
                &:hover {
                    background: #24201d; /* M3 surface-container */
                    border-color: #4e4842;
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
                    z-index: 2;

                    .thumbnail-container.clickable .episode-thumbnail {
                        transform: scale(1.03);
                    }

                    .thumbnail-container.clickable .thumb-play-overlay {
                        opacity: 1;
                    }
                }
            }

            &.dropdown-open {
                z-index: 50;
                border-color: rgba(255, 213, 44, 0.4);
            }

            .thumbnail-container {
                width: 100%;
                aspect-ratio: 16 / 9;
                height: auto;
                border-top-left-radius: 12px;
                border-top-right-radius: 12px;
                border-bottom-left-radius: 0;
                border-bottom-right-radius: 0;

                .episode-badge {
                    top: 8px;
                    left: 8px;
                    bottom: auto;
                    font-size: 11px;
                    padding: 2.5px 7px;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                }

                .thumb-play-overlay {
                    display: flex;
                    opacity: 0; /* Hidden by default on desktop, appears on hover or loading */
                    background: rgba(0, 0, 0, 0.38);

                    .play-icon-circle {
                        width: 44px;
                        height: 44px;
                        background: rgba(255, 213, 44, 0.92);
                        color: #13100e;
                    }

                    &.is-loading {
                        opacity: 1;
                        background: rgba(0, 0, 0, 0.65);

                        .play-icon-circle {
                            background: rgba(28, 25, 23, 0.95);
                        }
                    }
                }
            }

            .card-content {
                flex-direction: column;
                align-items: stretch;
                padding: 12px 14px 12px 14px;
                gap: 8px;
                flex: 1;

                .titles {
                    gap: 3px;
                    flex-grow: 1;

                    .title-1 {
                        font-size: 14px;
                        line-height: 1.35;
                    }

                    .date {
                        margin-top: auto;
                        padding-top: 2px;
                    }
                }

                .actions {
                    width: 100%;
                    border-top: none; /* M3: no divider line between card content and actions */
                    padding-top: 4px;
                    margin-top: auto;
                    justify-content: flex-end;
                    gap: 4px;
                }
            }
        }
    }

    .icon-spinner {
        display: inline-block;
        width: 1rem;
        height: 1rem;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffd52c;
        border-radius: 50%;
        animation: icon-btn-spin 0.6s linear infinite;
        box-sizing: border-box;
    }

    @keyframes icon-btn-spin {
        to {
            transform: rotate(360deg);
        }
    }

    .download-progress-text {
        font-size: 11px;
        margin-left: 2px;
        font-weight: 600;
        color: #ffd52c;
    }
</style>
