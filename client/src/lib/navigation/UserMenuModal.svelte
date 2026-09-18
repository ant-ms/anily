<script lang="ts">
    import type ProfileData from "../../types/ProfileData";
    import type { Tab } from "$lib/tab-switcher/tab-switcher-types";
    import { apiBaseUrl, selectedAnimeAnilistId } from "../context.svelte";
    import LogIcon from "phosphor-svelte/lib/LogIcon";
    import GearIcon from "phosphor-svelte/lib/GearIcon";
    import SignOutIcon from "phosphor-svelte/lib/SignOutIcon";
    import XIcon from "phosphor-svelte/lib/XIcon";
    import BottomSheet from "../BottomSheet.svelte";
    import Avatar from "../Avatar.svelte";
    import Badge from "../Badge.svelte";
    import IconButton from "../IconButton.svelte";
    import MenuItem from "../MenuItem.svelte";

    import { signOut } from "$lib/auth";

    let {
        profileData,
        activeTab = $bindable(),
        isOpen = $bindable(false),
    }: {
        profileData: ProfileData;
        activeTab?: Tab;
        isOpen?: boolean;
    } = $props();

    function navigateTo(tab: Tab) {
        activeTab = tab;
        selectedAnimeAnilistId.set(undefined);
        isOpen = false;
    }

    function handleSignOut() {
        isOpen = false;
        signOut();
    }
</script>

<BottomSheet bind:isOpen ariaLabel="User Account and Settings">
    <div class="user-header">
        <Avatar
            src={profileData.pictureUrl}
            alt={profileData.name}
            size="lg"
        />
        <div class="user-info">
            <span class="user-name">{profileData.name}</span>
            <div class="user-badge-wrapper">
                <Badge variant="muted" size="sm">Signed in</Badge>
            </div>
        </div>
        <IconButton
            Icon={XIcon}
            variant="ghost"
            shape="circle"
            onclick={() => { isOpen = false; }}
            title="Close menu"
        />
    </div>

    <div class="menu-divider"></div>

    <div class="menu-items">
        <MenuItem
            Icon={GearIcon}
            label="Settings"
            hasIconPill
            active={activeTab?.id === "settings"}
            onclick={() => navigateTo({ id: "settings", name: "Settings" })}
        />

        <MenuItem
            Icon={LogIcon}
            label="System Jobs"
            hasIconPill
            active={activeTab?.id === "logs"}
            onclick={() => navigateTo({ id: "logs", name: "System Jobs" })}
        />

        <MenuItem
            Icon={SignOutIcon}
            label="Sign Out"
            hasIconPill
            variant="danger"
            onclick={handleSignOut}
        />
    </div>
</BottomSheet>

<style lang="scss">
    .user-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 4px 0;

        .user-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
            flex: 1;
            min-width: 0;

            .user-name {
                font-size: 16px;
                font-weight: 600;
                color: #ffffff;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .user-badge-wrapper {
                display: flex;
            }
        }
    }

    .menu-divider {
        height: 1px;
        background: #2e2c29;
        margin: 2px 0;
    }

    .menu-items {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
</style>
