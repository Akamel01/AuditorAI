// GET/POST/DELETE /api/dev/harvest-stream/secrets — admin-gated runtime keys for agent reach (H11)
// GET returns presence booleans only (never values). POST sets fields
// (empty string clears that key). DELETE clears all overrides (env fallback).
import { NextResponse } from "next/server";
import { badRequest, requireAdmin, serverError } from "@/lib/api";
import {
  clearRuntimeSecrets,
  runtimeSecretPresence,
  setRuntimeSecrets,
} from "@/discovery/runtime-secrets";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    return NextResponse.json(await runtimeSecretPresence());
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const body = (await req.json().catch(() => null)) as {
      enabled?: unknown;
      exaKey?: unknown;
      opencodeKey?: unknown;
    } | null;
    if (!body || typeof body !== "object") return badRequest("expected JSON {enabled?, exaKey?, opencodeKey?}");
    const patch: { enabled?: boolean; exaKey?: string; opencodeKey?: string } = {};
    if (body.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") return badRequest("enabled must be boolean");
      patch.enabled = body.enabled;
    }
    for (const k of ["exaKey", "opencodeKey"] as const) {
      const v = body[k];
      if (v !== undefined) {
        if (typeof v !== "string") return badRequest(`${k} must be string`);
        if (v.length > 2000) return badRequest(`${k} too long`);
        patch[k] = v;
      }
    }
    await setRuntimeSecrets(patch);
    return NextResponse.json(await runtimeSecretPresence());
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    await clearRuntimeSecrets();
    return NextResponse.json(await runtimeSecretPresence());
  } catch (e) {
    return serverError(e);
  }
}
