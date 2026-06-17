<script lang="ts">
    import Button from "../lib/Button.svelte";
    import PlugsIcon from "phosphor-svelte/lib/PlugsIcon";
</script>

<div id="login-page">
    <span class="title"> Welcome to Anily </span>
    <label for="backend-url"> Backend URL to connect to: </label>
    <div class="backend-url-wrapper">
        <input id="backend-url" type="url" placeholder="https://" />
        <Button Icon={PlugsIcon}>Connect</Button>
    </div>
</div>

<style lang="scss">
    #login-page {
        display: flex;
        flex-direction: column;
        justify-content: center;
        margin-left: 10%;
        gap: 0.35rem;

        height: 100vh;

        .title {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }

        .backend-url-wrapper {
            display: flex;
            gap: 0.5rem;

            input {
                background: #1d1a17;
                border-radius: 6px;
                padding: 6px;
                width: 310px;
            }
        }
    }
</style>
