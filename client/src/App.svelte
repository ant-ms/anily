<script lang="ts">
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
        isMobileNavOpen,
        isSeasonsSidebarOpen,
    } from "./lib/context.svelte";
    import AnimeDetailsPage from "./pages/AnimeDetailsPage/AnimeDetailsPage.svelte";
    import ListIcon from "phosphor-svelte/lib/ListIcon";
    import TreeStructureIcon from "phosphor-svelte/lib/TreeStructureIcon";
    import CaretLeftIcon from "phosphor-svelte/lib/CaretLeftIcon";
    import { watch } from "runed";

    let profileData: ProfileData | undefined = $state(undefined);
    let activeTab: Tab | undefined = $state();

    $effect(() => {
        if (typeof window !== "undefined" && isSeasonsSidebarOpen.current === undefined) {
            isSeasonsSidebarOpen.set(window.innerWidth > 1024);
        }
    });

    watch(
        () => [selectedAnimeAnilistId.current, activeTab],
        () => {
            if (typeof window !== "undefined" && window.innerWidth <= 768) {
                isMobileNavOpen.set(false);
            }
        },
    );
</script>

{#if profileData}
    <main>
        <div class="sidebar-wrapper" class:open={isMobileNavOpen.current}>
            <Sidebar bind:activeTab {profileData} />
        </div>
        {#if isMobileNavOpen.current}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="mobile-backdrop"
                onclick={() => isMobileNavOpen.set(false)}
            ></div>
        {/if}

        <div id="content">
            <header class="mobile-topbar">
                <button
                    type="button"
                    class="topbar-btn"
                    onclick={() => isMobileNavOpen.set(!isMobileNavOpen.current)}
                    aria-label="Toggle navigation"
                >
                    <ListIcon size="1.25rem" />
                </button>

                <div class="topbar-title">
                    {#if selectedAnimeAnilistId.current}
                        <span>Anime Details</span>
                    {:else if activeTab?.id === "settings"}
                        <span>Settings</span>
                    {:else if activeTab?.id === "logs"}
                        <span>Import Logs</span>
                    {:else}
                        <span>Anily</span>
                    {/if}
                </div>

                <div class="topbar-actions">
                    {#if selectedAnimeAnilistId.current}
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
                        <button
                            type="button"
                            class="topbar-btn"
                            onclick={() => selectedAnimeAnilistId.set(undefined)}
                            title="Back"
                            aria-label="Back"
                        >
                            <CaretLeftIcon size="1.25rem" />
                        </button>
                    {/if}
                </div>
            </header>

            <div class="content-body">
                {#if activeTab?.id === "settings"}
                    <SettingsPage />
                {:else if activeTab?.id === "logs"}
                    <LogsPage />
                {:else if selectedAnimeAnilistId.current}
                    <AnimeDetailsPage />
                {:else}
                    <HomePage />
                {/if}
            </div>
        </div>
    </main>
{:else}
    <LoginPage bind:profileData />
{/if}

<style lang="scss">
    main {
        display: grid;
        grid-template-columns: auto 1fr;
        height: 100vh;
        height: 100dvh;
        width: 100vw;
        overflow: hidden;
        position: relative;
    }

    .sidebar-wrapper {
        height: 100%;
        display: contents;
    }

    #content {
        height: 100vh;
        height: 100dvh;
        min-width: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .content-body {
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
    }

    .mobile-topbar {
        display: none;
    }

    .mobile-backdrop {
        display: none;
    }

    @media (max-width: 768px) {
        main {
            display: block;
            width: 100vw;
            height: 100vh;
            height: 100dvh;
            position: relative;
        }

        .sidebar-wrapper {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            z-index: 50;
            transform: translateX(-100%);
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: none;

            &.open {
                transform: translateX(0);
                box-shadow: 4px 0 24px rgba(0, 0, 0, 0.7);
            }
        }

        .mobile-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(2px);
            z-index: 45;
        }

        .mobile-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 48px;
            padding: 0 10px;
            background: #1d1a17;
            border-bottom: 1px solid #2e2c29;
            flex-shrink: 0;
            z-index: 20;

            .topbar-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                border-radius: 6px;
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
                font-size: 15px;
                font-weight: 600;
                color: #eee;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                padding: 0 8px;
                flex: 1;
                text-align: center;
            }

            .topbar-actions {
                display: flex;
                align-items: center;
                gap: 6px;
            }
        }
    }
</style>
