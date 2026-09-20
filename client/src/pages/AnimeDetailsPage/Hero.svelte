<script lang="ts">
    import type AnimeDetailsData from "../../types/AnimeDetails";
    import IconButton from "../../lib/IconButton.svelte";
    import Popover from "../../lib/Popover.svelte";
    import BottomSheet from "../../lib/BottomSheet.svelte";
    import InfoIcon from "phosphor-svelte/lib/InfoIcon";
    import XIcon from "phosphor-svelte/lib/XIcon";

    let {
        animeDetails,
    }: {
        animeDetails: AnimeDetailsData;
    } = $props();

    let isInfoOpen = $state(false);
    let isMobile = $state(
        typeof window !== "undefined" ? window.innerWidth <= 768 : false,
    );

    $effect(() => {
        if (typeof window === "undefined") return;
        const mql = window.matchMedia("(max-width: 768px)");
        isMobile = mql.matches;
        const handler = (e: MediaQueryListEvent) => {
            isMobile = e.matches;
        };
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    });

    $effect(() => {
        // Reset info popup/sheet when anime changes
        animeDetails.anilistId;
        isInfoOpen = false;
    });

    let rawTitles = $derived([
        animeDetails.titleNative,
        animeDetails.titleEnglish,
        animeDetails.titleRomanji,
    ]);
    let titles = $derived(
        [...new Set(rawTitles.filter((t): t is string => Boolean(t && t.trim())))],
    );

    let sourceMatch = $derived(
        animeDetails.description?.match(/\(Source:\s*([^)]+)\)/i),
    );
    let sourceText = $derived(sourceMatch ? sourceMatch[1] : undefined);

    let formattedDescription = $derived(
        animeDetails.description
            ? animeDetails.description
                  .replace(/\(Source:\s*[^)]+\)/gi, "")
                  .replaceAll(/(<br\s*\/?>\s*)+/gi, "<br><br>")
                  .trim()
            : "",
    );
</script>

