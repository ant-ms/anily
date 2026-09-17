import "dotenv/config";
import { Hono } from "hono";
import { setupAuthHandlers } from "./auth";
import { setupLoggerMiddleware } from "./logger";

export const app = new Hono();

setupAuthHandlers(app);
setupLoggerMiddleware(app);

