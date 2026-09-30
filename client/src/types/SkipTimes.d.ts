export type SkipType = "op" | "ed" | "recap" | "mixed-op" | "mixed-ed";

export interface SkipInterval {
  startTime: number;
  endTime: number;
}

export interface SkipTimeEntry {
  type: SkipType;
  interval: SkipInterval;
  skipId?: string;
  episodeLength?: number;
}

export interface EpisodeSkipTimes {
  found: boolean;
  results: SkipTimeEntry[];
  op?: SkipInterval;
  ed?: SkipInterval;
  recap?: SkipInterval;
  mixedOp?: SkipInterval;
  mixedEd?: SkipInterval;
}

export interface ActiveSkipSegment {
  type: SkipType;
  label: string;
  startTime: number;
  endTime: number;
}
