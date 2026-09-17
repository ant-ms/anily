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
        return activeTab.name || activeTab.id;
    });

    watch(
        () => [activeTab, sidebarDataRefreshSeed.current],
        ([tab, seed], previous) => {
            const tabChanged = !previous || previous[0] !== tab;
            if (tabChanged) {
                visibleCardData = [];
                animeCount = 0;
                // If switching to a non-anime tab like settings, logs, or home, clear selected anime
                if (typeof tab === "object" && tab && (tab.id === "settings" || tab.id === "logs" || tab.id === "home")) {
                    selectedAnimeAnilistId.set(undefined);
                }
            }

            if (typeof tab === "object" && tab && (tab.id === "settings" || tab.id === "logs" || tab.id === "home")) {
                return;
            }

            isLoading = true;
            const url = new URL(
                `/api/sidebar/${activeTab?.id || "inbox"}`,
                apiBaseUrl.current,
            );
            fetch(url.toString(), { credentials: "include" })
                .then((res) => res.json())
                .then((data) => {
                    visibleCardData = data;
                    animeCount = data.length;
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
                <span class="count-badge">{visibleCardData.length}</span>
            {/if}
        </div>
    </div>

    <!-- Content / Cards List -->
    <div class="sidebar-content">
        {#if activeTab?.id === "logs"}
            <div class="logs-sidebar-nav">
                <button
                    type="button"
                    class="nav-item active"
                    onclick={() => handleNavClick({ id: "logs", name: "Logs" })}
                >
                    <ListDashesIcon size="1.2rem" />
                    <span>Import Logs</span>
                </button>
            </div>
        {:else if activeTab?.id !== "settings" && activeTab?.id !== "home"}
            {#if visibleCardData.length > 0}
                <div class="cards">
                    {#each visibleCardData as data}
                        <SidebarCard {data} />
                    {/each}
                </div>
            {:else if !isLoading}
                <div class="empty-state">
                    <p class="empty-text">No anime in {currentTitle}</p>
                    <span class="empty-sub">Anime added will show up here</span>
                </div>
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
            height: 52px;
            padding: 0 16px;
            flex-shrink: 0;
            border-bottom: 1px solid #2e2c29;
            box-sizing: border-box;

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

            .count-badge {
                font-size: 11px;
                font-weight: 600;
                color: #ffd52c;
                background: rgba(255, 213, 44, 0.15);
                padding: 2px 7px;
                border-radius: 12px;
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

                .nav-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 16px;
                    border-radius: 8px;
                    background: hsl(20, 17.6%, 8.5%);
                    border: 1px solid hsl(36, 5.7%, 20%);
                    color: #ddd;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s, border 0.2s, color 0.2s;

                    &:hover {
                        background: hsl(20, 17.6%, 14%);
                        color: #fff;
                    }

                    &.active {
                        background: #ffd52c18;
                        border-color: #ffd52c;
                        color: #ffd52c;
                    }
                }
            }

            .empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 48px 16px;
                text-align: center;
                color: #888;

                .empty-text {
                    margin: 0;
                    font-size: 14px;
                    font-weight: 500;
                    color: #bbb;
                }

                .empty-sub {
                    margin-top: 4px;
                    font-size: 12px;
                    color: #777;
                }
            }
        }
    }
</style>
