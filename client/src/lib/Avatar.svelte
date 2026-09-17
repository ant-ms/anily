<script lang="ts">
    import UserIcon from "phosphor-svelte/lib/UserIcon";

    let {
        src = undefined,
        alt = "User Avatar",
        size = "md",
        shape = "circle",
        active = false,
        border = true,
        onclick = undefined,
        title = undefined,
    }: {
        src?: string | null;
        alt?: string;
        size?: "sm" | "md" | "lg";
        shape?: "circle" | "rounded";
        active?: boolean;
        border?: boolean;
        onclick?: (e: MouseEvent) => void;
        title?: string;
    } = $props();

    let imageError = $state(false);

    $effect(() => {
        // Reset image error if src changes
        if (src) {
            imageError = false;
        }
    });

    const isButton = $derived(typeof onclick === "function");
</script>

{#if isButton}
    <button
        type="button"
        class="avatar-wrapper is-button"
        class:size-sm={size === "sm"}
        class:size-md={size === "md"}
        class:size-lg={size === "lg"}
        class:shape-circle={shape === "circle"}
        class:shape-rounded={shape === "rounded"}
        class:has-border={border}
        class:active
        {onclick}
        {title}
        aria-label={alt}
    >
        {#if src && !imageError}
            <img
                {src}
                {alt}
                class="avatar-img"
                onerror={() => (imageError = true)}
            />
        {:else}
            <div class="avatar-fallback">
                <UserIcon size="60%" />
            </div>
        {/if}
    </button>
{:else}
    <div
        class="avatar-wrapper"
        class:size-sm={size === "sm"}
        class:size-md={size === "md"}
        class:size-lg={size === "lg"}
        class:shape-circle={shape === "circle"}
        class:shape-rounded={shape === "rounded"}
        class:has-border={border}
        class:active
        {title}
    >
        {#if src && !imageError}
            <img
                {src}
                {alt}
                class="avatar-img"
                onerror={() => (imageError = true)}
            />
        {:else}
            <div class="avatar-fallback">
                <UserIcon size="60%" />
            </div>
        {/if}
    </div>
{/if}

<style lang="scss">
    .avatar-wrapper {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        background: hsl(20, 17.6%, 12%);
        overflow: hidden;
        flex-shrink: 0;
        box-sizing: border-box;
        user-select: none;
        transition:
            border-color 0.2s ease,
            transform 0.2s ease;

        &.shape-circle {
            border-radius: 50%;

            .avatar-img,
            .avatar-fallback {
                border-radius: 50%;
            }
        }

        &.shape-rounded {
            border-radius: 8px;

            .avatar-img,
            .avatar-fallback {
                border-radius: 8px;
            }
        }

        /* Sizes */
        &.size-sm {
            width: 32px;
            height: 32px;
        }

        &.size-md {
            width: 40px;
            height: 40px;
        }

        &.size-lg {
            width: 44px;
            height: 44px;
        }

        /* Border */
        &.has-border {
            border: 2px solid rgba(255, 213, 44, 0.35);

            &.active {
                border-color: #ffd52c;
            }
        }

        &:not(.has-border) {
            border: 2px solid transparent;

            &.active {
                border-color: #ffd52c;
            }
        }

        &.is-button {
            cursor: pointer;
            outline: none;

            &:hover {
                border-color: #ffd52c;
                transform: scale(1.04);
            }

            &:focus-visible {
                outline: 2px solid #ffd52c;
                outline-offset: 2px;
            }
        }

        .avatar-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .avatar-fallback {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #a09890;
            background: hsl(20, 17.6%, 16%);
        }
    }
</style>
