<script lang="ts">
    import type { IconComponentProps } from "phosphor-svelte";
    import type { Component, Snippet } from "svelte";

    let {
        variant = "default",
        size = "sm",
        Icon = undefined,
        label = undefined,
        value = undefined,
        children,
    }: {
        variant?: "default" | "hd" | "sub" | "dub" | "accent" | "metric";
        size?: "xs" | "sm" | "md";
        Icon?: Component<IconComponentProps, {}, "">;
        label?: string;
        value?: string | number;
        children?: Snippet;
    } = $props();
</script>

<span
    class="tag"
    class:variant-default={variant === "default"}
    class:variant-hd={variant === "hd"}
    class:variant-sub={variant === "sub"}
    class:variant-dub={variant === "dub"}
    class:variant-accent={variant === "accent"}
    class:variant-metric={variant === "metric"}
    class:size-xs={size === "xs"}
    class:size-sm={size === "sm"}
    class:size-md={size === "md"}
>
    {#if variant === "metric"}
        {#if value !== undefined}
            <span class="metric-val">{value}</span>
        {/if}
        {#if label}
            <span class="metric-key">{label}</span>
        {/if}
    {:else}
        {#if Icon}
            <Icon size={size === "xs" ? "0.75rem" : "0.85rem"} />
        {/if}
        {#if label}
            <span>{label}</span>
        {/if}
        {#if children}
            {@render children()}
        {/if}
    {/if}
</span>

<style lang="scss">
    .tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        line-height: 1;
        white-space: nowrap;
        user-select: none;
        box-sizing: border-box;
        border-radius: 6px;
        font-weight: 500;

        &.size-xs {
            font-size: 9px;
            padding: 1px 4px;
            border-radius: 3px;
        }

        &.size-sm {
            font-size: 0.75rem;
            padding: 3px 8px;
        }

        &.size-md {
            font-size: 0.8rem;
            padding: 4px 10px;
        }

        &.variant-default {
            background: hsl(20, 17.6%, 13%);
            border: 1px solid hsl(36, 5.7%, 24%);
            color: #d0c8c0;
        }

        &.variant-hd {
            font-size: 9px;
            font-weight: 700;
            padding: 1px 4px;
            border-radius: 3px;
            background: hsl(44, 80%, 18%);
            color: #ffd52c;
            border: 1px solid #ffd52c55;
            letter-spacing: 0.03em;
        }

        &.variant-sub {
            font-size: 10px;
            font-weight: 700;
            padding: 2px 5px;
            border-radius: 4px;
            text-transform: uppercase;
            background: #1b3d54;
            color: #79c0ff;
        }

        &.variant-dub {
            font-size: 10px;
            font-weight: 700;
            padding: 2px 5px;
            border-radius: 4px;
            text-transform: uppercase;
            background: #3e2723;
            color: #ffb74d;
        }

        &.variant-accent {
            background: rgba(255, 213, 44, 0.12);
            border: 1px solid rgba(255, 213, 44, 0.35);
            color: #ffd52c;
            font-weight: 600;
        }

        &.variant-metric {
            background: hsl(20, 17.6%, 12%);
            border: 1px solid hsl(36, 5.7%, 20%);
            padding: 4px 10px;
            gap: 6px;
            font-size: 0.8rem;

            .metric-val {
                color: #ffd52c;
                font-weight: 600;
            }

            .metric-key {
                color: #a09890;
            }
        }
    }
</style>
