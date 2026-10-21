import {
  extractFilename,
  makeProxiedUrl,
  getVttDuration,
  createStreamProxyHandler,
} from "@medialy/stream-core";
import { logger } from "$src/logger";
import { getPublicOrigin } from "$src/routes/apiStream/helpers";

const log = logger.child({ module: "streamProxy" });

export { extractFilename, makeProxiedUrl, getVttDuration, createStreamProxyHandler };

export const handleStreamProxy = createStreamProxyHandler({
  resolveOrigin: getPublicOrigin,
  logger: log,
});
