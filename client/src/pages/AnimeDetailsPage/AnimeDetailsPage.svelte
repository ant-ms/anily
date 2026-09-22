<script lang="ts">
    import { fade } from "svelte/transition";
    import { onDestroy } from "svelte";
    import { watch } from "runed";
    import {
        apiBaseUrl,
        selectedAnimeAnilistId,
        isSeasonsSidebarOpen,
        sidebarDataRefreshSeed,
        selectedAnimeDetails,
    } from "../../lib/context.svelte";
    import type AnimeDetailsData from "../../types/AnimeDetails";
    import Hero from "./Hero.svelte";
    import HeroSkeleton from "./HeroSkeleton.svelte";
    import Chains from "./Chains.svelte";
    import Episodes from "./Episodes.svelte";
    import { buildDetailsCacheKey } from "../../lib/storageKeys";

    let animeDetails: AnimeDetailsData | undefined = $state();
    let updateSeed = $state(Math.random());

    // Keep animeDetails in sync with selectedAnimeDetails if modified externally (e.g. bookmark toggle)
    $effect(() => {
        if (
            selectedAnimeDetails.current &&
            selectedAnimeDetails.current.anilistId === selectedAnimeAnilistId.current &&
            selectedAnimeDetails.current !== animeDetails
        ) {
            animeDetails = selectedAnimeDetails.current;
        }
    });

    onDestroy(() => {
        selectedAnimeDetails.set(undefined);
    });

    watch(
        () => [selectedAnimeAnilistId.current, updateSeed, sidebarDataRefreshSeed.current],
        ([anilistId], previous) => {
            if (anilistId === undefined) {
                animeDetails = undefined;
                selectedAnimeDetails.set(undefined);
                return;
            }

            const cacheKey = buildDetailsCacheKey(anilistId);
            try {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    animeDetails = JSON.parse(cached);
                    selectedAnimeDetails.set(animeDetails);
                } else {
                    const animeChanged = !previous || previous[0] !== anilistId;
                    if (animeChanged) {
                        animeDetails = undefined;
                        selectedAnimeDetails.set(undefined);
                    }
                }
            } catch {
                const animeChanged = !previous || previous[0] !== anilistId;
                if (animeChanged) {
                    animeDetails = undefined;
                    selectedAnimeDetails.set(undefined);
                }
            }

            if (!apiBaseUrl.current) return;

            const url = new URL(
                `/api/details/${anilistId}`,
                apiBaseUrl.current,
            );
            fetch(url.toString(), { credentials: "include" })
                .then((results) => (results.ok ? results.json() : null))
                .then((data) => {
                    if (!data || selectedAnimeAnilistId.current !== anilistId) return;
                    animeDetails = data;
                    selectedAnimeDetails.set(data);
                    try {
                        localStorage.setItem(cacheKey, JSON.stringify(data));
                    } catch {}
                })
                .catch((err) => console.error("Failed to fetch anime details online:", err));
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

        <Episodes {animeDetails} {updateSeed} animeName={animeDetails?.titleNative ?? animeDetails?.titleEnglish ?? animeDetails?.titleRomanji ?? ""} />
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
        grid-template-columns: 1fr auto;
        height: 100%;
        min-height: 0;
        position: relative;
        overflow: hidden;

        .left {
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 0;
            overflow: hidden;
        }

        .right {
            display: block;
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
