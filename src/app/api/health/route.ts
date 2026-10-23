// GET /api/health — product-reachable dependency state (no tenant data)
import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { isAnyProviderDegraded } from "@/discovery/health-state";
import { listProviderIds, providerEnabled } from "@/discovery/providers";
import "@/discovery/providers";
import { log } from "@/lib/logger";
import { fireAlert } from "@/lib/alert";

export async function GET(req: Request) {
  const cid = req.headers.get("x-correlation-id") ?? req.headers.get("x-request-id");
  const root = process.cwd();
  const storageMode = process.env.TENANT_STORE === "postgres" ? "postgres" : "legacy";
  const storageConfigured =
    storageMode === "postgres" ? !!process.env.DATABASE_URL : true;
  const providers = listProviderIds().map((id) => ({
    id,
    enabled: providerEnabled(id),
  }));
  const stateFiles = {
    evidenceRegistry: existsSync(path.join(root, "state", "evidence-registry.json")),
    graphState: existsSync(path.join(root, "state", "graph-state.json")),
  };
  const degraded = isAnyProviderDegraded();
  const status = storageConfigured && !degraded ? "ok" : "degraded";
  if (status !== "ok") {
    fireAlert({ kind: storageConfigured ? "provider_failure" : "storage_outage", message: "health degraded", details: { status, degraded, storageConfigured } });
  }
  log("info", "health check", { correlationId: cid, status });
  return NextResponse.json({
    status,
    storage: { mode: storageMode, configured: storageConfigured },
    providers,
    stateFiles,
    degraded,
  });
}
