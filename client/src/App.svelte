<script lang="ts">
    import Sidebar from "$lib/sidebar/Sidebar.svelte";
    import Searchbar from "$lib/searchbar/Searchbar.svelte";
    import "./app.scss";
    import type { Tab } from "$lib/tab-switcher/tab-switcher-types";
    import LoginPage from "./pages/LoginPage.svelte";
    import LogsPage from "./pages/LogsPage.svelte";
    import SettingsPage from "./pages/SettingsPage.svelte";

    // TODO
    let loggedIn = $state(true);

    let activeTab: Tab | undefined = $state();
</script>

{#if loggedIn}
    <main>
        <Sidebar bind:activeTab />
        <div id="content">
            {#if activeTab?.id === "watching"}

            {:else if activeTab?.id === "bookmarked"}

            {:else if activeTab?.id === "done"}

            {:else if activeTab?.id === "logs"}
                <LogsPage />
            {:else if activeTab?.id === "settings"}
                <SettingsPage />
            {:else}
                <Searchbar />
                <div>TODO calendar</div>
            {/if}
        </div>
    </main>
{:else}
    <LoginPage />
{/if}

<style style="scss">
    main {
        display: grid;
        grid-template-columns: auto 1fr;
        grid-template-rows: 100vh;

        #content {
            padding: 12px;
        }
    }
</style>
