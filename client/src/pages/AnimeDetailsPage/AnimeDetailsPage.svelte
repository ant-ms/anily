<script lang="ts">
    import { fade } from "svelte/transition";
    import { watch } from "runed";
    import {
        apiBaseUrl,
        selectedAnimeAnilistId,
    } from "../../lib/context.svelte";
    import type AnimeDetailsData from "../../types/AnimeDetails";
    import Hero from "./Hero.svelte";
    import HeroSkeleton from "./HeroSkeleton.svelte";
    import Chains from "./Chains.svelte";
    import Episodes from "./Episodes.svelte";

    let animeDetails: AnimeDetailsData | undefined = $state();
    let updateSeed = $state(Math.random());

    watch(
        () => [selectedAnimeAnilistId.current, updateSeed],
        ([anilistId], previous) => {
            if (anilistId === undefined) return;

            const animeChanged = !previous || previous[0] !== anilistId;
            if (animeChanged) animeDetails = undefined;

            const url = new URL(
                `/api/details/${anilistId}`,
                apiBaseUrl.current,
            );
            fetch(url.toString(), { credentials: "include" })
                .then((results) => results.json())
                .then((data) => {
                    if (selectedAnimeAnilistId.current !== anilistId) return;
                    animeDetails = data;
                });
        },
    );
</script>

<div id="anime-details-page">
    <div class="left">
        {#if animeDetails}
            <div transition:fade={{ duration: 200 }}>
                <Hero {animeDetails} />
            </div>
        {:else}
            <HeroSkeleton />
        {/if}

        <Episodes {updateSeed} />
    </div>
    <div class="right">
        <Chains {animeDetails} bind:updateSeed />
    </div>
</div>

<style lang="scss">
    #anime-details-page {
        display: grid;
        grid-template-columns: 1fr auto;

        .left {
            display: grid;
            grid-template-rows: auto 1fr;

            height: 100vh;
        }
    }
</style>
