<script lang="ts">
    import type { Snippet } from "svelte";

    let {
        variant = "accent",
        size = "sm",
        children,
    }: {
        variant?: "accent" | "muted" | "subtle" | "danger" | "success";
        size?: "sm" | "md";
        children?: Snippet;
    } = $props();
</script>

<span
    class="badge"
    class:variant-accent={variant === "accent"}
    class:variant-muted={variant === "muted"}
    class:variant-subtle={variant === "subtle"}
    class:variant-danger={variant === "danger"}
    class:variant-success={variant === "success"}
    class:size-sm={size === "sm"}
    class:size-md={size === "md"}
>
    {#if children}
        {@render children()}
    {/if}
</span>

<style lang="scss">
    .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        border-radius: 9999px;
        line-height: 1;
        white-space: nowrap;
        user-select: none;
        flex-shrink: 0;

        &.size-sm {
            font-size: 11px;
            padding: 2px 7px;
        }

        &.size-md {
            font-size: 12px;
            padding: 3px 9px;
        }

        &.variant-accent {
            color: #ffd52c;
            background: rgba(255, 213, 44, 0.15);
        }

        &.variant-muted {
            color: #a09890;
            background: rgba(255, 255, 255, 0.06);
        }

        &.variant-subtle {
            color: #777;
            background: transparent;
        }

        &.variant-danger {
            color: #ff7b72;
            background: rgba(255, 123, 114, 0.15);
        }

        &.variant-success {
            color: #66bb6a;
            background: rgba(102, 187, 106, 0.15);
        }
    }
</style>
