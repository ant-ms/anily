<script lang="ts">
    import type { IconComponentProps } from "phosphor-svelte";
    import type { Component, Snippet } from "svelte";

    let {
        children = undefined,
        Icon = undefined,
        iconSize = "1.25rem",
        onclick = undefined,
        style = "normal",
        active = false,
        disabled = false,
        loading = false,
        title = undefined,
        class: className = "",
    }: {
        children?: Snippet;
        Icon?: Component<IconComponentProps, {}, "">;
        iconSize?: string;
        style?: "normal" | "ghost";
        active?: boolean;
        onclick?: (e: MouseEvent) => void | Promise<void>;
        disabled?: boolean;
        loading?: boolean;
        title?: string;
        class?: string;
    } = $props();

    function handleClick(e: MouseEvent) {
        if (disabled || loading || !onclick) return;
        onclick(e);
    }
</script>

<button
    {title}
    onclick={handleClick}
    class={className}
    class:active
    disabled={disabled || loading}
    class:is-busy={loading}
    class:style-normal={style === "normal"}
    class:style-ghost={style === "ghost"}
>
    {#if loading}
        <span class="button-spinner"></span>
    {:else if Icon}
        <Icon size={iconSize} />
    {/if}
    {#if children}
        {@render children()}
    {/if}
</button>

<style lang="scss">
    button {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px;
        border-radius: 6px;
        transition:
            background 0.2s,
            border 0.2s;

        &.style-normal {
            background: hsl(20, 17.6%, 8.5%);
            border: 1px solid hsl(36, 5.7%, 20%);

            &:hover:not(:disabled) {
                cursor: pointer;
                background: hsl(20, 17.6%, 14%);
            }

            &:disabled:not(.is-busy) {
                opacity: 0.4;
                cursor: not-allowed;
            }

            &.active {
                background: #ffd52c14;
                border-color: #ffd52c;
                color: #ffd52c;
            }
        }

        &.style-ghost {
            background: transparent;
            border: none;

            &:hover:not(:disabled) {
                background: hsl(20, 17.6%, 14%);
            }

            &:disabled:not(.is-busy) {
                opacity: 0.4;
                cursor: not-allowed;
            }

            &.active {
                background: #ffd52c14;
                border-color: #ffd52c;
                color: #ffd52c;
            }
        }

        &.is-busy {
            opacity: 0.8;
            cursor: wait;
        }
    }

    .button-spinner {
        display: inline-block;
        width: 1.25rem;
        height: 1.25rem;
        border: 2px solid hsl(36, 5.7%, 30%);
        border-top-color: #ffd52c;
        border-radius: 50%;
        animation: btn-spin 0.6s linear infinite;
        box-sizing: border-box;
    }

    @keyframes btn-spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
