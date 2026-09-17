<script lang="ts">
    import type { Tab } from "$lib/tab-switcher/tab-switcher-types";
    import { selectedAnimeAnilistId } from "../context.svelte";
    import NavDestination from "./NavDestination.svelte";
    import { defaultDestinations } from "./destinations";

    let {
        activeTab = $bindable(),
    }: {
        activeTab?: Tab;
    } = $props();

    function isTabActive(tab: Tab): boolean {
        if (!activeTab) {
            return !!tab.default;
        }
        return activeTab.id === tab.id;
    }

    function handleTabClick(tab: Tab) {
        activeTab = tab;
        selectedAnimeAnilistId.set(undefined);
    }
</script>

<nav class="m3-navigation-bar" aria-label="Bottom Navigation">
    <div class="bar-destinations" role="tablist">
        {#each defaultDestinations as dest}
            <NavDestination
                {dest}
                active={isTabActive(dest)}
                mode="bar"
                onclick={() => handleTabClick(dest)}
            />
        {/each}
    </div>
</nav>

<style lang="scss">
    .m3-navigation-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100vw;
        height: 80px;
        height: calc(80px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
        padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
        padding-left: var(--safe-area-inset-left, env(safe-area-inset-left, 0px));
        padding-right: var(--safe-area-inset-right, env(safe-area-inset-right, 0px));
        background: #181512;
        border-top: 1px solid #2e2c29;
        box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.45);
        z-index: 40;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        user-select: none;

        .bar-destinations {
            display: flex;
            align-items: center;
            justify-content: space-around;
            width: 100%;
            height: 80px;
            max-width: 600px;
            margin: 0 auto;
        }
    }
</style>
