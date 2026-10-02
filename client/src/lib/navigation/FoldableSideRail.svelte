<script lang="ts">
    import type { Tab } from "$lib/tab-switcher/tab-switcher-types";
    import type ProfileData from "../../types/ProfileData";
    import {
        selectedAnimeAnilistId,
        selectedAnimeDetails,
        isSeasonsSidebarOpen,
        isGlobalSearchOpen,
        isAnimeDescriptionOpen,
    } from "../context.svelte";
    import { defaultDestinations } from "./destinations";
    import NavDestination from "./NavDestination.svelte";
    import IconButton from "../IconButton.svelte";
    import Avatar from "../Avatar.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { bookmarkManager } from "../bookmark.svelte";
    import { ratingManager } from "../rating.svelte";
    import { watchAllManager } from "../watchAll.svelte";
    import { networkState } from "../network.svelte";
    import { signOut } from "$lib/auth";
    import { isNative } from "$lib/native/anilyNative";
    import CaretLeftIcon from "phosphor-svelte/lib/CaretLeftIcon";
    import BookmarkIcon from "phosphor-svelte/lib/BookmarkIcon";
    import TreeStructureIcon from "phosphor-svelte/lib/TreeStructureIcon";
    import InfoIcon from "phosphor-svelte/lib/InfoIcon";
    import CheckIcon from "phosphor-svelte/lib/CheckIcon";
    import EyeIcon from "phosphor-svelte/lib/EyeIcon";
    import MagnifyingGlassIcon from "phosphor-svelte/lib/MagnifyingGlassIcon";
    import ThumbsUpIcon from "phosphor-svelte/lib/ThumbsUpIcon";
    import ThumbsDownIcon from "phosphor-svelte/lib/ThumbsDownIcon";
    import MinusIcon from "phosphor-svelte/lib/MinusIcon";
    import CloudSlashIcon from "phosphor-svelte/lib/CloudSlashIcon";
    import LogIcon from "phosphor-svelte/lib/LogIcon";
    import GearIcon from "phosphor-svelte/lib/GearIcon";
    import DownloadSimpleIcon from "phosphor-svelte/lib/DownloadSimpleIcon";
    import SignOutIcon from "phosphor-svelte/lib/SignOutIcon";

    let {
        activeTab = $bindable(),
        onBackClick,
        profileData,
    }: {
        activeTab?: Tab;
        onBackClick: () => void;
        profileData?: ProfileData;
    } = $props();

    let isProfileMenuOpen = $state(false);

    const isInMediaDetails = $derived(selectedAnimeAnilistId.current !== undefined);
    const isProfileTabActive = $derived(
        activeTab?.id === "logs" ||
        activeTab?.id === "settings" ||
        activeTab?.id === "downloads"
    );

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

