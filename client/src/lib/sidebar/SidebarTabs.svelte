<script lang="ts">
    import NewspaperIcon from "phosphor-svelte/lib/NewspaperIcon";
    import HourglassIcon from "phosphor-svelte/lib/HourglassIcon";
    import CheckFatIcon from "phosphor-svelte/lib/CheckFatIcon";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";
    import TabSwitcher from "../tab-switcher/TabSwitcher.svelte";
    import type { Tab } from "../tab-switcher/tab-switcher-types";

    let {
        activeTab = $bindable(),
    }: {
        activeTab?: Tab;
    } = $props();
</script>

<div class="tabs">
    <TabSwitcher
        bind:activeTab
        tabs={[
            {
                id: "inbox",
                Icon: NewspaperIcon,
                default: true,
            },
            {
                id: "waiting",
                name: "Caught Up",
                Icon: PlayIcon,
            },
            {
                id: "upcoming",
                name: "Upcoming",
                Icon: HourglassIcon,
            },
            {
                id: "completed",
                name: "Completed",
                Icon: CheckFatIcon,
            },
        ]}
    />
</div>

<style lang="scss">
    .tabs {
        flex-shrink: 0;
        width: 100%;
    }
</style>
