<script lang="ts">
    import type { Tab } from "./tab-switcher-types";

    let {
        tabs,
        activeTab = $bindable(),
    }: {
        tabs: Tab[];
        activeTab?: Tab;
    } = $props();
</script>

<div class="tab-switcher">
    {#each tabs as tab}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_missing_attribute -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <a
            onclick={() => (activeTab = tab)}
            class="tab"
            class:active={tab.id === activeTab?.id ||
                (tab.default && !activeTab)}
        >
            {#if tab.Icon}
                <tab.Icon size="1.25rem" />
            {/if}
            {#if tab.name}
                <span>{tab.name}</span>
            {/if}
        </a>
    {/each}
</div>

<style lang="scss">
    .tab-switcher {
        display: flex;

        .tab {
            display: flex;
            align-items: center;
            justify-content: center;

            span {
                font-size: 14px;
                color: #cccccc;
            }

            gap: 4px;
            padding: 10px;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            transition:
                background 0.2s,
                border-bottom 0.2s;

            &:hover {
                background: hsl(36, 7%, 14%);
                border-bottom: 3px solid hsl(36, 7%, 14%);
            }

            &.active {
                background: #ffd52c14;
                border-bottom: 3px solid #ffd52c;
            }
        }
    }
</style>
