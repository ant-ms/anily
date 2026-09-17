<script lang="ts">
    import type { Tab } from "$lib/tab-switcher/tab-switcher-types";

    let {
        dest,
        active = false,
        mode = "rail",
        onclick = undefined,
    }: {
        dest: Tab;
        active?: boolean;
        mode?: "rail" | "bar";
        onclick?: () => void;
    } = $props();
</script>

<button
    type="button"
    role="tab"
    class="m3-destination"
    class:mode-rail={mode === "rail"}
    class:mode-bar={mode === "bar"}
    class:active
    aria-selected={active}
    aria-label={dest.name}
    title={dest.name}
    {onclick}
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

<style lang="scss">
    .m3-destination {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        cursor: pointer;
        outline: none;
        color: hsl(36, 10%, 70%);
        transition: color 200ms cubic-bezier(0.2, 0, 0, 1);
        -webkit-tap-highlight-color: transparent;
        user-select: none;

        &.mode-rail {
            width: 80px;
            min-height: 56px;
            padding: 0;

            .indicator-container {
                width: 56px;
            }

            .destination-label {
                max-width: 76px;
            }
        }

        &.mode-bar {
            flex: 1 1 0;
            min-width: 48px;
            max-width: 168px;
            height: 100%;
            padding: 0 4px;

            .indicator-container {
                width: 64px;
            }

            .destination-label {
                max-width: 100%;
            }
        }

        &:focus-visible .indicator-container {
            outline: 2px solid #ffd52c;
            outline-offset: 2px;
        }

        .indicator-container {
            position: relative;
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
                transition:
                    transform 200ms cubic-bezier(0.2, 0, 0, 1),
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
                transition:
                    color 200ms cubic-bezier(0.2, 0, 0, 1),
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
            transition:
                font-weight 200ms cubic-bezier(0.2, 0, 0, 1),
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

            &:hover .indicator-container .active-indicator {
                background: rgba(255, 213, 44, 0.28);
            }
        }
    }
</style>
