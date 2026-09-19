<script lang="ts">
    import MagnifyingGlassIcon from "phosphor-svelte/lib/MagnifyingGlassIcon";
    import { apiBaseUrl, selectedAnimeAnilistId } from "../context.svelte";
    import { Debounced } from "runed";
    import TextInput from "../TextInput.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { snackbar } from "../snackbar.svelte";

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
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                searchResults = data;
            })
            .catch((err) => {
                console.error("Search failed:", err);
                snackbar.error("Search request failed");
            });
    });

    import { registerBackHandler } from "../navigation/backHandler";

    let autocompleteVisible = $state(false);

    $effect(() => {
        autocompleteVisible = searchResults.length > 0;
    });

    $effect(() => {
        if (autocompleteVisible) {
            return registerBackHandler(() => {
                if (autocompleteVisible) {
                    autocompleteVisible = false;
                    return true;
                }
                return false;
            });
        }
    });

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
    <TextInput
        type="search"
        placeholder="Search anime..."
        Icon={MagnifyingGlassIcon}
        size="lg"
        fullWidth
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
        <MenuItem
            label={result.titleEnglish || result.titleRomanji || result.titleNative}
            onclick={() => {
                autocompleteVisible = false;
                searchQuery = "";
                selectedAnimeAnilistId.set(result.anilistId);
            }}
        />
    {/each}
</div>

<style lang="scss">
    #searchbar {
        display: flex;
        width: 100%;
        max-width: 600px;
    }

    #search-autocomplete {
        position: absolute;
        background: #1d1a17;
        border: 1px solid #3a3733;
        border-radius: 8px;
        overflow: hidden;
        z-index: 50;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
        padding: 4px;
        display: none;
        flex-direction: column;
        gap: 2px;

        &.active {
            display: flex;
        }
    }
</style>
