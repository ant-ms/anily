import "dotenv/config";
import { Hono } from "hono";
import { setupAuthHandlers } from "./auth";
import { setupLoggerMiddleware } from "./logger";

import { setLogger } from "@ant.ms/anily-providers";
import { logger } from "./logger";
import { errorTracker } from "./errorTracker";

export const app = new Hono();

setupAuthHandlers(app);
setupLoggerMiddleware(app);
setLogger(logger.child({ module: "providers" }));

app.onError((err, c) => {
  const status = "status" in err && typeof err.status === "number" ? err.status : 500;
  errorTracker.recordError({
    category: "HTTP",
    action: `${c.req.method} ${c.req.path}`,
    message: err.message || "Unhandled server error",
    error: err,
    statusCode: status,
    endpoint: c.req.url,
    method: c.req.method,
  });
  return c.json(
    {
      error: err.message || "Internal Server Error",
    },
    status as any,
  );
});

