// Structured, correlation-id-carrying logger for product surfaces.
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts: string;
  level: LogLevel;
  message: string;
  correlationId: string | null;
  [key: string]: unknown;
}

export function correlationIdFromRequest(req: Request | { headers?: Headers } | null | undefined): string | null {
  if (!req) return null;
  const headers = (req as Request).headers ?? (req as { headers?: Headers }).headers;
  if (!headers) return null;
  return (
    headers.get?.("x-correlation-id") ??
    headers.get?.("x-request-id") ??
    headers.get?.("traceparent") ??
    null
  );
}

export function newCorrelationId(): string {
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ensureCorrelationId(req?: Request | null): string {
  return correlationIdFromRequest(req ?? null) ?? newCorrelationId();
}

export function log(level: LogLevel, message: string, fields: Record<string, unknown> = {}): LogEntry {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    message,
    correlationId: (fields.correlationId as string | null | undefined) ?? null,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  return entry;
}

export const logger = {
  debug: (m: string, f?: Record<string, unknown>) => log("debug", m, f),
  info: (m: string, f?: Record<string, unknown>) => log("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => log("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => log("error", m, f),
};
