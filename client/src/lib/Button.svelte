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
        loading = false,
    }: {
        children?: Snippet;
        Icon?: Component<IconComponentProps, {}, "">;
        style?: "normal" | "ghost";
        active?: boolean;
        onclick?: () => void | Promise<void>;
        disabled?: boolean;
        loading?: boolean;
    } = $props();

    let internalLoading = $state(false);
    let isBusy = $derived(loading || internalLoading);

    async function handleClick(e: MouseEvent) {
        if (disabled || isBusy || !onclick) return;
        try {
            const result = onclick();
            if (result instanceof Promise) {
                internalLoading = true;
                await result;
            }
        } finally {
            internalLoading = false;
        }
    }
</script>

<button
    onclick={handleClick}
    class:active
    disabled={disabled || isBusy}
    class:is-busy={isBusy}
    class:style-normal={style === "normal"}
    class:style-ghost={style === "ghost"}
>
    {#if isBusy}
        <span class="button-spinner"></span>
    {:else if Icon}
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

        &.is-busy {
            opacity: 0.65;
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
