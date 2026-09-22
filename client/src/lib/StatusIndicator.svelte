<script lang="ts">
    import CheckCircleIcon from "phosphor-svelte/lib/CheckCircleIcon";
    import XCircleIcon from "phosphor-svelte/lib/XCircleIcon";
    import ClockIcon from "phosphor-svelte/lib/ClockIcon";

    let {
        status,
        label = undefined,
        showIcon = true,
        size = "md",
        variant = "inline",
    }: {
        status: "COMPLETED" | "FAILED" | "RUNNING" | string;
        label?: string;
        showIcon?: boolean;
        size?: "sm" | "md";
        variant?: "chip" | "inline";
    } = $props();

    const STATUS_SENTENCE_NAMES: Record<string, string> = {
        COMPLETED: "Completed",
        FAILED: "Failed",
        RUNNING: "Running",
    };

    const normalizedStatus = $derived(status.toUpperCase());
    const displayLabel = $derived(label || STATUS_SENTENCE_NAMES[normalizedStatus] || status);
</script>

<div
    class="status-indicator"
    class:variant-inline={variant === "inline"}
    class:variant-chip={variant === "chip"}
    class:status-completed={normalizedStatus === "COMPLETED"}
    class:status-failed={normalizedStatus === "FAILED"}
    class:status-running={normalizedStatus === "RUNNING"}
    class:size-sm={size === "sm"}
    class:size-md={size === "md"}
>
    {#if showIcon}
        {#if normalizedStatus === "COMPLETED"}
            <CheckCircleIcon
                class="status-icon completed"
                weight="fill"
                size={size === "sm" ? "1rem" : "1.125rem"}
            />
        {:else if normalizedStatus === "FAILED"}
            <XCircleIcon
                class="status-icon failed"
                weight="fill"
                size={size === "sm" ? "1rem" : "1.125rem"}
            />
        {:else}
            <ClockIcon
                class="status-icon running"
                size={size === "sm" ? "1rem" : "1.125rem"}
            />
        {/if}
    {/if}
    <span class="status-label">{displayLabel}</span>
</div>

<style lang="scss">
    .status-indicator {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        line-height: 1;
        user-select: none;
        box-sizing: border-box;

        .status-label {
            font-weight: 600;
        }

        &.variant-inline {
            background: transparent;
            border: none;
            padding: 0;
            height: auto;
            min-height: 0;
            border-radius: 0;

            &.size-sm .status-label {
                font-size: 0.8125rem;
            }

            &.size-md .status-label {
                font-size: 0.875rem;
            }
        }

        &.variant-chip {
            border-radius: 8px;

            &.size-sm {
                padding: 0 8px;
                height: 26px;
                min-height: 26px;

                .status-label {
                    font-size: 0.75rem;
                }
            }

            &.size-md {
                padding: 0 12px;
                height: 32px;
                min-height: 32px;

                .status-label {
                    font-size: 0.8125rem;
                }
            }

            &.status-completed {
                background: rgba(102, 187, 106, 0.16);
                border: 1px solid rgba(102, 187, 106, 0.35);
            }

            &.status-failed {
                background: rgba(229, 115, 115, 0.16);
                border: 1px solid rgba(229, 115, 115, 0.35);
            }

            &.status-running {
                background: rgba(255, 213, 44, 0.14);
                border: 1px solid rgba(255, 213, 44, 0.35);
            }
        }

        /* High-contrast semantic colors (WCAG AA compliant) */
        &.status-completed {
            :global(.status-icon.completed) {
                color: #81c784;
            }
            .status-label {
                color: #81c784;
            }
        }

        &.status-failed {
            :global(.status-icon.failed) {
                color: #fca5a5;
            }
            .status-label {
                color: #fca5a5;
            }
        }

        &.status-running {
            :global(.status-icon.running) {
                color: #fde047;
                animation: status-spin 1.5s linear infinite;
            }
            .status-label {
                color: #fde047;
            }
        }
    }

    @keyframes status-spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
