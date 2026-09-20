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

<!-- svelte-ignore a11y_missing_attribute -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<a
    onclick={() => {
        if (isOfflineDisabled) return;
        if (data.allAnilistIds.includes(selectedAnimeAnilistId.current ?? 0)) {
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
</a>

<style lang="scss">
    .sidebar-card {
        display: flex;
        gap: 0.5rem;
        padding: 8px;
        margin: 2px 12px;
        border-radius: 12px;
        cursor: pointer;

        transition: background 0.2s cubic-bezier(0.2, 0, 0, 1);

        img {
            width: 65px;
            height: 90px;
            object-fit: cover;
            border-radius: 8px;
        }

        .right {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 2px;
            min-width: 0;

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

        &.active {
            background: rgba(255, 213, 44, 0.12);

            &:hover {
                background: rgba(255, 213, 44, 0.18);
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
