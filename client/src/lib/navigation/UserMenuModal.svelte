<script lang="ts">
    import type ProfileData from "../../types/ProfileData";
    import type { Tab } from "$lib/tab-switcher/tab-switcher-types";
    import { apiBaseUrl, selectedAnimeAnilistId } from "../context.svelte";
    import LogIcon from "phosphor-svelte/lib/LogIcon";
    import GearIcon from "phosphor-svelte/lib/GearIcon";
    import SignOutIcon from "phosphor-svelte/lib/SignOutIcon";
    import XIcon from "phosphor-svelte/lib/XIcon";

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
        if (typeof window !== "undefined") {
            window.location.href = `${apiBaseUrl.current}logout`;
        }
    }
</script>

{#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-backdrop" onclick={() => (isOpen = false)}>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
            class="modal-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="User Account and Settings"
            tabindex="-1"
            onclick={(e) => e.stopPropagation()}
        >
            <div class="sheet-handle"></div>

            <div class="user-header">
                <img
                    class="user-avatar"
                    src={profileData.pictureUrl}
                    alt={profileData.name}
                />
                <div class="user-info">
                    <span class="user-name">{profileData.name}</span>
                    <span class="user-badge">Signed in</span>
                </div>
                <button
                    type="button"
                    class="close-btn"
                    onclick={() => (isOpen = false)}
                    aria-label="Close menu"
                >
                    <XIcon size="1.25rem" />
                </button>
            </div>

            <div class="menu-divider"></div>

            <div class="menu-items">
                <button
                    type="button"
                    class="menu-item"
                    class:active={activeTab?.id === "settings"}
                    onclick={() => navigateTo({ id: "settings", name: "Settings" })}
                >
                    <div class="item-icon-pill">
                        <GearIcon size="1.35rem" />
                    </div>
                    <span class="item-label">Settings</span>
                </button>

                <button
                    type="button"
                    class="menu-item"
                    class:active={activeTab?.id === "logs"}
                    onclick={() => navigateTo({ id: "logs", name: "System Jobs" })}
                >
                    <div class="item-icon-pill">
                        <LogIcon size="1.35rem" />
                    </div>
                    <span class="item-label">System Jobs</span>
                </button>

                <button
                    type="button"
                    class="menu-item sign-out"
                    onclick={handleSignOut}
                >
                    <div class="item-icon-pill">
                        <SignOutIcon size="1.35rem" />
                    </div>
                    <span class="item-label">Sign Out</span>
                </button>
            </div>
        </div>
    </div>
{/if}

<style lang="scss">
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(4px);
        z-index: 100;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        animation: backdrop-fade-in 0.2s cubic-bezier(0.2, 0, 0, 1);
    }

    .modal-sheet {
        width: 100%;
        max-width: 440px;
        background: #1d1a17;
        border-top-left-radius: 24px;
        border-top-right-radius: 24px;
        border-top: 1px solid #3a3733;
        padding: 12px 16px;
        padding-bottom: max(24px, env(safe-area-inset-bottom, 24px));
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.7);
        animation: sheet-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .sheet-handle {
        width: 36px;
        height: 4px;
        border-radius: 2px;
        background: #4a4641;
        margin: 0 auto 4px auto;
    }

    .user-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 4px 0;

        .user-avatar {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #ffd52c40;
        }

        .user-info {
            display: flex;
            flex-direction: column;
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

            .user-badge {
                font-size: 12px;
                color: #a09890;
            }
        }

        .close-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            color: #888;
            cursor: pointer;
            transition: background 0.15s, color 0.15s;

            &:hover {
                background: rgba(255, 255, 255, 0.08);
                color: #ffffff;
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

    .menu-item {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 10px 12px;
        border-radius: 12px;
        color: #d0c8c0;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;

        .item-icon-pill {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.04);
            color: #a09890;
            transition: background 0.15s, color 0.15s;
        }

        .item-label {
            font-size: 15px;
            font-weight: 500;
        }

        &:hover {
            background: rgba(255, 255, 255, 0.06);
            color: #ffffff;

            .item-icon-pill {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
            }
        }

        &.active {
            background: rgba(255, 213, 44, 0.12);
            color: #ffd52c;

            .item-icon-pill {
                background: rgba(255, 213, 44, 0.22);
                color: #ffd52c;
            }
        }

        &.sign-out {
            color: #ff7b72;

            .item-icon-pill {
                color: #ff7b72;
            }

            &:hover {
                background: rgba(255, 123, 114, 0.12);
                color: #ff948d;

                .item-icon-pill {
                    background: rgba(255, 123, 114, 0.2);
                    color: #ff948d;
                }
            }
        }
    }

    @keyframes backdrop-fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes sheet-slide-up {
        from {
            transform: translateY(100%);
        }
        to {
            transform: translateY(0);
        }
    }
</style>
