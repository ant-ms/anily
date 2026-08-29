<script lang="ts">
    import { onMount } from "svelte";
    import { apiBaseUrl } from "$lib/context.svelte";
    import Button from "$lib/Button.svelte";
    import ArrowsClockwiseIcon from "phosphor-svelte/lib/ArrowsClockwiseIcon";
    import WarningCircleIcon from "phosphor-svelte/lib/WarningCircleIcon";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";
    import TorrentSelectionModal from "$lib/TorrentSelectionModal.svelte";
    import type { TorrentResult } from "../types/Media";

    type MissingEpisode = {
        id: number;
        number: number;
        title: string;
        airingAt: string;
        animeTitle: string;
        thumbnailUrl: string | null;
        lastSearchAt: string | null;
    };

    let loading = $state(true);
    let error = $state<string | null>(null);
    let episodes = $state<MissingEpisode[]>([]);
    let selectedModalEpisode = $state<MissingEpisode | null>(null);

    const fetchMissing = async () => {
        loading = true;
        try {
            const url = new URL("/api/media/missing", apiBaseUrl.current);
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            episodes = await res.json();
            error = null;
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            loading = false;
        }
    };

    const formatDate = (iso: string | null) => {
        if (!iso) return "Never";
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const handleManualDownload = async ({ episodeId, torrent }: { episodeId: number; torrent: TorrentResult }) => {
        try {
            const url = new URL("/api/media/download", apiBaseUrl.current);
            const res = await fetch(url.toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ episodeId, torrent }),
            });
            if (res.ok) {
                selectedModalEpisode = null;
                await fetchMissing();
            }
        } catch (err) {
            console.error("Failed to download selected torrent", err);
        }
    };

    onMount(fetchMissing);
</script>

<div id="missing-episodes-page">
    <header>
        <div>
            <h1>Missing Episodes</h1>
            <p class="subtitle">
                Episodes that aired over 8 days ago and could not be automatically found. Automated checks have stopped for these items.
            </p>
        </div>
        <div class="actions">
            <Button Icon={ArrowsClockwiseIcon} onclick={fetchMissing} style="ghost" />
        </div>
    </header>

    {#if loading}
        <div class="empty-state">Loading missing episodes…</div>
    {:else if error}
        <div class="empty-state error">Failed to load missing episodes: {error}</div>
    {:else if episodes.length === 0}
        <div class="empty-state">
            <WarningCircleIcon size="2rem" color="#4a9fd4" />
            <p>No missing episodes. All aired episodes for your bookmarked anime have been downloaded.</p>
        </div>
    {:else}
        <div class="episodes-list">
            {#each episodes as ep (ep.id)}
                <div class="missing-card">
                    {#if ep.thumbnailUrl}
                        <img src={ep.thumbnailUrl} alt="" class="card-thumb" />
                    {/if}
                    <div class="card-info">
                        <div class="anime-name">{ep.animeTitle}</div>
                        <div class="ep-title">Episode {ep.number}: {ep.title}</div>
                        <div class="meta">
                            <span>Aired: {formatDate(ep.airingAt)}</span>
                            <span>&bull;</span>
                            <span>Last Searched: {formatDate(ep.lastSearchAt)}</span>
                        </div>
                    </div>
                    <div class="actions">
                        <Button
                            Icon={PlayIcon}
                            style="ghost"
                            onclick={() => (selectedModalEpisode = ep)}
                        >
                            Select Torrent
                        </Button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

{#if selectedModalEpisode}
    <TorrentSelectionModal
        episodeId={selectedModalEpisode.id}
        episodeTitle={`${selectedModalEpisode.animeTitle} - Episode ${selectedModalEpisode.number}`}
        onconfirm={handleManualDownload}
        oncancel={() => (selectedModalEpisode = null)}
    />
{/if}

<style lang="scss">
    #missing-episodes-page {
        padding: 2rem;
        max-width: 1100px;
        margin: 0 auto;

        header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 2rem;

            h1 {
                margin: 0 0 0.5rem 0;
                font-size: 26px;
                color: #fff;
            }

            .subtitle {
                margin: 0;
                color: #999;
                font-size: 14px;
                max-width: 700px;
                line-height: 1.5;
            }
        }

        .empty-state {
            padding: 3rem;
            text-align: center;
            color: #888;
            background: #1d1a17;
            border-radius: 8px;
            border: 1px solid #2e2c29;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;

            &.error {
                color: #ff6b6b;
            }
        }

        .episodes-list {
            display: flex;
            flex-direction: column;
            gap: 10px;

            .missing-card {
                background: #1d1a17;
                border: 1px solid #2e2c29;
                border-radius: 8px;
                padding: 12px 16px;
                display: flex;
                align-items: center;
                gap: 14px;

                .card-thumb {
                    width: 70px;
                    height: 48px;
                    border-radius: 4px;
                    object-fit: cover;
                    background: #13100e;
                    flex-shrink: 0;
                }

                .card-info {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    flex-grow: 1;

                    .anime-name {
                        font-size: 14px;
                        font-weight: 600;
                        color: #fff;
                    }

                    .ep-title {
                        font-size: 13px;
                        color: #ccc;
                    }

                    .meta {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 11px;
                        color: #777;
                        margin-top: 2px;
                    }
                }
            }
        }
    }
</style>
