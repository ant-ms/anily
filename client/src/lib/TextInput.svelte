<script lang="ts">
    import type { IconComponentProps } from "phosphor-svelte";
    import type { Component } from "svelte";

    let {
        value = $bindable(""),
        type = "text",
        placeholder = "",
        Icon = undefined,
        id = undefined,
        disabled = false,
        size = "md",
        fullWidth = false,
        oninput = undefined,
        onkeydown = undefined,
    }: {
        value?: string;
        type?: string;
        placeholder?: string;
        Icon?: Component<IconComponentProps, {}, "">;
        id?: string;
        disabled?: boolean;
        size?: "sm" | "md" | "lg";
        fullWidth?: boolean;
        oninput?: (e: Event) => void;
        onkeydown?: (e: KeyboardEvent) => void;
    } = $props();
</script>

<div
    class="text-input-wrapper"
    class:has-icon={!!Icon}
    class:full-width={fullWidth}
    class:size-sm={size === "sm"}
    class:size-md={size === "md"}
    class:size-lg={size === "lg"}
    class:disabled
>
    {#if Icon}
        <div class="input-icon">
            <Icon size={size === "sm" ? "1rem" : size === "lg" ? "1.3rem" : "1.15rem"} />
        </div>
    {/if}
    <input
        {id}
        {type}
        {placeholder}
        {disabled}
        bind:value
        oninput={oninput}
        onkeydown={onkeydown}
    />
</div>

<style lang="scss">
    .text-input-wrapper {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        background: #1d1a17;
        border: 1px solid hsl(36, 5.7%, 20%);
        border-radius: 8px;
        color: #ffffff;
        box-sizing: border-box;
        transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;

        &:focus-within {
            border-color: #ffd52c;
            box-shadow: 0 0 0 1px #ffd52c33;
        }

        &.full-width {
            width: 100%;
        }

        &.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* Sizes */
        &.size-sm {
            padding: 4px 8px;
            font-size: 13px;
        }

        &.size-md {
            padding: 8px 12px;
            font-size: 14px;
        }

        &.size-lg {
            padding: 10px 14px;
            font-size: 15px;
        }

        .input-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #888;
            flex-shrink: 0;
        }

        input {
            flex: 1 1 0;
            min-width: 0;
            background: transparent;
            border: none;
            outline: none;
            color: #ffffff;
            font-size: inherit;
            padding: 0;

            &::placeholder {
                color: #777;
            }

            &:disabled {
                cursor: not-allowed;
            }
        }
    }
</style>
