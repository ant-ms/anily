<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Button from "$lib/Button.svelte";
    import { apiBaseUrl } from "$lib/context.svelte";
    import ArrowsClockwiseIcon from "phosphor-svelte/lib/ArrowsClockwiseIcon";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";
    import CheckCircleIcon from "phosphor-svelte/lib/CheckCircleIcon";
    import XCircleIcon from "phosphor-svelte/lib/XCircleIcon";
    import ClockIcon from "phosphor-svelte/lib/ClockIcon";
    import CalendarBlankIcon from "phosphor-svelte/lib/CalendarBlankIcon";
    import CursorIcon from "phosphor-svelte/lib/CursorIcon";

    type SyncJobStatus = "RUNNING" | "COMPLETED" | "FAILED";
    type SyncJobTrigger = "SCHEDULED" | "MANUAL";

    type SyncJob = {
        id: number;
        trigger: SyncJobTrigger;
        status: SyncJobStatus;
        startedAt: string;
        completedAt: string | null;
        updatesCount: number | null;
        error: string | null;
    };

    let jobs: SyncJob[] = $state([]);
    let loading = $state(true);
    let triggering = $state(false);
    let error: string | null = $state(null);
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

    const triggerSync = async () => {
        triggering = true;
        try {
            const url = new URL("/api/sync-jobs/trigger", apiBaseUrl.current);
            await fetch(url.toString(), {
                method: "POST",
                credentials: "include",
            });
            await fetchJobs();
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            triggering = false;
        }
    };

    const hasRunningJob = $derived(jobs.some((j) => j.status === "RUNNING"));

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
        <h1>Import Jobs</h1>
        <div class="actions">
            <Button Icon={ArrowsClockwiseIcon} onclick={fetchJobs} style="ghost" />
            <Button Icon={PlayIcon} onclick={triggerSync} disabled={triggering || hasRunningJob}>
                {triggering ? "Starting…" : "Run Now"}
            </Button>
        </div>
    </header>

    {#if loading}
        <div class="empty-state">Loading…</div>
    {:else if error}
        <div class="empty-state error">Failed to load jobs: {error}</div>
    {:else if jobs.length === 0}
        <div class="empty-state">No import jobs have run yet.</div>
    {:else}
        <div class="job-list">
            {#each jobs as job (job.id)}
                {@const duration = formatDuration(job.startedAt, job.completedAt)}
                <div class="job-card" class:running={job.status === "RUNNING"} class:failed={job.status === "FAILED"}>
                    <div class="job-header">
                        <div class="job-status">
                            {#if job.status === "COMPLETED"}
                                <CheckCircleIcon class="icon completed" weight="fill" size="1.1rem" />
                            {:else if job.status === "FAILED"}
                                <XCircleIcon class="icon failed" weight="fill" size="1.1rem" />
                            {:else}
                                <ClockIcon class="icon running" size="1.1rem" />
                            {/if}
                            <span class="status-label {job.status.toLowerCase()}">{job.status}</span>
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
                            <span class="meta-item">· {duration}</span>
                        {/if}
                        {#if job.status === "RUNNING"}
                            <span class="meta-item running-pulse">· Running…</span>
                        {/if}
                    </div>

                    {#if job.status === "COMPLETED" && job.updatesCount !== null}
                        <div class="job-updates">
                            {job.updatesCount === 0
                                ? "No updates found"
                                : `${job.updatesCount} anime updated`}
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

        header {
            display: flex;
            align-items: center;
            justify-content: space-between;

            h1 {
                font-size: 1.1rem;
                font-weight: 600;
                color: #e8e4df;
                margin: 0;
            }

            .actions {
                display: flex;
                gap: 8px;
                align-items: center;
            }
        }

        .empty-state {
            color: #857f78;
            font-size: 0.9rem;
            padding: 32px 0;
            text-align: center;

            &.error {
                color: #e57373;
            }
        }

        .job-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .job-card {
            background: hsl(20, 17.6%, 8.5%);
            border: 1px solid hsl(36, 5.7%, 18%);
            border-radius: 8px;
            padding: 14px 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
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
                gap: 4px;
                font-size: 0.8rem;
                color: #857f78;

                .running-pulse {
                    color: #ffd52c;
                    animation: pulse 1.5s ease-in-out infinite;
                }
            }

            .job-updates {
                font-size: 0.85rem;
                color: #c4bfb9;
                background: hsl(20, 17.6%, 12%);
                border-radius: 4px;
                padding: 6px 10px;
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
