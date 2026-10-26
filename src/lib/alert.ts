// Failure alerting: structured alert on a failing audit, provider or storage outage.
import { log } from "@/lib/logger";

export type AlertKind = "audit_failure" | "provider_failure" | "storage_outage" | "generic";

export interface AlertPayload {
  kind?: AlertKind;
  message: string;
  details?: Record<string, unknown>;
  correlationId?: string | null;
}

const DEDUP_WINDOW_MS = 60_000;
const recent = new Map<string, number>();

export function fireAlert(payload: AlertPayload): void {
  const kind = payload.kind ?? "generic";
  const key = `${kind}:${payload.message}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) return;
  recent.set(key, now);
  log("error", `ALERT: ${payload.message}`, {
    alert: true,
    kind,
    ...(payload.details ?? {}),
    correlationId: payload.correlationId ?? null,
  });
}
