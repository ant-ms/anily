<script lang="ts">
    import Button from "../../lib/Button.svelte";
    import type AnimeDetailsData from "../../types/AnimeDetails";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";
    import EyeIcon from "phosphor-svelte/lib/EyeIcon";
    import EyeSlashIcon from "phosphor-svelte/lib/EyeSlashIcon";
    import DownloadIcon from "phosphor-svelte/lib/DownloadIcon";

    let {
        animeDetails,
    }: {
        animeDetails: AnimeDetailsData;
    } = $props();
</script>

<div class="episodes">
    {#each new Array(animeDetails.episodes) as _, i}
        <div class="episode-card">
            <div class="number"><span>{i + 1}</span></div>
            <img
                src="https://artworks.thetvdb.com/banners/episodes/352408/6814223.jpg"
                alt=""
                class="episode-thumbnail"
            />
            <div class="titles">
                <span class="title-1">English Title</span>
                <span class="title-2">Japanese Title</span>
                <span class="date">2026-02-01</span>
            </div>
            <div class="actions">
                <Button Icon={DownloadIcon} style="ghost" />
                <Button Icon={true ? EyeIcon : EyeSlashIcon} />
                <Button Icon={PlayIcon} />
            </div>
        </div>
    {/each}
</div>

<style lang="scss">
    .episodes {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        overflow: auto;
        padding: 1rem;

        .episode-card {
            display: flex;
            gap: 1rem;
            align-items: center;

            .number {
                background-color: #1d1a17;
                display: flex;
                gap: 0.5rem;
                height: 35px;
                width: 35px;
                border-radius: 5px;
                justify-content: center;
                align-items: center;

                span {
                    margin-top: 2px;
                    margin-left: 1px;
                }
            }

            .episode-thumbnail {
                width: 160px;
                height: 90px;
                object-fit: cover;
            }

            .titles {
                flex-grow: 1;

                display: flex;
                flex-direction: column;
                gap: 0.25rem;

                .title-1 {
                    font-size: 14px;
                }

                .title-2 {
                    font-size: 14px;
                }

                .date {
                    font-size: 13px;
                    color: #999;
                }
            }

            .actions {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }
        }
    }
</style>
