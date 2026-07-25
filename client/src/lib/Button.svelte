<script lang="ts">
    import type { IconComponentProps } from "phosphor-svelte";
    import type { Component, Snippet } from "svelte";

    let {
        children = undefined,
        Icon = undefined,
        onclick = undefined,
        style = "normal",
        active = false,
        disabled = false,
    }: {
        children?: Snippet;
        Icon?: Component<IconComponentProps, {}, "">;
        style?: "normal" | "ghost";
        active?: boolean;
        onclick?: () => void;
        disabled?: boolean;
    } = $props();
</script>

<button
    {onclick}
    class:active
    {disabled}
    class:style-normal={style === "normal"}
    class:style-ghost={style === "ghost"}
>
    {#if Icon}
        <Icon size="1.25rem" />
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

            &:disabled {
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

            &:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }

            &.active {
                background: #ffd52c14;
                border-color: #ffd52c;
                color: #ffd52c;
            }
        }
    }
</style>
