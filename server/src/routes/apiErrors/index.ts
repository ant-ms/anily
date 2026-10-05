import { app } from "$src/app";
import { errorTracker, type ErrorCategory } from "$src/errorTracker";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const errorQueryValidator = zValidator(
  "query",
  z.object({
    category: z.enum(["ALL", "DOWNLOAD", "STREAM", "SYNC", "HTTP", "SYSTEM"]).optional(),
    query: z.string().optional(),
    limit: z.coerce.number().min(1).max(200).optional(),
    offset: z.coerce.number().min(0).optional(),
  }),
);

const reportBodyValidator = zValidator(
  "json",
  z.object({
    category: z.enum(["DOWNLOAD", "STREAM", "SYNC", "HTTP", "SYSTEM"]).default("DOWNLOAD"),
    action: z.string().min(1),
    message: z.string().min(1),
    errorName: z.string().optional(),
    statusCode: z.number().optional(),
    endpoint: z.string().optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    stack: z.string().optional(),
  }),
);

export const apiErrorsGetRoute = app.get(
  "/api/errors",
  errorQueryValidator,
  async (c) => {
    try {
      const { category, query, limit, offset } = c.req.valid("query");
      const result = errorTracker.getErrors({
        category: category as ErrorCategory | "ALL" | undefined,
        query,
        limit,
        offset,
      });
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error: "Failed to fetch error logs",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

export const apiErrorDetailsGetRoute = app.get(
  "/api/errors/:id",
  async (c) => {
    const id = c.req.param("id");
    const entry = errorTracker.getErrorById(id);
    if (!entry) {
      return c.json({ error: "Error record not found" }, 404);
    }
    return c.json(entry);
  },
);

export const apiErrorsClearPostRoute = app.post(
  "/api/errors/clear",
  async (c) => {
    errorTracker.clear();
    return c.json({ status: "cleared" });
  },
);

export const apiErrorsReportPostRoute = app.post(
  "/api/errors/report",
  reportBodyValidator,
  async (c) => {
    const data = c.req.valid("json");
    const entry = errorTracker.recordError({
      category: data.category as ErrorCategory,
      action: data.action,
      message: data.message,
      statusCode: data.statusCode,
      endpoint: data.endpoint,
      params: data.params,
    });
    if (data.stack) {
      entry.stack = data.stack;
    }
    return c.json({ status: "recorded", id: entry.id });
  },
);
