export type BackHandler = () => boolean;

const backHandlers: BackHandler[] = [];

/**
 * Register a back handler. Handlers are executed in LIFO (last-in, first-out) order.
 * If a handler returns true, back handling stops (the event was consumed).
 * Returns an unregister function to be called on cleanup.
 */
export function registerBackHandler(handler: BackHandler): () => void {
    backHandlers.push(handler);
    return () => {
        const index = backHandlers.lastIndexOf(handler);
        if (index !== -1) {
            backHandlers.splice(index, 1);
        }
    };
}

/**
 * Executes the highest-priority back handler in the stack.
 * Returns true if a handler consumed the back event, false otherwise.
 */
export function executeBackHandler(): boolean {
    for (let i = backHandlers.length - 1; i >= 0; i--) {
        if (backHandlers[i]()) {
            return true;
        }
    }
    return false;
}
