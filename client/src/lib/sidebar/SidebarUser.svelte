<script lang="ts">
    import Button from "../Button.svelte";
    import LogIcon from "phosphor-svelte/lib/LogIcon";
    import GearIcon from "phosphor-svelte/lib/GearIcon";
    import SignOutIcon from "phosphor-svelte/lib/SignOutIcon";
    import type { Tab } from "../tab-switcher/tab-switcher-types";

    let {
        activeTab = $bindable(),
    }: {
        activeTab?: Tab;
    } = $props();
</script>

<div id="sidebar-user">
    <img
        src="https://gitlab.com/uploads/-/system/user/avatar/3555890/avatar.png"
        alt=""
    />
    <span>Yanik</span>
    <Button
        Icon={LogIcon}
        active={activeTab?.id === "logs"}
        onclick={() => {
            activeTab = {
                id: "logs",
            };
        }}
    />
    <Button
        Icon={GearIcon}
        active={activeTab?.id === "settings"}
        onclick={() => {
            activeTab = {
                id: "settings",
            };
        }}
    />
    <Button Icon={SignOutIcon} />
</div>

<style lang="scss">
    #sidebar-user {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 12px;

        img {
            height: 2rem;
            border-radius: 100%;
        }

        span {
            flex-grow: 1;
        }
    }
</style>
