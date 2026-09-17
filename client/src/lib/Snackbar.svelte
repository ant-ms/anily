<script lang="ts">
    import { fly } from "svelte/transition";
    import { snackbar } from "./snackbar.svelte";
    import CheckCircleIcon from "phosphor-svelte/lib/CheckCircleIcon";
    import XCircleIcon from "phosphor-svelte/lib/XCircleIcon";
    import InfoIcon from "phosphor-svelte/lib/InfoIcon";
    import XIcon from "phosphor-svelte/lib/XIcon";

    const current = $derived(snackbar.current);

    function handleAction() {
        if (current?.onAction) {
            current.onAction();
        }
        snackbar.dismiss();
    }
</script>

{#if current}
    <div
        class="m3-snackbar-container"
        role={current.type === "error" ? "alert" : "status"}
        aria-live={current.type === "error" ? "assertive" : "polite"}
        transition:fly={{ y: 20, duration: 200 }}
    >
        <div
            class="m3-snackbar"
            class:error={current.type === "error"}
            class:success={current.type === "success"}
        >
            <div class="snackbar-icon">
                {#if current.type === "error"}
                    <XCircleIcon size="1.25rem" weight="fill" />
                {:else if current.type === "success"}
                    <CheckCircleIcon size="1.25rem" weight="fill" />
                {:else}
                    <InfoIcon size="1.25rem" weight="fill" />
                {/if}
            </div>
            <div class="snackbar-message">
                {current.message}
            </div>
            {#if current.actionLabel}
                <button type="button" class="snackbar-action" onclick={handleAction}>
                    {current.actionLabel}
                </button>
            {/if}
            <button
                type="button"
                class="snackbar-dismiss"
                onclick={() => snackbar.dismiss(current.id)}
                title="Dismiss"
                aria-label="Dismiss notification"
            >
                <XIcon size="0.95rem" />
            </button>
        </div>
    </div>
{/if}

<style lang="scss">
    .m3-snackbar-container {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        pointer-events: none;
        display: flex;
        justify-content: center;
        width: 100%;
        max-width: calc(100vw - 32px);

        @media (max-width: 768px) {
            bottom: calc(80px + 16px + env(safe-area-inset-bottom, 0px));
        }
    }

    .m3-snackbar {
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        gap: 12px;
        min-width: 288px;
        max-width: 560px;
        min-height: 48px;
        box-sizing: border-box;
        padding: 6px 8px 6px 16px;
        /* M3 shape.corner.extra-small = 4dp */
        border-radius: 4px;
        background: #2b2724;
        border: 1px solid hsl(36, 5.7%, 22%);
        /* M3 Elevation Level 3 */
        box-shadow:
            0 1px 3px 0 rgba(0, 0, 0, 0.3),
            0 4px 8px 3px rgba(0, 0, 0, 0.15);
        color: #f5f0eb;
        /* M3 body-medium */
        font-size: 14px;
        line-height: 20px;
        letter-spacing: 0.25px;

        &.error {
            border-color: rgba(239, 68, 68, 0.45);
            background: #2e1d1d;

            .snackbar-icon {
                color: #f87171;
            }
        }

        &.success {
            border-color: rgba(255, 213, 44, 0.35);

            .snackbar-icon {
                color: #ffd52c;
            }
        }

        &:not(.error):not(.success) {
            .snackbar-icon {
                color: #ffd52c;
            }
        }

        .snackbar-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .snackbar-message {
            flex: 1 1 auto;
            word-break: break-word;
            font-size: 14px;
            line-height: 20px;
            font-weight: 400;
            letter-spacing: 0.25px;
            padding: 8px 0;
        }

        .snackbar-action {
            background: transparent;
            border: none;
            color: #ffd52c;
            /* M3 label-large */
            font-weight: 500;
            font-size: 14px;
            line-height: 20px;
            letter-spacing: 0.1px;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            text-transform: uppercase;
            flex-shrink: 0;
            margin-left: -4px;

            &:hover {
                background: rgba(255, 213, 44, 0.12);
            }
        }

        .snackbar-dismiss {
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: none;
            color: #a8a29e;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            flex-shrink: 0;
            transition:
                color 0.15s,
                background 0.15s;

            &:hover {
                color: #f5f0eb;
                background: rgba(255, 255, 255, 0.08);
            }
        }
    }
</style>
