<script lang="ts">
    import { fade } from "svelte/transition";
    import { watch } from "runed";
    import Button from "../../lib/Button.svelte";
    import Skeleton from "../../lib/Skeleton.svelte";
    import {
        apiBaseUrl,
        selectedAnimeAnilistId,
    } from "../../lib/context.svelte";
    import type EpisodeData from "../../types/Episode";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";
    import CheckIcon from "phosphor-svelte/lib/CheckIcon";
    import EyeIcon from "phosphor-svelte/lib/EyeIcon";
    import DownloadIcon from "phosphor-svelte/lib/DownloadIcon";
    import ImageIcon from "phosphor-svelte/lib/ImageIcon";

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

    const isFuture = (airingAt: string | null) => {
        if (!airingAt) return true;
        return new Date(airingAt).getTime() > Date.now();
    };


    const toggleWatch = async (episode: EpisodeData) => {
        const newStatus = !episode.watched;
        episode.watched = newStatus;

        try {
            const url = new URL(
                `/api/episodes/${episode.id}/watch`,
                apiBaseUrl.current,
            );
            const response = await fetch(url.toString(), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ watched: newStatus }),
                credentials: "include",
            });
            if (!response.ok) {
                throw new Error("Failed to update watch status");
            }
        } catch (error) {
            console.error(error);
            episode.watched = !newStatus;
        }
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
            <div class="episode-card" transition:fade={{ duration: 200 }}>
                <div class="number"><span>{episode.number}</span></div>
                <div class="thumbnail-container">
                    <div class="placeholder">
                        <ImageIcon size="2rem" color="#666" />
                    </div>
                    {#if episode.thumbnailUrl}
                        <img
                            src={episode.thumbnailUrl}
                            alt=""
                            class="episode-thumbnail"
                            onerror={(e) => (e.currentTarget as HTMLImageElement).style.display='none'}
                        />
                    {/if}
                </div>
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
                    <Button Icon={DownloadIcon} style="ghost" disabled={isFuture(episode.airingAt)} />
                    <Button Icon={episode.watched ? CheckIcon : EyeIcon} active={episode.watched} disabled={isFuture(episode.airingAt)} onclick={() => toggleWatch(episode)} />
                    <Button Icon={PlayIcon} disabled={isFuture(episode.airingAt)} />
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

            .thumbnail-container {
                position: relative;
                width: 160px;
                height: 90px;
                border-radius: 4px;
                overflow: hidden;
                flex-shrink: 0;

                .placeholder {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: #1d1a17;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .episode-thumbnail {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
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
