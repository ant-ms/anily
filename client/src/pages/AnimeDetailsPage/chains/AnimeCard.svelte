<script lang="ts">
    import {
        selectedAnimeAnilistId,
        isSeasonsSidebarOpen,
    } from "../../../lib/context.svelte";
    import type { CommonDetails } from "../../../types/AnimeGroupings";
    import ProgressDonut from "../../../lib/sidebar/ProgressDonut.svelte";
    import { titleOf, shortTitleOf } from "./titleOf";

    let { node }: { node: CommonDetails } = $props();
</script>

<button
    type="button"
    class="card"
    class:selected={node.anilistId === selectedAnimeAnilistId.current}
    title={titleOf(node)}
    onclick={() => {
        selectedAnimeAnilistId.set(node.anilistId);
        if (typeof window !== "undefined" && window.innerWidth <= 1024) {
            isSeasonsSidebarOpen.set(false);
        }
    }}
>
    <div class="thumbnail-wrapper">
        {#if node.thumbnailUrl}
            <img src={node.thumbnailUrl} alt={titleOf(node)} />
        {:else}
            <div class="placeholder"></div>
        {/if}
    </div>
    <div class="caption-wrapper">
        <span class="caption">{shortTitleOf(node)}</span>
        {#if node.progress && node.progress.total > 0}
            <ProgressDonut prog={node.progress} />
        {/if}
    </div>
</button>

<style lang="scss">
    .card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.35rem;
        width: 100px;
        padding: 0;
        background: none;
        border: none;
        cursor: pointer;

        .thumbnail-wrapper {
            position: relative;
        }

        img,
        .placeholder {
            width: 100px;
            aspect-ratio: 3 / 4;
            object-fit: cover;
            border-radius: 5px;
            border: 3px solid transparent;
            background: #2a2723;
            transition: border-color 0.15s;
            display: block; /* Removes bottom gap in wrapper */
        }

        .caption-wrapper {
            display: flex;
            align-items: center;
            gap: 4px;
            
            .caption {
                font-size: 0.7rem;
                line-height: 1.2;
                color: #c9c2b6;
                text-align: center;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
        }

        &:hover img,
        &:hover .placeholder {
            border-color: #5a554c;
        }

        &.selected img,
        &.selected .placeholder {
            border-color: #ffd52c;
        }
    }
</style>
