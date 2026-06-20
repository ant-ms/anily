<script lang="ts">
    import MagnifyingGlassIcon from "phosphor-svelte/lib/MagnifyingGlassIcon";
    import { apiBaseUrl, selectedAnimeAnilistId } from "../context.svelte";
    import { Debounced } from "runed";

    type SearchResult = {
        titleEnglish: string;
        titleRomanji: string;
        titleNative: string;
        anilistId: number;
    };

    let searchQuery = $state("");

    const debouncedSearchQuery = new Debounced(() => searchQuery, 300);
    let searchResults: SearchResult[] = $state([]);

    $effect(() => {
        let query = debouncedSearchQuery.current;
        searchResults = [];

        if (query.trim() === "") {
            return;
        }

        if (!apiBaseUrl.current) {
            console.warn("[Searchbar] apiBaseUrl not set but tried to search");
            return;
        }

        const url = new URL(
            `/api/search?q=${encodeURIComponent(query)}`,
            apiBaseUrl.current,
        );

        fetch(url.toString(), { credentials: "include" })
            .then((res) => res.json())
            .then((data) => {
                searchResults = data;
            });
    });

    let autocompleteVisible = $state(false);

    $effect(() => {
        autocompleteVisible = searchResults.length > 0;
    });

    // TODO: Set autocomplete position
    let inputElement: HTMLElement | undefined;
    let autocompleteElement: HTMLElement | undefined;
    const autocompleteTopPadding = 8;
    $effect(() => {
        if (autocompleteElement && inputElement) {
            autocompleteElement.style.top = `${inputElement.getBoundingClientRect().bottom + autocompleteTopPadding}px`;
            autocompleteElement.style.left = `${inputElement.getBoundingClientRect().left}px`;
            autocompleteElement.style.width = `${inputElement.getBoundingClientRect().width}px`;
        }
    });
</script>

<div id="searchbar" bind:this={inputElement}>
    <MagnifyingGlassIcon />
    <input
        type="search"
        placeholder="Search anime..."
        bind:value={searchQuery}
        oninput={() => (autocompleteVisible = false)}
    />
</div>

<div
    id="search-autocomplete"
    class:active={autocompleteVisible}
    bind:this={autocompleteElement}
>
    {#each searchResults as result}
        <button
            onclick={() => {
                selectedAnimeAnilistId.set(result.anilistId);
            }}
        >
            {result.titleEnglish || result.titleRomanji || result.titleNative}
        </button>
    {/each}
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

    #search-autocomplete {
        position: absolute;
        background: #1d1a17;
        border-radius: 0.5rem;
        overflow: hidden;

        display: none;
        flex-direction: column;

        button {
            cursor: pointer;
            padding: 0.5rem;
            &:hover {
                background: #2a2622;
            }
        }

        &.active {
            display: flex;
        }
    }
</style>
