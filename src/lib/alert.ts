// Failure alerting: structured alert on a failing audit, provider or storage outage.
import { log } from "@/lib/logger";

export type AlertKind = "audit_failure" | "provider_failure" | "storage_outage" | "generic";

export interface AlertPayload {
  kind?: AlertKind;
  type?: AlertKind;
  message: string;
  details?: Record<string, unknown>;
  correlationId?: string | null;
}

export function fireAlert(payload: AlertPayload): void {
  const kind = payload.kind ?? payload.type ?? "generic";
  log("error", `ALERT: ${payload.message}`, {
    alert: true,
    kind,
    ...(payload.details ?? {}),
    correlationId: payload.correlationId ?? null,
  });
}

export const alert = fireAlert;
export const raiseAlert = fireAlert;
export const sendAlert = fireAlert;
export const notifyAlert = fireAlert;
