<script lang="ts">
    import type { AnimeProgress } from "../../types/SidebarCardData";

    let {
        prog,
    }: {
        prog: AnimeProgress;
    } = $props();

    let percent = $derived(
        prog.total > 0 ? (prog.watched / prog.total) * 100 : 0,
    );
</script>

<svg
    class="donut"
    width="14"
    height="14"
    viewBox="0 0 24 24"
>
    <title>{prog.watched} / {prog.total}</title>
    <!-- Solid background for overlaying on images -->
    <circle cx="12" cy="12" r="10" fill="#1d1a17" />

    {#if prog.released === 0}
        <!-- Small grey dot for announced/future anime with no released episodes -->
        <circle cx="12" cy="12" r="3" fill="rgba(255, 255, 255, 0.25)" />
    {:else}
        <!-- Background track: increased opacity for better contrast -->
        <circle
            cx="12"
            cy="12"
            r="9"
            stroke="rgba(255, 255, 255, 0.25)"
            stroke-width="3"
            fill="none"
        />
        {#if prog.watched > 0}
            <!-- Progress track -->
            <circle
                cx="12"
                cy="12"
                r="9"
                stroke="#ffd52c"
                stroke-width="3"
                fill={prog.watched === prog.total && prog.total > 0 ? "#ffd52c" : "none"}
                stroke-dasharray="56.548"
                stroke-dashoffset={56.548 - (percent / 100) * 56.548}
                transform="rotate(-90 12 12)"
                stroke-linecap="round"
            />
        {/if}
    {/if}
</svg>

<style lang="scss">
    .donut {
        flex-shrink: 0;
    }
</style>
