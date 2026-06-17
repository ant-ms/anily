<script lang="ts">
    import Button from "../lib/Button.svelte";
    import SignInIcon from "phosphor-svelte/lib/SignInIcon";
    import { PersistedState } from "runed";
    import type LoginData from "../types/LoginData";

    let {
        profileData = $bindable(),
    }: {
        profileData?: LoginData;
    } = $props();

    const enteredUrl = new PersistedState("backendUrl", "https://");
    let entedUrlValid: boolean = $derived(URL.canParse(enteredUrl.current));

    let enteredUrlReachable: boolean = $state(false);
    $effect(() => {
        enteredUrlReachable = false;
        if (!entedUrlValid) return;

        fetch(`${enteredUrl.current}/info`)
            .then((response) => {
                if (response.status != 200) throw new Error();
                return response.json();
            })
            .then((content) => {
                if (content.project != "anily") throw new Error();
                enteredUrlReachable = true;
            })
            .catch(() => {});
    });

    let enteredUrlAuthenticated: boolean = $state(false);
    let needAuthentication: boolean = $state(false);
    $effect(() => {
        enteredUrlAuthenticated = false;
        if (!entedUrlValid) return;

        fetch(`${enteredUrl.current}/api/me`, {
            credentials: "include",
            redirect: "manual",
        })
            .then(async (response) => {
                if (response.type == "opaqueredirect") {
                    needAuthentication = true;
                    return;
                }

                if (response.status != 200) return;

                enteredUrlAuthenticated = true;
                const content = await response.json();
                profileData = {
                    apiBaseUrl: `${enteredUrl.current}/api`,
                    name: content.name.split(" ")[0],
                    pictureUrl: content.picture,
                };
            })
            .catch(() => {});
    });
</script>

<div id="login-page">
    <span class="title"> Welcome to Anily </span>
    <label for="backend-url"> Backend URL to connect to: </label>
    <div class="backend-url-wrapper">
        <input
            id="backend-url"
            type="url"
            placeholder="https://"
            bind:value={enteredUrl.current}
        />
        <Button
            Icon={SignInIcon}
            disabled={!needAuthentication}
            onclick={() => {
                window.location.href = `${enteredUrl.current}/api/login`;
            }}>Login</Button
        >
    </div>
    <div class="checkbox-list">
        <input type="checkbox" readonly checked={entedUrlValid} />
        <span>Valid URL</span>
        <input type="checkbox" readonly checked={enteredUrlReachable} />
        <span>Reachable</span>
        <input type="checkbox" readonly checked={enteredUrlAuthenticated} />
        <span>Authenticated</span>
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

        .checkbox-list {
            margin-top: 0.5rem;
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 0.25rem;
        }
    }
</style>
