<script lang="ts">
    import { tick } from "svelte";
    import MagnifyingGlassIcon from "phosphor-svelte/lib/MagnifyingGlassIcon";
    import XIcon from "phosphor-svelte/lib/XIcon";
    import CaretLeftIcon from "phosphor-svelte/lib/CaretLeftIcon";
    import TelevisionIcon from "phosphor-svelte/lib/TelevisionIcon";
    import WarningCircleIcon from "phosphor-svelte/lib/WarningCircleIcon";
    import SparkleIcon from "phosphor-svelte/lib/SparkleIcon";
    import { Debounced } from "runed";
    import type { SearchResult } from "../../types/SearchResult";
    import {
        apiBaseUrl,
        selectedAnimeAnilistId,
        isGlobalSearchOpen,
        isMobileNavOpen,
    } from "../context.svelte";
    import { networkState } from "../network.svelte";
    import { registerBackHandler } from "../navigation/backHandler";

    let searchQuery = $state("");
    let isSearching = $state(false);
    let searchResults = $state<SearchResult[]>([]);
    let selectedIndex = $state(0);

    let inputElement = $state<HTMLInputElement>();
    let listContainerElement = $state<HTMLDivElement>();

    const debouncedSearchQuery = new Debounced(() => searchQuery, 220);

    let activeItems = $derived<SearchResult[]>(searchResults);

    $effect(() => {
        const query = debouncedSearchQuery.current.trim();

        if (query === "") {
            searchResults = [];
            isSearching = false;
            selectedIndex = 0;
            return;
        }

        if (!networkState.isOnline) {
            isSearching = false;
            searchResults = [];
            selectedIndex = 0;
            return;
        }

        if (!apiBaseUrl.current) {
            isSearching = false;
            return;
        }

        isSearching = true;
        const currentQuery = query;
        const url = new URL(
            `/api/search?q=${encodeURIComponent(query)}`,
            apiBaseUrl.current,
        );

        fetch(url.toString(), { credentials: "include" })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data: SearchResult[]) => {
                if (debouncedSearchQuery.current.trim() === currentQuery) {
                    searchResults = data;
                    selectedIndex = 0;
                }
            })
            .catch((err) => {
                console.error("[GlobalSearch] Search failed:", err);
            })
            .finally(() => {
                if (debouncedSearchQuery.current.trim() === currentQuery) {
                    isSearching = false;
                }
            });
    });

    function closeModal() {
        isGlobalSearchOpen.set(false);
    }

    $effect(() => {
        if (isGlobalSearchOpen.current) {
            selectedIndex = 0;
            tick().then(() => {
                inputElement?.focus();
                inputElement?.select();
            });

            return registerBackHandler(() => {
                if (isGlobalSearchOpen.current) {
                    closeModal();
                    return true;
                }
                return false;
            });
        }
    });

    function selectAnime(item: SearchResult) {
        selectedAnimeAnilistId.set(item.anilistId, { clearHistory: true });
        if (typeof window !== "undefined" && window.innerWidth <= 768) {
            isMobileNavOpen.set(false);
        }
        closeModal();
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (!isGlobalSearchOpen.current) return;

        if (e.key === "Escape") {
            e.preventDefault();
            closeModal();
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (activeItems.length > 0) {
                selectedIndex = (selectedIndex + 1) % activeItems.length;
                scrollActiveItemIntoView();
            }
            return;
        }

        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (activeItems.length > 0) {
                selectedIndex =
                    (selectedIndex - 1 + activeItems.length) % activeItems.length;
                scrollActiveItemIntoView();
            }
            return;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            if (activeItems.length > 0 && activeItems[selectedIndex]) {
                selectAnime(activeItems[selectedIndex]);
            }
            return;
        }
    }

    function scrollActiveItemIntoView() {
        tick().then(() => {
            const activeEl = listContainerElement?.querySelector(
                `.m3-list-item[data-index="${selectedIndex}"]`,
            );
            if (activeEl) {
                activeEl.scrollIntoView({ block: "nearest" });
            }
        });
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) {
            closeModal();
        }
    }

    function getDisplayTitles(item: SearchResult): string[] {
        const raw = [item.titleNative, item.titleEnglish, item.titleRomanji];
        return [...new Set(raw.filter((t): t is string => Boolean(t && t.trim())))];
    }

    function getDisplayTitle(item: SearchResult): string {
        return getDisplayTitles(item)[0] || "Untitled Anime";
    }

    function getSecondaryTitle(item: SearchResult): string | null {
        return getDisplayTitles(item)[1] || null;
    }

    function getThumbnail(item: SearchResult): string | null {
        if (item.thumbnailUrl) return item.thumbnailUrl;

        // Check local cache for details of this anime
        try {
            const cachedDetails = localStorage.getItem(`anily:cache:details:${item.anilistId}`);
            if (cachedDetails) {
                const parsed = JSON.parse(cachedDetails);
                if (parsed.thumbnailUrl) return parsed.thumbnailUrl;
            }
        } catch {}

        // Check local cache for sidebar cards (bookmarked anime chains)
        const tabs = ["inbox", "waiting", "upcoming", "completed"];
        for (const tab of tabs) {
            try {
                const raw = localStorage.getItem(`anily:cache:sidebar:${tab}`);
                if (raw) {
                    const cards = JSON.parse(raw);
                    if (Array.isArray(cards)) {
                        const match = cards.find((c: any) =>
                            c.displayAnilistId === item.anilistId ||
                            (Array.isArray(c.allAnilistIds) && c.allAnilistIds.includes(item.anilistId))
                        );
                        if (match?.thumbnailUrl) return match.thumbnailUrl;
                    }
                }
            } catch {}
        }

        return null;
    }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isGlobalSearchOpen.current}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="m3-search-scrim" onclick={handleBackdropClick}>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
            class="m3-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search anime"
            tabindex="-1"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- M3 Standalone Pill Search Bar (56dp height, 28dp pill radius) -->
            <div class="m3-search-bar-wrapper">
                <div class="m3-search-bar">
                    <button
                        type="button"
                        class="mobile-back-button"
                        onclick={closeModal}
                        title="Back"
                        aria-label="Close search"
                    >
                        <CaretLeftIcon size={24} />
                    </button>

                    <div class="search-leading-icon">
                        <MagnifyingGlassIcon size={24} />
                    </div>

                    <input
                        bind:this={inputElement}
                        bind:value={searchQuery}
                        type="search"
                        class="search-input"
                        placeholder="Search anime by title, romaji, synonyms..."
                        autocomplete="off"
                        autocorrect="off"
                        autocapitalize="off"
                        spellcheck="false"
                    />

                    {#if isSearching}
                        <div class="m3-progress-indicator" title="Searching..."></div>
                    {/if}

                    {#if searchQuery.length > 0}
                        <button
                            type="button"
                            class="search-action-button"
                            onclick={() => {
                                searchQuery = "";
                                inputElement?.focus();
                            }}
                            title="Clear search"
                            aria-label="Clear search input"
                        >
                            <XIcon size={20} />
                        </button>
                    {/if}
                </div>
            </div>

            <!-- Content Area: Suggestions and Results (Elevated Tonal Container) -->
            <div
                class="m3-search-content"
                bind:this={listContainerElement}
                role="listbox"
                aria-label="Search results"
            >
                {#if searchQuery.trim() !== ""}
                    {#if searchResults.length > 0}
                        <!-- M3 Two-Line List Items (72dp height, 0dp radius, edge-to-edge) -->
                        <div class="m3-list m3-results-list">
                            {#each searchResults as item, index (item.anilistId)}
                                {@const thumb = getThumbnail(item)}
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <div
                                    class="m3-list-item m3-two-line"
                                    class:selected={index === selectedIndex}
                                    data-index={index}
                                    role="option"
                                    tabindex="-1"
                                    aria-selected={index === selectedIndex}
                                    onclick={() => selectAnime(item)}
                                    onmouseenter={() => (selectedIndex = index)}
                                >
                                    <div class="item-leading-visual">
                                        {#if thumb}
                                            <img
                                                src={thumb}
                                                alt=""
                                                loading="lazy"
                                            />
                                        {:else}
                                            <TelevisionIcon size={24} />
                                        {/if}
                                    </div>

                                    <div class="item-content">
                                        <span class="headline-text">
                                            {getDisplayTitle(item)}
                                        </span>
                                        <span class="supporting-text">
                                            {#if getSecondaryTitle(item)}
                                                {getSecondaryTitle(item)}
                                            {/if}
                                            {#if getSecondaryTitle(item) && (item.format || item.seasonYear)}
                                                {" · "}
                                            {/if}
                                            {#if item.format}
                                                {item.format}
                                            {/if}
                                            {#if item.seasonYear}
                                                {" "}{item.season ? `${item.season} ` : ""}{item.seasonYear}
                                            {/if}
                                        </span>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else if !isSearching}
                        <!-- Empty Search Results -->
                        <div class="m3-empty-state">
                            <div class="empty-icon-wrap">
                                <WarningCircleIcon size={36} />
                            </div>
                            <h3 class="empty-title">No matching anime</h3>
                            <p class="empty-description">
                                No results found for "{searchQuery}". Check your spelling or try Japanese Romaji.
                            </p>
                        </div>
                    {/if}
                {:else}
                    <!-- Discovery State -->
                    <div class="m3-empty-state">
                        <div class="empty-icon-wrap highlight">
                            <SparkleIcon size={32} weight="fill" />
                        </div>
                        <h3 class="empty-title">Global Anime Search</h3>
                        <p class="empty-description">
                            Search anime across your library, caught-up lists, and the database.
                        </p>
                    </div>
                {/if}
            </div>

            {#if !networkState.isOnline}
                <footer class="m3-dialog-footer">
                    <span class="footer-offline-badge">Offline mode</span>
                </footer>
            {/if}
        </div>
    </div>
{/if}

<style lang="scss">
    /* M3 Surface & Color Design Tokens (Dark Theme) */
    .m3-search-scrim {
        /* md.sys.color.scrim: Pure black at 32% opacity, 0px blur (sharp background) */
        --md-sys-color-scrim: rgba(0, 0, 0, 0.32);
        --m3-surface-container-lowest: #100e0c;
        --m3-surface-container-low: #171513;
        --m3-surface-container: #201d1a;
        --m3-surface-container-high: #2c2825;
        --m3-surface-container-highest: #383430;
        --m3-surface: #141210;
        --m3-on-surface: #e7e1de;
        --m3-on-surface-variant: #cdc4be;
        --m3-outline-variant: #4b4541;
        --m3-primary: #ffd52c;
        --m3-state-hover: rgba(231, 225, 222, 0.08);
        --m3-state-selected: rgba(255, 213, 44, 0.12);

        position: fixed;
        inset: 0;
        background: var(--md-sys-color-scrim);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 0 16px;
        box-sizing: border-box;
        animation: m3-scrim-fade 0.18s cubic-bezier(0.2, 0, 0, 1);
    }

    /* M3 Search Dialog / Docked Search View */
    .m3-search-dialog {
        width: 100%;
        max-width: 640px;
        margin: clamp(40px, 10vh, 100px) auto auto auto;
        background: var(--m3-surface-container-high);
        border-radius: 16px;
        box-shadow:
            0 16px 36px -8px rgba(0, 0, 0, 0.65),
            0 4px 12px 0 rgba(0, 0, 0, 0.4);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: m3-dialog-enter 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        box-sizing: border-box;
    }

    /* M3 Search Bar Wrapper & Bar */
    .m3-search-bar-wrapper {
        padding: 12px 12px 8px 12px;
        background: var(--m3-surface-container-high);
        flex-shrink: 0;

        .m3-search-bar {
            display: flex;
            align-items: center;
            height: 52px;
            padding: 0 16px;
            border-radius: 16px;
            background: var(--m3-surface-container-highest);
            box-sizing: border-box;
            gap: 16px;

            .mobile-back-button {
                display: none;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                color: var(--m3-on-surface);
                cursor: pointer;
                border: none;
                background: transparent;

                &:hover {
                    background: var(--m3-state-hover);
                }
            }

            .search-leading-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--m3-on-surface-variant);
                flex-shrink: 0;
            }

            .search-input {
                flex: 1;
                min-width: 0;
                height: 100%;
                font-size: 16px;
                font-family: inherit;
                line-height: 24px;
                font-weight: 400;
                color: var(--m3-on-surface);
                border: none;
                outline: none;
                background: transparent;

                &::placeholder {
                    color: var(--m3-on-surface-variant);
                    font-size: 16px;
                    opacity: 0.8;
                }

                &::-webkit-search-decoration,
                &::-webkit-search-cancel-button,
                &::-webkit-search-results-button,
                &::-webkit-search-results-decoration {
                    display: none;
                }
            }

            .m3-progress-indicator {
                width: 20px;
                height: 20px;
                border: 2.5px solid rgba(255, 213, 44, 0.25);
                border-top-color: var(--m3-primary);
                border-radius: 50%;
                animation: m3-spin 0.65s linear infinite;
                flex-shrink: 0;
            }

            .search-action-button {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: none;
                background: transparent;
                color: var(--m3-on-surface-variant);
                cursor: pointer;
                flex-shrink: 0;
                transition: background 0.15s ease;

                &:hover {
                    background: var(--m3-state-hover);
                    color: var(--m3-on-surface);
                }
            }
        }
    }

    /* M3 Tonal Results Container: Inset rounded darker surface */
    .m3-search-content {
        background: var(--m3-surface-container-low, #171513);
        margin: 0 12px 12px 12px;
        border-radius: 16px;
        max-height: min(52vh, 460px);
        overflow: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;

        .m3-list {
            display: flex;
            flex-direction: column;
            width: 100%;

            &.m3-results-list {
                .m3-list-item:first-child {
                    border-top-left-radius: 16px;
                    border-top-right-radius: 16px;
                }

                .m3-list-item:last-child {
                    border-bottom-left-radius: 16px;
                    border-bottom-right-radius: 16px;
                }
            }
        }

        /* M3 List Items (Strictly edge-to-edge, standard padding and heights) */
        .m3-list-item {
            display: flex;
            align-items: center;
            width: 100%;
            padding: 0 16px;
            box-sizing: border-box;
            cursor: pointer;
            user-select: none;
            border-radius: 0;
            border: none;
            background: transparent;
            transition: background 0.15s cubic-bezier(0.2, 0, 0, 1);

            /* Two-line list item (72dp height) */
            &.m3-two-line {
                height: 72px;
                min-height: 72px;
                gap: 16px;

                .item-leading-visual {
                    width: 40px;
                    height: 56px;
                    border-radius: 6px;
                    overflow: hidden;
                    background: transparent;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--m3-on-surface-variant);

                    img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                }

                .item-content {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    flex: 1;
                    min-width: 0;
                    gap: 2px;

                    .headline-text {
                        font-size: 14px;
                        font-weight: 500;
                        line-height: 20px;
                        color: var(--m3-on-surface);
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        display: block;
                    }

                    .supporting-text {
                        font-size: 13px;
                        font-weight: 400;
                        line-height: 18px;
                        color: var(--m3-on-surface-variant);
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        display: block;
                    }
                }
            }

            /* State Layers (Hover and Selected) */
            &:hover {
                background: var(--m3-state-hover);
            }

            &.selected {
                background: var(--m3-state-selected);

                .headline-text {
                    color: var(--m3-primary);
                }
            }
        }
    }

    /* M3 Empty States */
    .m3-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        user-select: none;

        .empty-icon-wrap {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.04);
            color: var(--m3-on-surface-variant);
            margin-bottom: 16px;

            &.highlight {
                background: rgba(255, 213, 44, 0.12);
                color: var(--m3-primary);
            }
        }

        .empty-title {
            margin: 0 0 8px 0;
            font-size: 18px;
            font-weight: 500;
            line-height: 24px;
            color: var(--m3-on-surface);
        }

        .empty-description {
            margin: 0;
            font-size: 14px;
            line-height: 20px;
            color: var(--m3-on-surface-variant);
            max-width: 340px;
        }
    }

    /* M3 Dialog Footer: Matches the top search bar container tone */
    .m3-dialog-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 48px;
        padding: 0 16px;
        background: var(--m3-surface-container-high, #2c2825);
        border-top: none;
        flex-shrink: 0;

        .footer-offline-badge {
            font-size: 12px;
            font-weight: 500;
            line-height: 16px;
            color: #f59e0b;
        }
    }

    /* Transitions & Motion */
    @keyframes m3-scrim-fade {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes m3-dialog-enter {
        from {
            opacity: 0;
            transform: scale(0.96) translateY(-8px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }

    @keyframes m3-spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* Mobile Full-Screen Search View (<= 768px) */
    @media (max-width: 768px) {
        .m3-search-scrim {
            padding: 0;
            background: var(--m3-surface);
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            align-items: stretch;
        }

        .m3-search-dialog {
            max-width: 100vw;
            width: 100vw;
            height: 100vh;
            height: 100dvh;
            margin: 0;
            border-radius: 0;
            box-shadow: none;
            background: var(--m3-surface);
            padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
            padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
        }

        .m3-search-bar-wrapper {
            padding: 8px 12px;
            background: var(--m3-surface-container-high);

            .m3-search-bar {
                background: var(--m3-surface-container-highest);

                .mobile-back-button {
                    display: flex;
                }

                .search-leading-icon {
                    display: none;
                }
            }
        }

        .m3-search-content {
            flex: 1;
            max-height: none;
            background: var(--m3-surface-container-low, #171513);
            margin: 0 8px 8px 8px;
            border-radius: 16px;
        }

        .m3-dialog-footer {
            display: none;
        }
    }
</style>
