<script lang="ts">
    import ArrowsClockwiseIcon from "phosphor-svelte/lib/ArrowsClockwiseIcon";
    import BookmarkIcon from "phosphor-svelte/lib/BookmarkIcon";
    import PushPinIcon from "phosphor-svelte/lib/PushPinIcon";
    import PushPinSlashIcon from "phosphor-svelte/lib/PushPinSlashIcon";
    import CaretLeftIcon from "phosphor-svelte/lib/CaretLeftIcon";
    import CaretRightIcon from "phosphor-svelte/lib/CaretRightIcon";
    import XIcon from "phosphor-svelte/lib/XIcon";

    import {
        apiBaseUrl,
        selectedAnimeAnilistId,
        sidebarDataRefreshSeed,
        isSeasonsSidebarOpen,
    } from "../../lib/context.svelte";
    import type AnimeDetailsData from "../../types/AnimeDetails";
    import Button from "../../lib/Button.svelte";
    import type AnimeGroupingsData from "../../types/AnimeGroupings";
    import type { ChainNode } from "../../types/AnimeGroupings";
    import { fade } from "svelte/transition";
    import { watch } from "runed";
    import ChainTree from "./chains/ChainTree.svelte";
    import NotInChain from "./chains/NotInChain.svelte";

    let {
        animeDetails,
        updateSeed = $bindable(),
    }: {
        animeDetails: AnimeDetailsData | undefined;
        updateSeed: number;
    } = $props();

    let animeGroupings: AnimeGroupingsData | undefined = $state();
    let isBookmarked = $state(false);
    let isDisplayAnime = $state(false);

    $effect(() => {
        if (animeDetails !== undefined) {
            isBookmarked = animeDetails.groupingId != null;
            isDisplayAnime = animeDetails.isDisplayAnime;
        }
    });

    watch(
        () => [selectedAnimeAnilistId.current, updateSeed, sidebarDataRefreshSeed.current],
        ([anilistId, seed, sidebarSeed], previous) => {
            // A bookmark toggle (updateSeed change) always forces a refresh.
            const seedChanged = !previous || previous[1] !== seed || previous[2] !== sidebarSeed;

            // Navigating to an anime that's already part of the loaded grouping
            // just switches the visible page — no need to refetch.
            if (!seedChanged && animeGroupings) {
                const page = findPageForAnime(animeGroupings, anilistId as number | undefined);
                if (page !== null) {
                    currentPage = page;
                    return;
                }
            }

            const url = new URL(
                `/api/grouping?baseAnilistId=${selectedAnimeAnilistId.current}`,
                apiBaseUrl.current,
            );
            fetch(url.toString(), { credentials: "include" })
                .then((results) => results.json())
                .then((data: AnimeGroupingsData) => {
                    animeGroupings = data;
                    // Open the page containing the anime that's being viewed
                    // instead of resetting back to the first chain.
                    currentPage =
                        findPageForAnime(
                            data,
                            selectedAnimeAnilistId.current,
                        ) ?? 0;
                });
        },
    );

    const findPageForAnime = (
        data: AnimeGroupingsData,
        anilistId: number | undefined,
    ): number | null => {
        if (anilistId === undefined) return null;

        const inTree = (node: ChainNode): boolean =>
            node.anilistId === anilistId || node.children.some(inTree);

        const chainIndex = data.chains.findIndex(inTree);
        if (chainIndex !== -1) return chainIndex;

        if (data.notInChain.some((a) => a.anilistId === anilistId)) {
            return data.chains.length;
        }

        return null;
    };

    // The chevrons page through each chain plus a final "not in a chain" page.
    let currentPage = $state(0);
    let hasNotInChain = $derived((animeGroupings?.notInChain.length ?? 0) > 0);
    let pageCount = $derived(
        (animeGroupings?.chains.length ?? 0) + (hasNotInChain ? 1 : 0),
    );

    const navigate = (direction: -1 | 1) => {
        if (pageCount === 0) return;
        currentPage = Math.max(
            0,
            Math.min(pageCount - 1, currentPage + direction),
        );
    };

    const toggleGrouping = () => {
        if (!animeDetails) return;

        const url = new URL(
            `/api/details/${selectedAnimeAnilistId.current}/grouping`,
            apiBaseUrl.current,
        );

        // Remove the grouping if it exists
        if (animeDetails.groupingId !== null) {
            fetch(url.toString(), {
                method: "DELETE",
                credentials: "include",
            }).then((_) => {
                updateSeed = Math.random();
            });
        }

        // or add it if it doesn't
        if (animeDetails.groupingId === null) {
            fetch(url.toString(), {
                method: "POST",
                credentials: "include",
            }).then((_) => {
                updateSeed = Math.random();
                sidebarDataRefreshSeed.set(Math.random());
            });
        }
    };

    const setDisplayAnime = () => {
        if (!animeDetails || isDisplayAnime) return;

        const url = new URL(
            `/api/details/${selectedAnimeAnilistId.current}/grouping`,
            apiBaseUrl.current,
        );

        fetch(url.toString(), {
            method: "POST",
            credentials: "include",
        }).then((_) => {
            updateSeed = Math.random();
            sidebarDataRefreshSeed.set(Math.random());
        });
    };

    let refreshing = $state(false);

    const refreshDetails = () => {
        if (refreshing) return;
        refreshing = true;

        const detailsUrl = new URL(
            `/api/details/${selectedAnimeAnilistId.current}/refresh`,
            apiBaseUrl.current,
        );
        const episodesUrl = new URL(
            `/api/episodes/${selectedAnimeAnilistId.current}/refresh`,
            apiBaseUrl.current,
        );

        Promise.all([
            fetch(detailsUrl.toString(), {
                method: "POST",
                credentials: "include",
            }),
            fetch(episodesUrl.toString(), {
                method: "POST",
                credentials: "include",
            }),
        ])
            .then(() => {
                updateSeed = Math.random();
                sidebarDataRefreshSeed.set(Math.random());
            })
            .finally(() => {
                refreshing = false;
            });
    };
