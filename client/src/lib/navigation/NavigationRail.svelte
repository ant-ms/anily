<script lang="ts">
    import type { Tab } from "$lib/tab-switcher/tab-switcher-types";
    import type ProfileData from "../../types/ProfileData";
    import { apiBaseUrl, selectedAnimeAnilistId, isGlobalSearchOpen } from "../context.svelte";
    import MagnifyingGlassIcon from "phosphor-svelte/lib/MagnifyingGlassIcon";
    import LogIcon from "phosphor-svelte/lib/LogIcon";
    import GearIcon from "phosphor-svelte/lib/GearIcon";
    import DownloadSimpleIcon from "phosphor-svelte/lib/DownloadSimpleIcon";
    import SignOutIcon from "phosphor-svelte/lib/SignOutIcon";
    import NavDestination from "./NavDestination.svelte";
    import { defaultDestinations } from "./destinations";
    import Avatar from "../Avatar.svelte";
    import MenuItem from "../MenuItem.svelte";
    import CloudSlashIcon from "phosphor-svelte/lib/CloudSlashIcon";
    import { networkState } from "../network.svelte";

    import { signOut } from "$lib/auth";
    import { isNative } from "$lib/native/anilyNative";

    let {
        activeTab = $bindable(),
        profileData,
    }: {
        activeTab?: Tab;
        profileData: ProfileData;
    } = $props();

    let isProfileMenuOpen = $state(false);

    const isProfileTabActive = $derived(activeTab?.id === "logs" || activeTab?.id === "settings" || activeTab?.id === "downloads");

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
        isProfileMenuOpen = false;
        signOut();
    }
</script>

<svelte:window onclick={() => { if (isProfileMenuOpen) isProfileMenuOpen = false; }} />

<nav class="m3-navigation-rail" aria-label="Main Navigation">
    <!-- M3 Rail Top Action: Standard 56dp FAB -->
    <div class="rail-header">
        <button
            type="button"
            class="rail-fab"
            onclick={() => isGlobalSearchOpen.set(true)}
            title="Search anime (⌘K or Ctrl+K)"
            aria-label="Search anime"
        >
            <MagnifyingGlassIcon size={24} weight="bold" />
        </button>
    </div>

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
        {#if !networkState.isOnline}
            <div class="rail-offline-indicator" title="Offline Mode: only downloaded anime are available">
                <CloudSlashIcon size={18} weight="bold" />
                <span class="offline-pill-text">Offline</span>
            </div>
        {/if}

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

                        {#if isNative}
                            <MenuItem
                                Icon={DownloadSimpleIcon}
                                label="Downloads"
                                active={activeTab?.id === "downloads"}
                                onclick={() => handleTabClick({ id: "downloads", name: "Downloads" })}
                                role="menuitem"
                            />
                        {/if}

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
        padding-top: calc(20px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
        padding-left: var(--safe-area-inset-left, env(safe-area-inset-left, 0px));
        padding-right: 0;
        padding-bottom: 16px;
        box-sizing: border-box;
        user-select: none;
        position: relative;
        z-index: 30;
        flex-shrink: 0;

        .rail-header {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            margin-bottom: 16px;

            .rail-fab {
                position: relative;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 56px;
                height: 56px;
                border-radius: 16px;
                background: #ffd52c;
                color: #2b2000;
                border: none;
                cursor: pointer;
                outline: none;
                box-shadow:
                    0 4px 8px 3px rgba(0, 0, 0, 0.25),
                    0 1px 3px rgba(0, 0, 0, 0.35);
                transition:
                    box-shadow 200ms cubic-bezier(0.2, 0, 0, 1),
                    background-color 200ms cubic-bezier(0.2, 0, 0, 1);

                /* M3 State layer overlay */
                &::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    border-radius: inherit;
                    background: #2b2000; /* on-primary-container */
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1);
                }

                &:hover {
                    box-shadow:
                        0 6px 10px 4px rgba(0, 0, 0, 0.28),
                        0 2px 3px rgba(0, 0, 0, 0.38);

                    &::after {
                        opacity: 0.08; /* M3 Hover state layer: 8% */
                    }
                }

                &:active {
                    box-shadow:
                        0 4px 8px 3px rgba(0, 0, 0, 0.25),
                        0 1px 3px rgba(0, 0, 0, 0.35);

                    &::after {
                        opacity: 0.12; /* M3 Pressed state layer: 12% */
                    }
                }

                &:focus-visible {
                    outline: 2px solid #ffd52c;
                    outline-offset: 3px;

                    &::after {
                        opacity: 0.12;
                    }
                }
            }
        }

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

            .rail-offline-indicator {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
                padding: 6px 8px;
                border-radius: 8px;
                background: rgba(245, 158, 11, 0.15);
                border: 1px solid rgba(245, 158, 11, 0.35);
                color: #f59e0b;

                .offline-pill-text {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
            }
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
