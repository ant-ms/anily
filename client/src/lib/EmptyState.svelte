<script lang="ts">
    import type { IconComponentProps } from "phosphor-svelte";
    import type { Component, Snippet } from "svelte";

    let {
        Icon = undefined,
        iconSize = "3rem",
        title = undefined,
        description = undefined,
        variant = "default",
        children,
    }: {
        Icon?: Component<IconComponentProps, {}, "">;
        iconSize?: string;
        title?: string;
        description?: string;
        variant?: "default" | "error";
        children?: Snippet;
    } = $props();
</script>

<div class="empty-state" class:variant-error={variant === "error"}>
    {#if Icon}
        <div class="empty-icon">
            <Icon size={iconSize} />
        </div>
    {/if}
    {#if title}
        <p class="empty-title">{title}</p>
    {/if}
    {#if description}
        <span class="empty-description">{description}</span>
    {/if}
    {#if children}
        {@render children()}
    {/if}
</div>

<style lang="scss">
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 36px 16px;
        text-align: center;
        color: hsl(36, 10%, 45%);
        user-select: none;
        width: 100%;
        box-sizing: border-box;

        .empty-icon {
            color: hsl(36, 10%, 38%);
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .empty-title {
            margin: 8px 0 4px 0;
            font-size: 16px;
            font-weight: 600;
            color: hsl(36, 10%, 65%);
        }

        .empty-description {
            margin: 0;
            font-size: 13px;
            color: hsl(36, 10%, 45%);
            max-width: 320px;
            line-height: 1.4;
        }

        &.variant-error {
            color: #e57373;

            .empty-icon {
                color: #e57373;
            }

            .empty-title {
                color: #e57373;
            }

            .empty-description {
                color: #ef9a9a;
            }
        }
    }
</style>
