import { logger } from "./logger";

export type ErrorCategory = "DOWNLOAD" | "STREAM" | "SYNC" | "HTTP" | "SYSTEM";

export interface TraceStep {
  timestamp: string;
  relativeMs: number;
  level: "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
}

export interface ErrorTraceEntry {
  id: string;
  timestamp: string;
  category: ErrorCategory;
  action: string;
  message: string;
  errorName?: string;
  statusCode?: number;
  endpoint?: string;
  method?: string;
  params?: Record<string, unknown>;
  stack?: string;
  trace: TraceStep[];
}

export class ActiveTrace {
  private startTime = Date.now();
  private steps: TraceStep[] = [];
  public readonly id: string;

  constructor(
    public category: ErrorCategory,
    public action: string,
    public params?: Record<string, unknown>,
  ) {
    this.id = `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.step(`Trace started: ${action}`, params);
  }

  public step(message: string, data?: Record<string, unknown>): this {
    this.steps.push({
      timestamp: new Date().toISOString(),
      relativeMs: Date.now() - this.startTime,
      level: "info",
      message,
      data: data ? this.sanitize(data) : undefined,
    });
    return this;
  }

  public warn(message: string, data?: Record<string, unknown>): this {
    this.steps.push({
      timestamp: new Date().toISOString(),
      relativeMs: Date.now() - this.startTime,
      level: "warn",
      message,
      data: data ? this.sanitize(data) : undefined,
    });
    return this;
  }

  public fail(
    error: unknown,
    options?: {
      statusCode?: number;
      message?: string;
      endpoint?: string;
      method?: string;
      extraParams?: Record<string, unknown>;
    },
  ): ErrorTraceEntry {
    const errObj = error instanceof Error ? error : new Error(String(error));
    const relativeMs = Date.now() - this.startTime;
    const finalMsg = options?.message || errObj.message || "Unknown error";

    this.steps.push({
      timestamp: new Date().toISOString(),
      relativeMs,
      level: "error",
      message: finalMsg,
      data: {
        errorName: errObj.name,
        errorMessage: errObj.message,
      },
    });

    const entry: ErrorTraceEntry = {
      id: this.id,
      timestamp: new Date().toISOString(),
      category: this.category,
      action: this.action,
      message: finalMsg,
      errorName: errObj.name,
      statusCode: options?.statusCode ?? 500,
      endpoint: options?.endpoint,
      method: options?.method,
      params: this.sanitize({ ...this.params, ...options?.extraParams }),
      stack: errObj.stack,
      trace: [...this.steps],
    };

    errorTracker.record(entry);
    return entry;
  }

  private sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("token") ||
        lowerKey.includes("cookie") ||
        lowerKey.includes("auth") ||
        lowerKey.includes("password") ||
        lowerKey.includes("secret")
      ) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof val === "object" && val !== null) {
        try {
          sanitized[key] = JSON.parse(JSON.stringify(val));
        } catch {
          sanitized[key] = String(val);
        }
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
}

export class ErrorTracker {
  private static MAX_ENTRIES = 200;
  private entries: ErrorTraceEntry[] = [];

  public startTrace(
    category: ErrorCategory,
    action: string,
    params?: Record<string, unknown>,
  ): ActiveTrace {
    return new ActiveTrace(category, action, params);
  }

  public record(entry: ErrorTraceEntry): ErrorTraceEntry {
    // Check if duplicate of most recent entry to prevent noise
    const latest = this.entries[0];
    if (
      latest &&
      latest.category === entry.category &&
      latest.action === entry.action &&
      latest.message === entry.message &&
      Date.now() - new Date(latest.timestamp).getTime() < 1000
    ) {
      return latest;
    }

    this.entries.unshift(entry);
    if (this.entries.length > ErrorTracker.MAX_ENTRIES) {
      this.entries.length = ErrorTracker.MAX_ENTRIES;
    }

    logger.error(
      {
        errorId: entry.id,
        category: entry.category,
        action: entry.action,
        statusCode: entry.statusCode,
        endpoint: entry.endpoint,
        stepsCount: entry.trace.length,
      },
      `[ErrorTracker] Recorded error: ${entry.message}`,
    );

    return entry;
  }

  public recordError(options: {
    category: ErrorCategory;
    action: string;
    message: string;
    error?: unknown;
    statusCode?: number;
    endpoint?: string;
    method?: string;
    params?: Record<string, unknown>;
    traceSteps?: TraceStep[];
  }): ErrorTraceEntry {
    const errObj = options.error instanceof Error ? options.error : undefined;
    const now = new Date().toISOString();

    const traceSteps: TraceStep[] = options.traceSteps || [
      {
        timestamp: now,
        relativeMs: 0,
        level: "error",
        message: options.message,
        data: errObj ? { name: errObj.name, message: errObj.message } : undefined,
      },
    ];

    const entry: ErrorTraceEntry = {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: now,
      category: options.category,
      action: options.action,
      message: options.message,
      errorName: errObj?.name,
      statusCode: options.statusCode ?? 500,
      endpoint: options.endpoint,
      method: options.method,
      params: options.params,
      stack: errObj?.stack,
      trace: traceSteps,
    };

    return this.record(entry);
  }

  public getErrors(options?: {
    category?: ErrorCategory | "ALL";
    query?: string;
    limit?: number;
    offset?: number;
  }): {
    errors: ErrorTraceEntry[];
    total: number;
    countsByCategory: Record<string, number>;
  } {
    const categoryFilter = options?.category && options.category !== "ALL" ? options.category : null;
    const search = options?.query?.trim().toLowerCase();
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const offset = Math.max(options?.offset ?? 0, 0);

    const countsByCategory: Record<string, number> = {
      ALL: this.entries.length,
      DOWNLOAD: 0,
      STREAM: 0,
      SYNC: 0,
      HTTP: 0,
      SYSTEM: 0,
    };

    for (const item of this.entries) {
      if (countsByCategory[item.category] !== undefined) {
        countsByCategory[item.category]++;
      }
    }

    let filtered = this.entries;

    if (categoryFilter) {
      filtered = filtered.filter((e) => e.category === categoryFilter);
    }

    if (search) {
      filtered = filtered.filter((e) => {
        return (
          e.message.toLowerCase().includes(search) ||
          e.action.toLowerCase().includes(search) ||
          (e.endpoint && e.endpoint.toLowerCase().includes(search)) ||
          (e.params && JSON.stringify(e.params).toLowerCase().includes(search)) ||
          (e.errorName && e.errorName.toLowerCase().includes(search))
        );
      });
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      errors: paginated,
      total,
      countsByCategory,
    };
  }

  public getErrorById(id: string): ErrorTraceEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  public clear(): void {
    this.entries = [];
  }
}

export const errorTracker = new ErrorTracker();
