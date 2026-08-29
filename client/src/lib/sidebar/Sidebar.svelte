<script lang="ts">
    import SidebarTabs from "./SidebarTabs.svelte";
    import SidebarUser from "./SidebarUser.svelte";
    import type { Tab } from "../tab-switcher/tab-switcher-types";
    import type ProfileData from "../../types/ProfileData";
    import { watch } from "runed";
    import type SidebarCardData from "../../types/SidebarCardData";
    import { apiBaseUrl, sidebarDataRefreshSeed } from "../context.svelte";
    import SidebarCard from "./SidebarCard.svelte";

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
                if (tab && (tab.id === "settings" || tab.id === "logs")) {
                    selectedAnimeAnilistId.set(undefined);
                }
            }

            if (tab?.id === "settings" || tab?.id === "logs") {
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
        {#if activeTab?.id !== "logs" && activeTab?.id !== "settings"}
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
        display: flex;
        flex-direction: column;
        background: #1d1a17;
        border-right: 1px solid #2e2c29;

        .sidebar-content {
            flex-grow: 1;
            overflow-y: scroll;
            scrollbar-width: none;
        }
    }
</style>
