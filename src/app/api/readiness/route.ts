// GET /api/readiness — product-reachable readiness (no tenant data)
import { NextResponse } from "next/server";
import { tenantStoreEnabled, isDatabaseConfigured } from "@/lib/db/config";
import { isAnyProviderDegraded } from "@/discovery/health-state";
import { ensureCorrelationId, log } from "@/lib/logger";

export async function GET(req: Request) {
  const correlationId = ensureCorrelationId(req);
  const storage = tenantStoreEnabled() ? isDatabaseConfigured() : true;
  const providers = !isAnyProviderDegraded();
  const ready = storage && providers;
  log("info", "readiness check", { correlationId, ready });
  const res = NextResponse.json(
    { ready, checks: { storage, providers } },
    { status: ready ? 200 : 503 },
  );
  res.headers.set("x-correlation-id", correlationId);
  return res;
}
