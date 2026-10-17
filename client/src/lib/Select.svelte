<script lang="ts">
    import { tick } from "svelte";
    import { fade } from "svelte/transition";
    import CaretDownIcon from "phosphor-svelte/lib/CaretDownIcon";
    import CaretUpIcon from "phosphor-svelte/lib/CaretUpIcon";
    import CheckIcon from "phosphor-svelte/lib/CheckIcon";
    import { registerBackHandler } from "./navigation/backHandler";

    let {
        value = $bindable(),
        options,
        id = undefined,
        disabled = false,
        fullWidth = false,
        onchange = undefined,
    }: {
        value: any;
        options: Array<{ value: any; label: string }>;
        id?: string;
        disabled?: boolean;
        fullWidth?: boolean;
        onchange?: (value: any) => void;
    } = $props();

    let isOpen = $state(false);
    let wrapperEl = $state<HTMLDivElement>();
    let triggerEl = $state<HTMLButtonElement>();
    let menuEl = $state<HTMLDivElement>();

    const selectedLabel = $derived(
        options.find((opt) => opt.value === value)?.label ?? String(value ?? ""),
    );

    function toggleOpen(e: MouseEvent) {
        e.stopPropagation();
        if (disabled) return;
        isOpen = !isOpen;
    }

    function selectOption(nextVal: any) {
        if (disabled) return;
        value = nextVal;
        isOpen = false;
        onchange?.(nextVal);
    }

    function handleWindowClick(e: MouseEvent) {
        if (!isOpen) return;
        const target = e.target as Node;
        if (wrapperEl && !wrapperEl.contains(target)) {
            isOpen = false;
        }
    }

    $effect(() => {
        if (isOpen) {
            tick().then(() => {
                const selectedEl = menuEl?.querySelector<HTMLElement>(
                    ".select-option.selected, .select-option",
                );
                selectedEl?.focus({ preventScroll: true });
            });

            const unregister = registerBackHandler(() => {
                if (isOpen) {
                    isOpen = false;
                    return true;
                }
                return false;
            });

            return () => {
                unregister();
                if (triggerEl && triggerEl.isConnected) {
                    tick().then(() => triggerEl?.focus({ preventScroll: true }));
                }
            };
        }
    });
</script>

<svelte:window onclick={handleWindowClick} />

<div
    bind:this={wrapperEl}
    class="select-wrapper"
    class:full-width={fullWidth}
    class:disabled
    class:is-open={isOpen}
>
    <button
        bind:this={triggerEl}
        type="button"
        {id}
        {disabled}
        class="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onclick={toggleOpen}
    >
        <span class="select-label">{selectedLabel}</span>
        <span class="caret-icon">
            {#if isOpen}
                <CaretUpIcon size="0.9rem" />
            {:else}
                <CaretDownIcon size="0.9rem" />
            {/if}
        </span>
    </button>

    {#if isOpen}
        <div
            bind:this={menuEl}
            class="select-popover"
            role="listbox"
            tabindex="-1"
            transition:fade={{ duration: 110 }}
        >
            {#each options as opt}
                {@const isSelected = opt.value === value}
                <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    class="select-option"
                    class:selected={isSelected}
                    onclick={(e) => {
                        e.stopPropagation();
                        selectOption(opt.value);
                    }}
                >
                    <span class="opt-label">{opt.label}</span>
                    {#if isSelected}
                        <CheckIcon size="0.95rem" weight="bold" class="opt-check" />
                    {/if}
                </button>
            {/each}
        </div>
    {/if}
</div>

<style lang="scss">
    .select-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        width: fit-content;
        min-width: 180px;

        &.full-width {
            width: 100%;
        }

        &.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        &.is-open {
            z-index: 60;
        }

        .select-trigger {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            background: hsl(20, 17.6%, 8.5%);
            border: 1px solid hsl(36, 5.7%, 20%);
            color: #d8d0c8;
            border-radius: 6px;
            padding: 7px 10px;
            font-size: 13px;
            font-family: inherit;
            text-align: left;
            cursor: pointer;
            outline: none;
            box-sizing: border-box;
            transition:
                border-color 0.15s ease,
                background-color 0.15s ease,
                box-shadow 0.15s ease;

            &:hover:not(:disabled) {
                background: hsl(20, 17.6%, 12%);
                border-color: hsl(36, 5.7%, 28%);
            }

            &:focus-visible {
                border-color: #ffd52c;
                outline: 2px solid #ffd52c;
                outline-offset: 1px;
                box-shadow: 0 0 0 2px rgba(255, 213, 44, 0.2);
            }

            &:disabled {
                cursor: not-allowed;
            }

            .select-label {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                flex: 1;
            }

            .caret-icon {
                color: #888;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
        }

        .select-popover {
            position: absolute;
            top: calc(100% + 6px);
            right: 0;
            left: 0;
            min-width: 100%;
            z-index: 100;
            background: #231f1c;
            border: 1px solid #3a3733;
            border-radius: 8px;
            padding: 5px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);
            display: flex;
            flex-direction: column;
            gap: 2px;
            max-height: 260px;
            overflow-y: auto;
            box-sizing: border-box;

            .select-option {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                width: 100%;
                padding: 8px 10px;
                background: transparent;
                border: none;
                border-radius: 6px;
                color: #e8e4df;
                font-size: 13px;
                font-family: inherit;
                text-align: left;
                cursor: pointer;
                outline: none;
                transition: background 0.15s ease, color 0.15s ease;

                .opt-label {
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                :global(.opt-check) {
                    color: #ffd52c;
                    flex-shrink: 0;
                }

                &:hover {
                    background: rgba(255, 255, 255, 0.08);
                    color: #ffffff;
                }

                &:focus-visible {
                    background: rgba(255, 255, 255, 0.12);
                    outline: 2px solid #ffd52c;
                    outline-offset: -2px;
                }

                &.selected {
                    background: rgba(255, 213, 44, 0.14);
                    color: #ffd52c;
                    font-weight: 600;
                }
            }
        }
    }
</style>
