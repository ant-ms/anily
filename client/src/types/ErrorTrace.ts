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

export interface ErrorQueryResponse {
  errors: ErrorTraceEntry[];
  total: number;
  countsByCategory: Record<string, number>;
}
