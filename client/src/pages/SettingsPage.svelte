<script lang="ts">
    import { getStoredPlayer, setStoredPlayer, type MediaPlayer } from "../types/Media";
    import Select from "../lib/Select.svelte";

    let player: MediaPlayer = $state(getStoredPlayer());

    function onPlayerChange() {
        setStoredPlayer(player);
    }

    const playerOptions = [
        { value: "iina", label: "IINA (macOS)" },
        { value: "mpv", label: "mpv (copy URL to terminal)" },
        { value: "vlc", label: "VLC" },
        { value: "copy", label: "Copy URL only" },
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
        }
    }
</style>
