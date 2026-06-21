<script lang="ts">
    import Sidebar from "$lib/sidebar/Sidebar.svelte";
    import "./app.scss";
    import type { Tab } from "$lib/tab-switcher/tab-switcher-types";
    import LoginPage from "./pages/LoginPage.svelte";
    import LogsPage from "./pages/LogsPage.svelte";
    import SettingsPage from "./pages/SettingsPage.svelte";
    import HomePage from "./pages/HomePage.svelte";
    import type ProfileData from "./types/ProfileData";
    import { selectedAnimeAnilistId } from "./lib/context.svelte";
    import AnimeDetailsPage from "./pages/AnimeDetailsPage/AnimeDetailsPage.svelte";

    let profileData: ProfileData | undefined = $state(undefined);

    let activeTab: Tab | undefined = $state();
</script>

{#if profileData}
    <main>
        <Sidebar bind:activeTab {profileData} />
        <div id="content">
            {#if selectedAnimeAnilistId.current}
                <AnimeDetailsPage />
            {:else if activeTab?.id === "logs"}
                <LogsPage />
            {:else if activeTab?.id === "settings"}
                <SettingsPage />
            {:else}
                <HomePage />
            {/if}
        </div>
    </main>
{:else}
    <LoginPage bind:profileData />
{/if}

<style style="scss">
    main {
        display: grid;
        grid-template-columns: auto 1fr;
        grid-template-rows: 100vh;
    }
</style>
