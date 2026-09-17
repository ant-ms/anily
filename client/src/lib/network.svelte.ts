import { Network } from "@capacitor/network";

class NetworkState {
    public isOnline: boolean = $state(
        typeof navigator !== "undefined" ? navigator.onLine : true,
    );

    constructor() {
        if (typeof window !== "undefined") {
            Network.getStatus()
                .then((status) => {
                    this.isOnline = status.connected;
                })
                .catch(() => {
                    this.isOnline = navigator.onLine;
                });

            Network.addListener("networkStatusChange", (status) => {
                this.isOnline = status.connected;
            });

            window.addEventListener("online", () => {
                this.isOnline = true;
            });
            window.addEventListener("offline", () => {
                this.isOnline = false;
            });
        }
    }
}

export const networkState = new NetworkState();
