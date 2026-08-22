// Shared API helpers: workspace auth (+ rate limiting), JSON responses, error mapping.
import { NextResponse } from "next/server";
import { Repository, getDataStore, workspaceHash } from "./persistence";
import { checkRateLimit } from "./ratelimit";

export const WORKSPACE_HEADER = "x-workspace-key";

export async function requireWorkspace(
  req: Request,
): Promise<{ ok: true; ws: string; repo: Repository } | { ok: false; res: NextResponse }> {
  const key = req.headers.get(WORKSPACE_HEADER);
  if (!key || key.length < 16) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "missing or invalid x-workspace-key" },
        { status: 401 },
      ),
    };
  }
  const ws = workspaceHash(key);
  const limit = await checkRateLimit(ws);
  if (!limit.allowed) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "rate limit exceeded; retry shortly" },
        { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds ?? 60) } },
      ),
    };
  }
  return { ok: true, ws, repo: new Repository(getDataStore()) };
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(e: unknown) {
  if (e instanceof Error && e.name === "StageNotEligibleError") {
    return NextResponse.json({ error: e.message }, { status: 422 });
  }
  console.error("[api]", e);
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function newId(prefix: string): string {
  const [a, b] = crypto.randomUUID().split("-");
  return `${prefix}-${a}${b}`;
}
