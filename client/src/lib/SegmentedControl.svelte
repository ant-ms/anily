<script lang="ts">
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
        variant?: "connected" | "pills";
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
            {#if item.Icon}
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

        &.variant-pills {
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 2px;

            .segment-item {
                background: hsl(20, 17.6%, 10%);
                border: 1px solid hsl(36, 5.7%, 20%);
                color: #a09890;
                font-size: 0.8rem;
                font-weight: 500;
                padding: 5px 12px;
                border-radius: 9999px;
                cursor: pointer;
                transition: all 0.15s ease;
                white-space: nowrap;
                display: inline-flex;
                align-items: center;
                gap: 6px;

                &:hover:not(:disabled) {
                    background: hsl(20, 17.6%, 14%);
                    color: #e8e4df;
                }

                &:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                &.active {
                    background: rgba(255, 213, 44, 0.12);
                    border-color: rgba(255, 213, 44, 0.4);
                    color: #ffd52c;
                    font-weight: 600;
                }
            }
        }
    }
</style>
