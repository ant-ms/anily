<script lang="ts">
    import type { ChainNode } from "../../../types/AnimeGroupings";
    import AnimeCard from "./AnimeCard.svelte";

    let { root }: { root: ChainNode } = $props();
</script>

{#snippet treeNode(node: ChainNode)}
    <li>
        <AnimeCard {node} />
        {#if node.children.length > 0}
            <ul>
                {#each node.children as child}
                    {@render treeNode(child)}
                {/each}
            </ul>
        {/if}
    </li>
{/snippet}

<!-- A single chain rendered as a downward org-chart tree. -->
<ul class="tree-root">
    {@render treeNode(root)}
</ul>

<style lang="scss">
    .tree-root {
        --line: #45413a;

        flex: 0 0 auto;
        padding: 0;
    }

    ul {
        position: relative;
        display: flex;
        justify-content: center;
        padding: 20px 0 0;
        list-style: none;
    }

    li {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px 10px 0;
        list-style: none;
    }

    /* Connectors going up from each node to the horizontal bar. */
    li::before,
    li::after {
        content: "";
        position: absolute;
        top: 0;
        right: 50%;
        width: 50%;
        height: 20px;
        border-top: 2px solid var(--line);
    }

    li::after {
        right: auto;
        left: 50%;
        border-left: 2px solid var(--line);
    }

    li::before {
        border-right: 2px solid var(--line);
    }

    /* A lone child just needs a straight line, no horizontal bar. */
    li:only-child::before,
    li:only-child::after {
        display: none;
    }

    li:only-child {
        padding: 0;
    }

    /* Trim the outer halves of the horizontal bar at the ends. */
    li:first-child::before,
    li:last-child::after {
        border: 0 none;
    }

    li:last-child::before {
        border-right: 2px solid var(--line);
        border-radius: 0 6px 0 0;
    }

    li:first-child::after {
        border-radius: 6px 0 0 0;
    }

    /* Downward line from a parent node into its children's bar. */
    ul ul::before {
        content: "";
        position: absolute;
        top: 0;
        left: 50%;
        width: 0;
        height: 20px;
        border-left: 2px solid var(--line);
    }
</style>
