<script lang="ts">
    import type { Tab } from "$lib/tab-switcher/tab-switcher-types";
    import { selectedAnimeAnilistId } from "../context.svelte";
    import HouseIcon from "phosphor-svelte/lib/HouseIcon";
    import NewspaperIcon from "phosphor-svelte/lib/NewspaperIcon";
    import HourglassIcon from "phosphor-svelte/lib/HourglassIcon";
    import CheckFatIcon from "phosphor-svelte/lib/CheckFatIcon";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";

    let {
        activeTab = $bindable(),
    }: {
        activeTab?: Tab;
    } = $props();

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

    function isTabActive(tab: Tab): boolean {
        if (!activeTab) {
            return !!tab.default;
        }
        return activeTab.id === tab.id;
    }

    function handleTabClick(tab: Tab) {
        activeTab = tab;
        selectedAnimeAnilistId.set(undefined);
    }
</script>

<nav class="m3-navigation-bar" aria-label="Bottom Navigation">
    <div class="bar-destinations" role="tablist">
        {#each destinations as dest}
            {@const active = isTabActive(dest)}
            <button
                type="button"
                role="tab"
                class="bar-destination"
                class:active
                aria-selected={active}
                aria-label={dest.name}
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
</nav>

<style lang="scss">
    .m3-navigation-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100vw;
        height: 80px;
        height: calc(80px + env(safe-area-inset-bottom, 0px));
        padding-bottom: env(safe-area-inset-bottom, 0px);
        background: #181512;
        border-top: 1px solid #2e2c29;
        box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.45);
        z-index: 40;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        user-select: none;

        .bar-destinations {
            display: flex;
            align-items: center;
            justify-content: space-around;
            width: 100%;
            height: 80px;
            max-width: 600px;
            margin: 0 auto;
        }

        /* Material 3 Bottom Navigation Bar Item */
        .bar-destination {
            flex: 1 1 0;
            min-width: 48px;
            max-width: 168px;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: none;
            cursor: pointer;
            outline: none;
            padding: 0 4px;
            color: hsl(36, 10%, 70%);
            transition: color 200ms cubic-bezier(0.2, 0, 0, 1);
            -webkit-tap-highlight-color: transparent;

            &:focus-visible .indicator-container {
                outline: 2px solid #ffd52c;
                outline-offset: 2px;
            }

            .indicator-container {
                position: relative;
                width: 64px;
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
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 100%;
                transition: font-weight 200ms cubic-bezier(0.2, 0, 0, 1),
                    color 200ms cubic-bezier(0.2, 0, 0, 1);
            }

            /* Inactive Hover / Touch feedback */
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
    }
</style>
