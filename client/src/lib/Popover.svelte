<script lang="ts">
    import { fade } from "svelte/transition";
    import type { Snippet } from "svelte";

    import { registerBackHandler } from "./navigation/backHandler";

    let {
        isOpen = $bindable(false),
        placement = "bottom-end",
        minWidth = "200px",
        maxWidth = undefined,
        ariaLabel = undefined,
        children,
    }: {
        isOpen?: boolean;
        placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
        minWidth?: string;
        maxWidth?: string;
        ariaLabel?: string;
        children?: Snippet;
    } = $props();

    $effect(() => {
        if (isOpen) {
            return registerBackHandler(() => {
                if (isOpen) {
                    isOpen = false;
                    return true;
                }
                return false;
            });
        }
    });

    let popoverRef: HTMLElement | undefined = $state();

    function handleWindowClick(e: MouseEvent) {
        if (!isOpen) return;
        const target = e.target as HTMLElement;
        if (popoverRef && !popoverRef.contains(target)) {
            isOpen = false;
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape" && isOpen) {
            isOpen = false;
        }
    }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleKeydown} />

{#if isOpen}
    <div
        bind:this={popoverRef}
        class="popover-menu"
        class:placement-bottom-start={placement === "bottom-start"}
        class:placement-bottom-end={placement === "bottom-end"}
        class:placement-top-start={placement === "top-start"}
        class:placement-top-end={placement === "top-end"}
        style:min-width={minWidth}
        style:max-width={maxWidth}
        role="dialog"
        aria-label={ariaLabel}
        transition:fade={{ duration: 120 }}
    >
        {#if children}
            {@render children()}
        {/if}
    </div>
{/if}

<style lang="scss">
    .popover-menu {
        position: absolute;
        z-index: 100;
        background: #231f1c;
        border: 1px solid #3a3733;
        border-radius: 10px;
        padding: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        gap: 4px;
        box-sizing: border-box;

        &.placement-bottom-end {
            top: calc(100% + 6px);
            right: 0;
        }

        &.placement-bottom-start {
            top: calc(100% + 6px);
            left: 0;
        }

        &.placement-top-end {
            bottom: calc(100% + 6px);
            right: 0;
        }

        &.placement-top-start {
            bottom: calc(100% + 6px);
            left: 0;
        }
    }
</style>
