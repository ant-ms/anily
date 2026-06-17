<script lang="ts">
    import MagnifyingGlassIcon from "phosphor-svelte/lib/MagnifyingGlassIcon";
</script>

<div id="searchbar">
    <MagnifyingGlassIcon />
    <input type="search" placeholder="Search anime..." />
</div>

<style lang="scss">
    #searchbar {
        display: flex;
        align-items: center;
        gap: 0.5rem;

        background: #1d1a17;
        border-radius: 0.5rem;
        padding: 0.75rem;
    }
</style>
