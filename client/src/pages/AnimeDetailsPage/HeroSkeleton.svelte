<script lang="ts">
    import Skeleton from "../../lib/Skeleton.svelte";
</script>

<div class="hero">
    <Skeleton width="262px" height="350px" />
    <div class="right">
        <Skeleton width="60%" height="28px" />
        <Skeleton width="45%" height="24px" />
        <Skeleton width="35%" height="20px" />
        <div class="description">
            {#each Array(8) as _}
                <Skeleton height="13px" />
            {/each}
            <Skeleton width="40%" height="13px" />
        </div>
    </div>
</div>

<style lang="scss">
    .hero {
        display: flex;
        gap: 1.25rem;
        margin: 2rem;

        .right {
            height: 350px;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;

            .description {
                display: flex;
                flex-direction: column;
                gap: 0.4rem;
                margin-top: 0.75rem;
            }
        }
    }
</style>