</script>

<div class="chains">
    <div class="actions">
        <Button
            Icon={BookmarkIcon}
            active={isBookmarked}
            onclick={toggleGrouping}
        />
        <Button 
            Icon={isDisplayAnime ? PushPinIcon : PushPinSlashIcon} 
            active={isDisplayAnime} 
            onclick={setDisplayAnime} 
        />
        <Button
            Icon={ArrowsClockwiseIcon}
            disabled={refreshing}
            onclick={refreshDetails}
        />
        <div class="spacer"></div>
        <Button
            Icon={CaretLeftIcon}
            disabled={currentPage <= 0}
            onclick={() => navigate(-1)}
        />
        <Button
            Icon={CaretRightIcon}
            disabled={currentPage >= pageCount - 1}
            onclick={() => navigate(1)}
        />
        <Button
            Icon={XIcon}
            style="ghost"
            onclick={() => isSeasonsSidebarOpen.set(false)}
            title="Close seasons"
        />
    </div>

    <div class="tree">
        {#if animeGroupings}
            <div in:fade={{ duration: 150 }}>
                {#if currentPage < animeGroupings.chains.length}
                    <ChainTree root={animeGroupings.chains[currentPage]} />
                {:else if hasNotInChain}
                    <NotInChain animes={animeGroupings.notInChain} />
                {/if}
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
    .chains {
        display: grid;
        height: 100vh;
        height: 100dvh;
        max-height: 100dvh;
        grid-template-rows: auto 1fr;
        grid-template-columns: minmax(250px, auto);
        border-left: 1px solid #2e2c29;
        background: #1d1a17;
        min-height: 0;

        .actions {
            flex-grow: 1;
            display: flex;
            gap: 0.5rem;
            align-items: flex-end;
            margin: 0.5rem;

            .spacer {
                flex-grow: 1;
            }
        }

        .tree {
            display: flex;
            align-items: flex-start;
            justify-self: center;
            gap: 2rem;
            padding: 8px 12px;
            padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
            width: max-content;
            overflow-y: auto;
            overflow-x: auto;
        }
    }
</style>
