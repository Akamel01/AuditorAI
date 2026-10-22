// GET/POST/DELETE /api/dev/harvest-stream/secrets — admin-gated runtime keys for agent reach (H11)
// GET returns presence booleans only (never values). POST sets fields
// (empty string clears that key). DELETE clears all overrides (env fallback).
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { devSecretsRequest, readJsonBody } from "@/lib/request-schema";
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
    // The body is REQUIRED here — an absent body was a 400 before this change
    // (the old JSON-parse fallback yielded null and the `!body` guard
    // rejected it), so the empty body is NOT legal. The schema now owns the
    // type checks (enabled boolean, keys string, 2000-char cap); a failure
    // is a 422.
    const body = await readJsonBody<{
      enabled?: boolean;
      exaKey?: string;
      opencodeKey?: string;
    }>(req, devSecretsRequest);
    const patch: { enabled?: boolean; exaKey?: string; opencodeKey?: string } = {};
    if (body.enabled !== undefined) {
      patch.enabled = body.enabled;
    }
    for (const k of ["exaKey", "opencodeKey"] as const) {
      const v = body[k];
      if (v !== undefined) {
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
