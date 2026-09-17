import type { IconComponentProps } from "phosphor-svelte";
import type { Component } from "svelte";

export interface NavDestination {
    id: string;
    name: string;
    Icon: Component<IconComponentProps, {}, "">;
    default?: boolean;
}

// Re-export or alias Tab for compatibility across existing files
export type Tab = NavDestination;
