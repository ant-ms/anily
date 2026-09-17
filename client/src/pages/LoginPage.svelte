<script lang="ts">
    import { onMount } from "svelte";
    import Button from "../lib/Button.svelte";
    import TextInput from "../lib/TextInput.svelte";
    import SignInIcon from "phosphor-svelte/lib/SignInIcon";
    import { PersistedState } from "runed";
    import type ProfileData from "../types/ProfileData";
    import { apiBaseUrl } from "../lib/context.svelte";
    import { Browser } from "@capacitor/browser";
    import { App } from "@capacitor/app";
    import { Capacitor, CapacitorCookies } from "@capacitor/core";

    let {
        profileData: profileData = $bindable(),
    }: {
        profileData?: ProfileData;
    } = $props();

    const enteredUrl = new PersistedState("backendUrl", "https://");
    const cleanEnteredUrl: string = $derived(
        enteredUrl.current ? enteredUrl.current.trim().replace(/\/+$/, "") : ""
    );
    let entedUrlValid: boolean = $derived(
        Boolean(cleanEnteredUrl && URL.canParse(cleanEnteredUrl))
    );

    let enteredUrlReachable: boolean = $state(false);
    $effect(() => {
        enteredUrlReachable = false;
        if (!entedUrlValid) return;

        const targetUrl = `${cleanEnteredUrl}/info`;
        fetch(targetUrl)
            .then((response) => {
                if (response.status != 200) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((content) => {
                if (content.project != "anily") throw new Error("Not anily project");
                enteredUrlReachable = true;
            })
            .catch((err) => {
                console.error("Reachability check failed:", targetUrl, err);
            });
    });

    let enteredUrlAuthenticated: boolean = $state(false);
    let needAuthentication: boolean = $derived(
        enteredUrlReachable && !enteredUrlAuthenticated
    );
    let authCheckTrigger = $state(0);

    const checkAuth = () => {
        enteredUrlAuthenticated = false;
        if (!entedUrlValid) return;

        const targetUrl = `${cleanEnteredUrl}/api/me`;
        fetch(targetUrl, {
            credentials: "include",
            redirect: "manual",
        })
            .then(async (response) => {
                if (
                    response.type === "opaqueredirect" ||
                    response.status === 401 ||
                    response.status === 302 ||
                    response.status === 307
                ) {
                    enteredUrlAuthenticated = false;
                    return;
                }

                if (response.status !== 200) {
                    enteredUrlAuthenticated = false;
                    return;
                }

                const contentType = response.headers.get("content-type") || "";
                if (!contentType.includes("application/json")) {
                    console.log("Non-JSON response from /api/me (e.g. redirect to login page):", contentType);
                    enteredUrlAuthenticated = false;
                    return;
                }

                let content: any;
                try {
                    content = await response.json();
                } catch {
                    enteredUrlAuthenticated = false;
                    return;
                }

                if (!content || typeof content !== "object") {
                    enteredUrlAuthenticated = false;
                    return;
                }

                const displayName =
                    content.name ||
                    content.preferred_username ||
                    content.email ||
                    content.sub;

                if (!displayName) {
                    console.log("No valid user name or claims in /api/me payload:", content);
                    enteredUrlAuthenticated = false;
                    return;
                }

                apiBaseUrl.set(new URL(cleanEnteredUrl));
                profileData = {
                    name: typeof displayName === "string" ? displayName.split(" ")[0] : "User",
                    pictureUrl: content.picture || "",
                };
                enteredUrlAuthenticated = true;
            })
            .catch((err) => {
                console.error("Auth check failed:", targetUrl, err);
                enteredUrlAuthenticated = false;
            });
    };

    $effect(() => {
        // Track dependencies
        void entedUrlValid;
        void cleanEnteredUrl;
        void authCheckTrigger;
        checkAuth();
    });

    onMount(() => {
        let handlePromise: Promise<any> | undefined;

        if (Capacitor.isNativePlatform()) {
            handlePromise = App.addListener("appUrlOpen", async (data) => {
                console.log("App opened via deep link:", data.url);
                try {
                    await Browser.close();
                } catch {}

                if (data.url && (data.url.startsWith("ms.ant.anily://auth") || data.url.includes("://auth"))) {
                    try {
                        const parsed = new URL(data.url);
                        const session = parsed.searchParams.get("session");
                        if (session) {
                            localStorage.setItem("authToken", session);
                            try {
                                await CapacitorCookies.setCookie({
                                    url: cleanEnteredUrl,
                                    key: "oidc-auth",
                                    value: session,
                                });
                            } catch (e) {
                                console.warn("Failed setting cookie via CapacitorCookies:", e);
                            }
                            authCheckTrigger++;
                        }
                    } catch (e) {
                        console.error("Failed parsing auth deep link URL:", e);
                    }
                }
            });
        }

        return () => {
            handlePromise?.then((h) => h.remove());
        };
    });

    const handleLogin = async () => {
        if (Capacitor.isNativePlatform()) {
            const loginUrl = `${cleanEnteredUrl}/api/login?mobile=1`;
            await Browser.open({ url: loginUrl });
        } else {
            const redirectParam = encodeURIComponent(window.location.origin);
            window.location.href = `${cleanEnteredUrl}/api/login?redirect=${redirectParam}`;
        }
    };
</script>

<div id="login-page">
    <span class="title"> Welcome to Anily </span>
    <label for="backend-url"> Backend URL to connect to: </label>
    <div class="backend-url-wrapper">
        <TextInput
            id="backend-url"
            type="url"
            placeholder="https://"
            bind:value={enteredUrl.current}
        />
        <Button
            Icon={SignInIcon}
            disabled={!needAuthentication}
            onclick={handleLogin}>Login</Button
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
        height: 100dvh;
        max-height: 100dvh;
        padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
        padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
        box-sizing: border-box;

        @media (max-width: 640px) {
            margin-left: 1rem;
            margin-right: 1rem;
        }

        .title {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }

        .backend-url-wrapper {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .checkbox-list {
            margin-top: 0.5rem;
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 0.25rem;
        }
    }
</style>
