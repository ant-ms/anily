import { Capacitor, CapacitorCookies } from "@capacitor/core";
import { apiBaseUrl } from "./context.svelte";
import { STORAGE_KEYS } from "./storageKeys";

export async function clearAuthSession() {
    try {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.PROFILE_DATA);
    } catch {}

    if (Capacitor.isNativePlatform()) {
        try {
            const savedBackend = localStorage.getItem(STORAGE_KEYS.BACKEND_URL);
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
