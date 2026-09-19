<script lang="ts">
    import type { Snippet } from "svelte";

    import { registerBackHandler } from "./navigation/backHandler";

    let {
        isOpen = $bindable(false),
        ariaLabel = "Dialog",
        showHandle = true,
        maxWidth = "440px",
        children,
    }: {
        isOpen: boolean;
        ariaLabel?: string;
        showHandle?: boolean;
        maxWidth?: string;
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

    function handleBackdropClick() {
        isOpen = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape" && isOpen) {
            isOpen = false;
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="bottom-sheet-backdrop" onclick={handleBackdropClick}>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
            class="bottom-sheet-content"
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            tabindex="-1"
            style:max-width={maxWidth}
            onclick={(e) => e.stopPropagation()}
        >
            {#if showHandle}
                <div class="sheet-handle"></div>
            {/if}

            {#if children}
                {@render children()}
            {/if}
        </div>
    </div>
{/if}

<style lang="scss">
    .bottom-sheet-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(4px);
        z-index: 100;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        animation: sheet-backdrop-fade-in 0.2s cubic-bezier(0.2, 0, 0, 1);
    }

    .bottom-sheet-content {
        width: 100%;
        background: #1d1a17;
        border-top-left-radius: 24px;
        border-top-right-radius: 24px;
        border-top: 1px solid #3a3733;
        padding: 12px 16px;
        padding-bottom: max(24px, env(safe-area-inset-bottom, 24px));
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.7);
        animation: sheet-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        box-sizing: border-box;
        max-height: 85vh;
        max-height: 85dvh;
    }

    .sheet-handle {
        width: 36px;
        height: 4px;
        border-radius: 2px;
        background: #4a4641;
        margin: 0 auto 4px auto;
        flex-shrink: 0;
    }

    @keyframes sheet-backdrop-fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes sheet-slide-up {
        from {
            transform: translateY(100%);
        }
        to {
            transform: translateY(0);
        }
    }
</style>
