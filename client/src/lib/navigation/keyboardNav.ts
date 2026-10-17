import { isGlobalSearchOpen } from "../context.svelte";
import { videoPlayerState } from "../player/videoPlayer.svelte";

type Direction = "up" | "down" | "left" | "right";
type ZoneId = "rail" | "sidebar" | "details-main" | "chains";

const FOCUSABLE_SELECTOR = [
    'button:not([disabled]):not([tabindex="-1"])',
    'a[href]:not([tabindex="-1"])',
    'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex="0"]:not([disabled])',
].join(", ");

const OVERLAY_SELECTORS = [
    ".bottom-sheet-content",
    ".popover-menu",
    ".select-popover",
    ".services-dropdown",
    ".profile-popover",
];

const lastFocusedByZone = new Map<ZoneId, WeakRef<HTMLElement>>();

function isElementVisible(el: HTMLElement): boolean {
    if (!el.isConnected) return false;
    if (el.closest("[inert], [hidden], [aria-hidden='true']")) return false;

    const style = window.getComputedStyle(el);
    if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        parseFloat(style.opacity) === 0
    ) {
        return false;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    // Exclude off-canvas elements (e.g. closed slide-over drawers)
    if (rect.left >= window.innerWidth || rect.right <= 0) return false;
    return true;
}

function getFocusableElements(
    root: ParentNode = document,
    excludeRoot?: HTMLElement | null,
): HTMLElement[] {
    const raw = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    return raw.filter((el) => {
        if (excludeRoot && excludeRoot.contains(el)) return false;
        if (!isElementVisible(el)) return false;
        if (el.classList.contains("offline-disabled")) return false;
        return true;
    });
}

function focusAndReveal(el: HTMLElement) {
    el.focus({ preventScroll: true });
    el.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
    });
}

function getActiveOverlay(): HTMLElement | null {
    for (const selector of OVERLAY_SELECTORS) {
        const matches = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
            isElementVisible,
        );
        if (matches.length > 0) {
            return matches[matches.length - 1];
        }
    }
    return null;
}

interface ZoneDescriptor {
    id: ZoneId;
    element: HTMLElement;
    excludeElement?: HTMLElement | null;
}

function getZoneFocusables(zone: ZoneDescriptor): HTMLElement[] {
    return getFocusableElements(zone.element, zone.excludeElement);
}

function getAvailableZones(): ZoneDescriptor[] {
    const zones: ZoneDescriptor[] = [];

    const railEl = document.querySelector<HTMLElement>(
        ".rail-container, .foldable-side-rail, .bar-container",
    );
    if (railEl && isElementVisible(railEl)) {
        zones.push({ id: "rail", element: railEl });
    }

    const sidebarEl = document.querySelector<HTMLElement>(
        ".sidebar-container:not(.desktop-collapsed):not(.mobile-hidden)",
    );
    if (sidebarEl && isElementVisible(sidebarEl)) {
        zones.push({ id: "sidebar", element: sidebarEl });
    }

    const chainsEl = document.querySelector<HTMLElement>(
        "#anime-details-page > .right",
    );
    const isChainsVisible = Boolean(chainsEl && isElementVisible(chainsEl));

    const contentEl = document.querySelector<HTMLElement>("#content");
    const loginEl = document.querySelector<HTMLElement>("#login-page");

    if (contentEl && isElementVisible(contentEl)) {
        zones.push({
            id: "details-main",
            element: contentEl,
            excludeElement: chainsEl,
        });
    } else if (loginEl && isElementVisible(loginEl)) {
        zones.push({ id: "details-main", element: loginEl });
    }

    if (chainsEl && isChainsVisible) {
        zones.push({ id: "chains", element: chainsEl });
    }

    return zones;
}

function findZoneForElement(
    el: HTMLElement,
    zones: ZoneDescriptor[],
): ZoneDescriptor | undefined {
    // Check from most specific (chains/details-main) to least specific
    for (let i = zones.length - 1; i >= 0; i--) {
        if (zones[i].element.contains(el)) {
            return zones[i];
        }
    }
    return undefined;
}

