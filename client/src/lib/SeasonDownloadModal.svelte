<script lang="ts">
    import { fade } from "svelte/transition";
    import { apiBaseUrl } from "./context.svelte";
    import type { SeasonTorrentSearch, EpisodeTorrentSearch } from "../types/Media";

    let {
        show = false,
        anilistId,
        animeName,
        onconfirm,
        oncancel,
    }: {
        show?: boolean;
        anilistId: number;
        animeName: string;
        onconfirm?: () => void;
        oncancel?: () => void;
    } = $props();

    type EpisodeRow = {
        search: EpisodeTorrentSearch;
        selectedIndex: number | null;  // null = skip
        expanded: boolean;
    };

    let loading = $state(false);
    let submitting = $state(false);
    let rows = $state<EpisodeRow[]>([]);
    let error = $state<string | null>(null);

    const readyCount = $derived(
        rows.filter((r) => r.selectedIndex !== null).length,
    );

    const skippedCount = $derived(
        rows.filter((r) => r.selectedIndex === null).length,
    );

    $effect(() => {
        if (!show) return;
        loading = true;
        rows = [];
        error = null;

        const url = new URL(
            `/api/media/search-season/${anilistId}`,
            apiBaseUrl.current,
        );
        fetch(url.toString(), { credentials: "include" })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data: SeasonTorrentSearch) => {
                rows = data.episodes.map((ep) => ({
                    search: ep,
                    selectedIndex:
                        ep.recommendation.index >= 0 &&
                        ep.recommendation.confidence !== "low"
                            ? ep.recommendation.index
                            : null,
                    expanded: false,
                }));
            })
            .catch((e) => {
                error = e.message ?? "Failed to fetch season torrents";
            })
            .finally(() => {
                loading = false;
            });
    });

    function formatSize(bytes: number): string {
        const mb = bytes / (1024 * 1024);
        if (mb < 1024) return `${Math.round(mb)} MB`;
        return `${(mb / 1024).toFixed(1)} GB`;
    }

    function statusBadge(row: EpisodeRow): { icon: string; label: string; cls: string } {
        const conf = row.search.recommendation.confidence;
        const hasRec = row.search.recommendation.index >= 0;
        if (row.selectedIndex === null) {
            return { icon: "—", label: "Skipped", cls: "badge-skip" };
        }
        if (!hasRec) {
            return { icon: "⚠️", label: "Manual", cls: "badge-manual" };
        }
        if (conf === "high") return { icon: "✅", label: "High", cls: "badge-high" };
        if (conf === "medium") return { icon: "⚠️", label: "Medium", cls: "badge-medium" };
        return { icon: "❌", label: "Low", cls: "badge-low" };
    }

    function toggleExpanded(i: number) {
        rows[i].expanded = !rows[i].expanded;
    }

    function selectForRow(rowIdx: number, torrentIdx: number | null) {
        rows[rowIdx].selectedIndex = torrentIdx;
        rows[rowIdx].expanded = false;
    }

    async function handleConfirm() {
        submitting = true;
        try {
            const selections = rows
                .filter((r) => r.selectedIndex !== null)
                .map((r) => ({
                    episodeId: r.search.episode.id,
                    torrentIndex: r.selectedIndex!,
                }));

            const url = new URL(
                `/api/media/download-season/${anilistId}`,
                apiBaseUrl.current,
            );
            const res = await fetch(url.toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ selections }),
                credentials: "include",
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            onconfirm?.();
        } catch (e: any) {
            error = e.message ?? "Failed to start downloads";
        } finally {
            submitting = false;
        }
    }

    function handleCancel() {
        oncancel?.();
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) handleCancel();
    }
</script>

