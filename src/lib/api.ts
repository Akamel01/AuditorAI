// Shared API helpers: workspace auth, JSON responses, error mapping.
import { NextResponse } from "next/server";
import { Repository, getDataStore, workspaceHash } from "./persistence";

export const WORKSPACE_HEADER = "x-workspace-key";

export function requireWorkspace(
  req: Request,
): { ok: true; ws: string; repo: Repository } | { ok: false; res: NextResponse } {
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
  return { ok: true, ws: workspaceHash(key), repo: new Repository(getDataStore()) };
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
  const message = e instanceof Error ? e.message : String(e);
  console.error("[api]", e);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function newId(prefix: string): string {
  const [a, b] = crypto.randomUUID().split("-");
  return `${prefix}-${a}${b}`;
}
