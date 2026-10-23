// GET /api/readiness — product-reachable readiness (no tenant data)
import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { log } from "@/lib/logger";

export async function GET(req: Request) {
  const cid = req.headers.get("x-correlation-id") ?? req.headers.get("x-request-id");
  const root = process.cwd();
  const checks = {
    evidenceRegistry: existsSync(path.join(root, "state", "evidence-registry.json")),
    graphState: existsSync(path.join(root, "state", "graph-state.json")),
    storageConfigured: process.env.TENANT_STORE === "postgres" ? !!process.env.DATABASE_URL : true,
  };
  const ready = Object.values(checks).every(Boolean);
  log("info", "readiness check", { correlationId: cid, ready });
  return NextResponse.json({ ready, checks }, { status: ready ? 200 : 503 });
}
