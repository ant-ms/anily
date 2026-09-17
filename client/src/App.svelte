<script lang="ts">
    import NavigationRail from "$lib/navigation/NavigationRail.svelte";
    import NavigationBar from "$lib/navigation/NavigationBar.svelte";
    import UserMenuModal from "$lib/navigation/UserMenuModal.svelte";
    import Sidebar from "$lib/sidebar/Sidebar.svelte";
    import "./app.scss";
    import type { Tab } from "$lib/tab-switcher/tab-switcher-types";
    import LoginPage from "./pages/LoginPage.svelte";
    import LogsPage from "./pages/LogsPage.svelte";
    import SettingsPage from "./pages/SettingsPage.svelte";
    import HomePage from "./pages/HomePage.svelte";
    import type ProfileData from "./types/ProfileData";
    import {
        selectedAnimeAnilistId,
        isSeasonsSidebarOpen,
    } from "./lib/context.svelte";
    import AnimeDetailsPage from "./pages/AnimeDetailsPage/AnimeDetailsPage.svelte";
    import TreeStructureIcon from "phosphor-svelte/lib/TreeStructureIcon";
    import CaretLeftIcon from "phosphor-svelte/lib/CaretLeftIcon";
    import TelevisionIcon from "phosphor-svelte/lib/TelevisionIcon";

    let profileData: ProfileData | undefined = $state(undefined);
    let activeTab: Tab | undefined = $state({
        id: "home",
        name: "Home",
        default: true,
    });
    let previousAnimeTab: Tab | undefined = $state({
        id: "home",
        name: "Home",
        default: true,
    });
    let isMobileUserMenuOpen = $state(false);

    let sidebarAnimeCount = $state(0);

    let currentTitle = $derived.by(() => {
        if (selectedAnimeAnilistId.current !== undefined) return "Anime Details";
        if (activeTab?.id === "settings") return "Settings";
        if (activeTab?.id === "logs") return "Import Logs";
        if (activeTab?.id === "home") return "Home";
        if (activeTab?.id === "waiting") return "Caught Up";
        if (activeTab?.id === "upcoming") return "Upcoming";
        if (activeTab?.id === "completed") return "Completed";
        if (!activeTab || activeTab.id === "inbox") return "Inbox";
        return activeTab.name || activeTab.id;
    });

    $effect(() => {
        if (typeof window !== "undefined" && isSeasonsSidebarOpen.current === undefined) {
            isSeasonsSidebarOpen.set(window.innerWidth > 1024);
        }
    });

    $effect(() => {
        if (activeTab && activeTab.id !== "settings" && activeTab.id !== "logs") {
            previousAnimeTab = activeTab;
        }
    });

    function handleBack() {
        if (selectedAnimeAnilistId.current !== undefined) {
            selectedAnimeAnilistId.set(undefined);
        } else if (activeTab?.id === "settings" || activeTab?.id === "logs") {
            activeTab = previousAnimeTab || {
                id: "home",
                name: "Home",
                default: true,
            };
        }
    }
</script>

