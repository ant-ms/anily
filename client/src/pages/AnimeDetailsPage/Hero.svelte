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
        margin: 2rem;

        img,
        .right {
            height: 350px;
        }

        img {
            aspect-ratio: 3/4;
            object-fit: cover;
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
                overflow: scroll;
                scrollbar-width: none;
            }
        }
    }
</style>