<aside class="foldable-side-rail" aria-label="Foldable Controls">
    {#if isInMediaDetails}
        <div class="rail-media-pane">
            <!-- Top Group: Back, Sidebar toggle, Info, Rating buttons -->
            <div class="top-media-group">
                <!-- Back Button (56dp) -->
                <div class="rail-header">
                    <button
                        type="button"
                        class="rail-back-btn"
                        onclick={onBackClick}
                        title="Back to list"
                        aria-label="Back to list"
                    >
                        <CaretLeftIcon size={24} weight="bold" />
                    </button>
                </div>

                <!-- Top Action Buttons: Sidebar toggle, Info, Rating -->
                <div class="top-actions-list">
                    <!-- Sidebar (Seasons & Relations) Toggle -->
                    <IconButton
                        Icon={TreeStructureIcon}
                        variant="standard"
                        shape="circle"
                        size="standard"
                        active={isSeasonsSidebarOpen.current}
                        onclick={() =>
                            isSeasonsSidebarOpen.set(!isSeasonsSidebarOpen.current)}
                        title="Seasons & Relations"
                        ariaLabel="Seasons & Relations"
                    />

                    <!-- Info (Anime Description) Toggle -->
                    <IconButton
                        Icon={InfoIcon}
                        variant="standard"
                        shape="circle"
                        size="standard"
                        active={isAnimeDescriptionOpen.current}
                        disabled={!selectedAnimeDetails.current?.description}
                        onclick={() =>
                            isAnimeDescriptionOpen.set(!isAnimeDescriptionOpen.current)}
                        title="Anime description"
                        ariaLabel="Anime description"
                    />

                    <!-- Vertical Connected Rating Control (just below right sidebar and info buttons) -->
                    <div class="vertical-rating" role="radiogroup" aria-label="Season rating">
                        <button
                            type="button"
                            role="radio"
                            aria-checked={ratingManager.currentRating === "LIKE"}
                            class="rating-btn rating-like"
                            class:active={ratingManager.currentRating === "LIKE"}
                            disabled={ratingManager.isUpdating}
                            onclick={() => ratingManager.setRating("LIKE")}
                            title="Thumbs up"
                            aria-label="Thumbs up"
                        >
                            <ThumbsUpIcon
                                size={18}
                                weight={ratingManager.currentRating === "LIKE" ? "fill" : "regular"}
                            />
                        </button>
                        <div class="rating-separator"></div>
                        <button
                            type="button"
                            role="radio"
                            aria-checked={ratingManager.currentRating === "NEUTRAL"}
                            class="rating-btn rating-neutral"
                            class:active={ratingManager.currentRating === "NEUTRAL"}
                            disabled={ratingManager.isUpdating}
                            onclick={() => ratingManager.setRating("NEUTRAL")}
                            title="No rating"
                            aria-label="No rating"
                        >
                            <MinusIcon size={18} weight="bold" />
                        </button>
                        <div class="rating-separator"></div>
                        <button
                            type="button"
                            role="radio"
                            aria-checked={ratingManager.currentRating === "DISLIKE"}
                            class="rating-btn rating-dislike"
                            class:active={ratingManager.currentRating === "DISLIKE"}
                            disabled={ratingManager.isUpdating}
                            onclick={() => ratingManager.setRating("DISLIKE")}
                            title="Thumbs down"
                            aria-label="Thumbs down"
                        >
                            <ThumbsDownIcon
                                size={18}
                                weight={ratingManager.currentRating === "DISLIKE" ? "fill" : "regular"}
                            />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Bottom Group: Bookmark, Mark all as played, Offline indicator, Profile Avatar -->
            <div class="bottom-media-group">
                <div class="bottom-actions-list">
                    <!-- Bookmark Toggle -->
                    <IconButton
                        Icon={BookmarkIcon}
                        variant="standard"
                        shape="circle"
                        size="standard"
                        active={bookmarkManager.isBookmarked}
                        loading={bookmarkManager.isToggling}
                        disabled={!bookmarkManager.canToggle}
                        weight={bookmarkManager.isBookmarked ? "fill" : "regular"}
                        onclick={() => bookmarkManager.toggle()}
                        title={bookmarkManager.isBookmarked ? "Remove bookmark" : "Bookmark anime"}
                        ariaLabel={bookmarkManager.isBookmarked ? "Remove bookmark" : "Bookmark anime"}
                    />

                    <!-- Mark all as played toggle -->
                    <IconButton
                        Icon={watchAllManager.allReleasedWatched ? CheckIcon : EyeIcon}
                        variant="standard"
                        shape="circle"
                        size="standard"
                        active={watchAllManager.allReleasedWatched}
                        loading={watchAllManager.isUpdating}
                        disabled={!watchAllManager.canToggle}
                        onclick={() => watchAllManager.toggleAll()}
                        title={watchAllManager.allReleasedWatched ? "Mark all as unplayed" : "Mark all as played"}
                        ariaLabel={watchAllManager.allReleasedWatched ? "Mark all as unplayed" : "Mark all as played"}
                    />
                </div>

                <!-- Trailing Section: Offline indicator + User Profile Avatar -->
                <div class="rail-trailing">
                    {#if !networkState.isOnline}
                        <div class="rail-offline-indicator" title="Offline Mode: only downloaded anime are available">
                            <CloudSlashIcon size={18} weight="bold" />
                            <span class="offline-pill-text">Offline</span>
                        </div>
                    {/if}

                    {#if profileData}
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
                    {/if}
                </div>
            </div>
        </div>
    {:else}
        <div class="rail-nav-pane">
            <!-- M3 Rail Top Action: Standard 56dp Search FAB (identical to desktop) -->
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

            <!-- Primary Destinations (identical to desktop) -->
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

            <!-- Trailing Section: Offline indicator + User Profile Avatar (identical to desktop) -->
            <div class="rail-trailing">
                {#if !networkState.isOnline}
                    <div class="rail-offline-indicator" title="Offline Mode: only downloaded anime are available">
                        <CloudSlashIcon size={18} weight="bold" />
                        <span class="offline-pill-text">Offline</span>
                    </div>
                {/if}

                {#if profileData}
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
                {/if}
            </div>
        </div>
    {/if}
</aside>

<style lang="scss">
    .foldable-side-rail {
        display: none;
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 80px;
        min-width: 80px;
        max-width: 80px;
        height: 100vh;
        height: 100dvh;
        background: #181512;
        border-left: 1px solid #2e2c29;
        z-index: 30;
        box-sizing: border-box;
        user-select: none;
        padding-top: calc(20px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
        padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
        padding-right: var(--safe-area-inset-right, env(safe-area-inset-right, 0px));
        padding-left: 0;
        flex-direction: column;
        align-items: center;
        flex-shrink: 0;
    }

    @media (max-width: 768px) {
        :global(main.foldable-crease-split) .foldable-side-rail {
            display: flex;
        }
    }

    .rail-media-pane,
    .rail-nav-pane {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        height: 100%;
    }

    .top-media-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        width: 100%;
    }

    .top-actions-list,
    .bottom-actions-list {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        width: 100%;
    }

    .bottom-media-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        width: 100%;
        margin-top: auto;
    }

    .rail-header {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        margin-bottom: 8px;

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

            &::after {
                content: "";
                position: absolute;
                inset: 0;
                border-radius: inherit;
                background: #2b2000;
                opacity: 0;
                pointer-events: none;
                transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1);
            }

            &:hover {
                box-shadow:
                    0 6px 10px 4px rgba(0, 0, 0, 0.28),
                    0 2px 3px rgba(0, 0, 0, 0.38);

                &::after {
                    opacity: 0.08;
                }
            }

            &:active {
                box-shadow:
                    0 4px 8px 3px rgba(0, 0, 0, 0.25),
                    0 1px 3px rgba(0, 0, 0, 0.35);

                &::after {
                    opacity: 0.12;
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

        .rail-back-btn {
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            height: 56px;
            border-radius: 16px;
            background: var(--m3-surface-container-high, #2c2825);
            border: 1px solid #3a3733;
            color: var(--m3-on-surface, #e7e1de);
            cursor: pointer;
            outline: none;
            transition:
                background 150ms ease,
                border-color 150ms ease,
                color 150ms ease,
                transform 150ms ease;

            &:hover {
                background: var(--m3-surface-container-highest, #383430);
                color: #ffffff;
            }

            &:active {
                transform: scale(0.94);
                background: rgba(255, 255, 255, 0.14);
            }

            &:focus-visible {
                outline: 2px solid #ffd52c;
                outline-offset: 3px;
            }
        }
    }

    .vertical-rating {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: hsl(20, 17.6%, 8.5%);
        border: 1px solid #2e2c29;
        border-radius: 12px;
        overflow: hidden;
        width: 44px;

        .rating-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 36px;
            padding: 0;
            background: transparent;
            border: none;
            color: #a8a29e;
            cursor: pointer;
            transition:
                background 0.15s ease,
                color 0.15s ease,
                transform 0.1s ease;

            &:active:not(:disabled) {
                transform: scale(0.92);
            }

            &:hover:not(:disabled) {
                background: hsl(20, 17.6%, 14%);
                color: #e8e4df;
            }

            &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            &.active {
                &.rating-like {
                    background: #ffd52c18;
                    color: #ffd52c;
                }

                &.rating-neutral {
                    background: hsl(20, 17.6%, 16%);
                    color: #e8e4df;
                }

                &.rating-dislike {
                    background: rgba(229, 115, 115, 0.16);
                    color: #e57373;
                }
            }
        }

        .rating-separator {
            width: 100%;
            height: 1px;
            background: #2e2c29;
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
                right: 64px;
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
                animation: popover-fade-right 0.15s cubic-bezier(0.2, 0, 0, 1);

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

    @keyframes popover-fade-right {
        from {
            opacity: 0;
            transform: translateX(8px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
</style>
