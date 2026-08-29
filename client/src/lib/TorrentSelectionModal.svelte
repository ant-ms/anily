<script lang="ts">
    import { fade } from "svelte/transition";
    import { apiBaseUrl } from "./context.svelte";
    import type { EpisodeTorrentSearch, TorrentResult } from "../types/Media";

    let {
        show = false,
        episodeId,
        episodeTitle,
        mode = "single",
        onconfirm,
        oncancel,
    }: {
        show?: boolean;
        episodeId: number;
        episodeTitle: string;
        mode?: "single" | "season";
        onconfirm?: (detail: { episodeId: number; torrentIndex: number; torrent?: TorrentResult }) => void;
        oncancel?: () => void;
    } = $props();

    let loading = $state(false);
    let searchData = $state<EpisodeTorrentSearch | null>(null);
    let selectedIndex = $state<number | null>(null);
    let error = $state<string | null>(null);

    $effect(() => {
        if (!show) return;
        loading = true;
        searchData = null;
        selectedIndex = null;
        error = null;

        const url = new URL(
            `/api/media/search/${episodeId}`,
            apiBaseUrl.current,
        );
        fetch(url.toString(), { credentials: "include" })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data: EpisodeTorrentSearch) => {
                searchData = data;
                // Pre-select AI recommendation if available
                if (data.recommendation.index >= 0) {
                    selectedIndex = data.recommendation.index;
                }
            })
            .catch((e) => {
                error = e.message ?? "Failed to fetch torrents";
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

    function confidenceLabel(confidence: "high" | "medium" | "low"): string {
        if (confidence === "high") return "High confidence";
        if (confidence === "medium") return "Medium confidence";
        return "Low confidence";
    }

    function confidenceClass(confidence: "high" | "medium" | "low"): string {
        if (confidence === "high") return "confidence-high";
        if (confidence === "medium") return "confidence-medium";
        return "confidence-low";
    }

    function handleConfirm() {
        if (selectedIndex === null || !searchData) return;
        const torrent = searchData.results[selectedIndex];
        onconfirm?.({ episodeId, torrentIndex: selectedIndex, torrent });
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
                <span class="modal-title">Select Torrent</span>
                <span class="modal-subtitle">{episodeTitle}</span>
            </div>

            <div class="modal-body">
                {#if loading}
                    <div class="state-message">
                        <span class="spinner"></span>
                        Searching for torrents…
                    </div>
                {:else if error}
                    <div class="state-message error">{error}</div>
                {:else if !searchData || searchData.results.length === 0}
                    <div class="state-message">No torrents found.</div>
                {:else}
                    {#if searchData.recommendation.index >= 0}
                        <div class="ai-recommendation">
                            <div class="ai-header">
                                <span class="ai-icon">✨</span>
                                <span class="ai-label">AI Recommendation</span>
                                <span class="confidence-badge {confidenceClass(searchData.recommendation.confidence)}">
                                    {confidenceLabel(searchData.recommendation.confidence)}
                                </span>
                            </div>
                            <p class="ai-reason">{searchData.recommendation.reason}</p>
                        </div>
                    {/if}

                    <div class="torrent-list">
                        {#each searchData.results as result, i (i)}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="torrent-row"
                                class:selected={selectedIndex === i}
                                class:ai-pick={searchData.recommendation.index === i}
                                onclick={() => (selectedIndex = i)}
                            >
                                <input
                                    type="radio"
                                    name="torrent"
                                    checked={selectedIndex === i}
                                    onchange={() => (selectedIndex = i)}
                                />
                                <div class="torrent-info">
                                    <span class="torrent-title" title={result.title}>
                                        {result.title}
                                        {#if searchData.recommendation.index === i}
                                            <span class="ai-star">✨</span>
                                        {/if}
                                    </span>
                                    <div class="torrent-meta">
                                        <span class="meta-item">{formatSize(result.size)}</span>
                                        <span class="meta-sep">·</span>
                                        <span class="meta-item">{result.seeders} seeders</span>
                                        <span class="meta-sep">·</span>
                                        <span class="meta-item source">{result.source}</span>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="modal-footer">
                <button class="btn-cancel" onclick={handleCancel}>Cancel</button>
                <button
                    class="btn-confirm"
                    onclick={handleConfirm}
                    disabled={selectedIndex === null || loading}
                >
                    Download Selected
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
        max-width: 600px;
        max-height: 80vh;
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
        padding: 1rem 1.5rem;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .state-message {
        color: #999;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 1rem 0;

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

    .ai-recommendation {
        background: #ffd52c0d;
        border: 1px solid #ffd52c55;
        border-radius: 8px;
        padding: 0.75rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .ai-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .ai-icon {
        font-size: 14px;
    }

    .ai-label {
        font-size: 13px;
        font-weight: 600;
        color: #ffd52c;
    }

    .confidence-badge {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: auto;
        font-weight: 500;

        &.confidence-high {
            background: #2d4a2d;
            color: #6fbf6f;
        }

        &.confidence-medium {
            background: #4a3d1a;
            color: #d4a843;
        }

        &.confidence-low {
            background: #4a2020;
            color: #c96060;
        }
    }

    .ai-reason {
        font-size: 12px;
        color: #b0a090;
        margin: 0;
        line-height: 1.5;
    }

    .torrent-list {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .torrent-row {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.6rem 0.75rem;
        border-radius: 6px;
        border: 1px solid transparent;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;

        &:hover {
            background: hsl(20, 17.6%, 11%);
        }

        &.selected {
            background: hsl(20, 17.6%, 12%);
            border-color: hsl(36, 5.7%, 28%);
        }

        &.ai-pick.selected {
            border-color: #ffd52c55;
            background: #ffd52c08;
        }

        input[type="radio"] {
            accent-color: #ffd52c;
            margin-top: 3px;
            flex-shrink: 0;
            cursor: pointer;
        }
    }

    .torrent-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 0;
    }

    .torrent-title {
        font-size: 13px;
        color: #d8d0c8;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 0.3rem;
    }

    .ai-star {
        font-size: 11px;
        flex-shrink: 0;
    }

    .torrent-meta {
        display: flex;
        gap: 0.3rem;
        align-items: center;
    }

    .meta-item {
        font-size: 11px;
        color: #777;

        &.source {
            color: #555;
        }
    }

    .meta-sep {
        font-size: 11px;
        color: #444;
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
