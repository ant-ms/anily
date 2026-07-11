<script lang="ts">
    import { watch } from "runed";
    import Button from "../../lib/Button.svelte";
    import Skeleton from "../../lib/Skeleton.svelte";
    import {
        apiBaseUrl,
        selectedAnimeAnilistId,
    } from "../../lib/context.svelte";
    import type EpisodeData from "../../types/Episode";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";
    import EyeIcon from "phosphor-svelte/lib/EyeIcon";
    import EyeSlashIcon from "phosphor-svelte/lib/EyeSlashIcon";
    import DownloadIcon from "phosphor-svelte/lib/DownloadIcon";

    let {
        updateSeed,
    }: {
        updateSeed: number;
    } = $props();

    let episodes: EpisodeData[] = $state([]);
    let loading = $state(true);

    watch(
        () => [selectedAnimeAnilistId.current, updateSeed],
        () => {
            const anilistId = selectedAnimeAnilistId.current;
            if (anilistId === undefined) return;

            loading = true;

            const url = new URL(
                `/api/episodes/${anilistId}`,
                apiBaseUrl.current,
            );
            fetch(url.toString(), { credentials: "include" })
                .then((results) => results.json())
                .then((data) => {
                    if (selectedAnimeAnilistId.current !== anilistId) return;
                    episodes = Array.isArray(data) ? data : [];
                    loading = false;
                });
        },
    );

    const formatAiringDate = (airingAt: string | null) => {
        if (!airingAt) return "TBA";
        return new Date(airingAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };
</script>

<div class="episodes">
    {#if loading}
        {#each Array(6) as _}
            <div class="episode-card">
                <div class="number">
                    <Skeleton width="35px" height="35px" />
                </div>
                <Skeleton width="160px" height="90px" radius="0" />
                <div class="titles">
                    <Skeleton width="55%" height="14px" />
                    <Skeleton width="40%" height="14px" />
                    <Skeleton width="25%" height="13px" />
                </div>
            </div>
        {/each}
    {:else}
        {#each episodes as episode (episode.number)}
            <div class="episode-card">
                <div class="number"><span>{episode.number}</span></div>
                <img
                    src={episode.thumbnailUrl ?? ""}
                    alt=""
                    class="episode-thumbnail"
                />
                <div class="titles">
                    <span class="title-1"
                        >{episode.titleEnglish ??
                            `Episode ${episode.number}`}</span
                    >
                    <span class="title-2">{episode.titleNative ?? ""}</span>
                    <span class="date"
                        >{formatAiringDate(episode.airingAt)}</span
                    >
                </div>
                <div class="actions">
                    <Button Icon={DownloadIcon} style="ghost" />
                    <Button Icon={episode.watched ? EyeIcon : EyeSlashIcon} />
                    <Button Icon={PlayIcon} />
                </div>
            </div>
        {/each}
    {/if}
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
