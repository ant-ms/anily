<script lang="ts">
    import {
        getStoredPlayer,
        setStoredPlayer,
        getStoredLanguagePreference,
        setStoredLanguagePreference,
        type MediaPlayer,
        type StreamLanguagePreference,
    } from "../types/Media";
    import {
        getStoredFoldableCreaseSplit,
        setStoredFoldableCreaseSplit,
    } from "../lib/context.svelte";
    import Select from "../lib/Select.svelte";
    import Switch from "../lib/Switch.svelte";

    let player: MediaPlayer = $state(getStoredPlayer());
    let languagePreference: StreamLanguagePreference = $state(getStoredLanguagePreference());
    let foldableCreaseSplit: boolean = $state(getStoredFoldableCreaseSplit());

    function onPlayerChange() {
        setStoredPlayer(player);
    }

    function onLanguagePreferenceChange() {
        setStoredLanguagePreference(languagePreference);
    }

    function onFoldableCreaseSplitChange(enabled: boolean) {
        setStoredFoldableCreaseSplit(enabled);
    }

    const playerOptions = [
        { value: "builtin", label: "In-App Player (Default)" },
        { value: "iina", label: "IINA (macOS)" },
        { value: "mpv", label: "mpv (copy URL to terminal)" },
        { value: "vlc", label: "VLC" },
        { value: "copy", label: "Copy URL only" },
    ];

    const languageOptions = [
        { value: "sub", label: "SUB (Subtitled)" },
        { value: "dub", label: "DUB (Dubbed)" },
    ];
</script>

<div id="settings-page">
    <h2>Settings</h2>

    <section>
        <h3>Media Player</h3>
        <p>Choose how media URLs are opened when you click the open button on an episode.</p>
        <Select
            bind:value={player}
            options={playerOptions}
            onchange={onPlayerChange}
        />
    </section>

    <section>
        <h3>Preferred Audio / Subtitles</h3>
        <p>Choose your preference for SUB or DUB when automatically selecting an episode stream.</p>
        <Select
            bind:value={languagePreference}
            options={languageOptions}
            onchange={onLanguagePreferenceChange}
        />
    </section>

    <section>
        <div class="setting-row">
            <div class="setting-info">
                <h3>Foldable Crease Split</h3>
                <p>On medium devices (such as foldables), expand the navigation rail and sidebar combined to exactly 50% of the screen width so the split aligns with the fold crease.</p>
            </div>
            <Switch
                bind:checked={foldableCreaseSplit}
                onchange={onFoldableCreaseSplitChange}
                ariaLabel="Foldable Crease Split"
            />
        </div>
    </section>
</div>

<style lang="scss">
    #settings-page {
        padding: 2rem;
        max-width: 560px;
        display: flex;
        flex-direction: column;
        gap: 2rem;

        @media (max-width: 768px) {
            padding: 1.25rem 1rem;
            gap: 1.5rem;
        }

        h2 {
            font-size: 18px;
            font-weight: 600;
            color: #e8e0d6;
            margin: 0;
        }

        section {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;

            h3 {
                font-size: 14px;
                font-weight: 600;
                color: #d8d0c8;
                margin: 0;
            }

            p {
                font-size: 13px;
                color: #777;
                margin: 0;
                line-height: 1.5;
            }

            .setting-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1.5rem;

                .setting-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                    flex: 1;
                }
            }
        }
    }
</style>
