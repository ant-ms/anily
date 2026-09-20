import type { Tab } from "$lib/tab-switcher/tab-switcher-types";
import NewspaperIcon from "phosphor-svelte/lib/NewspaperIcon";
import HourglassIcon from "phosphor-svelte/lib/HourglassIcon";
import CheckFatIcon from "phosphor-svelte/lib/CheckFatIcon";
import PlayIcon from "phosphor-svelte/lib/PlayIcon";

export const defaultDestinations: Tab[] = [
    {
        id: "inbox",
        name: "Inbox",
        Icon: NewspaperIcon,
        default: true,
    },
    {
        id: "waiting",
        name: "Caught Up",
        Icon: PlayIcon,
    },
    {
        id: "upcoming",
        name: "Upcoming",
        Icon: HourglassIcon,
    },
    {
        id: "completed",
        name: "Completed",
        Icon: CheckFatIcon,
    },
];
