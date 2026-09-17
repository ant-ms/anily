<script lang="ts">
    import CheckCircleIcon from "phosphor-svelte/lib/CheckCircleIcon";
    import XCircleIcon from "phosphor-svelte/lib/XCircleIcon";
    import ClockIcon from "phosphor-svelte/lib/ClockIcon";

    let {
        status,
        label = undefined,
        showIcon = true,
        size = "md",
    }: {
        status: "COMPLETED" | "FAILED" | "RUNNING" | string;
        label?: string;
        showIcon?: boolean;
        size?: "sm" | "md";
    } = $props();

    const normalizedStatus = $derived(status.toUpperCase());
    const displayLabel = $derived(label || status);
</script>

<div
    class="status-indicator"
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
                size={size === "sm" ? "1rem" : "1.15rem"}
            />
        {:else if normalizedStatus === "FAILED"}
            <XCircleIcon
                class="status-icon failed"
                weight="fill"
                size={size === "sm" ? "1rem" : "1.15rem"}
            />
        {:else}
            <ClockIcon
                class="status-icon running"
                size={size === "sm" ? "1rem" : "1.15rem"}
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

        .status-label {
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        &.size-sm .status-label {
            font-size: 0.75rem;
        }

        &.size-md .status-label {
            font-size: 0.85rem;
        }

        /* Status Colors */
        &.status-completed {
            :global(.status-icon.completed) {
                color: #66bb6a;
            }
            .status-label {
                color: #66bb6a;
            }
        }

        &.status-failed {
            :global(.status-icon.failed) {
                color: #e57373;
            }
            .status-label {
                color: #e57373;
            }
        }

        &.status-running {
            :global(.status-icon.running) {
                color: #ffd52c;
                animation: status-spin 1.5s linear infinite;
            }
            .status-label {
                color: #ffd52c;
            }
        }
    }

    @keyframes status-spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
