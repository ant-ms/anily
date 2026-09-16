<script lang="ts">
    import SidebarTabs from "./SidebarTabs.svelte";
    import SidebarUser from "./SidebarUser.svelte";
    import type { Tab } from "../tab-switcher/tab-switcher-types";
    import type ProfileData from "../../types/ProfileData";
    import { watch } from "runed";
    import type SidebarCardData from "../../types/SidebarCardData";
    import {
        apiBaseUrl,
        sidebarDataRefreshSeed,
        selectedAnimeAnilistId,
        isMobileNavOpen,
    } from "../context.svelte";
    import SidebarCard from "./SidebarCard.svelte";
    import ListDashesIcon from "phosphor-svelte/lib/ListDashesIcon";
    import XIcon from "phosphor-svelte/lib/XIcon";

    let {
        activeTab = $bindable(),
        profileData,
    }: {
        activeTab?: Tab;
        profileData: ProfileData;
    } = $props();

    let visibleCardData: SidebarCardData[] = $state([]);

    watch(
        () => [activeTab, sidebarDataRefreshSeed.current],
        ([tab, seed], previous) => {
            const tabChanged = !previous || previous[0] !== tab;
            if (tabChanged) {
                visibleCardData = [];
                // If switching to a non-anime tab like settings or logs, clear selected anime
                if (typeof tab === "object" && tab && (tab.id === "settings" || tab.id === "logs")) {
                    selectedAnimeAnilistId.set(undefined);
                }
            }

            if (typeof tab === "object" && tab && (tab.id === "settings" || tab.id === "logs")) {
                return;
            }

            const url = new URL(
                `/api/sidebar/${activeTab?.id || "inbox"}`,
                apiBaseUrl.current,
            );
            fetch(url.toString(), { credentials: "include" })
                .then((res) => res.json())
                .then((data) => {
                    visibleCardData = data;
                });
        },
    );

    function handleNavClick(tab: Tab) {
        activeTab = tab;
        if (typeof window !== "undefined" && window.innerWidth <= 768) {
            isMobileNavOpen.set(false);
        }
    }
</script>

<div id="sidebar">
    <div class="sidebar-header-row">
        <div class="tabs-container">
            <SidebarTabs bind:activeTab />
        </div>
        <button
            type="button"
            class="sidebar-close-btn"
            onclick={() => isMobileNavOpen.set(false)}
            aria-label="Close navigation"
        >
            <XIcon size="1.25rem" />
        </button>
    </div>

    <div class="sidebar-content">
        {#if activeTab?.id === "logs"}
            <div class="logs-sidebar-nav">
                <button
                    class="nav-item active"
                    onclick={() => handleNavClick({ id: "logs", name: "Logs" })}
                >
                    <ListDashesIcon size="1.2rem" />
                    <span>Import Logs</span>
                </button>
            </div>
        {:else if activeTab?.id !== "settings"}
            <div class="cards">
                {#each visibleCardData as data}
                    <SidebarCard {data} />
                {/each}
            </div>
        {/if}
    </div>
    <SidebarUser bind:activeTab {profileData} />
</div>

<style lang="scss">
    #sidebar {
        width: 370px;
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
            width: min(320px, 85vw);
            height: 100%;
            border-right: 1px solid #3a3733;
        }

        .sidebar-header-row {
            display: flex;
            align-items: stretch;
            flex-shrink: 0;
            border-bottom: 1px solid #2e2c29;

            .tabs-container {
                flex: 1;
                min-width: 0;
            }

            .sidebar-close-btn {
                display: none;
                align-items: center;
                justify-content: center;
                padding: 0 12px;
                color: #888;
                cursor: pointer;
                transition: color 0.15s, background 0.15s;

                &:hover {
                    color: #fff;
                    background: hsl(20, 17.6%, 14%);
                }

                @media (max-width: 768px) {
                    display: flex;
                }
            }
        }

        .sidebar-content {
            flex: 1 1 0px;
            min-height: 0;
            overflow-y: auto;
            scrollbar-width: none;

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
        }
    }
</style>
