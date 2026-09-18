<script lang="ts">
    import Tag from '../../lib/Tag.svelte';
    import { isHdService, type AvailableService } from '../../types/Media';
    import type EpisodeData from '../../types/Episode';

    let {
        episodeId,
        isChecking,
        services,
        selectedService,
        onSelect,
    }: {
        episodeId: number;
        isChecking: boolean;
        services: AvailableService[];
        selectedService?: AvailableService;
        onSelect: (service: AvailableService) => void;
    } = $props();

    const isSelected = (service: AvailableService): boolean =>
        selectedService?.providerId === service.providerId &&
        selectedService?.serverId === service.serverId &&
        selectedService?.language === service.language;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="services-dropdown" onclick={(e) => e.stopPropagation()}>
    <div class="dropdown-header">
        <span>Stream Provider</span>
    </div>

    {#if isChecking}
        <div class="dropdown-loading">Checking available services…</div>
    {:else if services.length === 0}
        <div class="dropdown-empty">No services found for this episode</div>
    {:else}
        <div class="services-list">
            {#each services as service}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <button
                    type="button"
                    class="service-item"
                    class:selected={isSelected(service)}
                    onclick={() => onSelect(service)}
                >
                    <div class="service-meta">
                        <span class="provider-name">{service.providerName}</span>
                        <span class="server-name">· {service.serverName}</span>
                    </div>
                    <div class="service-tags">
                        {#if isHdService(service)}
                            <Tag variant="hd">HD</Tag>
                        {/if}
                        <Tag variant={service.language === 'dub' ? 'dub' : 'sub'}>
                            {service.language.toUpperCase()}
                        </Tag>
                    </div>
                </button>
            {/each}
        </div>
    {/if}
</div>

<style lang="scss">
    .services-dropdown {
        position: absolute;
        right: 0;
        top: calc(100% + 6px);
        z-index: 100;
        min-width: 210px;
        background: hsl(20, 17.6%, 11%);
        border: 1px solid hsl(36, 5.7%, 22%);
        border-radius: 7px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
        padding: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;

        .dropdown-header {
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #857f78;
            border-bottom: 1px solid hsl(36, 5.7%, 18%);
            margin-bottom: 2px;
        }

        .dropdown-loading,
        .dropdown-empty {
            padding: 10px 8px;
            font-size: 12px;
            color: #999;
            text-align: center;
        }

        .dropdown-empty {
            color: #e57373;
        }

        .services-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
            max-height: 200px;
            overflow-y: auto;
        }

        .service-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 6px 8px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 5px;
            color: #e8e4df;
            font-size: 13px;
            cursor: pointer;
            text-align: left;
            transition: background 0.15s, border-color 0.15s;

            &:hover {
                background: hsl(20, 17.6%, 17%);
                border-color: hsl(36, 5.7%, 26%);
            }

            &.selected {
                background: hsl(44, 80%, 15%);
                border-color: #ffd52c55;
                color: #ffd52c;
            }

            .service-meta {
                display: flex;
                align-items: center;
                gap: 4px;
                overflow: hidden;

                .provider-name {
                    font-weight: 500;
                }

                .server-name {
                    font-size: 12px;
                    color: #999;
                }
            }

            .service-tags {
                display: flex;
                align-items: center;
                gap: 4px;
                flex-shrink: 0;
            }
        }
    }
</style>
