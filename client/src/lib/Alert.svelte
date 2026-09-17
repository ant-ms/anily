<script lang="ts">
    import WarningCircleIcon from "phosphor-svelte/lib/WarningCircleIcon";
    import XCircleIcon from "phosphor-svelte/lib/XCircleIcon";
    import InfoIcon from "phosphor-svelte/lib/InfoIcon";
    import CheckCircleIcon from "phosphor-svelte/lib/CheckCircleIcon";
    import CaretDownIcon from "phosphor-svelte/lib/CaretDownIcon";
    import CaretUpIcon from "phosphor-svelte/lib/CaretUpIcon";
    import type { Snippet } from "svelte";

    let {
        variant = "info",
        title = undefined,
        message = undefined,
        collapsible = false,
        isOpen = $bindable(false),
        children,
    }: {
        variant?: "warning" | "error" | "info" | "success";
        title?: string;
        message?: string;
        collapsible?: boolean;
        isOpen?: boolean;
        children?: Snippet;
    } = $props();

    function toggle() {
        if (collapsible) {
            isOpen = !isOpen;
        }
    }
</script>

<div
    class="alert-box"
    class:variant-warning={variant === "warning"}
    class:variant-error={variant === "error"}
    class:variant-info={variant === "info"}
    class:variant-success={variant === "success"}
    class:is-collapsible={collapsible}
>
    {#if collapsible}
        <button
            type="button"
            class="alert-header-btn"
            onclick={toggle}
        >
            <div class="header-content">
                {#if variant === "warning"}
                    <WarningCircleIcon weight="fill" size="1.1rem" class="alert-icon" />
                {:else if variant === "error"}
                    <XCircleIcon weight="fill" size="1.1rem" class="alert-icon" />
                {:else if variant === "success"}
                    <CheckCircleIcon weight="fill" size="1.1rem" class="alert-icon" />
                {:else}
                    <InfoIcon weight="fill" size="1.1rem" class="alert-icon" />
                {/if}
                {#if title}
                    <span class="alert-title">{title}</span>
                {/if}
            </div>
            <div class="header-chevron">
                {#if isOpen}
                    <CaretUpIcon size="0.9rem" />
                {:else}
                    <CaretDownIcon size="0.9rem" />
                {/if}
            </div>
        </button>

        {#if isOpen && children}
            <div class="alert-body">
                {@render children()}
            </div>
        {/if}
    {:else}
        <div class="alert-content">
            {#if variant === "warning"}
                <WarningCircleIcon weight="fill" size="1.1rem" class="alert-icon" />
            {:else if variant === "error"}
                <XCircleIcon weight="fill" size="1.1rem" class="alert-icon" />
            {:else if variant === "success"}
                <CheckCircleIcon weight="fill" size="1.1rem" class="alert-icon" />
            {:else}
                <InfoIcon weight="fill" size="1.1rem" class="alert-icon" />
            {/if}
            <div class="alert-text">
                {#if title}
                    <span class="alert-title">{title}</span>
                {/if}
                {#if message}
                    <span class="alert-message">{message}</span>
                {/if}
                {#if children}
                    {@render children()}
                {/if}
            </div>
        </div>
    {/if}
</div>

<style lang="scss">
    .alert-box {
        border-radius: 6px;
        overflow: hidden;
        font-size: 0.82rem;
        line-height: 1.4;
        box-sizing: border-box;

        .alert-header-btn {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 7px 12px;
            background: transparent;
            border: none;
            cursor: pointer;
            text-align: left;
            font-size: inherit;
            color: inherit;

            &:hover {
                background: rgba(255, 255, 255, 0.04);
            }

            .header-content {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
                min-width: 0;
            }

            .header-chevron {
                display: flex;
                align-items: center;
                flex-shrink: 0;
            }
        }

        .alert-content {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 8px 12px;

            .alert-text {
                display: flex;
                flex-direction: column;
                gap: 2px;
                flex: 1;
                min-width: 0;
            }
        }

        .alert-title {
            font-weight: 600;
        }

        .alert-body {
            padding: 6px 12px 10px 12px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        :global(.alert-icon) {
            flex-shrink: 0;
            margin-top: 1px;
        }

        /* Variants */
        &.variant-warning {
            background: rgba(255, 171, 0, 0.08);
            border: 1px solid rgba(255, 171, 0, 0.25);
            color: #ffab00;

            .alert-header-btn {
                color: #ffab00;
            }

            .alert-body {
                border-top-color: rgba(255, 171, 0, 0.15);
                color: #ded7ce;
            }
        }

        &.variant-error {
            background: hsl(0, 30%, 10%);
            border: 1px solid hsl(0, 45%, 25%);
            color: #e57373;

            .alert-header-btn {
                color: #e57373;
            }

            .alert-body {
                border-top-color: hsl(0, 45%, 20%);
                color: #ffcdd2;
            }
        }

        &.variant-info {
            background: hsl(200, 30%, 10%);
            border: 1px solid hsl(200, 45%, 22%);
            color: #64b5f6;

            .alert-header-btn {
                color: #64b5f6;
            }
        }

        &.variant-success {
            background: hsl(120, 25%, 10%);
            border: 1px solid hsl(120, 35%, 22%);
            color: #81c784;

            .alert-header-btn {
                color: #81c784;
            }
        }
    }
</style>
