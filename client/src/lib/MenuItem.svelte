<script lang="ts">
    import type { IconComponentProps } from "phosphor-svelte";
    import type { Component } from "svelte";

    let {
        label,
        Icon = undefined,
        variant = "default",
        active = false,
        hasIconPill = false,
        role = undefined,
        onclick = undefined,
    }: {
        label: string;
        Icon?: Component<IconComponentProps, {}, "">;
        variant?: "default" | "danger";
        active?: boolean;
        hasIconPill?: boolean;
        role?: string;
        onclick?: (e: MouseEvent) => void;
    } = $props();
</script>

<button
    type="button"
    {role}
    class="menu-item"
    class:variant-danger={variant === "danger"}
    class:has-icon-pill={hasIconPill}
    class:active
    {onclick}
>
    {#if Icon}
        {#if hasIconPill}
            <div class="item-icon-pill">
                <Icon size="1.3rem" />
            </div>
        {:else}
            <Icon size="1.2rem" class="item-icon-raw" />
        {/if}
    {/if}
    <span class="item-label">{label}</span>
</button>

<style lang="scss">
    .menu-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        background: transparent;
        border: none;
        color: #d0c8c0;
        cursor: pointer;
        font-size: 14px;
        text-align: left;
        box-sizing: border-box;
        transition:
            background 0.15s ease,
            color 0.15s ease;

        &.has-icon-pill {
            padding: 10px 12px;
            border-radius: 12px;
            gap: 14px;

            .item-icon-pill {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.04);
                color: #a09890;
                transition:
                    background 0.15s ease,
                    color 0.15s ease;
                flex-shrink: 0;
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

            &.variant-danger {
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

        &:not(.has-icon-pill) {
            &:hover {
                background: rgba(255, 255, 255, 0.08);
                color: #ffffff;
            }

            &.active {
                background: rgba(255, 213, 44, 0.14);
                color: #ffd52c;
                font-weight: 500;
            }

            &.variant-danger {
                color: #ff7b72;

                &:hover {
                    background: rgba(255, 123, 114, 0.12);
                    color: #ff948d;
                }
            }
        }
    }
</style>
