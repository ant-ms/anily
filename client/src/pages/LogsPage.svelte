<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Button from "$lib/Button.svelte";
    import { apiBaseUrl } from "$lib/context.svelte";
    import ArrowsClockwiseIcon from "phosphor-svelte/lib/ArrowsClockwiseIcon";
    import CheckCircleIcon from "phosphor-svelte/lib/CheckCircleIcon";
    import XCircleIcon from "phosphor-svelte/lib/XCircleIcon";
    import ClockIcon from "phosphor-svelte/lib/ClockIcon";
    import CalendarBlankIcon from "phosphor-svelte/lib/CalendarBlankIcon";
    import CursorIcon from "phosphor-svelte/lib/CursorIcon";
    import WarningCircleIcon from "phosphor-svelte/lib/WarningCircleIcon";
    import CaretDownIcon from "phosphor-svelte/lib/CaretDownIcon";
    import CaretUpIcon from "phosphor-svelte/lib/CaretUpIcon";
    import DatabaseIcon from "phosphor-svelte/lib/DatabaseIcon";

    type SyncJobType = "ANILIST_SYNC" | "EPISODE_METADATA";
    type SyncJobStatus = "RUNNING" | "COMPLETED" | "FAILED";
    type SyncJobTrigger = "SCHEDULED" | "MANUAL";

    type SyncJobWarning = {
        anilistId: number;
        title: string;
        message: string;
    };

    type SyncJobDetails = {
        animeChecked?: number;
        titlesUpdated?: number;
        detailsUpdated?: number;
        episodesUpdated?: number;
        groupingsUpdated?: number;
        warnings?: SyncJobWarning[];
    };

    type SyncJob = {
        id: number;
        type?: SyncJobType;
        trigger: SyncJobTrigger;
        status: SyncJobStatus;
        startedAt: string;
        completedAt: string | null;
        updatesCount: number | null;
        details?: SyncJobDetails | null;
        error: string | null;
    };

    let jobs: SyncJob[] = $state([]);
    let loading = $state(true);
    let error: string | null = $state(null);
    let activeTypeFilter: "ALL" | SyncJobType = $state("ALL");
    let expandedWarnings: Record<number, boolean> = $state({});
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const fetchJobs = async () => {
        try {
            const url = new URL("/api/sync-jobs", apiBaseUrl.current);
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            jobs = await res.json();
            error = null;
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            loading = false;
        }
    };

    const hasRunningJob = $derived(jobs.some((j) => j.status === "RUNNING"));

    const filteredJobs = $derived(
        activeTypeFilter === "ALL"
            ? jobs
            : jobs.filter((j) => (j.type ?? "ANILIST_SYNC") === activeTypeFilter)
    );

    const toggleWarnings = (id: number) => {
        expandedWarnings[id] = !expandedWarnings[id];
    };

    const getJobTypeName = (type?: SyncJobType) => {
        switch (type) {
            case "ANILIST_SYNC":
                return "AniList Sync";
            case "EPISODE_METADATA":
                return "Episode Metadata";
            default:
                return "AniList Sync";
        }
    };

    onMount(() => {
        fetchJobs();
    });

    onDestroy(() => {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    });

    // Poll every 3s while a job is running
    $effect(() => {
        if (hasRunningJob) {
            if (!pollInterval) {
                pollInterval = setInterval(fetchJobs, 3000);
            }
        } else {
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
        }
    });

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    const formatDuration = (start: string, end: string | null) => {
        if (!end) return null;
        const ms = new Date(end).getTime() - new Date(start).getTime();
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        return `${m}m ${s}s`;
    };
</script>

