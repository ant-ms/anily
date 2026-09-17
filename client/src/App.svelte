<script lang="ts">
    import { onMount } from "svelte";
    import NavigationRail from "$lib/navigation/NavigationRail.svelte";
    import NavigationBar from "$lib/navigation/NavigationBar.svelte";
    import UserMenuModal from "$lib/navigation/UserMenuModal.svelte";
    import Sidebar from "$lib/sidebar/Sidebar.svelte";
    import IconButton from "$lib/IconButton.svelte";
    import Avatar from "$lib/Avatar.svelte";
    import Badge from "$lib/Badge.svelte";
    import EmptyState from "$lib/EmptyState.svelte";
    import Snackbar from "$lib/Snackbar.svelte";
    import { snackbar } from "$lib/snackbar.svelte";
    import "./app.scss";
    import type { Tab } from "$lib/tab-switcher/tab-switcher-types";
    import LoginPage from "./pages/LoginPage.svelte";
    import LogsPage from "./pages/LogsPage.svelte";
    import SettingsPage from "./pages/SettingsPage.svelte";
    import HomePage from "./pages/HomePage.svelte";
    import type ProfileData from "./types/ProfileData";
    import {
        apiBaseUrl,
        selectedAnimeAnilistId,
        isSeasonsSidebarOpen,
    } from "./lib/context.svelte";
    import AnimeDetailsPage from "./pages/AnimeDetailsPage/AnimeDetailsPage.svelte";
    import TreeStructureIcon from "phosphor-svelte/lib/TreeStructureIcon";
    import CaretLeftIcon from "phosphor-svelte/lib/CaretLeftIcon";
    import TelevisionIcon from "phosphor-svelte/lib/TelevisionIcon";
    import CloudSlashIcon from "phosphor-svelte/lib/CloudSlashIcon";
    import { networkState } from "./lib/network.svelte";

    const loadCachedProfile = (): ProfileData | undefined => {
        try {
            const raw = localStorage.getItem("anily:profile_data");
            return raw ? JSON.parse(raw) : undefined;
        } catch {
            return undefined;
        }
    };

    let profileData: ProfileData | undefined = $state(loadCachedProfile());

    $effect(() => {
        if (profileData) {
            try {
                localStorage.setItem("anily:profile_data", JSON.stringify(profileData));
            } catch {}
        }
    });

    if (typeof window !== "undefined") {
        try {
            const savedBackend = localStorage.getItem("backendUrl");
            if (savedBackend) {
                const cleaned = JSON.parse(savedBackend).trim().replace(/\/+$/, "");
                if (cleaned && URL.canParse(cleaned)) {
                    apiBaseUrl.set(new URL(cleaned));
                }
            }
        } catch {}
    }

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

    onMount(() => {
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const msg =
                event.reason instanceof Error
                    ? event.reason.message
                    : typeof event.reason === "string"
                      ? event.reason
                      : "";
            if (msg) {
                snackbar.error(msg);
            }
        };

        const handleError = (event: ErrorEvent) => {
            if (
                event.target instanceof HTMLElement &&
                event.target.tagName === "IMG"
            ) {
                return;
            }
            if (event.message && !event.message.includes("ResizeObserver")) {
                snackbar.error(event.message);
            }
        };

        window.addEventListener("unhandledrejection", handleUnhandledRejection);
        window.addEventListener("error", handleError);

        return () => {
            window.removeEventListener(
                "unhandledrejection",
                handleUnhandledRejection,
            );
            window.removeEventListener("error", handleError);
        };
    });
</script>

