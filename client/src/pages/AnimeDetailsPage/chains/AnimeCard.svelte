<script lang="ts">
    import { selectedAnimeAnilistId } from "../../../lib/context.svelte";
    import type { CommonDetails } from "../../../types/AnimeGroupings";
    import { titleOf, shortTitleOf } from "./titleOf";

    let { node }: { node: CommonDetails } = $props();
</script>

<button
    type="button"
    class="card"
    class:selected={node.anilistId === selectedAnimeAnilistId.current}
    title={titleOf(node)}
    onclick={() => selectedAnimeAnilistId.set(node.anilistId)}
>
    {#if node.thumbnailUrl}
        <img src={node.thumbnailUrl} alt={titleOf(node)} />
    {:else}
        <div class="placeholder"></div>
    {/if}
    <span class="caption">{shortTitleOf(node)}</span>
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

        img,
        .placeholder {
            width: 100px;
            aspect-ratio: 3 / 4;
            object-fit: cover;
            border-radius: 5px;
            border: 3px solid transparent;
            background: #2a2723;
            transition: border-color 0.15s;
        }

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
