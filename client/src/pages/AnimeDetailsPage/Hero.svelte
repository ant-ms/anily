<script lang="ts">
    import type AnimeDetailsData from "../../types/AnimeDetails";

    let {
        animeDetails,
    }: {
        animeDetails: AnimeDetailsData;
    } = $props();

    let titles = $derived([
        ...(animeDetails.titleEnglish ? [animeDetails.titleEnglish] : []),
        ...(animeDetails.titleRomanji ? [animeDetails.titleRomanji] : []),
        ...(animeDetails.titleNative ? [animeDetails.titleNative] : []),
    ]);
</script>

<div class="hero">
    <!-- TODO: Fallback thumbnail -->
    <img src={animeDetails.thumbnailUrl} alt="" />
    <div class="right">
        {#each titles as title, i}
            <span class="title-{i}">{title}</span>
        {/each}
        {#if animeDetails.description}
            <p>
                {@html animeDetails.description
                    .replace(/\(Source: .+\)/, "")
                    .replaceAll(/(<br( +)?(\/)?>)+/g, "<br>")
                    .trim()}
            </p>
        {/if}
    </div>
</div>

<style lang="scss">
    .hero {
        display: flex;
        gap: 1.25rem;
        margin: 1.25rem 1.5rem;
        flex-shrink: 0;

        img,
        .right {
            height: clamp(170px, 22vh, 230px);
        }

        img {
            aspect-ratio: 3/4;
            object-fit: cover;
            border-radius: 5px;
            flex-shrink: 0;
        }

        .right {
            display: flex;
            flex-direction: column;
            min-width: 0;
            flex: 1;

            span {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;

                &.title-0 {
                    font-size: 1.35rem;
                    font-weight: bold;
                    color: #fff;
                    line-height: 1.25;
                }

                &.title-1 {
                    font-size: 1.05rem;
                    color: #ddd;
                    line-height: 1.25;
                }

                &.title-2 {
                    font-size: 0.85rem;
                    color: #aaa;
                    margin-top: 2px;
                }
            }

            p {
                text-align: justify;
                font-size: 13.5px;
                line-height: 1.45;
                color: #ddd;
                overflow-y: auto;
                scrollbar-width: none;
                margin: 6px 0 0 0;
            }
        }

        @media (max-width: 1024px), (max-height: 850px) {
            margin: 0.85rem 1rem;
            gap: 1rem;

            img,
            .right {
                height: clamp(130px, 18vh, 170px);
            }

            .right {
                span {
                    &.title-0 {
                        font-size: 1.15rem;
                    }

                    &.title-1 {
                        font-size: 0.95rem;
                    }

                    &.title-2 {
                        font-size: 0.8rem;
                    }
                }

                p {
                    font-size: 12.5px;
                    line-height: 1.35;
                }
            }
        }

        @media (max-width: 640px) {
            margin: 0.65rem 0.75rem;
            gap: 0.75rem;

            img,
            .right {
                height: 120px;
            }

            .right {
                span {
                    &.title-0 {
                        font-size: 1rem;
                    }

                    &.title-1 {
                        font-size: 0.85rem;
                    }

                    &.title-2 {
                        display: none;
                    }
                }

                p {
                    font-size: 12px;
                    line-height: 1.3;
                    margin-top: 4px;
                }
            }
        }
    }
</style>
