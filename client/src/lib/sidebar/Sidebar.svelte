<script lang="ts">
    import SidebarTabs from "./SidebarTabs.svelte";
    import SidebarUser from "./SidebarUser.svelte";
    import type { Tab } from "../tab-switcher/tab-switcher-types";
    import type ProfileData from "../../types/ProfileData";
    import { watch } from "runed";
    import type SidebarCardData from "../../types/sidebarCardData";
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
        () => {
            visibleCardData = [];

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
        {#if activeTab?.id === "waiting"}
            <div>
                TODO waiting anime (at least 1 episode watched but not all)
            </div>
        {:else if activeTab?.id === "upcoming"}
            <div>TODO want to watch animes (no episodes watched)</div>
        {:else if activeTab?.id === "completed"}
            <div>TODO finished animes (all episodes watched)</div>
        {:else if activeTab?.id === "logs"}
            <div>TODO logs</div>
        {:else if activeTab?.id === "settings"}
            <div>TODO settings</div>
        {:else}
            <!-- <div>
                TODO watching anime with new <br /> unwatched episodes ("like news")
            </div> -->

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
