<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Button from "$lib/Button.svelte";
    import SegmentedControl from "$lib/SegmentedControl.svelte";
    import StatusIndicator from "$lib/StatusIndicator.svelte";
    import Tag from "$lib/Tag.svelte";
    import Alert from "$lib/Alert.svelte";
    import EmptyState from "$lib/EmptyState.svelte";
    import { apiBaseUrl } from "$lib/context.svelte";
    import ArrowsClockwiseIcon from "phosphor-svelte/lib/ArrowsClockwiseIcon";
    import CalendarBlankIcon from "phosphor-svelte/lib/CalendarBlankIcon";
    import CursorIcon from "phosphor-svelte/lib/CursorIcon";
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
        <SegmentedControl
            variant="pills"
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
                            <StatusIndicator status={job.status} />
                            <Tag Icon={DatabaseIcon} label={getJobTypeName(job.type)} />
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
                                <Tag variant="metric" value={job.details.animeChecked ?? job.updatesCount ?? 0} label="Checked" />
                                <Tag variant="metric" value={job.details.titlesUpdated ?? 0} label="Titles & Relations" />
                                <Tag variant="metric" value={job.details.detailsUpdated ?? 0} label="Details Refreshed" />
                                <Tag variant="metric" value={job.details.episodesUpdated ?? 0} label="Episodes Synced" />
                                <Tag variant="metric" value={job.details.groupingsUpdated ?? 0} label="Groupings Updated" />
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
            overflow-x: auto;
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
            }

            .job-updates {
                font-size: 0.85rem;
                color: #c4bfb9;
                background: hsl(20, 17.6%, 12%);
                border-radius: 4px;
                padding: 6px 10px;
            }

            .warning-list {
                display: flex;
                flex-direction: column;
                gap: 4px;

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
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.4; }
    }
</style>
