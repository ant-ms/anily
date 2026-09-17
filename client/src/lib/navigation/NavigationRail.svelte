<script lang="ts">
    import type { Tab } from "$lib/tab-switcher/tab-switcher-types";
    import type ProfileData from "../../types/ProfileData";
    import { apiBaseUrl, selectedAnimeAnilistId } from "../context.svelte";
    import HouseIcon from "phosphor-svelte/lib/HouseIcon";
    import NewspaperIcon from "phosphor-svelte/lib/NewspaperIcon";
    import HourglassIcon from "phosphor-svelte/lib/HourglassIcon";
    import CheckFatIcon from "phosphor-svelte/lib/CheckFatIcon";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";
    import LogIcon from "phosphor-svelte/lib/LogIcon";
    import GearIcon from "phosphor-svelte/lib/GearIcon";
    import SignOutIcon from "phosphor-svelte/lib/SignOutIcon";

    let {
        activeTab = $bindable(),
        profileData,
    }: {
        activeTab?: Tab;
        profileData: ProfileData;
    } = $props();

    let isProfileMenuOpen = $state(false);

    const destinations: Tab[] = [
        {
            id: "home",
            name: "Home",
            Icon: HouseIcon,
            default: true,
        },
        {
            id: "inbox",
            name: "Inbox",
            Icon: NewspaperIcon,
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
    ];

    const trailingDestinations: Tab[] = [
        {
            id: "logs",
            name: "Logs",
            Icon: LogIcon,
        },
        {
            id: "settings",
            name: "Settings",
            Icon: GearIcon,
        },
    ];

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
        {#each destinations as dest}
            {@const active = isTabActive(dest)}
            <button
                type="button"
                role="tab"
                class="rail-destination"
                class:active
                aria-selected={active}
                aria-label={dest.name}
                title={dest.name}
                onclick={() => handleTabClick(dest)}
            >
                <div class="indicator-container">
                    <div class="active-indicator"></div>
                    <div class="icon-wrapper">
                        {#if dest.Icon}
                            <dest.Icon size="1.5rem" />
                        {/if}
                    </div>
                </div>
                <span class="destination-label">{dest.name}</span>
            </button>
        {/each}
    </div>

    <!-- Trailing Section (Secondary Actions & User Profile) -->
    <div class="rail-trailing">
        {#each trailingDestinations as dest}
            {@const active = isTabActive(dest)}
            <button
                type="button"
                role="tab"
                class="rail-destination"
                class:active
                aria-selected={active}
                aria-label={dest.name}
                title={dest.name}
                onclick={() => handleTabClick(dest)}
            >
                <div class="indicator-container">
                    <div class="active-indicator"></div>
                    <div class="icon-wrapper">
                        {#if dest.Icon}
                            <dest.Icon size="1.5rem" />
                        {/if}
                    </div>
                </div>
                <span class="destination-label">{dest.name}</span>
            </button>
        {/each}

        <!-- Profile Avatar & Popover -->
        <div class="profile-container">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="avatar-trigger-wrapper"
                onclick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    class="avatar-btn"
                    class:active={isProfileMenuOpen}
                    onclick={() => (isProfileMenuOpen = !isProfileMenuOpen)}
                    aria-label={`User profile for ${profileData.name}`}
                    title={profileData.name}
                    aria-expanded={isProfileMenuOpen}
                    aria-haspopup="true"
                >
                    <img
                        src={profileData.pictureUrl}
                        alt=""
                        class="avatar-img"
                    />
                </button>

                {#if isProfileMenuOpen}
                    <div class="profile-popover" role="menu">
                        <div class="popover-user-info">
                            <span class="popover-name" title={profileData.name}>
                                {profileData.name}
                            </span>
                            <span class="popover-sub">Logged in</span>
                        </div>
                        <div class="popover-divider"></div>
                        <button
                            type="button"
                            class="popover-btn sign-out"
                            onclick={handleSignOut}
                            role="menuitem"
                        >
                            <SignOutIcon size="1.2rem" />
                            <span>Sign Out</span>
                        </button>
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

        /* Material 3 Destination Item */
        .rail-destination {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 80px;
            min-height: 56px;
            padding: 0;
            background: transparent;
            border: none;
            cursor: pointer;
            outline: none;
            color: hsl(36, 10%, 70%);
            transition: color 200ms cubic-bezier(0.2, 0, 0, 1);

            &:focus-visible .indicator-container {
                outline: 2px solid #ffd52c;
                outline-offset: 2px;
            }

            .indicator-container {
                position: relative;
                width: 56px;
                height: 32px;
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;

                .active-indicator {
                    position: absolute;
                    inset: 0;
                    border-radius: 16px;
                    background: transparent;
                    transform: scaleX(0.4);
                    opacity: 0;
                    transition: transform 200ms cubic-bezier(0.2, 0, 0, 1),
                        background-color 200ms cubic-bezier(0.2, 0, 0, 1),
                        opacity 200ms cubic-bezier(0.2, 0, 0, 1);
                }

                .icon-wrapper {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    color: inherit;
                    transition: color 200ms cubic-bezier(0.2, 0, 0, 1),
                        transform 200ms cubic-bezier(0.2, 0, 0, 1);
                }
            }

            .destination-label {
                margin-top: 4px;
                font-size: 12px;
                line-height: 16px;
                font-weight: 500;
                letter-spacing: 0.4px;
                color: inherit;
                text-align: center;
                max-width: 76px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                transition: font-weight 200ms cubic-bezier(0.2, 0, 0, 1),
                    color 200ms cubic-bezier(0.2, 0, 0, 1);
            }

            /* Inactive Hover */
            &:hover:not(.active) {
                color: #e0d8d0;

                .indicator-container .active-indicator {
                    background: rgba(255, 255, 255, 0.08);
                    opacity: 1;
                    transform: scaleX(1);
                }
            }

            /* Active State */
            &.active {
                color: #ffffff;

                .indicator-container {
                    .active-indicator {
                        background: rgba(255, 213, 44, 0.2);
                        opacity: 1;
                        transform: scaleX(1);
                    }

                    .icon-wrapper {
                        color: #ffd52c;
                    }
                }

                .destination-label {
                    font-weight: 600;
                    color: #ffffff;
                }

                /* Active Hover */
                &:hover .indicator-container .active-indicator {
                    background: rgba(255, 213, 44, 0.28);
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

            .avatar-btn {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                padding: 0;
                border: 2px solid transparent;
                background: transparent;
                cursor: pointer;
                transition: border-color 0.2s, transform 0.2s;

                .avatar-img {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    object-fit: cover;
                    display: block;
                }

                &:hover {
                    border-color: rgba(255, 213, 44, 0.5);
                    transform: scale(1.05);
                }

                &.active {
                    border-color: #ffd52c;
                }

                &:focus-visible {
                    outline: 2px solid #ffd52c;
                    outline-offset: 2px;
                }
            }

            .profile-popover {
                position: absolute;
                bottom: 0;
                left: 54px;
                width: 200px;
                background: #231f1c;
                border: 1px solid #3a3733;
                border-radius: 12px;
                padding: 12px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
                z-index: 50;
                display: flex;
                flex-direction: column;
                gap: 8px;
                animation: popover-fade 0.15s cubic-bezier(0.2, 0, 0, 1);

                .popover-user-info {
                    display: flex;
                    flex-direction: column;

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
                }

                .popover-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 10px;
                    border-radius: 8px;
                    font-size: 13px;
                    cursor: pointer;
                    color: #d0c8c0;
                    transition: background 0.15s, color 0.15s;

                    &:hover {
                        background: rgba(255, 255, 255, 0.08);
                        color: #ffffff;
                    }

                    &.sign-out {
                        color: #ff7b72;

                        &:hover {
                            background: rgba(255, 123, 114, 0.12);
                            color: #ff948d;
                        }
                    }
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
