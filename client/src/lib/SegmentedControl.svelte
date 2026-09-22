<script lang="ts">
    import CheckIcon from "phosphor-svelte/lib/CheckIcon";
    import type { IconComponentProps } from "phosphor-svelte";
    import type { Component } from "svelte";

    export type SegmentOption<T = any> = {
        value: T;
        label?: string;
        Icon?: Component<IconComponentProps, {}, "">;
        iconWeight?: "regular" | "bold" | "fill";
        activeIconWeight?: "regular" | "bold" | "fill";
        title?: string;
        activeColor?: "accent" | "like" | "dislike" | "neutral";
    };

    let {
        items,
        value = $bindable(),
        variant = "connected",
        disabled = false,
        ariaLabel = undefined,
        onchange = undefined,
    }: {
        items: SegmentOption[];
        value: any;
        variant?: "connected" | "pills" | "chips";
        disabled?: boolean;
        ariaLabel?: string;
        onchange?: (value: any) => void;
    } = $props();

    function select(val: any) {
        if (disabled) return;
        value = val;
        onchange?.(val);
    }
</script>

<div
    class="segmented-control"
    class:variant-connected={variant === "connected"}
    class:variant-pills={variant === "pills"}
    class:variant-chips={variant === "chips"}
    role="radiogroup"
    aria-label={ariaLabel}
>
    {#each items as item}
        {@const isSelected = value === item.value}
        {@const color = item.activeColor ?? "accent"}
        <button
            type="button"
            role="radio"
            aria-checked={isSelected}
            title={item.title || item.label}
            aria-label={item.title || item.label}
            class="segment-item"
            class:active={isSelected}
            class:active-like={isSelected && color === "like"}
            class:active-dislike={isSelected && color === "dislike"}
            class:active-neutral={isSelected && color === "neutral"}
            class:active-accent={isSelected && color === "accent"}
            {disabled}
            onclick={() => select(item.value)}
        >
            {#if isSelected && (variant === "pills" || variant === "chips")}
                <CheckIcon size="1rem" weight="bold" class="chip-check-icon" />
            {:else if item.Icon}
                <item.Icon
                    size="1.15rem"
                    weight={isSelected && item.activeIconWeight ? item.activeIconWeight : (item.iconWeight || "regular")}
                />
            {/if}
            {#if item.label}
                <span class="segment-label">{item.label}</span>
            {/if}
        </button>
    {/each}
</div>

<style lang="scss">
    .segmented-control {
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;

        &.variant-connected {
            background: hsl(20, 17.6%, 8.5%);
            border: 1px solid hsl(36, 5.7%, 20%);
            border-radius: 6px;
            overflow: hidden;

            .segment-item {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                padding: 6px 10px;
                background: transparent;
                border: none;
                border-right: 1px solid hsl(36, 5.7%, 20%);
                color: #a8a29e;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition:
                    background 0.15s ease,
                    color 0.15s ease,
                    border-color 0.15s ease;
                white-space: nowrap;
                user-select: none;
                line-height: 1;

                @media (max-width: 640px) {
                    padding: 6px 8px;
                }

                &:last-child {
                    border-right: none;
                }

                &:hover:not(:disabled) {
                    background: hsl(20, 17.6%, 14%);
                    color: #e8e4df;
                }

                &:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                &.active-accent,
                &.active-like {
                    background: #ffd52c18;
                    color: #ffd52c;
                    font-weight: 600;
                }

                &.active-dislike {
                    background: rgba(229, 115, 115, 0.16);
                    color: #e57373;
                    font-weight: 600;
                }

                &.active-neutral {
                    background: hsl(20, 17.6%, 16%);
                    color: #e8e4df;
                    font-weight: 600;
                }
            }
        }

        &.variant-pills,
        &.variant-chips {
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 2px;
            align-items: center;
            border: none;
            scrollbar-width: none;
            -ms-overflow-style: none;

            &::-webkit-scrollbar {
                display: none;
            }

            .segment-item {
                background: transparent;
                border: 1px solid var(--m3-outline-variant, #4b4541);
                color: var(--m3-on-surface-variant, #cdc4be);
                font-size: 0.8125rem;
                font-weight: 500;
                padding: 0 16px;
                height: 32px;
                min-height: 32px;
                box-sizing: border-box;
                border-radius: 8px;
                cursor: pointer;
                transition:
                    background 0.15s ease,
                    border-color 0.15s ease,
                    color 0.15s ease;
                white-space: nowrap;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                user-select: none;

                &:hover:not(:disabled) {
                    background: var(--m3-state-hover, rgba(231, 225, 222, 0.08));
                    color: var(--m3-on-surface, #e7e1de);
                }

                &:disabled {
                    opacity: 0.38;
                    cursor: not-allowed;
                }

                &.active {
                    background: var(--m3-secondary-container, #5c4728);
                    border: 1px solid transparent;
                    color: var(--m3-on-secondary-container, #ffe082);
                    font-weight: 600;
                    padding-left: 10px;

                    :global(.chip-check-icon) {
                        color: var(--m3-on-secondary-container, #ffe082);
                        flex-shrink: 0;
                    }

                    &:hover:not(:disabled) {
                        background: #6a5330;
                        color: #ffffff;
                    }
                }
            }
        }
    }
</style>
