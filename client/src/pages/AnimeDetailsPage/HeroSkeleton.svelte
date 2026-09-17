<script lang="ts">
    import Skeleton from "../../lib/Skeleton.svelte";
</script>

<div class="hero">
    <div class="thumb-skeleton">
        <Skeleton width="100%" height="100%" />
    </div>
    <div class="right">
        <div class="header-row">
            <div class="titles">
                <Skeleton width="65%" height="26px" radius="4px" />
                <Skeleton width="45%" height="18px" radius="4px" />
                <Skeleton width="35%" height="14px" radius="4px" />
            </div>
            <Skeleton width="36px" height="36px" radius="8px" />
        </div>
    </div>
</div>

<style lang="scss">
    .hero {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        margin: 1.25rem 1.5rem;
        flex-shrink: 0;

        .thumb-skeleton {
            height: clamp(140px, 18vh, 180px);
            aspect-ratio: 3/4;
            border-radius: 6px;
            overflow: hidden;
            flex-shrink: 0;
        }

        .right {
            display: flex;
            flex-direction: column;
            justify-content: center;
            flex: 1;
            min-width: 0;

            .header-row {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 0.75rem;
                width: 100%;

                .titles {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    flex: 1;
                    min-width: 0;
                }
            }
        }

        @media (max-width: 1024px), (max-height: 850px) {
            margin: 0.85rem 1rem;
            gap: 1rem;

            .thumb-skeleton {
                height: clamp(120px, 15vh, 150px);
            }
        }

        @media (max-width: 640px) {
            margin: 0.65rem 0.75rem;
            gap: 0.75rem;

            .thumb-skeleton {
                height: 110px;
            }

            .right {
                .header-row {
                    gap: 0.5rem;

                    .titles {
                        gap: 4px;
                    }
                }
            }
        }
    }
</style>
