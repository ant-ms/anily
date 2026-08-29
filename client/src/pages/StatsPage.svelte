<script lang="ts">
    import { onMount } from "svelte";
    import { apiBaseUrl } from "$lib/context.svelte";
    import Button from "$lib/Button.svelte";
    import ArrowsClockwiseIcon from "phosphor-svelte/lib/ArrowsClockwiseIcon";
    import HardDrivesIcon from "phosphor-svelte/lib/HardDrivesIcon";
    import UploadSimpleIcon from "phosphor-svelte/lib/UploadSimpleIcon";
    import WarningCircleIcon from "phosphor-svelte/lib/WarningCircleIcon";
    import FolderIcon from "phosphor-svelte/lib/FolderIcon";
    import FileVideoIcon from "phosphor-svelte/lib/FileVideoIcon";

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

    let totals = $derived.by(() => {
        if (!stats) return { storageBytes: BigInt(0), uploadedBytes: BigInt(0), downloadedEpisodes: 0, totalEpisodes: 0, seedingCount: 0, uploadSpeed: 0 };
        let storageBytes = BigInt(0);
        let uploadedBytes = BigInt(0);
        let downloadedEpisodes = 0;
        let totalEpisodes = 0;
        let seedingCount = 0;
        let uploadSpeed = 0;

        for (const g of stats.groupings) {
            storageBytes += BigInt(g.totalBytes || 0);
            uploadedBytes += BigInt(g.totalUploadedBytes || 0);
            downloadedEpisodes += g.downloadedCount;
            totalEpisodes += g.episodeCount;
            seedingCount += g.uploadingCount;
            uploadSpeed += g.uploadSpeed;
        }

        return { storageBytes, uploadedBytes, downloadedEpisodes, totalEpisodes, seedingCount, uploadSpeed };
    });

    function formatBytes(bytesStrOrNum: string | number | bigint): string {
        const bytes = typeof bytesStrOrNum === "string" ? parseInt(bytesStrOrNum, 10) : Number(bytesStrOrNum);
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
            <p class="subtitle">Storage usage, seeding metrics per anime grouping, and storage integrity.</p>
        </div>
        <div class="actions">
            <Button Icon={ArrowsClockwiseIcon} onclick={fetchStats} style="ghost" />
        </div>
    </header>

    {#if loading}
        <div class="empty-state">Loading statistics…</div>
    {:else if error}
        <div class="empty-state error">Failed to load statistics: {error}</div>
    {:else if stats}
        <!-- Global Aggregated Totals Banner -->
        <div class="totals-overview">
            <div class="total-stat">
                <HardDrivesIcon size="1.4rem" color="#ffd52c" />
                <div class="data">
                    <span class="value">{formatBytes(totals.storageBytes)}</span>
                    <span class="label">Total Storage Used</span>
                </div>
            </div>
            <div class="total-stat">
                <UploadSimpleIcon size="1.4rem" color="#6fbf6f" />
                <div class="data">
                    <span class="value">{formatBytes(totals.uploadedBytes)}</span>
                    <span class="label">Total Uploaded ({totals.seedingCount} active)</span>
                </div>
            </div>
            <div class="total-stat">
                <FolderIcon size="1.4rem" color="#4a9fd4" />
                <div class="data">
                    <span class="value">{totals.downloadedEpisodes} / {totals.totalEpisodes}</span>
                    <span class="label">Downloaded Episodes</span>
                </div>
            </div>
            {#if totals.uploadSpeed > 0}
                <div class="total-stat">
                    <UploadSimpleIcon size="1.4rem" color="#ffd52c" />
                    <div class="data">
                        <span class="value">{formatSpeed(totals.uploadSpeed)}</span>
                        <span class="label">Current Upload Speed</span>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Orphan files / unbookmarked warning banner -->
        {#if stats.orphanTorrents.length > 0}
            <div class="orphan-alert">
                <div class="alert-header">
                    <WarningCircleIcon size="1.4rem" color="#ff5252" weight="fill" />
                    <h2>Unbookmarked Media Detected ({stats.orphanTorrents.length})</h2>
                </div>
                <p>
                    The following files/torrents in qBittorrent do not match any currently bookmarked anime grouping.
                    They may be unmanaged files taking up disk space:
                </p>
                <div class="orphan-list">
                    {#each stats.orphanTorrents as orphan}
                        <div class="orphan-item">
                            <FileVideoIcon size="1.1rem" color="#ff5252" />
                            <div class="orphan-info">
                                <span class="orphan-name">{orphan.name}</span>
                                <span class="orphan-meta">{formatBytes(orphan.size)} &bull; {orphan.savePath}</span>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Compact Grouping breakdown cards -->
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
                                    <FolderIcon size="1.5rem" color="#666" />
                                </div>
                            {/if}
                            <div class="card-meta">
                                <h3>{g.title}</h3>
                                <span class="badge">{g.downloadedCount}/{g.episodeCount} eps downloaded</span>
                            </div>
                        </div>

                        <div class="stats-row">
                            <div class="stat-pill">
                                <HardDrivesIcon size="1rem" color="#ffd52c" />
                                <div class="stat-data">
                                    <span class="val">{formatBytes(g.totalBytes)}</span>
                                    <span class="lbl">Storage</span>
                                </div>
                            </div>
                            <div class="stat-pill">
                                <UploadSimpleIcon size="1rem" color="#6fbf6f" />
                                <div class="stat-data">
                                    <span class="val">{formatBytes(g.totalUploadedBytes)}</span>
                                    <span class="lbl">Uploaded ({g.uploadingCount} seeding)</span>
                                </div>
                            </div>
                            {#if g.uploadSpeed > 0}
                                <div class="stat-pill">
                                    <UploadSimpleIcon size="1rem" color="#ffd52c" />
                                    <div class="stat-data">
                                        <span class="val">{formatSpeed(g.uploadSpeed)}</span>
                                        <span class="lbl">Speed</span>
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

        .totals-overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
            margin-bottom: 1.5rem;

            .total-stat {
                background: #1d1a17;
                border: 1px solid #2e2c29;
                border-radius: 8px;
                padding: 14px 18px;
                display: flex;
                align-items: center;
                gap: 14px;

                .data {
                    display: flex;
                    flex-direction: column;

                    .value {
                        font-size: 18px;
                        font-weight: 700;
                        color: #fff;
                    }

                    .label {
                        font-size: 12px;
                        color: #888;
                        margin-top: 2px;
                    }
                }
            }
        }

        .orphan-alert {
            background: #2b1111;
            border: 1px solid #ff5252;
            border-radius: 8px;
            padding: 1rem 1.25rem;
            margin-bottom: 1.5rem;

            .alert-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 0.35rem;

                h2 {
                    margin: 0;
                    font-size: 16px;
                    color: #ff5252;
                }
            }

            p {
                margin: 0 0 0.75rem 0;
                font-size: 13px;
                color: #fca5a5;
            }

            .orphan-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
                max-height: 180px;
                overflow-y: auto;

                .orphan-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(0, 0, 0, 0.4);
                    padding: 6px 10px;
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
                            font-size: 11px;
                            color: #aaa;
                        }
                    }
                }
            }
        }

        .groupings-grid {
            display: flex;
            flex-direction: column;
            gap: 10px;

            .grouping-card {
                background: #1d1a17;
                border: 1px solid #2e2c29;
                border-radius: 6px;
                padding: 10px 14px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                flex-wrap: wrap;

                .card-hero {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 240px;
                    flex: 1;

                    .card-thumb,
                    .thumb-placeholder {
                        width: 36px;
                        height: 50px;
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
                        gap: 2px;

                        h3 {
                            margin: 0;
                            font-size: 14px;
                            font-weight: 600;
                            color: #fff;
                        }

                        .badge {
                            font-size: 11px;
                            color: #888;
                        }
                    }
                }

                .stats-row {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    flex-wrap: wrap;

                    .stat-pill {
                        background: hsl(20, 17.6%, 8.5%);
                        border: 1px solid hsl(36, 5.7%, 20%);
                        border-radius: 5px;
                        padding: 6px 10px;
                        display: flex;
                        align-items: center;
                        gap: 8px;

                        .stat-data {
                            display: flex;
                            align-items: baseline;
                            gap: 5px;

                            .val {
                                font-size: 13px;
                                font-weight: 600;
                                color: #fff;
                            }

                            .lbl {
                                font-size: 11px;
                                color: #777;
                            }
                        }
                    }
                }
            }
        }
    }
</style>