<div id="logs-page">
    <header>
        <div class="title-group">
            <h1>Scheduled & System Jobs</h1>
            <p class="subtitle">Background schedulers, metadata synchronizers, and execution logs</p>
        </div>
        <div class="actions">
            <Button Icon={ArrowsClockwiseIcon} onclick={fetchJobs} style="ghost" />
        </div>
    </header>

    <div class="filter-bar">
        <button
            type="button"
            class="filter-pill"
            class:active={activeTypeFilter === "ALL"}
            onclick={() => (activeTypeFilter = "ALL")}
        >
            All Jobs ({jobs.length})
        </button>
        <button
            type="button"
            class="filter-pill"
            class:active={activeTypeFilter === "ANILIST_SYNC"}
            onclick={() => (activeTypeFilter = "ANILIST_SYNC")}
        >
            AniList Sync ({jobs.filter((j) => (j.type ?? "ANILIST_SYNC") === "ANILIST_SYNC").length})
        </button>
        <button
            type="button"
            class="filter-pill"
            class:active={activeTypeFilter === "EPISODE_METADATA"}
            onclick={() => (activeTypeFilter = "EPISODE_METADATA")}
        >
            Episode Metadata ({jobs.filter((j) => j.type === "EPISODE_METADATA").length})
        </button>
    </div>

    {#if loading}
        <div class="empty-state">Loading…</div>
    {:else if error}
        <div class="empty-state error">Failed to load jobs: {error}</div>
    {:else if filteredJobs.length === 0}
        <div class="empty-state">No jobs found for the selected filter.</div>
    {:else}
        <div class="job-list">
            {#each filteredJobs as job (job.id)}
                {@const duration = formatDuration(job.startedAt, job.completedAt)}
                {@const warnings = job.details?.warnings ?? []}
                {@const hasWarnings = warnings.length > 0}
                {@const isExpanded = !!expandedWarnings[job.id]}
                <div class="job-card" class:running={job.status === "RUNNING"} class:failed={job.status === "FAILED"}>
                    <div class="job-header">
                        <div class="job-status-group">
                            <div class="job-status">
                                {#if job.status === "COMPLETED"}
                                    <CheckCircleIcon class="icon completed" weight="fill" size="1.15rem" />
                                {:else if job.status === "FAILED"}
                                    <XCircleIcon class="icon failed" weight="fill" size="1.15rem" />
                                {:else}
                                    <ClockIcon class="icon running" size="1.15rem" />
                                {/if}
                                <span class="status-label {job.status.toLowerCase()}">{job.status}</span>
                            </div>
                            <span class="job-type-pill">
                                <DatabaseIcon size="0.8rem" />
                                {getJobTypeName(job.type)}
                            </span>
                        </div>

                        <div class="job-trigger">
                            {#if job.trigger === "SCHEDULED"}
                                <CalendarBlankIcon size="0.85rem" />
                                <span>Scheduled</span>
                            {:else}
                                <CursorIcon size="0.85rem" />
                                <span>Manual</span>
                            {/if}
                        </div>
                    </div>

                    <div class="job-meta">
                        <span class="meta-item">
                            Started {formatDate(job.startedAt)}
                        </span>
                        {#if duration}
                            <span class="meta-item">· Duration: {duration}</span>
                        {/if}
                        {#if job.status === "RUNNING"}
                            <span class="meta-item running-pulse">· Running…</span>
                        {/if}
                    </div>

                    <!-- Metrics / Updates breakdown -->
                    {#if job.status === "COMPLETED"}
                        {#if job.details}
                            <div class="metrics-grid">
                                <div class="metric-badge">
                                    <span class="metric-val">{job.details.animeChecked ?? job.updatesCount ?? 0}</span>
                                    <span class="metric-key">Checked</span>
                                </div>
                                <div class="metric-badge">
                                    <span class="metric-val">{job.details.titlesUpdated ?? 0}</span>
                                    <span class="metric-key">Titles & Relations</span>
                                </div>
                                <div class="metric-badge">
                                    <span class="metric-val">{job.details.detailsUpdated ?? 0}</span>
                                    <span class="metric-key">Details Refreshed</span>
                                </div>
                                <div class="metric-badge">
                                    <span class="metric-val">{job.details.episodesUpdated ?? 0}</span>
                                    <span class="metric-key">Episodes Synced</span>
                                </div>
                                <div class="metric-badge">
                                    <span class="metric-val">{job.details.groupingsUpdated ?? 0}</span>
                                    <span class="metric-key">Groupings Updated</span>
                                </div>
                            </div>
                        {:else if job.updatesCount !== null}
                            <div class="job-updates">
                                {job.updatesCount === 0
                                    ? "No updates found"
                                    : `${job.updatesCount} anime updated`}
                            </div>
                        {/if}
                    {/if}

                    <!-- Warnings section -->
                    {#if hasWarnings}
                        <div class="job-warnings">
                            <button
                                type="button"
                                class="warning-toggle"
                                onclick={() => toggleWarnings(job.id)}
                            >
                                <WarningCircleIcon class="warning-icon" weight="fill" size="1.05rem" />
                                <span>{warnings.length} warning{warnings.length > 1 ? "s" : ""} occurred during sync</span>
                                {#if isExpanded}
                                    <CaretUpIcon size="0.9rem" />
                                {:else}
                                    <CaretDownIcon size="0.9rem" />
                                {/if}
                            </button>

                            {#if isExpanded}
                                <div class="warning-list">
                                    {#each warnings as warn}
                                        <div class="warning-item">
                                            <span class="warn-title">{warn.title}:</span>
                                            <span class="warn-msg">{warn.message}</span>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}

                    {#if job.error}
                        <div class="job-error">
                            <span class="error-label">Error:</span>
                            {job.error}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style lang="scss">
    #logs-page {
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        color: #e8e4df;

        @media (max-width: 768px) {
            padding: 12px 14px;
            gap: 12px;
        }

        header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;

            .title-group {
                display: flex;
                flex-direction: column;
                gap: 4px;

                h1 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #e8e4df;
                    margin: 0;
                }

                .subtitle {
                    margin: 0;
                    font-size: 0.82rem;
                    color: #857f78;
                }
            }

            .actions {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-shrink: 0;
            }
        }

        .filter-bar {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 2px;

            .filter-pill {
                background: hsl(20, 17.6%, 10%);
                border: 1px solid hsl(36, 5.7%, 20%);
                color: #a09890;
                font-size: 0.8rem;
                font-weight: 500;
                padding: 5px 12px;
                border-radius: 9999px;
                cursor: pointer;
                transition: all 0.15s ease;
                white-space: nowrap;

                &:hover {
                    background: hsl(20, 17.6%, 14%);
                    color: #e8e4df;
                }

                &.active {
                    background: rgba(255, 213, 44, 0.12);
                    border-color: rgba(255, 213, 44, 0.4);
                    color: #ffd52c;
                    font-weight: 600;
                }
            }
        }

        .empty-state {
            color: #857f78;
            font-size: 0.9rem;
            padding: 36px 0;
            text-align: center;

            &.error {
                color: #e57373;
            }
        }

        .job-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .job-card {
            background: hsl(20, 17.6%, 8.5%);
            border: 1px solid hsl(36, 5.7%, 18%);
            border-radius: 10px;
            padding: 14px 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            transition: border-color 0.2s;

            &.running {
                border-color: hsl(44, 80%, 50%);
            }

            &.failed {
                border-color: hsl(0, 55%, 45%);
            }

            .job-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 8px;

                .job-status-group {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .job-status {
                    display: flex;
                    align-items: center;
                    gap: 6px;

                    :global(.icon.completed) {
                        color: #66bb6a;
                    }
                    :global(.icon.failed) {
                        color: #e57373;
                    }
                    :global(.icon.running) {
                        color: #ffd52c;
                        animation: spin 1.5s linear infinite;
                    }

                    .status-label {
                        font-size: 0.85rem;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;

                        &.completed { color: #66bb6a; }
                        &.failed    { color: #e57373; }
                        &.running   { color: #ffd52c; }
                    }
                }

                .job-type-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    background: hsl(20, 17.6%, 13%);
                    border: 1px solid hsl(36, 5.7%, 24%);
                    border-radius: 6px;
                    padding: 3px 8px;
                    font-size: 0.75rem;
                    color: #d0c8c0;
                    font-weight: 500;
                }

                .job-trigger {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: #857f78;
                    font-size: 0.8rem;
                }
            }

            .job-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                font-size: 0.8rem;
                color: #857f78;

                .running-pulse {
                    color: #ffd52c;
                    animation: pulse 1.5s ease-in-out infinite;
                }
            }

            .metrics-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;

                .metric-badge {
                    background: hsl(20, 17.6%, 12%);
                    border: 1px solid hsl(36, 5.7%, 20%);
                    border-radius: 6px;
                    padding: 4px 10px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8rem;

                    .metric-val {
                        color: #ffd52c;
                        font-weight: 600;
                    }

                    .metric-key {
                        color: #a09890;
                    }
                }
            }

            .job-updates {
                font-size: 0.85rem;
                color: #c4bfb9;
                background: hsl(20, 17.6%, 12%);
                border-radius: 4px;
                padding: 6px 10px;
            }

            .job-warnings {
                background: rgba(255, 171, 0, 0.08);
                border: 1px solid rgba(255, 171, 0, 0.25);
                border-radius: 6px;
                overflow: hidden;

                .warning-toggle {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 7px 12px;
                    background: transparent;
                    border: none;
                    color: #ffab00;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    text-align: left;
                    justify-content: flex-start;

                    :global(.warning-icon) {
                        flex-shrink: 0;
                    }

                    span {
                        flex: 1;
                    }

                    &:hover {
                        background: rgba(255, 171, 0, 0.05);
                    }
                }

                .warning-list {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    padding: 6px 12px 10px 12px;
                    border-top: 1px solid rgba(255, 171, 0, 0.15);

                    .warning-item {
                        font-size: 0.78rem;
                        color: #ded7ce;
                        line-height: 1.4;

                        .warn-title {
                            font-weight: 600;
                            color: #ffab00;
                            margin-right: 4px;
                        }

                        .warn-msg {
                            color: #c4bfb9;
                        }
                    }
                }
            }

            .job-error {
                font-size: 0.8rem;
                color: #e57373;
                background: hsl(0, 30%, 10%);
                border-radius: 4px;
                padding: 8px 10px;
                word-break: break-word;

                .error-label {
                    font-weight: 600;
                    margin-right: 4px;
                }
            }
        }
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.4; }
    }
</style>
