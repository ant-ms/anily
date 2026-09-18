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
    import { snackbar } from "../../lib/snackbar.svelte";
    import type AnimeDetailsData from "../../types/AnimeDetails";
    import Button from "../../lib/Button.svelte";
    import IconButton from "../../lib/IconButton.svelte";
    import type AnimeGroupingsData from "../../types/AnimeGroupings";
    import type { ChainNode } from "../../types/AnimeGroupings";
    import { fade } from "svelte/transition";
    import { watch } from "runed";
    import ChainTree from "./chains/ChainTree.svelte";
    import NotInChain from "./chains/NotInChain.svelte";
    import { buildGroupingCacheKey } from "../../lib/storageKeys";

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
    let isTogglingBookmark = $state(false);

    watch(
        () => selectedAnimeAnilistId.current,
        () => {
            isTogglingBookmark = false;
        },
    );

    $effect(() => {
        if (animeDetails !== undefined) {
            isBookmarked = animeDetails.groupingId != null;
            isDisplayAnime = animeDetails.isDisplayAnime;
        }
    });

    watch(
        () => [selectedAnimeAnilistId.current, updateSeed, sidebarDataRefreshSeed.current],
        ([anilistId, seed, sidebarSeed], previous) => {
            if (anilistId === undefined) return;

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

            const cacheKey = buildGroupingCacheKey(anilistId as number);
            try {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    animeGroupings = parsed;
                    currentPage = findPageForAnime(parsed, anilistId as number) ?? 0;
                }
            } catch {}

            if (!apiBaseUrl.current) return;

            const url = new URL(
                `/api/grouping?baseAnilistId=${selectedAnimeAnilistId.current}`,
                apiBaseUrl.current,
            );
            fetch(url.toString(), { credentials: "include" })
                .then((results) => (results.ok ? results.json() : null))
                .then((data: AnimeGroupingsData | null) => {
                    if (!data) return;
                    animeGroupings = data;
                    try {
                        localStorage.setItem(cacheKey, JSON.stringify(data));
                    } catch {}
                    // Open the page containing the anime that's being viewed
                    // instead of resetting back to the first chain.
                    currentPage =
                        findPageForAnime(
                            data,
                            selectedAnimeAnilistId.current,
                        ) ?? 0;
                })
                .catch((err) => console.warn("Failed to fetch grouping online:", err));
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

    const toggleGrouping = async () => {
        if (
            !animeDetails ||
            isTogglingBookmark ||
            !apiBaseUrl.current ||
            selectedAnimeAnilistId.current === undefined
        ) {
            return;
        }

        const currentAnilistId = selectedAnimeAnilistId.current;
        const removing = animeDetails.groupingId !== null;
        isTogglingBookmark = true;

        const url = new URL(
            `/api/details/${currentAnilistId}/grouping`,
            apiBaseUrl.current,
        );

        try {
            // Remove the grouping if it exists
            if (removing) {
                const res = await fetch(url.toString(), {
                    method: "DELETE",
                    credentials: "include",
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                if (selectedAnimeAnilistId.current === currentAnilistId) {
                    isBookmarked = false;
                    updateSeed = Math.random();
                }
            } else {
                // or add it if it doesn't
                const res = await fetch(url.toString(), {
                    method: "POST",
                    credentials: "include",
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                if (selectedAnimeAnilistId.current === currentAnilistId) {
                    isBookmarked = true;
                    updateSeed = Math.random();
                    sidebarDataRefreshSeed.set(Math.random());
                }
            }
        } catch (err) {
            console.error(
                removing
                    ? "Failed to remove anime from chain:"
                    : "Failed to add anime to chain:",
                err,
            );
            snackbar.error(
                removing
                    ? "Failed to remove anime from chain"
                    : "Failed to add anime to chain",
            );
        } finally {
            if (selectedAnimeAnilistId.current === currentAnilistId) {
                isTogglingBookmark = false;
            }
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
        })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                updateSeed = Math.random();
                sidebarDataRefreshSeed.set(Math.random());
            })
            .catch((err) => {
                console.error("Failed to pin display anime:", err);
                snackbar.error("Failed to pin display anime");
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
            .then(([res1, res2]) => {
                if (!res1.ok || !res2.ok) {
                    throw new Error("Failed to refresh details from AniList");
                }
                updateSeed = Math.random();
                sidebarDataRefreshSeed.set(Math.random());
                snackbar.success("Refreshed anime details");
            })
            .catch((err) => {
                console.error("Failed to refresh details:", err);
                snackbar.error("Failed to refresh anime details");
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
            loading={isTogglingBookmark}
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
        <div class="close-btn-wrapper">
            <IconButton
                Icon={XIcon}
                variant="ghost"
                onclick={() => isSeasonsSidebarOpen.set(false)}
                title="Close seasons"
            />
        </div>
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
            padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));

            .spacer {
                flex-grow: 1;
            }

            .close-btn-wrapper {
                display: none;

                @media (max-width: 1024px) {
                    display: block;
                }
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