{#if profileData}
    <main>
        <!-- Single Unified Mobile Top App Bar for Phones (<= 768px) -->
        <header class="mobile-topbar">
            <div class="topbar-left">
                {#if selectedAnimeAnilistId.current !== undefined || activeTab?.id === "settings" || activeTab?.id === "logs"}
                    <button
                        type="button"
                        class="topbar-btn back-btn"
                        onclick={handleBack}
                        title="Back"
                        aria-label="Back"
                    >
                        <CaretLeftIcon size="1.25rem" />
                    </button>
                {/if}

                <div class="topbar-title-wrapper">
                    <h1 class="topbar-title">{currentTitle}</h1>
                    {#if selectedAnimeAnilistId.current === undefined && activeTab?.id !== "home" && activeTab?.id !== "settings" && activeTab?.id !== "logs" && sidebarAnimeCount > 0}
                        <span class="count-badge">{sidebarAnimeCount}</span>
                    {/if}
                </div>
            </div>

            <div class="topbar-actions">
                {#if selectedAnimeAnilistId.current !== undefined}
                    <button
                        type="button"
                        class="topbar-btn"
                        class:active={isSeasonsSidebarOpen.current}
                        onclick={() =>
                            isSeasonsSidebarOpen.set(!isSeasonsSidebarOpen.current)}
                        title="Seasons & Relations"
                        aria-label="Toggle Seasons"
                    >
                        <TreeStructureIcon size="1.2rem" />
                    </button>
                {:else}
                    <button
                        type="button"
                        class="topbar-avatar-btn"
                        onclick={() => (isMobileUserMenuOpen = true)}
                        title={profileData.name}
                        aria-label="User Account"
                    >
                        <img
                            src={profileData.pictureUrl}
                            alt={profileData.name}
                            class="topbar-avatar-img"
                        />
                    </button>
                {/if}
            </div>
        </header>

        <!-- M3 Navigation Rail for Medium and Large viewports (>= 769px) -->
        <div class="rail-container">
            <NavigationRail bind:activeTab {profileData} />
        </div>

        <!-- Sidebar / List Pane -->
        <div
            class="sidebar-container"
            class:mobile-hidden={selectedAnimeAnilistId.current !== undefined || activeTab?.id === "settings" || activeTab?.id === "logs" || activeTab?.id === "home"}
            class:desktop-collapsed={activeTab?.id === "settings" || activeTab?.id === "logs" || activeTab?.id === "home"}
        >
            <Sidebar
                bind:activeTab
                {profileData}
                bind:animeCount={sidebarAnimeCount}
            />
        </div>

        <!-- Detail / Main Content Area -->
        <div
            id="content"
            class:mobile-hidden={selectedAnimeAnilistId.current === undefined && activeTab?.id !== "settings" && activeTab?.id !== "logs" && activeTab?.id !== "home"}
        >
            <!-- Tablet Topbar (769px - 1024px, shown only when an anime is selected) -->
            {#if selectedAnimeAnilistId.current !== undefined}
                <header class="tablet-topbar">
                    <div class="topbar-left">
                        <button
                            type="button"
                            class="topbar-btn back-btn"
                            onclick={handleBack}
                            title="Back"
                            aria-label="Back"
                        >
                            <CaretLeftIcon size="1.25rem" />
                        </button>
                        <h2 class="topbar-title">Anime Details</h2>
                    </div>
                    <div class="topbar-actions">
                        <button
                            type="button"
                            class="topbar-btn"
                            class:active={isSeasonsSidebarOpen.current}
                            onclick={() =>
                                isSeasonsSidebarOpen.set(!isSeasonsSidebarOpen.current)}
                            title="Seasons & Relations"
                            aria-label="Toggle Seasons"
                        >
                            <TreeStructureIcon size="1.2rem" />
                        </button>
                    </div>
                </header>
            {/if}

            <div class="content-body">
                {#if activeTab?.id === "settings"}
                    <SettingsPage />
                {:else if activeTab?.id === "logs"}
                    <LogsPage />
                {:else if activeTab?.id === "home"}
                    <HomePage />
                {:else if selectedAnimeAnilistId.current}
                    <AnimeDetailsPage />
                {:else}
                    <div class="no-anime-selected">
                        <TelevisionIcon size="3.5rem" />
                        <p class="placeholder-title">Select an anime</p>
                        <span class="placeholder-sub">Choose an anime from the list to view episodes, progress, and details</span>
                    </div>
                {/if}
            </div>
        </div>

        <!-- M3 Bottom Navigation Bar for Phones (<= 768px) -->
        <div class="bar-container">
            <NavigationBar bind:activeTab />
        </div>

        <!-- Mobile User Menu Modal -->
        <UserMenuModal
            {profileData}
            bind:activeTab
            bind:isOpen={isMobileUserMenuOpen}
        />
    </main>
{:else}
    <LoginPage bind:profileData />
{/if}

<style lang="scss">
    main {
        display: flex;
        flex-direction: row;
        height: 100vh;
        height: 100dvh;
        width: 100vw;
        overflow: hidden;
        position: relative;
    }

    .rail-container {
        display: block;
        flex-shrink: 0;
        width: 80px;
        height: 100%;
    }

    .sidebar-container {
        display: flex;
        flex-shrink: 0;
        height: 100%;
        width: 320px;
        transition: width 0.2s ease, opacity 0.2s ease;

        @media (max-width: 1024px) {
            width: 280px;
        }

        &.desktop-collapsed {
            display: none;
        }
    }

    #content {
        flex: 1 1 0;
        min-width: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .content-body {
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
    }

    .no-anime-selected {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-height: 300px;
        padding: 32px;
        text-align: center;
        color: hsl(36, 10%, 40%);
        user-select: none;

        .placeholder-title {
            margin: 16px 0 4px 0;
            font-size: 18px;
            font-weight: 600;
            color: hsl(36, 10%, 65%);
        }

        .placeholder-sub {
            margin: 0;
            font-size: 13px;
            color: hsl(36, 10%, 45%);
            max-width: 320px;
            line-height: 1.4;
        }
    }

    .bar-container {
        display: none;
    }

    .mobile-topbar {
        display: none;
    }

    .tablet-topbar {
        display: none;
    }

    /* Foldables and tablets (769px - 1024px): show topbar inside #content ONLY when an anime is selected */
    @media (min-width: 769px) and (max-width: 1024px) {
        .mobile-topbar {
            display: none !important;
        }

        .tablet-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 52px;
            padding: 0 16px;
            background: #1d1a17;
            border-bottom: 1px solid #2e2c29;
            box-sizing: border-box;
            flex-shrink: 0;
            z-index: 20;

            .topbar-left {
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 0;
            }

            .topbar-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                border-radius: 8px;
                background: hsl(20, 17.6%, 12%);
                border: 1px solid hsl(36, 5.7%, 20%);
                color: #ddd;
                cursor: pointer;
                transition: background 0.15s, color 0.15s;

                &:hover {
                    background: hsl(20, 17.6%, 18%);
                    color: #fff;
                }

                &.active {
                    background: #ffd52c18;
                    border-color: #ffd52c;
                    color: #ffd52c;
                }
            }

            .topbar-title {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #ffffff;
                letter-spacing: 0.15px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .topbar-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-left: auto;
            }
        }
    }

    /* Desktop (> 1024px) */
    @media (min-width: 1025px) {
        .mobile-topbar,
        .tablet-topbar {
            display: none !important;
        }
    }

    /* Phones (<= 768px): Bottom Navigation Bar, Hidden Navigation Rail */
    @media (max-width: 768px) {
        main {
            display: flex;
            flex-direction: column;
            width: 100vw;
            height: 100vh;
            height: 100dvh;
            position: relative;
        }

        .rail-container {
            display: none;
        }

        .bar-container {
            display: block;
            flex-shrink: 0;
        }

        .tablet-topbar {
            display: none !important;
        }

        .mobile-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 52px;
            padding: 0 16px;
            background: #1d1a17;
            border-bottom: 1px solid #2e2c29;
            box-sizing: border-box;
            flex-shrink: 0;
            z-index: 20;

            .topbar-left {
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 0;
                flex: 1;
            }

            .topbar-title-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
            }

            .topbar-title {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #ffffff;
                letter-spacing: 0.15px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .count-badge {
                font-size: 11px;
                font-weight: 600;
                color: #ffd52c;
                background: rgba(255, 213, 44, 0.15);
                padding: 2px 7px;
                border-radius: 12px;
            }

            .topbar-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                border-radius: 8px;
                background: hsl(20, 17.6%, 12%);
                border: 1px solid hsl(36, 5.7%, 20%);
                color: #ddd;
                cursor: pointer;
                transition: background 0.15s, color 0.15s;

                &:hover {
                    background: hsl(20, 17.6%, 18%);
                    color: #fff;
                }

                &.active {
                    background: #ffd52c18;
                    border-color: #ffd52c;
                    color: #ffd52c;
                }
            }

            .topbar-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-left: auto;
                flex-shrink: 0;
            }

            .topbar-avatar-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                padding: 0;
                border: 1.5px solid rgba(255, 213, 44, 0.4);
                background: transparent;
                cursor: pointer;
                overflow: hidden;
                transition: border-color 0.15s;

                &:hover {
                    border-color: #ffd52c;
                }

                .topbar-avatar-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }
            }
        }

        .sidebar-container {
            flex: 1 1 0;
            min-height: 0;
            width: 100vw;
            padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
            box-sizing: border-box;
            overflow-y: auto;

            &.mobile-hidden {
                display: none !important;
            }
        }

        #content {
            flex: 1 1 0;
            min-height: 0;
            width: 100vw;
            padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
            box-sizing: border-box;

            &.mobile-hidden {
                display: none !important;
            }
        }
    }
</style>
