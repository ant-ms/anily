<script lang="ts">
    import type { IconComponentProps, IconWeight } from "phosphor-svelte";
    import type { Component } from "svelte";

    let {
        Icon,
        onclick = undefined,
        variant = "normal",
        shape = "rounded",
        size = "md",
        active = false,
        disabled = false,
        loading = false,
        title = undefined,
        ariaLabel = undefined,
        weight = undefined,
    }: {
        Icon: Component<IconComponentProps, {}, "">;
        onclick?: (e: MouseEvent) => any;
        variant?: "normal" | "ghost" | "danger" | "tonal" | "standard";
        shape?: "square" | "rounded" | "circle";
        size?: "sm" | "md" | "lg" | "standard" | "player";
        active?: boolean;
        disabled?: boolean;
        loading?: boolean;
        title?: string;
        ariaLabel?: string;
        weight?: IconWeight;
    } = $props();

    let internalLoading = $state(false);
    let isBusy = $derived(loading || internalLoading);

    async function handleClick(e: MouseEvent) {
        if (disabled || isBusy || !onclick) return;
        try {
            const result = onclick(e);
            if (result instanceof Promise) {
                internalLoading = true;
                await result;
            }
        } finally {
            internalLoading = false;
        }
    }

    const iconSizes = {
        sm: "1rem",
        md: "1.25rem",
        lg: "1.4rem",
        standard: "1.25rem",
        player: "1.5rem",
    };
</script>

<button
    type="button"
    {title}
    aria-label={ariaLabel || title}
    onclick={handleClick}
    disabled={disabled || isBusy}
    class="icon-button"
    class:variant-normal={variant === "normal"}
    class:variant-ghost={variant === "ghost"}
    class:variant-danger={variant === "danger"}
    class:variant-tonal={variant === "tonal"}
    class:variant-standard={variant === "standard"}
    class:shape-square={shape === "square"}
    class:shape-rounded={shape === "rounded"}
    class:shape-circle={shape === "circle"}
    class:size-sm={size === "sm"}
    class:size-md={size === "md"}
    class:size-lg={size === "lg"}
    class:size-standard={size === "standard"}
    class:size-player={size === "player"}
    class:active
    class:is-busy={isBusy}
>
    {#if isBusy}
        <span class="icon-spinner"></span>
    {:else}
        <Icon size={iconSizes[size]} {weight} />
    {/if}
</button>

<style lang="scss">
    .icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        cursor: pointer;
        color: #ddd;
        flex-shrink: 0;
        user-select: none;
        transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease,
            transform 0.15s ease;

        &:disabled:not(.is-busy) {
            opacity: 0.4;
            cursor: not-allowed;
        }

        &:focus-visible {
            outline: 2px solid var(--color-accent, #ffd52c);
            outline-offset: 2px;
        }

        &:active:not(:disabled):not(.is-busy) {
            transform: scale(0.92);
        }

        &.is-busy {
            opacity: 0.85;
            cursor: wait;
        }

        /* Sizes */
        &.size-sm {
            width: 28px;
            height: 28px;
        }

        &.size-md {
            width: 36px;
            height: 36px;
        }

        &.size-lg {
            width: 44px;
            height: 44px;
        }

        &.size-standard {
            width: 40px;
            height: 40px;
            min-width: 40px;
            min-height: 40px;
        }

        &.size-player {
            width: 48px;
            height: 48px;
            min-width: 48px;
            min-height: 48px;
        }

        /* Shapes */
        &.shape-square {
            border-radius: 0;
        }

        &.shape-rounded {
            border-radius: 8px;
        }

        &.shape-circle {
            border-radius: 50%;
        }

        /* Variants */
        &.variant-normal {
            background: hsl(20, 17.6%, 12%);
            border: 1px solid hsl(36, 5.7%, 20%);

            &:hover:not(:disabled) {
                background: hsl(20, 17.6%, 18%);
                color: #ffffff;
            }

            &.active {
                background: #ffd52c18;
                border-color: #ffd52c;
                color: #ffd52c;
            }
        }

        &.variant-tonal {
            background: var(--m3-surface-container-high, #2c2825);
            border: 1px solid transparent;
            color: var(--m3-on-surface, #e7e1de);

            &:hover:not(:disabled) {
                background: var(--m3-surface-container-highest, #383430);
                color: #ffffff;
            }

            &:active:not(:disabled) {
                background: rgba(255, 255, 255, 0.14);
            }

            &.active {
                background: rgba(255, 213, 44, 0.16);
                border-color: #ffd52c;
                color: #ffd52c;
            }
        }

        &.variant-standard {
            background: transparent;
            border: 1px solid transparent;
            color: var(--m3-on-surface-variant, #cdc4be);

            &:hover:not(:disabled) {
                background: var(--m3-state-hover, rgba(231, 225, 222, 0.08));
                color: var(--m3-on-surface, #e7e1de);
            }

            &:active:not(:disabled) {
                background: rgba(231, 225, 222, 0.14);
            }

            &.active {
                background: rgba(255, 213, 44, 0.12);
                color: #ffd52c;
            }
        }

        &.variant-ghost {
            background: transparent;
            border: 1px solid transparent;

            &:hover:not(:disabled) {
                background: rgba(255, 255, 255, 0.08);
                color: #ffffff;
            }

            &.active {
                background: #ffd52c18;
                border-color: #ffd52c;
                color: #ffd52c;
            }
        }

        &.variant-danger {
            background: transparent;
            border: 1px solid transparent;
            color: #ff7b72;

            &:hover:not(:disabled) {
                background: rgba(255, 123, 114, 0.12);
                color: #ff948d;
            }

            &.active {
                background: rgba(255, 123, 114, 0.2);
                border-color: #ff7b72;
                color: #ff948d;
            }
        }
    }

    .icon-spinner {
        display: inline-block;
        width: 1.1rem;
        height: 1.1rem;
        border: 2px solid hsl(36, 5.7%, 30%);
        border-top-color: #ffd52c;
        border-radius: 50%;
        animation: icon-btn-spin 0.6s linear infinite;
        box-sizing: border-box;
    }

    @keyframes icon-btn-spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