{#if profileData}
    <main>
        <!-- Single Unified Mobile Top App Bar for Phones (<= 768px) -->
        <header class="mobile-topbar">
            <div class="topbar-left">
                {#if selectedAnimeAnilistId.current !== undefined || activeTab?.id === "settings" || activeTab?.id === "logs"}
                    <IconButton
                        Icon={CaretLeftIcon}
                        onclick={handleBack}
                        title="Back"
                    />
                {/if}

                <div class="topbar-title-wrapper">
                    <h1 class="topbar-title">{currentTitle}</h1>
                    {#if selectedAnimeAnilistId.current === undefined && activeTab?.id !== "home" && activeTab?.id !== "settings" && activeTab?.id !== "logs" && sidebarAnimeCount > 0}
                        <Badge>{sidebarAnimeCount}</Badge>
                    {/if}
                </div>
            </div>

            <div class="topbar-actions">
                {#if !networkState.isOnline}
                    <div class="mobile-offline-badge" title="Offline Mode: only downloaded anime are available">
                        <CloudSlashIcon size={14} weight="bold" />
                        <span>Offline</span>
                    </div>
                {/if}
                {#if selectedAnimeAnilistId.current !== undefined}
                    <IconButton
                        Icon={TreeStructureIcon}
                        active={isSeasonsSidebarOpen.current}
                        onclick={() =>
                            isSeasonsSidebarOpen.set(!isSeasonsSidebarOpen.current)}
                        title="Seasons & Relations"
                    />
                {:else}
                    <Avatar
                        src={profileData.pictureUrl}
                        alt={profileData.name}
                        size="sm"
                        onclick={() => (isMobileUserMenuOpen = true)}
                        title={profileData.name}
                    />
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
                        <IconButton
                            Icon={CaretLeftIcon}
                            onclick={handleBack}
                            title="Back"
                        />
                        <h2 class="topbar-title">Anime Details</h2>
                    </div>
                    <div class="topbar-actions">
                        {#if !networkState.isOnline}
                            <div class="mobile-offline-badge" title="Offline Mode: only downloaded anime are available">
                                <CloudSlashIcon size={14} weight="bold" />
                                <span>Offline</span>
                            </div>
                        {/if}
                        <IconButton
                            Icon={TreeStructureIcon}
                            active={isSeasonsSidebarOpen.current}
                            onclick={() =>
                                isSeasonsSidebarOpen.set(!isSeasonsSidebarOpen.current)}
                            title="Seasons & Relations"
                        />
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
                    <EmptyState
                        Icon={TelevisionIcon}
                        iconSize="3.5rem"
                        title="Select an anime"
                        description="Choose an anime from the list to view episodes, progress, and details"
                    />
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

<Snackbar />

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
            box-sizing: content-box;
            height: 52px;
            padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
            padding-left: calc(16px + var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));
            padding-right: calc(16px + var(--safe-area-inset-right, env(safe-area-inset-right, 0px)));
            padding-bottom: 0;
            background: #1d1a17;
            border-bottom: 1px solid #2e2c29;
            flex-shrink: 0;
            z-index: 20;

            .topbar-left {
                display: flex;
                align-items: center;
                gap: 12px;
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

            .topbar-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-left: auto;

                .mobile-offline-badge {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 8px;
                    border-radius: 6px;
                    background: rgba(245, 158, 11, 0.15);
                    border: 1px solid rgba(245, 158, 11, 0.35);
                    color: #f59e0b;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
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
            box-sizing: content-box;
            height: 52px;
            padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
            padding-left: calc(16px + var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));
            padding-right: calc(16px + var(--safe-area-inset-right, env(safe-area-inset-right, 0px)));
            padding-bottom: 0;
            background: #1d1a17;
            border-bottom: 1px solid #2e2c29;
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

            .topbar-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-left: auto;
                flex-shrink: 0;

                .mobile-offline-badge {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 8px;
                    border-radius: 6px;
                    background: rgba(245, 158, 11, 0.15);
                    border: 1px solid rgba(245, 158, 11, 0.35);
                    color: #f59e0b;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
            }
        }

        .sidebar-container {
            flex: 1 1 0;
            min-height: 0;
            width: 100vw;
            padding-bottom: calc(80px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
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
            padding-bottom: calc(80px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
            box-sizing: border-box;

            &.mobile-hidden {
                display: none !important;
            }
        }
    }
</style>
