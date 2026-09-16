<script lang="ts">
    import { fade } from "svelte/transition";
    import { watch } from "runed";
    import {
        apiBaseUrl,
        selectedAnimeAnilistId,
        isSeasonsSidebarOpen,
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

<div
    id="anime-details-page"
    class:seasons-open={isSeasonsSidebarOpen.current}
>
    <div class="left">
        {#if animeDetails}
            <div transition:fade={{ duration: 200 }}>
                <Hero {animeDetails} />
            </div>
        {:else}
            <HeroSkeleton />
        {/if}

        <Episodes {updateSeed} animeName={animeDetails?.titleEnglish ?? animeDetails?.titleRomanji ?? ""} />
    </div>
    <div class="right" class:open={isSeasonsSidebarOpen.current}>
        <Chains {animeDetails} bind:updateSeed />
    </div>

    {#if isSeasonsSidebarOpen.current}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="seasons-backdrop"
            onclick={() => isSeasonsSidebarOpen.set(false)}
        ></div>
    {/if}
</div>

<style lang="scss">
    #anime-details-page {
        display: grid;
        grid-template-columns: 1fr;
        height: 100%;
        min-height: 0;
        position: relative;
        overflow: hidden;

        &.seasons-open {
            grid-template-columns: 1fr auto;
        }

        .left {
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 0;
            overflow: hidden;
        }

        .right {
            display: none;

            &.open {
                display: block;
            }
        }

        .seasons-backdrop {
            display: none;
        }

        @media (max-width: 1024px) {
            display: block;
            width: 100%;
            height: 100%;

            .left {
                width: 100%;
                height: 100%;
            }

            .right {
                display: block;
                position: fixed;
                top: 0;
                right: 0;
                bottom: 0;
                z-index: 60;
                width: min(320px, 85vw);
                transform: translateX(100%);
                transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                box-shadow: none;

                &.open {
                    transform: translateX(0);
                    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.7);
                }
            }

            .seasons-backdrop {
                display: block;
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.65);
                backdrop-filter: blur(2px);
                z-index: 55;
            }
        }
    }
</style>
