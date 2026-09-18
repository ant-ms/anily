import { Capacitor, CapacitorCookies } from "@capacitor/core";
import { apiBaseUrl } from "./context.svelte";

export async function clearAuthSession() {
    try {
        localStorage.removeItem("authToken");
        localStorage.removeItem("anily:profile_data");
    } catch {}

    if (Capacitor.isNativePlatform()) {
        try {
            const savedBackend = localStorage.getItem("backendUrl");
            if (savedBackend) {
                const cleaned = JSON.parse(savedBackend).trim().replace(/\/+$/, "");
                await CapacitorCookies.deleteCookie({
                    url: cleaned,
                    key: "oidc-auth",
                });
            }
        } catch (e) {
            console.warn("Failed to delete oidc-auth cookie:", e);
        }
    }

    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("anily:unauthorized"));
    }
}

export async function signOut() {
    try {
        if (apiBaseUrl.current) {
            await fetch(`${apiBaseUrl.current}logout`, { credentials: "include" }).catch(() => {});
        }
    } catch {}

    await clearAuthSession();
}
