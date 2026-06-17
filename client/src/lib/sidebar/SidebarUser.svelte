<script lang="ts">
    import Button from "../Button.svelte";
    import LogIcon from "phosphor-svelte/lib/LogIcon";
    import GearIcon from "phosphor-svelte/lib/GearIcon";
    import SignOutIcon from "phosphor-svelte/lib/SignOutIcon";
    import type { Tab } from "../tab-switcher/tab-switcher-types";
    import type LoginData from "../../types/LoginData";

    let {
        activeTab = $bindable(),
        profileData,
    }: {
        activeTab?: Tab;
        profileData: LoginData;
    } = $props();
</script>

<div id="sidebar-user">
    <img src={profileData.pictureUrl} alt="" />
    <span>{profileData.name}</span>
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
    <Button
        Icon={SignOutIcon}
        onclick={() => {
            window.location.href = `${profileData.apiBaseUrl.replace(/\/api$/, "")}/logout`;
        }}
    />
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
