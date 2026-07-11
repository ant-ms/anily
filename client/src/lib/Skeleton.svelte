<script lang="ts">
    let {
        width = "100%",
        height = "1rem",
        radius = "5px",
    }: {
        width?: string;
        height?: string;
        radius?: string;
    } = $props();
</script>

<div
    class="skeleton"
    style:width
    style:height
    style:border-radius={radius}
></div>

<style lang="scss">
    .skeleton {
        background: linear-gradient(
            90deg,
            #1d1a17 0%,
            #2e2c29 50%,
            #1d1a17 100%
        );
        background-size: 200% 100%;
        animation: shimmer 1.4s ease-in-out infinite;
    }

    @keyframes shimmer {
        0% {
            background-position: 200% 0;
        }
        100% {
            background-position: -200% 0;
        }
    }
</style>
