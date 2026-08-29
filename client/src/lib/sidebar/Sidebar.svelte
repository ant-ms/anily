<script lang="ts">
    import SidebarTabs from "./SidebarTabs.svelte";
    import SidebarUser from "./SidebarUser.svelte";
    import type { Tab } from "../tab-switcher/tab-switcher-types";
    import type ProfileData from "../../types/ProfileData";
    import { watch } from "runed";
    import type SidebarCardData from "../../types/SidebarCardData";
    import { apiBaseUrl, sidebarDataRefreshSeed, selectedAnimeAnilistId } from "../context.svelte";
    import SidebarCard from "./SidebarCard.svelte";
    import ChartBarIcon from "phosphor-svelte/lib/ChartBarIcon";
    import ListDashesIcon from "phosphor-svelte/lib/ListDashesIcon";
    import WarningCircleIcon from "phosphor-svelte/lib/WarningCircleIcon";

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
                // If switching to a non-anime tab like settings, stats, logs, or missing, clear selected anime
                if (tab && (tab.id === "settings" || tab.id === "logs" || tab.id === "stats" || tab.id === "missing")) {
                    selectedAnimeAnilistId.set(undefined);
                }
            }

            if (tab?.id === "settings" || tab?.id === "logs" || tab?.id === "stats" || tab?.id === "missing") {
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
</script>

<div id="sidebar">
    <SidebarTabs bind:activeTab />
    <div class="sidebar-content">
        {#if activeTab?.id === "logs" || activeTab?.id === "stats" || activeTab?.id === "missing"}
            <div class="logs-sidebar-nav">
                <button
                    class="nav-item"
                    class:active={activeTab?.id === "stats"}
                    onclick={() => (activeTab = { id: "stats", name: "Statistics" })}
                >
                    <ChartBarIcon size="1.2rem" />
                    <span>Statistics</span>
                </button>
                <button
                    class="nav-item"
                    class:active={activeTab?.id === "logs"}
                    onclick={() => (activeTab = { id: "logs", name: "Logs" })}
                >
                    <ListDashesIcon size="1.2rem" />
                    <span>Import Logs</span>
                </button>
                <button
                    class="nav-item"
                    class:active={activeTab?.id === "missing"}
                    onclick={() => (activeTab = { id: "missing", name: "Missing Episodes" })}
                >
                    <WarningCircleIcon size="1.2rem" />
                    <span>Missing Episodes</span>
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
        min-height: 0;
        display: flex;
        flex-direction: column;
        background: #1d1a17;
        border-right: 1px solid #2e2c29;
        overflow: hidden;

        .sidebar-content {
            flex-grow: 1;
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
