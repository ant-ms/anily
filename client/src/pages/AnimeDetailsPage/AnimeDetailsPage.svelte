<script lang="ts">
    import { watch } from "runed";
    import {
        apiBaseUrl,
        selectedAnimeAnilistId,
    } from "../../lib/context.svelte";
    import type AnimeDetailsData from "../../types/AnimeDetails";
    import Hero from "./Hero.svelte";
    import Chains from "./Chains.svelte";

    let animeDetails: AnimeDetailsData | undefined = $state();
    let updateSeed = $state(Math.random());

    watch(
        () => `${selectedAnimeAnilistId.current}${updateSeed}`,
        () => {
            const url = new URL(
                `/api/details/${selectedAnimeAnilistId.current}`,
                apiBaseUrl.current,
            );
            fetch(url.toString(), { credentials: "include" })
                .then((results) => results.json())
                .then((data) => {
                    animeDetails = data;
                });
        },
    );
</script>

{#if animeDetails}
    <div id="anime-details-page">
        <div class="left">
            <Hero {animeDetails} />

            <div class="episodes">
                <p>bla</p>
                <p>bla</p>
                <p>bla</p>
                <p>bla</p>
                <p>bla</p>
                <p>bla</p>
                <p>bla</p>
                <p>bla</p>
            </div>
        </div>
        <div class="right">
            <Chains {animeDetails} {updateSeed} />
        </div>
    </div>
{/if}

<style lang="scss">
    #anime-details-page {
        display: grid;
        grid-template-columns: 1fr auto;
        /* display: grid;
        grid-template-rows: auto 1fr;
        gap: 2rem;
        height: 100vh;

        .episodes {
            overflow-y: auto;
        } */
    }
</style>
