import { autoDownloadNewEpisodes, syncDownloadStatuses } from "$lib/media/mediaManager";
import { logger } from "$src/logger";

export const runAutoDownload = async () => {
  const log = logger.child({ task: "autoDownload" });
  try {
    // First sync existing download statuses
    await syncDownloadStatuses();
    // Then kick off new downloads for aired episodes
    const result = await autoDownloadNewEpisodes();
    log.info(result, "auto-download complete");
  } catch (error) {
    log.error({ error }, "auto-download failed");
  }
};
