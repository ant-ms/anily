<script lang="ts">
    import type { Tab } from "$lib/tab-switcher/tab-switcher-types";
    import type ProfileData from "../../types/ProfileData";
    import { apiBaseUrl, selectedAnimeAnilistId } from "../context.svelte";
    import LogIcon from "phosphor-svelte/lib/LogIcon";
    import GearIcon from "phosphor-svelte/lib/GearIcon";
    import SignOutIcon from "phosphor-svelte/lib/SignOutIcon";
    import NavDestination from "./NavDestination.svelte";
    import { defaultDestinations } from "./destinations";
    import Avatar from "../Avatar.svelte";
    import MenuItem from "../MenuItem.svelte";

    let {
        activeTab = $bindable(),
        profileData,
    }: {
        activeTab?: Tab;
        profileData: ProfileData;
    } = $props();

    let isProfileMenuOpen = $state(false);

    const isProfileTabActive = $derived(activeTab?.id === "logs" || activeTab?.id === "settings");

    function isTabActive(tab: Tab): boolean {
        if (!activeTab) {
            return !!tab.default;
        }
        return activeTab.id === tab.id;
    }

    function handleTabClick(tab: Tab) {
        activeTab = tab;
        selectedAnimeAnilistId.set(undefined);
        isProfileMenuOpen = false;
    }

    function handleSignOut() {
        if (typeof window !== "undefined") {
            window.location.href = `${apiBaseUrl.current}logout`;
        }
    }
</script>

<svelte:window onclick={() => { if (isProfileMenuOpen) isProfileMenuOpen = false; }} />

<nav class="m3-navigation-rail" aria-label="Main Navigation">
    <!-- Primary Destinations -->
    <div class="rail-destinations" role="tablist" aria-orientation="vertical">
        {#each defaultDestinations as dest}
            <NavDestination
                {dest}
                active={isTabActive(dest)}
                mode="rail"
                onclick={() => handleTabClick(dest)}
            />
        {/each}
    </div>

    <!-- Trailing Section (User Profile & Popup Menu) -->
    <div class="rail-trailing">
        <!-- Profile Avatar & Popover -->
        <div class="profile-container">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="avatar-trigger-wrapper"
                onclick={(e) => e.stopPropagation()}
            >
                <Avatar
                    src={profileData.pictureUrl}
                    alt={profileData.name}
                    size="md"
                    active={isProfileMenuOpen || isProfileTabActive}
                    onclick={() => (isProfileMenuOpen = !isProfileMenuOpen)}
                    title={profileData.name}
                />

                {#if isProfileMenuOpen}
                    <div class="profile-popover" role="menu">
                        <div class="popover-user-info">
                            <span class="popover-name" title={profileData.name}>
                                {profileData.name}
                            </span>
                            <span class="popover-sub">Signed in</span>
                        </div>
                        <div class="popover-divider"></div>

                        <MenuItem
                            Icon={GearIcon}
                            label="Settings"
                            active={activeTab?.id === "settings"}
                            onclick={() => handleTabClick({ id: "settings", name: "Settings" })}
                            role="menuitem"
                        />

                        <MenuItem
                            Icon={LogIcon}
                            label="System Jobs"
                            active={activeTab?.id === "logs"}
                            onclick={() => handleTabClick({ id: "logs", name: "System Jobs" })}
                            role="menuitem"
                        />

                        <div class="popover-divider"></div>

                        <MenuItem
                            Icon={SignOutIcon}
                            label="Sign Out"
                            variant="danger"
                            onclick={handleSignOut}
                            role="menuitem"
                        />
                    </div>
                {/if}
            </div>
        </div>
    </div>
</nav>

<style lang="scss">
    .m3-navigation-rail {
        width: 80px;
        min-width: 80px;
        max-width: 80px;
        height: 100vh;
        height: 100dvh;
        background: #181512;
        border-right: 1px solid #2e2c29;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px 0 16px 0;
        box-sizing: border-box;
        user-select: none;
        position: relative;
        z-index: 30;
        flex-shrink: 0;

        .rail-destinations {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
        }

        .rail-trailing {
            margin-top: auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            padding-bottom: max(0px, env(safe-area-inset-bottom, 0px));
        }

        /* Profile avatar button & popover */
        .profile-container {
            margin-top: 4px;
            width: 100%;
            display: flex;
            justify-content: center;
            position: relative;

            .avatar-trigger-wrapper {
                position: relative;
            }

            .profile-popover {
                position: absolute;
                bottom: 0;
                left: 54px;
                width: 210px;
                background: #231f1c;
                border: 1px solid #3a3733;
                border-radius: 12px;
                padding: 8px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
                z-index: 50;
                display: flex;
                flex-direction: column;
                gap: 4px;
                animation: popover-fade 0.15s cubic-bezier(0.2, 0, 0, 1);

                .popover-user-info {
                    display: flex;
                    flex-direction: column;
                    padding: 4px 8px;

                    .popover-name {
                        font-size: 14px;
                        font-weight: 600;
                        color: #ffffff;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .popover-sub {
                        font-size: 12px;
                        color: #888;
                    }
                }

                .popover-divider {
                    height: 1px;
                    background: #33302c;
                    margin: 2px 0;
                }
            }
        }
    }

    @keyframes popover-fade {
        from {
            opacity: 0;
            transform: translateX(-8px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
</style>