function rememberZoneFocus(zoneId: ZoneId, el: HTMLElement) {
    lastFocusedByZone.set(zoneId, new WeakRef(el));
}

function getPreferredEntryElement(zone: ZoneDescriptor): HTMLElement | null {
    const remembered = lastFocusedByZone.get(zone.id)?.deref();
    if (
        remembered &&
        zone.element.contains(remembered) &&
        (!zone.excludeElement || !zone.excludeElement.contains(remembered)) &&
        isElementVisible(remembered) &&
        !remembered.hasAttribute("disabled")
    ) {
        return remembered;
    }

    if (zone.id === "sidebar") {
        const activeCard = zone.element.querySelector<HTMLElement>(
            ".sidebar-card.active:not(.offline-disabled)",
        );
        if (activeCard && isElementVisible(activeCard)) return activeCard;

        const firstCard = zone.element.querySelector<HTMLElement>(
            ".sidebar-card:not(.offline-disabled)",
        );
        if (firstCard && isElementVisible(firstCard)) return firstCard;
    }

    if (zone.id === "rail") {
        const activeRailItem = zone.element.querySelector<HTMLElement>(
            ".rail-item.active, .bar-item.active",
        );
        if (activeRailItem && isElementVisible(activeRailItem)) {
            return activeRailItem;
        }
    }

    if (zone.id === "details-main") {
        const firstEpisodeThumb = zone.element.querySelector<HTMLElement>(
            '.episode-card:not(.is-future) .thumbnail-container[tabindex="0"]',
        );
        if (firstEpisodeThumb && isElementVisible(firstEpisodeThumb)) {
            return firstEpisodeThumb;
        }
    }

    if (zone.id === "chains") {
        const currentChainCard = zone.element.querySelector<HTMLElement>(
            ".anime-card.current",
        );
        if (currentChainCard && isElementVisible(currentChainCard)) {
            return currentChainCard;
        }
        const firstChainCard = zone.element.querySelector<HTMLElement>(".anime-card");
        if (firstChainCard && isElementVisible(firstChainCard)) {
            return firstChainCard;
        }
    }

    const focusables = getZoneFocusables(zone);
    return focusables[0] ?? null;
}

function getBestSpatialCandidate(
    origin: HTMLElement,
    candidates: HTMLElement[],
    direction: Direction,
    options?: { requireRowAlignment?: boolean },
): HTMLElement | null {
    const originRect = origin.getBoundingClientRect();
    const originCenterX = originRect.left + originRect.width / 2;
    const originCenterY = originRect.top + originRect.height / 2;

    let bestCandidate: HTMLElement | null = null;
    let bestScore = Infinity;

    for (const candidate of candidates) {
        if (candidate === origin) continue;
        if (candidate.contains(origin) || origin.contains(candidate)) continue;

        const rect = candidate.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = centerX - originCenterX;
        const dy = centerY - originCenterY;

        if (direction === "right" && dx <= 4) continue;
        if (direction === "left" && dx >= -4) continue;
        if (direction === "down" && dy <= 4) continue;
        if (direction === "up" && dy >= -4) continue;

        const overlapX = Math.max(
            0,
            Math.min(originRect.right, rect.right) -
                Math.max(originRect.left, rect.left),
        );
        const overlapY = Math.max(
            0,
            Math.min(originRect.bottom, rect.bottom) -
                Math.max(originRect.top, rect.top),
        );

        if (
            options?.requireRowAlignment &&
            (direction === "left" || direction === "right")
        ) {
            const verticalGap = Math.max(
                0,
                Math.max(originRect.top, rect.top) -
                    Math.min(originRect.bottom, rect.bottom),
            );
            if (overlapY <= 0 && verticalGap > 24) {
                continue;
            }
        }

        let primaryDist: number;
        let secondaryDist: number;
        let hasAlignmentOverlap: boolean;

        if (direction === "left" || direction === "right") {
            const edgeGap =
                direction === "right"
                    ? Math.max(0, rect.left - originRect.right)
                    : Math.max(0, originRect.left - rect.right);
            primaryDist = overlapY > 0 ? edgeGap : Math.abs(dx);
            secondaryDist = Math.abs(dy);
            hasAlignmentOverlap = overlapY > 0;
        } else {
            const edgeGap =
                direction === "down"
                    ? Math.max(0, rect.top - originRect.bottom)
                    : Math.max(0, originRect.top - rect.bottom);
            primaryDist = overlapX > 0 ? edgeGap : Math.abs(dy);
            secondaryDist = Math.abs(dx);
            hasAlignmentOverlap = overlapX > 0;
        }

        // Strongly prefer candidates that overlap along the perpendicular axis
        const alignmentPenalty = hasAlignmentOverlap ? 0 : 250;
        const score = primaryDist + secondaryDist * 2.5 + alignmentPenalty;

        if (score < bestScore) {
            bestScore = score;
            bestCandidate = candidate;
        }
    }

    return bestCandidate;
}

