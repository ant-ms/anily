<script lang="ts">
    import { onMount } from "svelte";
    import { apiBaseUrl } from "$lib/context.svelte";
    import Button from "$lib/Button.svelte";
    import {
        ArrowClockwise,
        HardDrives,
        UploadSimple,
        WarningCircle,
        FolderNotchOpen,
        FileVideo,
    } from "phosphor-svelte";

    type GroupingStat = {
        id: number;
        title: string;
        thumbnailUrl: string | null;
        itemsCount: number;
        episodeCount: number;
        downloadedCount: number;
        totalBytes: string;
        uploadingCount: number;
        totalUploadedBytes: string;
        uploadSpeed: number;
    };

    type OrphanTorrent = {
        hash: string;
        name: string;
        size: number;
        savePath: string;
    };

    type StatsResponse = {
        groupings: GroupingStat[];
        orphanTorrents: OrphanTorrent[];
        totalTorrents: number;
    };

    let loading = $state(true);
    let error = $state<string | null>(null);
    let stats = $state<StatsResponse | null>(null);

    const fetchStats = async () => {
        loading = true;
        try {
            const url = new URL("/api/media/stats", apiBaseUrl.current);
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            stats = await res.json();
            error = null;
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            loading = false;
        }
    };

    function formatBytes(bytesStrOrNum: string | number): string {
        const bytes = typeof bytesStrOrNum === "string" ? parseInt(bytesStrOrNum, 10) : bytesStrOrNum;
        if (isNaN(bytes) || bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    function formatSpeed(bytesPerSec: number): string {
        if (!bytesPerSec || bytesPerSec === 0) return "0 KB/s";
        const kb = bytesPerSec / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB/s`;
        return `${(kb / 1024).toFixed(2)} MB/s`;
    }

    onMount(fetchStats);
</script>

<div id="stats-page">
    <header>
        <div>
            <h1>Storage & Seeding Statistics</h1>
            <p class="subtitle">Storage usage, seeding statistics per anime grouping, and storage integrity checks.</p>
        </div>
        <div class="actions">
            <Button Icon={ArrowClockwise} onclick={fetchStats} style="ghost" />
        </div>
    </header>

    {#if loading}
        <div class="empty-state">Loading statistics…</div>
    {:else if error}
        <div class="empty-state error">Failed to load statistics: {error}</div>
    {:else if stats}
        <!-- Orphan files / unbookmarked warning banner -->
        {#if stats.orphanTorrents.length > 0}
            <div class="orphan-alert">
                <div class="alert-header">
                    <WarningCircle size="1.5rem" color="#ff5252" weight="fill" />
                    <h2>Unbookmarked Media Detected ({stats.orphanTorrents.length})</h2>
                </div>
                <p>
                    The following files/torrents in qBittorrent do not match any currently bookmarked anime grouping.
                    They may be leftover downloads or unmanaged files taking up disk space:
                </p>
                <div class="orphan-list">
                    {#each stats.orphanTorrents as orphan}
                        <div class="orphan-item">
                            <FileVideo size="1.2rem" color="#ff5252" />
                            <div class="orphan-info">
                                <span class="orphan-name">{orphan.name}</span>
                                <span class="orphan-meta">{formatBytes(orphan.size)} &bull; {orphan.savePath}</span>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Grouping breakdown cards -->
        <div class="groupings-grid">
            {#if stats.groupings.length === 0}
                <div class="empty-state">No bookmarked anime groupings found.</div>
            {:else}
                {#each stats.groupings as g (g.id)}
                    <div class="grouping-card">
                        <div class="card-hero">
                            {#if g.thumbnailUrl}
                                <img src={g.thumbnailUrl} alt="" class="card-thumb" />
                            {:else}
                                <div class="thumb-placeholder">
                                    <FolderNotchOpen size="2rem" color="#666" />
                                </div>
                            {/if}
                            <div class="card-meta">
                                <h3>{g.title}</h3>
                                <span class="badge">{g.downloadedCount} / {g.episodeCount} episodes downloaded</span>
                            </div>
                        </div>

                        <div class="stats-row">
                            <div class="stat-pill">
                                <HardDrives size="1.1rem" color="#ffd52c" />
                                <div class="stat-data">
                                    <span class="val">{formatBytes(g.totalBytes)}</span>
                                    <span class="lbl">Storage Used</span>
                                </div>
                            </div>
                            <div class="stat-pill">
                                <UploadSimple size="1.1rem" color="#6fbf6f" />
                                <div class="stat-data">
                                    <span class="val">{formatBytes(g.totalUploadedBytes)}</span>
                                    <span class="lbl">Uploaded ({g.uploadingCount} seeding)</span>
                                </div>
                            </div>
                            {#if g.uploadSpeed > 0}
                                <div class="stat-pill">
                                    <span class="speed-indicator">⚡</span>
                                    <div class="stat-data">
                                        <span class="val">{formatSpeed(g.uploadSpeed)}</span>
                                        <span class="lbl">Upload Speed</span>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    {/if}
</div>

<style lang="scss">
    #stats-page {
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
            }
        }

        .empty-state {
            padding: 3rem;
            text-align: center;
            color: #888;
            background: #1d1a17;
            border-radius: 8px;
            border: 1px solid #2e2c29;

            &.error {
                color: #ff6b6b;
            }
        }

        .orphan-alert {
            background: #2b1111;
            border: 1px solid #ff5252;
            border-radius: 8px;
            padding: 1.25rem;
            margin-bottom: 2rem;

            .alert-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 0.5rem;

                h2 {
                    margin: 0;
                    font-size: 18px;
                    color: #ff5252;
                }
            }

            p {
                margin: 0 0 1rem 0;
                font-size: 14px;
                color: #fca5a5;
            }

            .orphan-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
                max-height: 200px;
                overflow-y: auto;

                .orphan-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(0, 0, 0, 0.4);
                    padding: 8px 12px;
                    border-radius: 6px;

                    .orphan-info {
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                        overflow: hidden;

                        .orphan-name {
                            font-size: 13px;
                            color: #fff;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        }

                        .orphan-meta {
                            font-size: 12px;
                            color: #aaa;
                        }
                    }
                }
            }
        }

        .groupings-grid {
            display: flex;
            flex-direction: column;
            gap: 1rem;

            .grouping-card {
                background: #1d1a17;
                border: 1px solid #2e2c29;
                border-radius: 8px;
                padding: 1.25rem;
                display: flex;
                flex-direction: column;
                gap: 1rem;

                .card-hero {
                    display: flex;
                    align-items: center;
                    gap: 1rem;

                    .card-thumb,
                    .thumb-placeholder {
                        width: 50px;
                        height: 70px;
                        border-radius: 4px;
                        object-fit: cover;
                        background: #13100e;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }

                    .card-meta {
                        display: flex;
                        flex-direction: column;
                        gap: 4px;

                        h3 {
                            margin: 0;
                            font-size: 16px;
                            color: #fff;
                        }

                        .badge {
                            font-size: 12px;
                            color: #aaa;
                        }
                    }
                }

                .stats-row {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;

                    .stat-pill {
                        background: hsl(20, 17.6%, 8.5%);
                        border: 1px solid hsl(36, 5.7%, 20%);
                        border-radius: 6px;
                        padding: 8px 14px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        min-width: 160px;

                        .speed-indicator {
                            font-size: 1.1rem;
                        }

                        .stat-data {
                            display: flex;
                            flex-direction: column;

                            .val {
                                font-size: 14px;
                                font-weight: 600;
                                color: #fff;
                            }

                            .lbl {
                                font-size: 11px;
                                color: #888;
                            }
                        }
                    }
                }
            }
        }
    }
</style>
