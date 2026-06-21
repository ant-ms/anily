<script lang="ts">
    import type SidebarCardData from "../../types/sidebarCardData";
    import { selectedAnimeAnilistId } from "../context.svelte";

    let {
        data,
    }: {
        data: SidebarCardData;
    } = $props();

    let titles = $derived([
        ...(data.titleEnglish ? [data.titleEnglish] : []),
        ...(data.titleRomanji ? [data.titleRomanji] : []),
        ...(data.titleNative ? [data.titleNative] : []),
    ]);
</script>

<!-- svelte-ignore a11y_missing_attribute -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<a
    onclick={() => {
        if (selectedAnimeAnilistId.current !== data.anilistId) {
            selectedAnimeAnilistId.set(data.anilistId);
        } else {
            selectedAnimeAnilistId.set(undefined);
        }
    }}
    class="sidebar-card"
    class:active={selectedAnimeAnilistId.current === data.anilistId}
>
    <img src={data.thumbnailUrl} alt="" />
    <div class="right">
        <span>{titles[0]}</span>
        <span>{titles[1]}</span>
    </div>
</a>

<style lang="scss">
    .sidebar-card {
        display: flex;
        gap: 0.5rem;
        padding: 8px;

        transition:
            background 0.2s,
            border-left 0.2s;
        border-left: 3px solid transparent;

        img {
            width: 65px;
            height: 90px;
            object-fit: cover;
            border-radius: 5px;
        }

        .right {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 2px;

            span {
                font-size: 14px;
                &:nth-child(2) {
                    opacity: 0.6;
                }
            }
        }

        &:hover {
            background: hsl(36, 7%, 14%);
            border-left: 3px solid hsl(36, 7%, 14%);
        }

        &.active {
            background: #ffd52c14;
            border-left: 3px solid #ffd52c;
        }
    }
</style>