function navigateLinearList(
    current: HTMLElement,
    items: HTMLElement[],
    delta: -1 | 1,
    wrap = false,
): HTMLElement | null {
    if (items.length === 0) return null;
    const idx = items.indexOf(current);
    if (idx === -1) {
        return delta === 1 ? items[0] : items[items.length - 1];
    }
    const nextIdx = idx + delta;
    if (nextIdx >= 0 && nextIdx < items.length) {
        return items[nextIdx];
    }
    if (wrap) {
        return items[(nextIdx + items.length) % items.length];
    }
    return null;
}

export function focusDefaultElement() {
    const overlay = getActiveOverlay();
    if (overlay) {
        const focusables = getFocusableElements(overlay);
        if (focusables.length > 0) {
            focusAndReveal(focusables[0]);
            return;
        }
    }

    const zones = getAvailableZones();
    const preferredOrder: ZoneId[] = ["details-main", "sidebar", "rail", "chains"];

    for (const id of preferredOrder) {
        const zone = zones.find((z) => z.id === id);
        if (!zone) continue;
        // Prefer sidebar first if no anime is currently selected and sidebar is open
        if (
            id === "details-main" &&
            !document.querySelector("#anime-details-page") &&
            zones.some((z) => z.id === "sidebar")
        ) {
            continue;
        }
        const target = getPreferredEntryElement(zone);
        if (target) {
            rememberZoneFocus(zone.id, target);
            focusAndReveal(target);
            return;
        }
    }

    for (const zone of zones) {
        const target = getPreferredEntryElement(zone);
        if (target) {
            rememberZoneFocus(zone.id, target);
            focusAndReveal(target);
            return;
        }
    }
}

