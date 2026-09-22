<script lang="ts">
    import { onMount } from "svelte";
    import IconButton from "$lib/IconButton.svelte";
    import SegmentedControl from "$lib/SegmentedControl.svelte";
    import StatusIndicator from "$lib/StatusIndicator.svelte";
    import Alert from "$lib/Alert.svelte";
    import EmptyState from "$lib/EmptyState.svelte";
    import { apiBaseUrl } from "$lib/context.svelte";
    import ArrowsClockwiseIcon from "phosphor-svelte/lib/ArrowsClockwiseIcon";
    import CalendarBlankIcon from "phosphor-svelte/lib/CalendarBlankIcon";
    import CursorIcon from "phosphor-svelte/lib/CursorIcon";
    import DatabaseIcon from "phosphor-svelte/lib/DatabaseIcon";
    import type { SyncJob, SyncJobType } from "../types/SyncJob";

    let jobs: SyncJob[] = $state([]);
    let loading = $state(true);
    let error: string | null = $state(null);
    let activeTypeFilter: "ALL" | SyncJobType = $state("ALL");
    let expandedWarnings: Record<number, boolean> = $state({});

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

    const filterOptions = $derived([
        { value: "ALL", label: `All Jobs (${jobs.length})` },
        {
            value: "ANILIST_SYNC",
            label: `AniList Sync (${jobs.filter((j) => (j.type ?? "ANILIST_SYNC") === "ANILIST_SYNC").length})`,
        },
        {
            value: "EPISODE_METADATA",
            label: `Episode Metadata (${jobs.filter((j) => j.type === "EPISODE_METADATA").length})`,
        },
    ]);

    const JOB_TYPE_NAMES: Record<string, string> = {
        ANILIST_SYNC: "AniList Sync",
        EPISODE_METADATA: "Episode Metadata",
    };

    const getJobTypeName = (type?: SyncJobType): string =>
        JOB_TYPE_NAMES[type ?? "ANILIST_SYNC"] ?? "AniList Sync";

    onMount(() => {
        fetchJobs();
    });

    // Poll every 3s while a job is running; the effect teardown clears the interval on re-run
    $effect(() => {
        if (!hasRunningJob) return;

        const interval = setInterval(fetchJobs, 3000);
        return () => clearInterval(interval);
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
            <IconButton
                Icon={ArrowsClockwiseIcon}
                onclick={fetchJobs}
                variant="tonal"
                shape="circle"
                size="standard"
                title="Refresh jobs"
                ariaLabel="Refresh jobs"
                loading={loading}
            />
        </div>
    </header>

    <div class="filter-bar">
        <SegmentedControl
            variant="chips"
            items={filterOptions}
            bind:value={activeTypeFilter}
        />
    </div>

    {#if loading}
        <EmptyState title="Loading…" />
    {:else if error}
        <EmptyState variant="error" title="Failed to load jobs" description={error} />
    {:else if filteredJobs.length === 0}
        <EmptyState title="No jobs found for the selected filter." />
    {:else}
        <div class="job-list">
            {#each filteredJobs as job (job.id)}
                {@const duration = formatDuration(job.startedAt, job.completedAt)}
                {@const warnings = job.details?.warnings ?? []}
                {@const hasWarnings = warnings.length > 0}
                <div class="job-card" class:running={job.status === "RUNNING"} class:failed={job.status === "FAILED"}>
                    <div class="job-header">
                        <div class="job-status-group">
                            <StatusIndicator status={job.status} variant="inline" />
                            <span class="meta-separator" aria-hidden="true">•</span>
                            <span class="job-type-label">
                                <DatabaseIcon size="1rem" />
                                <span>{getJobTypeName(job.type)}</span>
                            </span>
                        </div>

                        <div class="job-trigger">
                            {#if job.trigger === "SCHEDULED"}
                                <CalendarBlankIcon size="0.95rem" />
                                <span>Scheduled</span>
                            {:else}
                                <CursorIcon size="0.95rem" />
                                <span>Manual</span>
                            {/if}
                        </div>
                    </div>

                    <div class="job-meta">
                        <span class="meta-item">Started {formatDate(job.startedAt)}</span>
                        {#if duration}
                            <span class="meta-dot" aria-hidden="true">·</span>
                            <span class="meta-item">Duration: {duration}</span>
                        {/if}
                        {#if job.status === "RUNNING"}
                            <span class="meta-dot" aria-hidden="true">·</span>
                            <span class="meta-item running-pulse">Running…</span>
                        {/if}
                    </div>

                    <!-- Metrics / Updates breakdown -->
                    {#if job.status === "COMPLETED"}
                        {#if job.details}
                            <div class="job-metrics">
                                <span class="metric-item">
                                    <strong class="metric-value">{job.details.animeChecked ?? job.updatesCount ?? 0}</strong>
                                    <span class="metric-label">Checked</span>
                                </span>
                                <span class="metric-dot" aria-hidden="true">·</span>
                                <span class="metric-item">
                                    <strong class="metric-value">{job.details.titlesUpdated ?? 0}</strong>
                                    <span class="metric-label">Titles & Relations</span>
                                </span>
                                <span class="metric-dot" aria-hidden="true">·</span>
                                <span class="metric-item">
                                    <strong class="metric-value">{job.details.detailsUpdated ?? 0}</strong>
                                    <span class="metric-label">Details Refreshed</span>
                                </span>
                                <span class="metric-dot" aria-hidden="true">·</span>
                                <span class="metric-item">
                                    <strong class="metric-value">{job.details.episodesUpdated ?? 0}</strong>
                                    <span class="metric-label">Episodes Synced</span>
                                </span>
                                <span class="metric-dot" aria-hidden="true">·</span>
                                <span class="metric-item">
                                    <strong class="metric-value">{job.details.groupingsUpdated ?? 0}</strong>
                                    <span class="metric-label">Groupings Updated</span>
                                </span>
                            </div>
                        {:else if job.updatesCount !== null}
                            <div class="job-metrics">
                                <span class="metric-item">
                                    <strong class="metric-value">{job.updatesCount}</strong>
                                    <span class="metric-label">{job.updatesCount === 1 ? "anime updated" : "anime updated"}</span>
                                </span>
                            </div>
                        {/if}
                    {/if}

                    <!-- Warnings section -->
                    {#if hasWarnings}
                        <Alert
                            variant="warning"
                            collapsible
                            bind:isOpen={expandedWarnings[job.id]}
                            title="{warnings.length} warning{warnings.length > 1 ? 's' : ''} occurred during sync"
                        >
                            <div class="warning-list">
                                {#each warnings as warn}
                                    <div class="warning-item">
                                        <span class="warn-title">{warn.title}:</span>
                                        <span class="warn-msg">{warn.message}</span>
                                    </div>
                                {/each}
                            </div>
                        </Alert>
                    {/if}

                    {#if job.error}
                        <Alert variant="error" title="Error:" message={job.error} />
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style lang="scss">
    #logs-page {
        --m3-surface: #12100e;
        --m3-surface-container-lowest: #0d0b0a;
        --m3-surface-container-low: #1c1917; /* Card fill: elevated from scaffold */
        --m3-surface-container: #24201d; /* Card hover fill */
        --m3-surface-container-high: #2c2825;
        --m3-surface-container-highest: #383430;
        --m3-on-surface: #f5efe9; /* Primary text (15:1 contrast against card) */
        --m3-on-surface-variant: #d4ccc5; /* Secondary text (11.5:1 contrast against card, WCAG AA) */
        --m3-outline: #938c84; /* WCAG AA contrast against card */
        --m3-outline-variant: #443e3a; /* Card border 1dp */
        --m3-primary: #ffd52c;
        --m3-secondary-container: #5c4728; /* Pronounced active chip fill */
        --m3-on-secondary-container: #ffe082;
        --m3-state-hover: rgba(245, 239, 233, 0.08);

        background: var(--m3-surface);
        color: var(--m3-on-surface);
        min-height: 100%;
        max-width: 1200px;
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;

        @media (max-width: 768px) {
            padding: 16px;
            gap: 12px;
        }

        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            border-bottom: none;

            .title-group {
                display: flex;
                flex-direction: column;
                gap: 4px;

                h1 {
                    font-size: 1.375rem;
                    font-weight: 600;
                    color: var(--m3-on-surface);
                    margin: 0;
                    letter-spacing: 0;
                    line-height: 1.25;
                }

                .subtitle {
                    margin: 0;
                    font-size: 0.875rem;
                    color: var(--m3-on-surface-variant);
                    line-height: 1.4;
                }
            }

            .actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }
        }

        .filter-bar {
            display: flex;
            overflow-x: auto;
            border-bottom: none;
            scrollbar-width: none;
            -ms-overflow-style: none;

            &::-webkit-scrollbar {
                display: none;
            }
        }

        .job-list {
            display: flex;
            flex-direction: column;
            gap: 8px; /* M3 standard 8dp vertical separation for cards */
        }

        .job-card {
            background: var(--m3-surface-container-low); /* Elevated from scaffold */
            border: 1px solid var(--m3-outline-variant); /* 1dp border */
            border-radius: 12px; /* M3 standard 12dp corner radius for Outlined Cards */
            padding: 16px; /* Uniform 16dp padding on all sides */
            display: flex;
            flex-direction: column;
            gap: 12px;
            box-sizing: border-box;
            transition:
                background 0.15s ease,
                border-color 0.15s ease;

            &:hover {
                background: var(--m3-surface-container);
            }

            &.running {
                border-color: var(--m3-primary);
            }

            &.failed {
                border-color: #f87171;
            }

            .job-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 12px;

                .job-status-group {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;

                    .meta-separator {
                        color: var(--m3-outline);
                        font-size: 0.8125rem;
                        user-select: none;
                    }

                    .job-type-label {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        color: var(--m3-on-surface);
                        font-size: 0.875rem;
                        font-weight: 500;
                    }
                }

                .job-trigger {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--m3-on-surface-variant);
                    font-size: 0.8125rem;
                    font-weight: 500; /* M3 labelMedium weight */
                    letter-spacing: 0.01em;
                    line-height: 1;
                }
            }

            .job-meta {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 8px;
                font-size: 0.8125rem;
                color: var(--m3-on-surface-variant);
                line-height: 1.4;

                .meta-dot {
                    color: var(--m3-outline);
                    font-weight: 700;
                    user-select: none;
                }

                .running-pulse {
                    color: #fde047;
                    font-weight: 600;
                    animation: pulse 1.5s ease-in-out infinite;
                }
            }

            .job-metrics {
                display: flex;
                flex-wrap: wrap;
                align-items: baseline;
                gap: 8px;
                font-size: 0.8125rem;
                line-height: 1.4;

                .metric-item {
                    display: inline-flex;
                    align-items: baseline;
                    gap: 4px;
                }

                .metric-value {
                    font-weight: 600;
                    color: var(--m3-on-surface);
                    font-variant-numeric: tabular-nums;
                }

                .metric-label {
                    color: var(--m3-on-surface-variant);
                    font-weight: 400;
                }

                .metric-dot {
                    color: var(--m3-outline);
                    font-weight: 700;
                    user-select: none;
                }
            }

            :global(.alert-box) {
                border-radius: 8px;
            }

            .warning-list {
                display: flex;
                flex-direction: column;
                gap: 6px;

                .warning-item {
                    font-size: 0.8125rem;
                    color: var(--m3-on-surface);
                    line-height: 1.4;

                    .warn-title {
                        font-weight: 600;
                        color: #ffab00;
                        margin-right: 4px;
                    }

                    .warn-msg {
                        color: var(--m3-on-surface-variant);
                    }
                }
            }
        }
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.4; }
    }
</style>
