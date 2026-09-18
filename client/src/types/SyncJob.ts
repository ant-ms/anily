export type SyncJobType = 'ANILIST_SYNC' | 'EPISODE_METADATA';
export type SyncJobStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';
export type SyncJobTrigger = 'SCHEDULED' | 'MANUAL';

export type SyncJobWarning = {
  anilistId: number;
  title: string;
  message: string;
};

export type SyncJobDetails = {
  animeChecked?: number;
  titlesUpdated?: number;
  detailsUpdated?: number;
  episodesUpdated?: number;
  groupingsUpdated?: number;
  warnings?: SyncJobWarning[];
};

export type SyncJob = {
  id: number;
  type?: SyncJobType;
  trigger: SyncJobTrigger;
  status: SyncJobStatus;
  startedAt: string;
  completedAt: string | null;
  updatesCount: number | null;
  details?: SyncJobDetails | null;
  error: string | null;
};