{#if show}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-backdrop" transition:fade={{ duration: 150 }} onclick={handleBackdropClick}>
        <div class="modal-card">
            <div class="modal-header">
                <span class="modal-title">Download Season</span>
                <span class="modal-subtitle">{animeName}</span>
            </div>

            <div class="modal-body">
                {#if loading}
                    <div class="state-message">
                        <span class="spinner"></span>
                        Searching torrents for all episodes…
                    </div>
                {:else if error}
                    <div class="state-message error">{error}</div>
                {:else if rows.length === 0}
                    <div class="state-message">No episodes found.</div>
                {:else}
                    <div class="episode-table">
                        {#each rows as row, i (row.search.episode.id)}
                            {@const badge = statusBadge(row)}
                            {@const rec = row.search.recommendation}
                            {@const recResult =
                                rec.index >= 0
                                    ? row.search.results[rec.index]
                                    : null}
                            {@const selectedResult =
                                row.selectedIndex !== null
                                    ? row.search.results[row.selectedIndex]
                                    : null}

                            <div class="ep-row" class:expanded={row.expanded}>
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div
                                    class="ep-summary"
                                    onclick={() => toggleExpanded(i)}
                                >
                                    <span class="ep-num">Ep {row.search.episode.number}</span>
                                    <span class="ep-pick">
                                        {#if selectedResult}
                                            <span class="pick-title" title={selectedResult.title}>
                                                {selectedResult.title}
                                            </span>
                                            <span class="pick-meta">
                                                {formatSize(selectedResult.size)} · {selectedResult.seeders} seeders
                                            </span>
                                        {:else}
                                            <span class="pick-none">No selection</span>
                                        {/if}
                                    </span>
                                    <span class="ep-badge {badge.cls}">
                                        {badge.icon} {badge.label}
                                    </span>
                                    <span class="expand-arrow" class:open={row.expanded}>›</span>
                                </div>

                                {#if row.expanded}
                                    <div class="ep-torrent-list" transition:fade={{ duration: 100 }}>
                                        <!-- Skip option -->
                                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                                        <div
                                            class="torrent-opt"
                                            class:selected={row.selectedIndex === null}
                                            onclick={() => selectForRow(i, null)}
                                        >
                                            <input
                                                type="radio"
                                                name="ep-{row.search.episode.id}"
                                                checked={row.selectedIndex === null}
                                                onchange={() => selectForRow(i, null)}
                                            />
                                            <span class="opt-title skip">Skip this episode</span>
                                        </div>
                                        {#each row.search.results as result, j (j)}
                                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                                            <div
                                                class="torrent-opt"
                                                class:selected={row.selectedIndex === j}
                                                class:ai-pick={rec.index === j}
                                                onclick={() => selectForRow(i, j)}
                                            >
                                                <input
                                                    type="radio"
                                                    name="ep-{row.search.episode.id}"
                                                    checked={row.selectedIndex === j}
                                                    onchange={() => selectForRow(i, j)}
                                                />
                                                <div class="opt-info">
                                                    <span class="opt-title" title={result.title}>
                                                        {result.title}
                                                        {#if rec.index === j}
                                                            <span class="ai-star">✨</span>
                                                        {/if}
                                                    </span>
                                                    <span class="opt-meta">
                                                        {formatSize(result.size)} · {result.seeders} seeders · {result.source}
                                                    </span>
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            {#if !loading && rows.length > 0}
                <div class="modal-summary">
                    <span class="summary-text">
                        <span class="ready">{readyCount} episodes ready</span>
                        {#if skippedCount > 0}
                            <span class="skipped">, {skippedCount} skipped</span>
                        {/if}
                    </span>
                </div>
            {/if}

            <div class="modal-footer">
                <button class="btn-cancel" onclick={handleCancel} disabled={submitting}>Cancel</button>
                <button
                    class="btn-confirm"
                    onclick={handleConfirm}
                    disabled={readyCount === 0 || submitting}
                >
                    {#if submitting}
                        Starting…
                    {:else}
                        Download {readyCount} Episode{readyCount !== 1 ? "s" : ""}
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<style lang="scss">
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal-card {
        background: #1a1714;
        border: 1px solid hsl(36, 5.7%, 20%);
        border-radius: 10px;
        width: 100%;
        max-width: 640px;
        max-height: 82vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .modal-header {
        padding: 1.25rem 1.5rem 1rem;
        border-bottom: 1px solid hsl(36, 5.7%, 18%);
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }

    .modal-title {
        font-size: 15px;
        font-weight: 600;
        color: #e8e0d6;
    }

    .modal-subtitle {
        font-size: 13px;
        color: #999;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .modal-body {
        padding: 0.75rem 1rem;
        overflow-y: auto;
        flex: 1;
    }

    .state-message {
        color: #999;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 1rem 0.5rem;

        &.error {
            color: #e05252;
        }
    }

    .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid hsl(36, 5.7%, 25%);
        border-top-color: #ffd52c;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
        flex-shrink: 0;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .episode-table {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .ep-row {
        border: 1px solid hsl(36, 5.7%, 18%);
        border-radius: 6px;
        overflow: hidden;

        &.expanded {
            border-color: hsl(36, 5.7%, 24%);
        }
    }

    .ep-summary {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.55rem 0.75rem;
        cursor: pointer;
        transition: background 0.12s;
        min-width: 0;

        &:hover {
            background: hsl(20, 17.6%, 11%);
        }
    }

    .ep-num {
        font-size: 12px;
        color: #777;
        min-width: 40px;
        flex-shrink: 0;
    }

    .ep-pick {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .pick-title {
        font-size: 12px;
        color: #ccc;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .pick-meta {
        font-size: 11px;
        color: #555;
    }

    .pick-none {
        font-size: 12px;
        color: #555;
        font-style: italic;
    }

    .ep-badge {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        flex-shrink: 0;
        font-weight: 500;

        &.badge-high {
            background: #2d4a2d;
            color: #6fbf6f;
        }

        &.badge-medium {
            background: #4a3d1a;
            color: #d4a843;
        }

        &.badge-low {
            background: #4a2020;
            color: #c96060;
        }

        &.badge-manual {
            background: hsl(20, 17.6%, 14%);
            color: #999;
        }

        &.badge-skip {
            background: hsl(20, 17.6%, 12%);
            color: #555;
        }
    }

    .expand-arrow {
        font-size: 14px;
        color: #555;
        transform: rotate(0deg);
        transition: transform 0.15s;
        flex-shrink: 0;

        &.open {
            transform: rotate(90deg);
        }
    }

    .ep-torrent-list {
        border-top: 1px solid hsl(36, 5.7%, 16%);
        background: hsl(20, 17.6%, 8%);
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        padding: 0.35rem 0.5rem;
    }

    .torrent-opt {
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 0.4rem 0.5rem;
        border-radius: 5px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: background 0.12s;

        &:hover {
            background: hsl(20, 17.6%, 12%);
        }

        &.selected {
            background: hsl(20, 17.6%, 12%);
            border-color: hsl(36, 5.7%, 24%);
        }

        &.ai-pick.selected {
            border-color: #ffd52c44;
            background: #ffd52c07;
        }

        input[type="radio"] {
            accent-color: #ffd52c;
            margin-top: 3px;
            flex-shrink: 0;
            cursor: pointer;
        }
    }

    .opt-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .opt-title {
        font-size: 12px;
        color: #ccc;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 0.3rem;

        &.skip {
            color: #666;
            font-style: italic;
        }
    }

    .opt-meta {
        font-size: 11px;
        color: #555;
    }

    .ai-star {
        font-size: 11px;
        flex-shrink: 0;
    }

    .modal-summary {
        padding: 0.6rem 1.5rem;
        border-top: 1px solid hsl(36, 5.7%, 16%);
        background: hsl(20, 17.6%, 9%);
    }

    .summary-text {
        font-size: 13px;
    }

    .ready {
        color: #6fbf6f;
    }

    .skipped {
        color: #777;
    }

    .modal-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid hsl(36, 5.7%, 18%);
        display: flex;
        justify-content: flex-end;
        gap: 0.6rem;
    }

    button {
        padding: 7px 16px;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.15s, opacity 0.15s;
        border: none;

        &:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
    }

    .btn-cancel {
        background: hsl(20, 17.6%, 12%);
        border: 1px solid hsl(36, 5.7%, 20%);
        color: #aaa;

        &:hover:not(:disabled) {
            background: hsl(20, 17.6%, 17%);
        }
    }

    .btn-confirm {
        background: #ffd52c;
        color: #1a1714;
        font-weight: 600;

        &:hover:not(:disabled) {
            background: #ffe060;
        }
    }
</style>
