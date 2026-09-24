import "dotenv/config";
import { Hono } from "hono";
import { setupAuthHandlers } from "./auth";
import { setupLoggerMiddleware } from "./logger";

import { setLogger } from "@ant.ms/anily-providers";
import { logger } from "./logger";

export const app = new Hono();

setupAuthHandlers(app);
setupLoggerMiddleware(app);
setLogger(logger.child({ module: "providers" }));

