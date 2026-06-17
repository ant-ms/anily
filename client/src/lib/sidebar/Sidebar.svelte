<script lang="ts">
    import SidebarTabs from "./SidebarTabs.svelte";
    import SidebarUser from "./SidebarUser.svelte";
    import type { Tab } from "../tab-switcher/tab-switcher-types";

    let {
        activeTab = $bindable(),
    }: {
        activeTab?: Tab;
    } = $props();
</script>

<div id="sidebar">
    <SidebarTabs bind:activeTab />
    <div class="sidebar-content">
        {#if activeTab?.id === "watching"}
            <div>
                TODO watching anime (at least 1 episode watched but not all)
            </div>
        {:else if activeTab?.id === "bookmarked"}
            <div>TODO want to watch animes (no episodes watched)</div>
        {:else if activeTab?.id === "done"}
            <div>TODO finished animes (all episodes watched)</div>
        {:else if activeTab?.id === "logs"}
            <div>TODO logs</div>
        {:else if activeTab?.id === "settings"}
            <div>TODO settings</div>
        {:else}
            <div>
                TODO watching anime with new unwatched episodes ("like news")
            </div>
        {/if}
    </div>
    <SidebarUser bind:activeTab />
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

            margin: 8px;
        }
    }
</style>
