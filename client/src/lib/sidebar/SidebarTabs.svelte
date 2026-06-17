<script lang="ts">
    import NewspaperIcon from "phosphor-svelte/lib/NewspaperIcon";
    import BookmarkIcon from "phosphor-svelte/lib/BookmarkIcon";
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

<TabSwitcher
    bind:activeTab
    tabs={[
        {
            id: "home",
            Icon: NewspaperIcon,
            default: true,
        },
        {
            id: "watching",
            name: "In Progress",
            Icon: PlayIcon,
        },
        {
            id: "bookmarked",
            name: "Bookmarked",
            Icon: BookmarkIcon,
        },
        {
            id: "done",
            name: "Done",
            Icon: CheckFatIcon,
        },
    ]}
/>
