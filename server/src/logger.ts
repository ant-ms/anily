import { Hono } from "hono";
import { pinoLogger } from "hono-pino";
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        }
      : undefined,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      // Explicitly omit headers by not passing req.headers
    }),
    res: (res: Response) => ({
      statusCode: res.status,
      // Explicitly omit response headers
    }),
  },
});

export const setupLoggerMiddleware = (app: Hono) => {
  app.use("*", pinoLogger({ pino: logger }));
};