export function handleSpatialNavigation(e: KeyboardEvent): boolean {
    if (e.defaultPrevented) return false;
    if (e.altKey || e.ctrlKey || e.metaKey) return false;
    if (videoPlayerState.mode === "expanded" || isGlobalSearchOpen.current) {
        return false;
    }

    const directionMap: Record<string, Direction | undefined> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
    };

    const direction = directionMap[e.key];
    if (!direction) return false;

    const activeEl = document.activeElement as HTMLElement | null;

    // Allow Left/Right inside text inputs for cursor navigation, but allow Up/Down to escape inputs
    if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.isContentEditable
    ) {
        if (direction === "left" || direction === "right") {
            return false;
        }
    }

    // 1. Trap navigation inside any active overlay (BottomSheet, Popover, Select, StreamingDropdown, Profile menu)
    const overlay = getActiveOverlay();
    if (overlay) {
        const overlayItems = getFocusableElements(overlay);
        if (overlayItems.length === 0) return false;

        e.preventDefault();
        if (!activeEl || !overlay.contains(activeEl)) {
            focusAndReveal(overlayItems[0]);
            return true;
        }

        const spatialNext = getBestSpatialCandidate(activeEl, overlayItems, direction);
        if (spatialNext) {
            focusAndReveal(spatialNext);
            return true;
        }

        if (direction === "down" || direction === "right") {
            const next = navigateLinearList(activeEl, overlayItems, 1, true);
            if (next) focusAndReveal(next);
        } else {
            const prev = navigateLinearList(activeEl, overlayItems, -1, true);
            if (prev) focusAndReveal(prev);
        }
        return true;
    }

    const zones = getAvailableZones();
    if (zones.length === 0) return false;

    // 2. If nothing is currently focused, focus the best starting element
    if (
        !activeEl ||
        activeEl === document.body ||
        !isElementVisible(activeEl)
    ) {
        e.preventDefault();
        focusDefaultElement();
        return true;
    }

    const currentZone = findZoneForElement(activeEl, zones);
    if (currentZone) {
        rememberZoneFocus(currentZone.id, activeEl);
    } else {
        e.preventDefault();
        focusDefaultElement();
        return true;
    }

    const currentZoneIdx = zones.findIndex((z) => z.id === currentZone.id);

    // Helper to transition horizontally to an adjacent zone
    const moveAdjacentZone = (delta: -1 | 1): boolean => {
        for (
            let i = currentZoneIdx + delta;
            i >= 0 && i < zones.length;
            i += delta
        ) {
            const targetZone = zones[i];
            const entry = getPreferredEntryElement(targetZone);
            if (entry) {
                rememberZoneFocus(targetZone.id, entry);
                focusAndReveal(entry);
                return true;
            }
        }
        return false;
    };

    // 3. Zone-specific behavior for Navigation Rail & Anime Sidebar (strict 1D vertical lists)
    if (currentZone.id === "rail" || currentZone.id === "sidebar") {
        const zoneItems = getZoneFocusables(currentZone);
        if (direction === "up" || direction === "down") {
            e.preventDefault();
            const next = navigateLinearList(
                activeEl,
                zoneItems,
                direction === "down" ? 1 : -1,
                false,
            );
            if (next) {
                rememberZoneFocus(currentZone.id, next);
                focusAndReveal(next);
            }
            return true;
        }

        if (direction === "left") {
            e.preventDefault();
            moveAdjacentZone(-1);
            return true;
        }

        if (direction === "right") {
            e.preventDefault();
            moveAdjacentZone(1);
            return true;
        }
    }

    // 4. Episode Thumbnail horizontal grid navigation (glide directly between episode thumbnails on Left/Right)
    if (
        currentZone.id === "details-main" &&
        activeEl.classList.contains("thumbnail-container") &&
        (direction === "left" || direction === "right")
    ) {
        e.preventDefault();
        const allThumbs = Array.from(
            currentZone.element.querySelectorAll<HTMLElement>(
                '.episode-card:not(.is-future) .thumbnail-container[tabindex="0"]',
            ),
        ).filter(isElementVisible);

        const nextThumb = getBestSpatialCandidate(activeEl, allThumbs, direction, {
            requireRowAlignment: true,
        });
        if (nextThumb) {
            rememberZoneFocus(currentZone.id, nextThumb);
            focusAndReveal(nextThumb);
            return true;
        }

        moveAdjacentZone(direction === "left" ? -1 : 1);
        return true;
    }

    // 5. General 2D spatial navigation within details-main or chains
    const zoneCandidates = getZoneFocusables(currentZone);
    const nextInZone = getBestSpatialCandidate(
        activeEl,
        zoneCandidates,
        direction,
        {
            requireRowAlignment: direction === "left" || direction === "right",
        },
    );

    e.preventDefault();
    if (nextInZone) {
        rememberZoneFocus(currentZone.id, nextInZone);
        focusAndReveal(nextInZone);
        return true;
    }

    // If at the horizontal edge of a row in details-main or chains, cross to the adjacent pane
    if (direction === "left") {
        moveAdjacentZone(-1);
        return true;
    }
    if (direction === "right") {
        moveAdjacentZone(1);
        return true;
    }

    // If pressing Up at the very top of details-main or chains, ensure the scroll container scrolls all the way to top
    if (direction === "up") {
        const scrollContainer =
            currentZone.element.querySelector<HTMLElement>(
                "#anime-details-page > .left, .tree, .content-body",
            ) ?? currentZone.element;
        scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    }

    return true;
}
