<script lang="ts">
    import { onMount } from "svelte";
    import IconButton from "$lib/IconButton.svelte";
    import SegmentedControl from "$lib/SegmentedControl.svelte";
    import EmptyState from "$lib/EmptyState.svelte";
    import { apiBaseUrl } from "$lib/context.svelte";
    import { snackbar } from "$lib/snackbar.svelte";
    import ArrowsClockwiseIcon from "phosphor-svelte/lib/ArrowsClockwiseIcon";
    import TrashIcon from "phosphor-svelte/lib/TrashIcon";
    import ShieldCheckIcon from "phosphor-svelte/lib/ShieldCheckIcon";
    import CopyIcon from "phosphor-svelte/lib/CopyIcon";
    import CaretDownIcon from "phosphor-svelte/lib/CaretDownIcon";
    import CaretUpIcon from "phosphor-svelte/lib/CaretUpIcon";
    import WarningCircleIcon from "phosphor-svelte/lib/WarningCircleIcon";
    import DownloadSimpleIcon from "phosphor-svelte/lib/DownloadSimpleIcon";
    import BroadcastIcon from "phosphor-svelte/lib/BroadcastIcon";
    import ArrowsLeftRightIcon from "phosphor-svelte/lib/ArrowsLeftRightIcon";
    import MagnifyingGlassIcon from "phosphor-svelte/lib/MagnifyingGlassIcon";
    import type { ErrorCategory, ErrorTraceEntry, ErrorQueryResponse } from "../types/ErrorTrace";

    let errors: ErrorTraceEntry[] = $state([]);
    let countsByCategory: Record<string, number> = $state({
        ALL: 0,
        DOWNLOAD: 0,
        STREAM: 0,
        SYNC: 0,
        HTTP: 0,
        SYSTEM: 0,
    });
    let loading = $state(true);
    let fetchError: string | null = $state(null);
    let activeCategoryFilter: "ALL" | ErrorCategory = $state("ALL");
    let searchQuery = $state("");
    let expandedErrors: Record<string, boolean> = $state({});
    let isClearing = $state(false);

    const fetchErrors = async () => {
        try {
            if (!apiBaseUrl.current) return;
            const url = new URL("/api/errors", apiBaseUrl.current);
            if (activeCategoryFilter !== "ALL") {
                url.searchParams.set("category", activeCategoryFilter);
            }
            if (searchQuery.trim()) {
                url.searchParams.set("query", searchQuery.trim());
            }
            url.searchParams.set("limit", "100");

            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: ErrorQueryResponse = await res.json();
            errors = data.errors ?? [];
            countsByCategory = { ...countsByCategory, ...(data.countsByCategory ?? {}) };
            fetchError = null;
        } catch (e) {
            fetchError = e instanceof Error ? e.message : String(e);
        } finally {
            loading = false;
        }
    };

    const clearErrors = async () => {
        if (!confirm("Are you sure you want to clear all error records?")) return;
        try {
            isClearing = true;
            if (!apiBaseUrl.current) return;
            const url = new URL("/api/errors/clear", apiBaseUrl.current);
            const res = await fetch(url.toString(), {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            errors = [];
            countsByCategory = {
                ALL: 0,
                DOWNLOAD: 0,
                STREAM: 0,
                SYNC: 0,
                HTTP: 0,
                SYSTEM: 0,
            };
            expandedErrors = {};
            snackbar.success("Error history cleared");
        } catch (e) {
            snackbar.error(`Failed to clear errors: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            isClearing = false;
        }
    };

    const toggleExpand = (id: string) => {
        expandedErrors[id] = !expandedErrors[id];
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            snackbar.success(`${label} copied to clipboard`);
        } catch {
            snackbar.error("Failed to copy to clipboard");
        }
    };

    const filterOptions = $derived([
        { value: "ALL", label: `All (${countsByCategory.ALL ?? 0})` },
        { value: "DOWNLOAD", label: `Downloads (${countsByCategory.DOWNLOAD ?? 0})` },
        { value: "STREAM", label: `Streaming (${countsByCategory.STREAM ?? 0})` },
        { value: "SYNC", label: `Sync (${countsByCategory.SYNC ?? 0})` },
        { value: "HTTP", label: `HTTP (${countsByCategory.HTTP ?? 0})` },
    ]);

    onMount(() => {
        fetchErrors();
        const interval = setInterval(fetchErrors, 5000);
        return () => clearInterval(interval);
    });

    $effect(() => {
        // Refetch when category filter changes
        activeCategoryFilter;
        fetchErrors();
    });

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    const formatRelativeTime = (iso: string) => {
        const diffMs = Date.now() - new Date(iso).getTime();
        const sec = Math.floor(diffMs / 1000);
        if (sec < 60) return `${sec}s ago`;
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}m ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}h ago`;
        return `${Math.floor(hr / 24)}d ago`;
    };

    const formatOffset = (ms: number) => {
        if (ms < 1000) return `+${ms}ms`;
        return `+${(ms / 1000).toFixed(2)}s`;
    };

    const getCategoryIcon = (category: ErrorCategory) => {
        switch (category) {
            case "DOWNLOAD":
                return DownloadSimpleIcon;
            case "STREAM":
                return BroadcastIcon;
            case "SYNC":
                return ArrowsLeftRightIcon;
            default:
                return WarningCircleIcon;
        }
    };
</script>

<div id="errors-page">
    <header>
        <div class="title-group">
            <h1>Recent Errors & Tracing</h1>
            <p class="subtitle">Diagnostic traces for download failures, streaming issues, and system exceptions</p>
        </div>
        <div class="actions">
            {#if errors.length > 0}
                <IconButton
                    Icon={TrashIcon}
                    onclick={clearErrors}
                    variant="tonal"
                    shape="circle"
                    size="standard"
                    title="Clear errors"
                    ariaLabel="Clear errors"
                    loading={isClearing}
                />
            {/if}
            <IconButton
                Icon={ArrowsClockwiseIcon}
                onclick={fetchErrors}
                variant="tonal"
                shape="circle"
                size="standard"
                title="Refresh errors"
                ariaLabel="Refresh errors"
                loading={loading}
            />
        </div>
    </header>

    <div class="controls-bar">
        <div class="filter-bar">
            <SegmentedControl
                variant="chips"
                items={filterOptions}
                bind:value={activeCategoryFilter}
            />
        </div>

        <div class="search-box">
            <MagnifyingGlassIcon size="1.1rem" class="search-icon" />
            <input
                type="text"
                placeholder="Search error, provider, title..."
                bind:value={searchQuery}
                oninput={() => fetchErrors()}
            />
        </div>
    </div>

    {#if loading && errors.length === 0}
        <EmptyState title="Loading error logs…" />
    {:else if fetchError}
        <EmptyState variant="error" title="Failed to load errors" description={fetchError} />
    {:else if errors.length === 0}
        <EmptyState
            Icon={ShieldCheckIcon}
            iconSize="3.5rem"
            title="No Recent Errors"
            description="All services and downloads are operating normally. When an error or download failure occurs, its step-by-step execution trace will be captured here."
        />
    {:else}
        <div class="error-list">
            {#each errors as errorItem (errorItem.id)}
                {@const isExpanded = !!expandedErrors[errorItem.id]}
                {@const CategoryIcon = getCategoryIcon(errorItem.category)}
                <div class="error-card" class:expanded={isExpanded} class:download-error={errorItem.category === "DOWNLOAD"}>
                    <div class="card-summary" role="button" tabindex="0" onclick={() => toggleExpand(errorItem.id)} onkeydown={(e) => e.key === 'Enter' && toggleExpand(errorItem.id)}>
                        <div class="card-header-row">
                            <div class="badge-group">
                                <span class="category-badge category-{errorItem.category.toLowerCase()}">
                                    <CategoryIcon size="0.9rem" />
                                    <span>{errorItem.category}</span>
                                </span>
                                {#if errorItem.statusCode}
                                    <span class="status-code status-{Math.floor(errorItem.statusCode / 100)}xx">
                                        HTTP {errorItem.statusCode}
                                    </span>
                                {/if}
                            </div>
                            <span class="error-time" title={formatDate(errorItem.timestamp)}>
                                {formatRelativeTime(errorItem.timestamp)}
                            </span>
                        </div>

                        <div class="card-main-row">
                            <div class="card-text">
                                <h2 class="error-action">{errorItem.action}</h2>
                                <p class="error-message">{errorItem.message}</p>
                            </div>
                            <button
                                type="button"
                                class="expand-btn"
                                aria-label={isExpanded ? "Collapse trace" : "Expand trace"}
                            >
                                {#if isExpanded}
                                    <CaretUpIcon size="1.25rem" />
                                {:else}
                                    <CaretDownIcon size="1.25rem" />
                                {/if}
                            </button>
                        </div>

                        <!-- Parameter Pills -->
                        {#if errorItem.params && Object.keys(errorItem.params).length > 0}
                            <div class="params-preview">
                                {#each Object.entries(errorItem.params) as [key, val]}
                                    {#if val !== undefined && val !== null && typeof val !== "object"}
                                        <span class="param-pill">
                                            <span class="param-key">{key}:</span>
                                            <span class="param-val">{String(val)}</span>
                                        </span>
                                    {/if}
                                {/each}
                            </div>
                        {/if}
                    </div>

                    <!-- Expanded Details & Timeline Tracing -->
                    {#if isExpanded}
                        <div class="card-details">
                            <div class="trace-section">
                                <div class="section-title-row">
                                    <h3>Execution Trace ({errorItem.trace.length} steps)</h3>
                                    <div class="section-actions">
                                        <button
                                            type="button"
                                            class="copy-btn"
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                copyToClipboard(JSON.stringify(errorItem, null, 2), "Full trace JSON");
                                            }}
                                        >
                                            <CopyIcon size="0.95rem" />
                                            <span>Copy Trace JSON</span>
                                        </button>
                                    </div>
                                </div>

                                <div class="trace-timeline">
                                    {#each errorItem.trace as step, idx}
                                        <div class="timeline-step step-{step.level}">
                                            <div class="step-indicator">
                                                <div class="step-dot"></div>
                                                {#if idx < errorItem.trace.length - 1}
                                                    <div class="step-line"></div>
                                                {/if}
                                            </div>
                                            <div class="step-content">
                                                <div class="step-header">
                                                    <span class="step-offset">{formatOffset(step.relativeMs)}</span>
                                                    <span class="step-msg">{step.message}</span>
                                                </div>
                                                {#if step.data && Object.keys(step.data).length > 0}
                                                    <pre class="step-data">{JSON.stringify(step.data, null, 2)}</pre>
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>

                            {#if errorItem.stack}
                                <div class="stack-section">
                                    <div class="section-title-row">
                                        <h3>Stack Trace</h3>
                                        <button
                                            type="button"
                                            class="copy-btn"
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                copyToClipboard(errorItem.stack || "", "Stack trace");
                                            }}
                                        >
                                            <CopyIcon size="0.95rem" />
                                            <span>Copy Stack</span>
                                        </button>
                                    </div>
                                    <pre class="stack-trace">{errorItem.stack}</pre>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style lang="scss">
    #errors-page {
        --m3-surface: #12100e;
        --m3-surface-container-lowest: #0d0b0a;
        --m3-surface-container-low: #1c1917;
        --m3-surface-container: #24201d;
        --m3-surface-container-high: #2c2825;
        --m3-surface-container-highest: #383430;
        --m3-on-surface: #f5efe9;
        --m3-on-surface-variant: #d4ccc5;
        --m3-outline: #938c84;
        --m3-outline-variant: #443e3a;
        --m3-error: #ffb4ab;
        --m3-error-container: #93000a;
        --m3-on-error: #690005;

        max-width: 1000px;
        margin: 0 auto;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        box-sizing: border-box;
        width: 100%;
    }

    header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;

        .title-group {
            display: flex;
            flex-direction: column;
            gap: 6px;

            h1 {
                font-size: 1.6rem;
                font-weight: 600;
                margin: 0;
                color: var(--m3-on-surface);
                letter-spacing: -0.02em;
            }

            .subtitle {
                font-size: 0.9rem;
                color: var(--m3-on-surface-variant);
                margin: 0;
            }
        }

        .actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }
    }

    .controls-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;

        .filter-bar {
            overflow-x: auto;
            max-width: 100%;
        }

        .search-box {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--m3-surface-container-low);
            border: 1px solid var(--m3-outline-variant);
            border-radius: 20px;
            padding: 6px 14px;
            min-width: 240px;

            :global(.search-icon) {
                color: var(--m3-on-surface-variant);
                flex-shrink: 0;
            }

            input {
                background: transparent;
                border: none;
                outline: none;
                color: var(--m3-on-surface);
                font-size: 0.85rem;
                width: 100%;

                &::placeholder {
                    color: var(--m3-outline);
                }
            }
        }
    }

    .error-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .error-card {
        background: var(--m3-surface-container-low);
        border: 1px solid var(--m3-outline-variant);
        border-radius: 12px;
        overflow: hidden;
        transition: border-color 0.15s ease, background 0.15s ease;

        &:hover {
            border-color: rgba(255, 180, 171, 0.3);
            background: var(--m3-surface-container);
        }

        &.download-error {
            border-left: 4px solid #f87171;
        }

        &.expanded {
            border-color: rgba(255, 180, 171, 0.4);
        }

        .card-summary {
            padding: 14px 18px;
            cursor: pointer;
            outline: none;
            display: flex;
            flex-direction: column;
            gap: 8px;

            &:focus-visible {
                outline: 2px solid var(--m3-error);
            }
        }

        .card-header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.8rem;

            .badge-group {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .category-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 0.72rem;
                letter-spacing: 0.04em;
                text-transform: uppercase;

                &.category-download {
                    background: rgba(248, 113, 113, 0.15);
                    color: #f87171;
                    border: 1px solid rgba(248, 113, 113, 0.3);
                }
                &.category-stream {
                    background: rgba(168, 85, 247, 0.15);
                    color: #c084fc;
                    border: 1px solid rgba(168, 85, 247, 0.3);
                }
                &.category-sync {
                    background: rgba(59, 130, 246, 0.15);
                    color: #60a5fa;
                    border: 1px solid rgba(59, 130, 246, 0.3);
                }
                &.category-http, &.category-system {
                    background: rgba(234, 179, 8, 0.15);
                    color: #facc15;
                    border: 1px solid rgba(234, 179, 8, 0.3);
                }
            }

            .status-code {
                font-family: monospace;
                font-size: 0.75rem;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;

                &.status-5xx {
                    background: rgba(239, 68, 68, 0.2);
                    color: #fca5a5;
                }
                &.status-4xx {
                    background: rgba(245, 158, 11, 0.2);
                    color: #fde68a;
                }
            }

            .error-time {
                color: var(--m3-on-surface-variant);
                font-size: 0.8rem;
            }
        }

        .card-main-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;

            .card-text {
                display: flex;
                flex-direction: column;
                gap: 4px;
                flex: 1;

                .error-action {
                    font-size: 1.05rem;
                    font-weight: 600;
                    margin: 0;
                    color: var(--m3-on-surface);
                }

                .error-message {
                    font-size: 0.9rem;
                    margin: 0;
                    color: #fca5a5;
                    word-break: break-word;
                }
            }

            .expand-btn {
                background: transparent;
                border: none;
                color: var(--m3-on-surface-variant);
                cursor: pointer;
                padding: 4px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: color 0.15s ease;

                &:hover {
                    color: var(--m3-on-surface);
                }
            }
        }

        .params-preview {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 4px;

            .param-pill {
                display: inline-flex;
                gap: 4px;
                background: var(--m3-surface-container-highest);
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 0.72rem;

                .param-key {
                    color: var(--m3-outline);
                }
                .param-val {
                    color: var(--m3-on-surface);
                    font-family: monospace;
                }
            }
        }

        .card-details {
            border-top: 1px solid var(--m3-outline-variant);
            padding: 18px;
            background: var(--m3-surface-container-lowest);
            display: flex;
            flex-direction: column;
            gap: 18px;
        }

        .section-title-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;

            h3 {
                font-size: 0.85rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--m3-on-surface-variant);
                margin: 0;
                font-weight: 600;
            }

            .copy-btn {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                background: var(--m3-surface-container-high);
                border: 1px solid var(--m3-outline-variant);
                color: var(--m3-on-surface);
                border-radius: 6px;
                padding: 4px 10px;
                font-size: 0.78rem;
                cursor: pointer;
                transition: background 0.15s ease;

                &:hover {
                    background: var(--m3-surface-container-highest);
                }
            }
        }

        .trace-timeline {
            display: flex;
            flex-direction: column;
            gap: 0;

            .timeline-step {
                display: flex;
                gap: 12px;

                .step-indicator {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 16px;
                    flex-shrink: 0;

                    .step-dot {
                        width: 10px;
                        height: 10px;
                        border-radius: 50%;
                        margin-top: 5px;
                        background: var(--m3-outline);
                        border: 2px solid var(--m3-surface-container-lowest);
                    }

                    .step-line {
                        width: 2px;
                        flex: 1;
                        min-height: 16px;
                        background: var(--m3-outline-variant);
                    }
                }

                &.step-info .step-dot {
                    background: #60a5fa;
                }
                &.step-warn .step-dot {
                    background: #fbbf24;
                }
                &.step-error .step-dot {
                    background: #ef4444;
                    box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
                }

                .step-content {
                    padding-bottom: 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    flex: 1;

                    .step-header {
                        display: flex;
                        gap: 8px;
                        align-items: baseline;
                        font-size: 0.85rem;

                        .step-offset {
                            font-family: monospace;
                            color: var(--m3-outline);
                            font-size: 0.78rem;
                            flex-shrink: 0;
                        }

                        .step-msg {
                            color: var(--m3-on-surface);
                        }
                    }

                    .step-data {
                        margin: 4px 0 0 0;
                        padding: 8px 12px;
                        background: var(--m3-surface-container);
                        border-radius: 6px;
                        font-family: monospace;
                        font-size: 0.75rem;
                        color: var(--m3-on-surface-variant);
                        overflow-x: auto;
                        white-space: pre-wrap;
                        word-break: break-all;
                        border: 1px solid var(--m3-outline-variant);
                    }
                }
            }
        }

        .stack-trace {
            margin: 0;
            padding: 12px 14px;
            background: var(--m3-surface-container);
            border: 1px solid var(--m3-outline-variant);
            border-radius: 8px;
            font-family: monospace;
            font-size: 0.75rem;
            color: #fca5a5;
            overflow-x: auto;
            white-space: pre;
            line-height: 1.4;
        }
    }

    @media (max-width: 600px) {
        #errors-page {
            padding: 16px;
        }

        .controls-bar {
            flex-direction: column;
            align-items: stretch;

            .search-box {
                min-width: 0;
                width: 100%;
            }
        }
    }
</style>
