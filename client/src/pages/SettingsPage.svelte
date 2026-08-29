<script lang="ts">
    import { getStoredPlayer, setStoredPlayer, type MediaPlayer } from "../types/Media";

    let player: MediaPlayer = $state(getStoredPlayer());

    function onPlayerChange() {
        setStoredPlayer(player);
    }
</script>

<div id="settings-page">
    <h2>Settings</h2>

    <section>
        <h3>Media Player</h3>
        <p>Choose how media URLs are opened when you click the open button on an episode.</p>
        <select bind:value={player} onchange={onPlayerChange}>
            <option value="iina">IINA (macOS)</option>
            <option value="mpv">mpv (copy URL to terminal)</option>
            <option value="vlc">VLC</option>
            <option value="copy">Copy URL only</option>
        </select>
    </section>
</div>

<style lang="scss">
    #settings-page {
        padding: 2rem;
        max-width: 560px;
        display: flex;
        flex-direction: column;
        gap: 2rem;

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

            select {
                margin-top: 0.25rem;
                background: hsl(20, 17.6%, 8.5%);
                border: 1px solid hsl(36, 5.7%, 20%);
                color: #d8d0c8;
                border-radius: 6px;
                padding: 6px 10px;
                font-size: 13px;
                cursor: pointer;
                width: fit-content;
                min-width: 200px;
                appearance: auto;

                &:focus {
                    outline: none;
                    border-color: #ffd52c55;
                }

                option {
                    background: #1d1a17;
                }
            }
        }
    }
</style>
