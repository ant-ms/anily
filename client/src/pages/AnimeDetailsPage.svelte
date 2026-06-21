<script lang="ts">
    import ArrowsClockwiseIcon from "phosphor-svelte/lib/ArrowsClockwiseIcon";
    import BookmarkIcon from "phosphor-svelte/lib/BookmarkIcon";
    import PencilIcon from "phosphor-svelte/lib/PencilIcon";

    import { watch } from "runed";
    import {
        apiBaseUrl,
        selectedAnimeAnilistId,
        sidebarDataRefreshSeed,
    } from "../lib/context.svelte";
    import type AnimeDetailsData from "../types/AnimeDetails";
    import Button from "../lib/Button.svelte";

    let animeDetails: AnimeDetailsData | undefined = $state();
    let updateSeed = $state(Math.random());

    watch(
        () => [selectedAnimeAnilistId.current, updateSeed],
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

    let titles = $derived([
        ...(animeDetails?.titleEnglish ? [animeDetails?.titleEnglish] : []),
        ...(animeDetails?.titleRomanji ? [animeDetails?.titleRomanji] : []),
        ...(animeDetails?.titleNative ? [animeDetails?.titleNative] : []),
    ]);
</script>

<div id="anime-details-page">
    <div class="groupingItems">
        <div class="card">
            <img
                src="https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fa.storyblok.com%2Ff%2F178900%2F901x1200%2F5e507335eb%2Ffrieren-season-2-jp-visual.jpeg%2Fm%2Ffilters%3Aquality(95)format(webp)&f=1&nofb=1&ipt=6aad48f461a19075238c787079c1dd7587a8d18ed49cd89b2189f3dd385d2dc9"
                alt=""
            />
        </div>
        <div class="card">
            <img
                src="https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fa.storyblok.com%2Ff%2F178900%2F901x1200%2F5e507335eb%2Ffrieren-season-2-jp-visual.jpeg%2Fm%2Ffilters%3Aquality(95)format(webp)&f=1&nofb=1&ipt=6aad48f461a19075238c787079c1dd7587a8d18ed49cd89b2189f3dd385d2dc9"
                alt=""
            />
        </div>
        <div class="card selected">
            <img
                src="https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg"
                alt=""
            />
        </div>
        <div class="card">
            <img
                src="https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fa.storyblok.com%2Ff%2F178900%2F901x1200%2F5e507335eb%2Ffrieren-season-2-jp-visual.jpeg%2Fm%2Ffilters%3Aquality(95)format(webp)&f=1&nofb=1&ipt=6aad48f461a19075238c787079c1dd7587a8d18ed49cd89b2189f3dd385d2dc9"
                alt=""
            />
        </div>

        <div class="actions">
            <Button
                Icon={BookmarkIcon}
                active={animeDetails?.groupingId !== null}
                onclick={() => {
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
                }}
            />
            <div class="spacer"></div>
            <Button Icon={PencilIcon} />
            <Button Icon={ArrowsClockwiseIcon} />
        </div>
    </div>

    <div class="hero">
        <!-- TODO: Fallback thumbnail -->
        <img src={animeDetails?.thumbnailUrl} alt="" />
        <div class="right">
            {#each titles as title, i}
                <span class="title-{i}">{title}</span>
            {/each}
            {#if animeDetails?.description}
                <p>
                    {@html animeDetails.description
                        .split("\n")
                        .slice(0, -1)
                        .join("\n")}
                </p>
            {/if}
        </div>
    </div>

    <div class="episodes">
        <p>bla</p>
        <p>bla</p>
        <p>bla</p>
        <p>bla</p>
        <p>bla</p>
        <p>bla</p>
        <p>bla</p>
        <p>bla</p>
        <p>bla</p>
        <p>bla</p>
        <p>bla</p>
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

<style lang="scss">
    #anime-details-page {
        display: grid;
        grid-template-rows: auto auto 1fr;
        gap: 2rem;
        height: 100vh;

        .groupingItems {
            display: flex;
            gap: calc(1rem - 3px);
            padding: 0.5rem 0.75rem;
            border-bottom: 1px solid #2e2c29;

            .card {
                img {
                    width: 100px;
                    aspect-ratio: 3/4;
                    object-fit: cover;
                    border-radius: 5px;
                    border: 3px solid transparent;
                }

                &.selected {
                    img {
                        border: 3px solid #ffd52c;
                    }
                }
            }

            .actions {
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                align-items: flex-end;

                .spacer {
                    flex-grow: 1;
                }
            }
        }

        .episodes {
            overflow-y: auto;
        }

        .hero {
            justify-self: center;
            display: grid;
            grid-template-columns: 250px 1fr;
            gap: 1rem;
            max-width: 800px;

            img {
                width: 100%;
                border-radius: 5px;
            }

            .right {
                display: flex;
                flex-direction: column;

                span {
                    &.title-0 {
                        font-size: 24px;
                        font-weight: bold;
                        color: #fff;
                    }

                    &.title-1 {
                        font-size: 22px;
                        color: #ddd;
                    }

                    &.title-2 {
                        font-size: 18px;
                        color: #ddd;
                        margin-top: 2px;
                    }
                }

                p {
                    text-align: justify;
                    font-size: 14px;
                    color: #ddd;
                }
            }
        }
    }
</style>
