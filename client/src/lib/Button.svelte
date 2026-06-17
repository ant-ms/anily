<script lang="ts">
    import type { IconComponentProps } from "phosphor-svelte";
    import type { Component, Snippet } from "svelte";

    let {
        children = undefined,
        Icon = undefined,
        onclick = undefined,
        style = "normal",
        active = false,
    }: {
        children?: Snippet;
        Icon?: Component<IconComponentProps, {}, "">;
        style?: "normal" | "ghost";
        active?: boolean;
        onclick?: () => void;
    } = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="button" {onclick} class:active>
    {#if Icon}
        <Icon size="1.25rem" />
    {/if}
    {#if children}
        {@render children()}
    {/if}
</div>

<style lang="scss">
    .button {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px;
        border-radius: 6px;
        background: hsl(20, 17.6%, 8.5%);
        border: 1px solid hsl(36, 5.7%, 20%);
        transition:
            background 0.2s,
            border 0.2s;

        &:hover {
            cursor: pointer;
            background: hsl(20, 17.6%, 14%);
        }

        &.active {
            background: #ffd52c14;
            border-color: #ffd52c;
        }
    }
</style>
