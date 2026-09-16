<script lang="ts">
    import Skeleton from "../../lib/Skeleton.svelte";
</script>

<div class="hero">
    <div class="thumb-skeleton">
        <Skeleton width="100%" height="100%" />
    </div>
    <div class="right">
        <Skeleton width="60%" height="24px" />
        <Skeleton width="45%" height="18px" />
        <Skeleton width="35%" height="14px" />
        <div class="description">
            {#each Array(4) as _}
                <Skeleton height="12px" />
            {/each}
            <Skeleton width="40%" height="12px" />
        </div>
    </div>
</div>

<style lang="scss">
    .hero {
        display: flex;
        gap: 1.25rem;
        margin: 1.25rem 1.5rem;
        flex-shrink: 0;

        .thumb-skeleton {
            height: clamp(170px, 22vh, 230px);
            aspect-ratio: 3/4;
            border-radius: 5px;
            overflow: hidden;
            flex-shrink: 0;
        }

        .right {
            height: clamp(170px, 22vh, 230px);
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            flex: 1;
            min-width: 0;

            .description {
                display: flex;
                flex-direction: column;
                gap: 0.4rem;
                margin-top: 0.5rem;
            }
        }

        @media (max-width: 1024px), (max-height: 850px) {
            margin: 0.85rem 1rem;
            gap: 1rem;

            .thumb-skeleton,
            .right {
                height: clamp(130px, 18vh, 170px);
            }
        }

        @media (max-width: 640px) {
            margin: 0.65rem 0.75rem;
            gap: 0.75rem;

            .thumb-skeleton,
            .right {
                height: 120px;
            }
        }
    }
</style>
