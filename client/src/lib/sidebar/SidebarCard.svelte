<script lang="ts">
    import type SidebarCardData from "../../types/SidebarCardData";
    import { selectedAnimeAnilistId, isMobileNavOpen } from "../context.svelte";
    import ProgressDonut from "./ProgressDonut.svelte";
    import { downloadManager } from "../download/downloadManager.svelte";
    import { networkState } from "../network.svelte";
    import DownloadSimpleIcon from "phosphor-svelte/lib/DownloadSimpleIcon";

    let {
        data,
    }: {
        data: SidebarCardData;
    } = $props();

    let titles = $derived([
        ...(data.titleNative ? [data.titleNative] : []),
        ...(data.titleEnglish ? [data.titleEnglish] : []),
        ...(data.titleRomanji ? [data.titleRomanji] : []),
    ]);

    let hasOfflineDownloads = $derived(
        downloadManager.hasDownloads(data.allAnilistIds)
    );

    let isOfflineDisabled = $derived(
        !networkState.isOnline && !hasOfflineDownloads
    );
</script>

<!-- TODO: Stay highlighted -->

<button
    type="button"
    onclick={(e) => {
        if (isOfflineDisabled) return;
        const isAlreadyActive = data.allAnilistIds.includes(
            selectedAnimeAnilistId.current ?? 0,
        );
        if (isAlreadyActive) {
            if (e.detail === 0) {
                // Triggered via keyboard (Enter/Space) on an already-selected card: move focus into the main content area
                const firstEpisodeOrControl = document.querySelector<HTMLElement>(
                    '#content .episode-card:not(.is-future) .thumbnail-container[tabindex="0"], #content button:not([disabled]), #content [tabindex="0"]',
                );
                firstEpisodeOrControl?.focus();
                return;
            }
            selectedAnimeAnilistId.set(undefined);
        } else {
            selectedAnimeAnilistId.set(data.displayAnilistId, { clearHistory: true });
        }
        if (typeof window !== "undefined" && window.innerWidth <= 768) {
            isMobileNavOpen.set(false);
        }
    }}
    class="sidebar-card"
    class:active={data.allAnilistIds.includes(
        selectedAnimeAnilistId.current ?? 0,
    )}
    class:offline-disabled={isOfflineDisabled}
    disabled={isOfflineDisabled}
    aria-disabled={isOfflineDisabled}
>
    <div class="thumb-container">
        <img src={data.thumbnailUrl} alt="" />
        {#if hasOfflineDownloads}
            <div class="offline-ready-badge" title="Downloaded offline">
                <DownloadSimpleIcon size={12} weight="bold" />
            </div>
        {/if}
    </div>
    <div class="right">
        <span>{titles[0]}</span>
        <span>{titles[1]}</span>

        {#if data.progress && data.progress.length > 0}
            <div class="progress-chains">
                {#each data.progress as chain}
                    <div class="progress-chain">
                        {#each chain as prog}
                            <ProgressDonut {prog} />
                        {/each}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</button>

<style lang="scss">
    .sidebar-card {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 8px;
        margin: 2px 12px;
        width: calc(100% - 24px);
        box-sizing: border-box;
        background: transparent;
        border: 2px solid transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        border-radius: 12px;
        cursor: pointer;
        outline: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;

        transition:
            background 0.2s cubic-bezier(0.2, 0, 0, 1),
            border-color 0.15s ease,
            box-shadow 0.15s ease;

        img {
            width: 65px;
            height: 90px;
            object-fit: cover;
            border-radius: 8px;
            display: block;
        }

        .right {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 2px;
            min-width: 0;
            flex: 1;

            span {
                font-size: 14px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;

                &:nth-child(2) {
                    opacity: 0.6;
                }
            }

            .progress-chains {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 6px;
            }

            .progress-chain {
                display: flex;
                gap: 4px;
                padding: 4px 6px;
                border-radius: 100px;
                border-top: 1px solid #2e2c29;
                border-bottom: 1px solid #2e2c29;
                background: rgba(255, 255, 255, 0.02);
            }
        }

        &:hover {
            background: hsl(36, 7%, 14%);
        }

        &:focus-visible {
            background: hsl(36, 7%, 16%);
            border-color: #ffd52c;
            box-shadow: 0 0 0 2px rgba(255, 213, 44, 0.22);
        }

        &.active {
            background: rgba(255, 213, 44, 0.12);

            &:hover {
                background: rgba(255, 213, 44, 0.18);
            }

            &:focus-visible {
                background: rgba(255, 213, 44, 0.2);
                border-color: #ffd52c;
            }
        }

        &.offline-disabled {
            opacity: 0.28;
            filter: grayscale(85%);
            cursor: not-allowed;
            pointer-events: none;

            &:hover {
                background: transparent;
            }
        }

        .thumb-container {
            position: relative;
            flex-shrink: 0;

            .offline-ready-badge {
                position: absolute;
                bottom: 4px;
                right: 4px;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #ffd52c;
                color: #121316;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
            }
        }

        @media (max-width: 1024px) {
            padding: 6px;
            gap: 0.4rem;
            margin: 2px 8px;
            width: calc(100% - 16px);

            img {
                width: 52px;
                height: 72px;
                border-radius: 6px;
            }

            .right span {
                font-size: 13px;
            }
        }
    }
</style>
