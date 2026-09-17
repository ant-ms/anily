<script lang="ts">
    import type { IconComponentProps } from "phosphor-svelte";
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
    }: {
        Icon: Component<IconComponentProps, {}, "">;
        onclick?: (e: MouseEvent) => any;
        variant?: "normal" | "ghost" | "danger";
        shape?: "square" | "rounded" | "circle";
        size?: "sm" | "md" | "lg";
        active?: boolean;
        disabled?: boolean;
        loading?: boolean;
        title?: string;
        ariaLabel?: string;
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
    class:shape-square={shape === "square"}
    class:shape-rounded={shape === "rounded"}
    class:shape-circle={shape === "circle"}
    class:size-sm={size === "sm"}
    class:size-md={size === "md"}
    class:size-lg={size === "lg"}
    class:active
    class:is-busy={isBusy}
>
    {#if isBusy}
        <span class="icon-spinner"></span>
    {:else}
        <Icon size={iconSizes[size]} />
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

        &:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        &.is-busy {
            opacity: 0.65;
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
