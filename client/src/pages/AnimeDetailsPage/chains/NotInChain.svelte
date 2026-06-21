<script lang="ts">
    import type { CommonDetails } from "../../../types/AnimeGroupings";
    import AnimeCard from "./AnimeCard.svelte";

    let { animes }: { animes: CommonDetails[] } = $props();
</script>

<div class="not-in-chain">
    <span class="label">Not in a chain</span>
    <div class="grid">
        {#each animes as anime}
            <AnimeCard node={anime} />
        {/each}
    </div>
</div>

<style lang="scss">
    .not-in-chain {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        margin-top: 8px;

        .label {
            font-size: 0.75rem;
            color: #8a847a;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(2, auto);
            gap: 1rem;
        }
    }
</style>
