import type { Tab } from "../tab-switcher/tab-switcher-types";

export interface RouteState {
  tab: Tab;
  animeId?: number;
}

export const KNOWN_TABS: Record<string, Tab> = {
  inbox: { id: "inbox", name: "Inbox", default: true },
  waiting: { id: "waiting", name: "Caught Up" },
  upcoming: { id: "upcoming", name: "Upcoming" },
  completed: { id: "completed", name: "Completed" },
  settings: { id: "settings", name: "Settings" },
  logs: { id: "logs", name: "Import Logs" },
  downloads: { id: "downloads", name: "Downloads" },
};

/**
 * Parses the current hash or path into a typed route state.
 * Supports:
 * - #/inbox, #/waiting, #/upcoming, #/completed
 * - #/settings, #/logs, #/downloads
 * - #/anime/12345 or /anime/12345
 */
export function parseCurrentRoute(): RouteState {
  if (typeof window === "undefined") {
    return { tab: KNOWN_TABS.inbox };
  }

  const rawHash = window.location.hash.replace(/^#\/?/, "").trim();
  const rawPath = window.location.pathname.replace(/^\/?/, "").trim();
  const target = rawHash || rawPath;

  const animeMatch = target.match(/^anime\/(\d+)/i);
  if (animeMatch) {
    const animeId = parseInt(animeMatch[1], 10);
    return {
      tab: KNOWN_TABS.inbox,
      animeId: isNaN(animeId) ? undefined : animeId,
    };
  }

  const tabKey = target.split("/")[0].toLowerCase();
  if (tabKey && KNOWN_TABS[tabKey]) {
    return { tab: KNOWN_TABS[tabKey] };
  }

  return { tab: KNOWN_TABS.inbox };
}

/**
 * Synchronizes the browser URL and history state with current view state.
 */
export function syncUrlWithState(
  activeTab: Tab | undefined,
  animeId: number | undefined,
  replace = false,
): void {
  if (typeof window === "undefined") return;

  const targetHash = animeId !== undefined ? `#/anime/${animeId}` : `#/${activeTab?.id || "inbox"}`;

  if (window.location.hash !== targetHash) {
    const stateObj = {
      animeId,
      tabId: activeTab?.id,
      anilyApp: true,
      hasPrev: !replace && !!window.history.state?.anilyApp,
    };
    if (replace) {
      window.history.replaceState(stateObj, "", targetHash);
    } else {
      window.history.pushState(stateObj, "", targetHash);
    }
  }
}
