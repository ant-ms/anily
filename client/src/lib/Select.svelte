<script lang="ts">
    import CaretDownIcon from "phosphor-svelte/lib/CaretDownIcon";

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

    function handleChange(e: Event) {
        const target = e.target as HTMLSelectElement;
        value = target.value;
        onchange?.(target.value);
    }
</script>

<div
    class="select-wrapper"
    class:full-width={fullWidth}
    class:disabled
>
    <select
        {id}
        {disabled}
        bind:value
        onchange={handleChange}
    >
        {#each options as opt}
            <option value={opt.value}>{opt.label}</option>
        {/each}
    </select>
    <div class="caret-icon">
        <CaretDownIcon size="0.9rem" />
    </div>
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

        select {
            width: 100%;
            background: hsl(20, 17.6%, 8.5%);
            border: 1px solid hsl(36, 5.7%, 20%);
            color: #d8d0c8;
            border-radius: 6px;
            padding: 7px 32px 7px 10px;
            font-size: 13px;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            outline: none;
            box-sizing: border-box;
            transition:
                border-color 0.15s ease,
                background-color 0.15s ease;

            &:focus {
                border-color: #ffd52c;
                box-shadow: 0 0 0 1px #ffd52c33;
            }

            option {
                background: #1d1a17;
                color: #ffffff;
            }

            &:disabled {
                cursor: not-allowed;
            }
        }

        .caret-icon {
            position: absolute;
            right: 10px;
            pointer-events: none;
            color: #888;
            display: flex;
            align-items: center;
            justify-content: center;
        }
    }
</style>
