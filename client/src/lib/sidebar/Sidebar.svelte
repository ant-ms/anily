<script lang="ts">
    import type { Tab } from "../tab-switcher/tab-switcher-types";
    import type ProfileData from "../../types/ProfileData";
    import { watch } from "runed";
    import type SidebarCardData from "../../types/SidebarCardData";
    import {
        apiBaseUrl,
        sidebarDataRefreshSeed,
        selectedAnimeAnilistId,
    } from "../context.svelte";
    import SidebarCard from "./SidebarCard.svelte";
    import ListDashesIcon from "phosphor-svelte/lib/ListDashesIcon";
    import Badge from "../Badge.svelte";
    import MenuItem from "../MenuItem.svelte";
    import EmptyState from "../EmptyState.svelte";
    import { snackbar } from "../snackbar.svelte";
    import { buildSidebarCacheKey } from "../storageKeys";

    let {
        activeTab = $bindable(),
        profileData,
        animeCount = $bindable(0),
    }: {
        activeTab?: Tab;
        profileData: ProfileData;
        animeCount?: number;
    } = $props();

    let visibleCardData: SidebarCardData[] = $state([]);
    let isLoading = $state(false);

    let currentTitle = $derived.by(() => {
        if (activeTab?.id === "home") return "Home";
        if (!activeTab || activeTab.id === "inbox") return "Inbox";
        if (activeTab.id === "waiting") return "Caught Up";
        if (activeTab.id === "upcoming") return "Upcoming";
        if (activeTab.id === "completed") return "Completed";
        if (activeTab.id === "logs") return "Import Logs";
        if (activeTab.id === "settings") return "Settings";
        if (activeTab.id === "downloads") return "Downloads";
        return activeTab.name || activeTab.id;
    });

    watch(
        () => [activeTab, sidebarDataRefreshSeed.current],
        ([tab, seed], previous) => {
            const tabChanged = !previous || previous[0] !== tab;
            if (tabChanged) {
                visibleCardData = [];
                animeCount = 0;
                // If switching to a non-anime tab like settings, logs, downloads, or home, clear selected anime
                if (typeof tab === "object" && tab && (tab.id === "settings" || tab.id === "logs" || tab.id === "downloads" || tab.id === "home")) {
                    selectedAnimeAnilistId.set(undefined);
                }
            }

            if (typeof tab === "object" && tab && (tab.id === "settings" || tab.id === "logs" || tab.id === "downloads" || tab.id === "home")) {
                return;
            }

            const tabKey = buildSidebarCacheKey(activeTab?.id || "inbox");
            try {
                const cached = localStorage.getItem(tabKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        visibleCardData = parsed;
                        animeCount = parsed.length;
                    }
                }
            } catch {}

            isLoading = visibleCardData.length === 0;
            if (!apiBaseUrl.current) {
                isLoading = false;
                return;
            }

            const url = new URL(
                `/api/sidebar/${activeTab?.id || "inbox"}`,
                apiBaseUrl.current,
            );
            fetch(url.toString(), { credentials: "include" })
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then((data) => {
                    visibleCardData = data;
                    animeCount = data.length;
                    try {
                        localStorage.setItem(tabKey, JSON.stringify(data));
                    } catch {}
                })
                .catch((err) => {
                    console.error("Failed to load anime list:", err);
                    if (visibleCardData.length === 0) {
                        snackbar.error("Failed to load anime list");
                    }
                })
                .finally(() => {
                    isLoading = false;
                });
        },
    );

    function handleNavClick(tab: Tab) {
        activeTab = tab;
        selectedAnimeAnilistId.set(undefined);
    }
</script>

<div id="sidebar">
    <!-- Pane Header -->
    <div class="sidebar-pane-header">
        <div class="header-left">
            <h2 class="pane-title">{currentTitle}</h2>
            {#if activeTab?.id !== "settings" && activeTab?.id !== "logs" && activeTab?.id !== "home" && visibleCardData.length > 0}
                <Badge>{visibleCardData.length}</Badge>
            {/if}
        </div>
    </div>

    <!-- Content / Cards List -->
    <div class="sidebar-content">
        {#if activeTab?.id === "logs"}
            <div class="logs-sidebar-nav">
                <MenuItem
                    Icon={ListDashesIcon}
                    label="Import Logs"
                    active
                    onclick={() => handleNavClick({ id: "logs", name: "Logs" })}
                />
            </div>
        {:else if activeTab?.id !== "settings" && activeTab?.id !== "home"}
            {#if visibleCardData.length > 0}
                <div class="cards">
                    {#each visibleCardData as data}
                        <SidebarCard {data} />
                    {/each}
                </div>
            {:else if !isLoading}
                <EmptyState
                    title="No anime in {currentTitle}"
                    description="Anime added will show up here"
                />
            {/if}
        {/if}
    </div>
</div>

<style lang="scss">
    #sidebar {
        width: 320px;
        height: 100vh;
        height: 100dvh;
        max-height: 100dvh;
        min-height: 0;
        display: flex;
        flex-direction: column;
        background: #1d1a17;
        border-right: 1px solid #2e2c29;
        overflow: hidden;

        @media (max-width: 1024px) {
            width: 280px;
        }

        @media (max-width: 768px) {
            width: 100%;
            height: 100%;
            border-right: none;
        }

        .sidebar-pane-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-sizing: content-box;
            height: 52px;
            padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
            padding-left: calc(16px + var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));
            padding-right: 16px;
            padding-bottom: 0;
            flex-shrink: 0;
            border-bottom: 1px solid #2e2c29;

            @media (max-width: 768px) {
                display: none !important;
            }

            .header-left {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .pane-title {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #ffffff;
                letter-spacing: 0.15px;
            }
        }

        .sidebar-content {
            flex: 1 1 0px;
            min-height: 0;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #3a3733 transparent;

            .logs-sidebar-nav {
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 12px;
            }
        }
    }
</style>
