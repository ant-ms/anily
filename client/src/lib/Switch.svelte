<script lang="ts">
    let {
        checked = $bindable(false),
        disabled = false,
        id = undefined,
        ariaLabel = undefined,
        onchange = undefined,
    }: {
        checked?: boolean;
        disabled?: boolean;
        id?: string;
        ariaLabel?: string;
        onchange?: (checked: boolean) => void;
    } = $props();

    function toggle() {
        if (disabled) return;
        checked = !checked;
        onchange?.(checked);
    }

    function onKeyDown(e: KeyboardEvent) {
        if (disabled) return;
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            toggle();
        }
    }
</script>

<button
    type="button"
    role="switch"
    {id}
    aria-checked={checked}
    aria-label={ariaLabel}
    {disabled}
    class="m3-switch"
    class:checked
    class:disabled
    onclick={toggle}
    onkeydown={onKeyDown}
>
    <span class="switch-track">
        <span class="switch-thumb"></span>
    </span>
</button>

<style lang="scss">
    .m3-switch {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        margin: 0;
        background: transparent;
        border: none;
        cursor: pointer;
        outline: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible .switch-track {
            outline: 2px solid #ffd52c;
            outline-offset: 2px;
        }

        &.disabled {
            opacity: 0.38;
            cursor: not-allowed;
        }

        .switch-track {
            position: relative;
            display: flex;
            align-items: center;
            width: 48px;
            height: 28px;
            border-radius: 14px;
            box-sizing: border-box;
            background: #25221e;
            border: 2px solid #5a544c;
            transition: background 0.2s cubic-bezier(0.2, 0, 0, 1),
                        border-color 0.2s cubic-bezier(0.2, 0, 0, 1);
        }

        .switch-thumb {
            position: absolute;
            left: 4px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #9c948a;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
            transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1),
                        width 0.2s cubic-bezier(0.2, 0, 0, 1),
                        height 0.2s cubic-bezier(0.2, 0, 0, 1),
                        background 0.2s cubic-bezier(0.2, 0, 0, 1),
                        left 0.2s cubic-bezier(0.2, 0, 0, 1);
        }

        &.checked {
            .switch-track {
                background: #ffd52c;
                border-color: #ffd52c;
            }

            .switch-thumb {
                left: 2px;
                transform: translateX(20px);
                width: 20px;
                height: 20px;
                background: #181512;
            }
        }

        &:hover:not(.disabled) {
            &:not(.checked) {
                .switch-track {
                    border-color: #797167;
                }
                .switch-thumb {
                    background: #b5ada3;
                }
            }
            &.checked {
                .switch-track {
                    background: #ffdb4d;
                    border-color: #ffdb4d;
                }
            }
        }
    }
</style>