{#snippet infoBody()}
    <div class="info-header">
        <h3 class="info-title">Description</h3>
        <IconButton
            Icon={XIcon}
            variant="ghost"
            shape="circle"
            size="sm"
            onclick={() => (isInfoOpen = false)}
            title="Close"
            ariaLabel="Close"
        />
    </div>
    <div class="info-divider"></div>
    <div class="info-body">
        {#if formattedDescription}
            <div class="info-description">
                {@html formattedDescription}
            </div>
            {#if sourceText}
                <div class="info-source">Source: {sourceText}</div>
            {/if}
        {:else}
            <p class="no-description">No description available.</p>
        {/if}
    </div>
{/snippet}

<div class="hero">
    <!-- TODO: Fallback thumbnail -->
    <img src={animeDetails.thumbnailUrl} alt={titles[0] ?? ""} />
    <div class="right">
        <div class="header-row">
            <div class="titles">
                {#each titles as title, i}
                    <span class="title-{i}" title={title}>{title}</span>
                {/each}
            </div>
            {#if animeDetails.description}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="info-trigger-wrapper"
                    onclick={(e) => e.stopPropagation()}
                >
                    <IconButton
                        Icon={InfoIcon}
                        variant="normal"
                        shape="rounded"
                        size="md"
                        active={isInfoOpen}
                        onclick={() => (isInfoOpen = !isInfoOpen)}
                        title="Show anime description"
                        ariaLabel="Show anime description"
                    />

                    {#if !isMobile}
                        <Popover
                            bind:isOpen={isInfoOpen}
                            placement="bottom-end"
                            minWidth="340px"
                            maxWidth="460px"
                            ariaLabel="Anime description"
                        >
                            {@render infoBody()}
                        </Popover>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>

{#if isMobile && animeDetails.description}
    <BottomSheet
        bind:isOpen={isInfoOpen}
        ariaLabel="Anime description"
        maxWidth="500px"
    >
        {@render infoBody()}
    </BottomSheet>
{/if}

<style lang="scss">
    .hero {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        margin: 1.25rem 1.5rem;
        flex-shrink: 0;

        img {
            height: clamp(140px, 18vh, 180px);
            aspect-ratio: 3/4;
            object-fit: cover;
            border-radius: 6px;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .right {
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-width: 0;
            flex: 1;

            .header-row {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 0.75rem;
                width: 100%;

                .titles {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    min-width: 0;
                    flex: 1;

                    span {
                        min-width: 0;

                        &.title-0 {
                            font-size: 1.4rem;
                            font-weight: 700;
                            color: #fff;
                            line-height: 1.25;
                            display: -webkit-box;
                            -webkit-line-clamp: 2;
                            line-clamp: 2;
                            -webkit-box-orient: vertical;
                            overflow: hidden;
                            word-break: break-word;
                        }

                        &.title-1 {
                            font-size: 1.05rem;
                            color: #d1cfcb;
                            line-height: 1.25;
                            display: -webkit-box;
                            -webkit-line-clamp: 1;
                            line-clamp: 1;
                            -webkit-box-orient: vertical;
                            overflow: hidden;
                            word-break: break-word;
                        }

                        &.title-2 {
                            font-size: 0.85rem;
                            color: #8c8883;
                            line-height: 1.25;
                            margin-top: 1px;
                            display: -webkit-box;
                            -webkit-line-clamp: 1;
                            line-clamp: 1;
                            -webkit-box-orient: vertical;
                            overflow: hidden;
                            word-break: break-word;
                        }
                    }
                }

                .info-trigger-wrapper {
                    position: relative;
                    flex-shrink: 0;
                }
            }
        }

        @media (max-width: 1024px), (max-height: 850px) {
            margin: 0.85rem 1rem;
            gap: 1rem;

            img {
                height: clamp(120px, 15vh, 150px);
            }

            .right {
                .header-row {
                    .titles {
                        span {
                            &.title-0 {
                                font-size: 1.25rem;
                            }

                            &.title-1 {
                                font-size: 0.95rem;
                            }

                            &.title-2 {
                                font-size: 0.8rem;
                            }
                        }
                    }
                }
            }
        }

        @media (max-width: 640px) {
            margin: 0.65rem 0.75rem;
            gap: 0.75rem;

            img {
                height: 110px;
            }

            .right {
                .header-row {
                    gap: 0.5rem;

                    .titles {
                        gap: 2px;

                        span {
                            &.title-0 {
                                font-size: 1.15rem;
                            }

                            &.title-1 {
                                font-size: 0.88rem;
                            }

                            &.title-2 {
                                font-size: 0.78rem;
                            }
                        }
                    }
                }
            }
        }
    }

    .info-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 0 2px 2px;

        .info-title {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 600;
            color: #ffffff;
        }
    }

    .info-divider {
        height: 1px;
        background: #3a3733;
        margin: 2px 0 6px 0;
        width: 100%;
    }

    .info-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: min(400px, 60vh);
        overflow-y: auto;
        padding: 2px 4px 4px 2px;

        scrollbar-width: thin;
        scrollbar-color: #4a4641 transparent;

        &::-webkit-scrollbar {
            width: 6px;
        }
        &::-webkit-scrollbar-thumb {
            background: #4a4641;
            border-radius: 3px;
        }

        .info-description {
            font-size: 13.5px;
            line-height: 1.55;
            color: #d6d3d1;
            word-break: break-word;

            :global(a) {
                color: #ffd52c;
                text-decoration: underline;
                &:hover {
                    color: #ffe169;
                }
            }
        }

        .info-source {
            font-size: 12px;
            font-style: italic;
            color: #8c8883;
            margin-top: 4px;
        }

        .no-description {
            margin: 0;
            font-size: 13px;
            color: #8c8883;
            font-style: italic;
        }
    }
</style>
