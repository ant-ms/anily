<script lang="ts">
    import Button from "../Button.svelte";
    import Avatar from "../Avatar.svelte";
    import LogIcon from "phosphor-svelte/lib/LogIcon";
    import GearIcon from "phosphor-svelte/lib/GearIcon";
    import DownloadSimpleIcon from "phosphor-svelte/lib/DownloadSimpleIcon";
    import SignOutIcon from "phosphor-svelte/lib/SignOutIcon";
    import type { Tab } from "../tab-switcher/tab-switcher-types";
    import type ProfileData from "../../types/ProfileData";
    import { signOut } from "../auth";
    import { isMobileNavOpen } from "../context.svelte";
    import { isNative } from "../native/anilyNative";

    let {
        activeTab = $bindable(),
        profileData,
    }: {
        activeTab?: Tab;
        profileData: ProfileData;
    } = $props();

    function selectTab(tab: Tab) {
        activeTab = tab;
        if (typeof window !== "undefined" && window.innerWidth <= 768) {
            isMobileNavOpen.set(false);
        }
    }
</script>

<div id="sidebar-user">
    <Avatar src={profileData.pictureUrl} alt={profileData.name} size="sm" border={false} />
    <span title={profileData.name}>{profileData.name}</span>
    {#if isNative}
        <Button
            Icon={DownloadSimpleIcon}
            active={activeTab?.id === "downloads"}
            title="Downloads"
            onclick={() => {
                selectTab({
                    id: "downloads",
                    name: "Downloads",
                });
            }}
        />
    {/if}
    <Button
        Icon={LogIcon}
        active={activeTab?.id === "logs"}
        title="System Jobs"
        onclick={() => {
            selectTab({
                id: "logs",
                name: "System Jobs",
            });
        }}
    />
    <Button
        Icon={GearIcon}
        active={activeTab?.id === "settings"}
        title="Settings"
        onclick={() => {
            selectTab({
                id: "settings",
            });
        }}
    />
    <Button
        Icon={SignOutIcon}
        onclick={() => signOut()}
    />
</div>

<style lang="scss">
    #sidebar-user {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 12px;
        padding-bottom: max(10px, env(safe-area-inset-bottom, 0px));
        flex-shrink: 0;
        background: #1d1a17;
        border-top: 1px solid #2e2c29;
        min-width: 0;

        span {
            flex: 1 1 0;
            min-width: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 14px;
        }
    }
</style>
