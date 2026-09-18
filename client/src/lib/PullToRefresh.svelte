<script lang="ts">
    import type { Snippet } from "svelte";
    import ArrowsClockwiseIcon from "phosphor-svelte/lib/ArrowsClockwiseIcon";

    let {
        scrollContainer = undefined,
        onrefresh,
        disabled = false,
        threshold = 64,
        maxPull = 105,
        children = undefined,
    }: {
        scrollContainer?: HTMLElement;
        onrefresh: () => void | Promise<void>;
        disabled?: boolean;
        threshold?: number;
        maxPull?: number;
        children?: Snippet;
    } = $props();

    let rootElement: HTMLElement | undefined = $state();
    let isPulling = $state(false);
    let isRefreshing = $state(false);
    let pullDistance = $state(0);

    const RESTING_HEIGHT = 48;

    let startY = 0;
    let startX = 0;
    let canPull = false;

    function getTarget(): HTMLElement | undefined {
        return scrollContainer || rootElement?.parentElement || undefined;
    }

    function handleTouchStart(e: TouchEvent) {
        if (disabled || isRefreshing || e.touches.length !== 1) {
            canPull = false;
            return;
        }

        const target = getTarget();
        if (!target) return;

        // Only allow pulling if scrolled to the very top (allow small subpixel leeway)
        if (target.scrollTop <= 2) {
            canPull = true;
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
            isPulling = false;
        } else {
            canPull = false;
        }
    }

    function handleTouchMove(e: TouchEvent) {
        if (!canPull || isRefreshing || e.touches.length !== 1) return;

        const target = getTarget();
        if (!target) return;

        if (target.scrollTop > 2) {
            canPull = false;
            if (isPulling) {
                isPulling = false;
                pullDistance = 0;
            }
            return;
        }

        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        const deltaY = currentY - startY;
        const deltaX = currentX - startX;

        if (!isPulling) {
            // Dragging up or more horizontal than vertical -> ignore
            if (deltaY <= 0 || Math.abs(deltaX) > deltaY) {
                canPull = false;
                return;
            }
            // Require 6px downward pull to start gesture
            if (deltaY > 6) {
                isPulling = true;
            }
        }

        if (isPulling) {
            if (e.cancelable) {
                e.preventDefault();
            }
            const raw = deltaY - 6;
            // Damped elastic resistance curve
            const damped = Math.min(maxPull, raw * 0.45);
            pullDistance = Math.max(0, damped);
        }
    }

    async function handleTouchEnd() {
        if (!isPulling) {
            canPull = false;
            return;
        }

        canPull = false;
        isPulling = false;

        if (pullDistance >= threshold && !isRefreshing) {
            isRefreshing = true;
            pullDistance = RESTING_HEIGHT;
            const minWait = new Promise((resolve) => setTimeout(resolve, 400));
            try {
                const refreshPromise = onrefresh();
                if (refreshPromise instanceof Promise) {
                    await Promise.all([refreshPromise, minWait]);
                } else {
                    await minWait;
                }
            } catch (err) {
                console.error("Pull to refresh error:", err);
            } finally {
                isRefreshing = false;
                pullDistance = 0;
            }
        } else {
            pullDistance = 0;
        }
    }

    $effect(() => {
        if (disabled) {
            canPull = false;
            isPulling = false;
            pullDistance = 0;
        }
    });

    $effect(() => {
        const target = getTarget();
        if (!target) return;

        target.addEventListener("touchstart", handleTouchStart, { passive: true });
        target.addEventListener("touchmove", handleTouchMove, { passive: false });
        target.addEventListener("touchend", handleTouchEnd, { passive: true });
        target.addEventListener("touchcancel", handleTouchEnd, { passive: true });

        return () => {
            target.removeEventListener("touchstart", handleTouchStart);
            target.removeEventListener("touchmove", handleTouchMove);
            target.removeEventListener("touchend", handleTouchEnd);
            target.removeEventListener("touchcancel", handleTouchEnd);
        };
    });
</script>

<div class="pull-to-refresh" bind:this={rootElement}>
    <div
        class="pull-track"
        class:pulling={isPulling}
        class:refreshing={isRefreshing}
        style:height="{pullDistance}px"
        aria-hidden="true"
    >
        <div
            class="pull-indicator"
            class:ready={pullDistance >= threshold && !isRefreshing}
            class:refreshing={isRefreshing}
            style:transform="scale({Math.min(1, Math.max(0.5, pullDistance / threshold))}) rotate({isRefreshing ? 0 : (pullDistance / threshold) * 360}deg)"
            style:opacity="{Math.min(1, Math.max(0, (pullDistance - 8) / (threshold * 0.4)))}"
        >
            {#if isRefreshing}
                <span class="pull-spinner"></span>
            {:else}
                <ArrowsClockwiseIcon size={18} weight="bold" />
            {/if}
        </div>
    </div>

    <div class="pull-content">
        {#if children}
            {@render children()}
        {/if}
    </div>
</div>

<style lang="scss">
    .pull-to-refresh {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 100%;
        position: relative;
    }

    .pull-track {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        overflow: hidden;
        pointer-events: none;
        will-change: height;
        transition: height 0.25s cubic-bezier(0.2, 0, 0, 1);

        &.pulling {
            transition: none !important;
        }
    }

    .pull-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: hsl(20, 17.6%, 12%);
        border: 1px solid hsl(36, 5.7%, 24%);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        color: hsl(36, 5.7%, 65%);
        transition:
            border-color 0.15s ease,
            color 0.15s ease,
            background 0.15s ease,
            box-shadow 0.15s ease;

        &.ready {
            color: #ffd52c;
            border-color: #ffd52c;
            background: hsl(20, 17.6%, 16%);
            box-shadow: 0 4px 14px rgba(255, 213, 44, 0.25);
        }

        &.refreshing {
            color: #ffd52c;
            border-color: hsl(36, 5.7%, 24%);
            background: hsl(20, 17.6%, 12%);
        }
    }

    .pull-spinner {
        display: inline-block;
        width: 18px;
        height: 18px;
        border: 2px solid hsl(36, 5.7%, 30%);
        border-top-color: #ffd52c;
        border-radius: 50%;
        animation: pull-spin 0.6s linear infinite;
        box-sizing: border-box;
    }

    @keyframes pull-spin {
        to {
            transform: rotate(360deg);
        }
    }

    .pull-content {
        flex: 1 1 0px;
        display: flex;
        flex-direction: column;
        min-height: 0;
        width: 100%;
    }
</style>
