// POST /api/dev/vault/sync — re-compile vault from working tree (admin-gated)
// ponytail: runs vault-import + vault-export directly; on Vercel FS is ephemeral (ROFS is prod truth via git).
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const root = process.cwd();
    const { execSync } = await import("node:child_process");
    // Direct compile (no HEAD worktree dance — that is for deterministic git commits; this is live refresh)
    let stdout = "";
    try {
      stdout += execSync("node scripts/vault-import.mjs", { cwd: root, encoding: "utf8", timeout: 8000 });
      stdout += execSync("node scripts/vault-export.mjs", { cwd: root, encoding: "utf8", timeout: 8000 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // surface script stderr (front-matter validation etc.)
      const stderr = (e as { stderr?: Buffer | string })?.stderr;
      const detail = stderr ? String(stderr).slice(0, 2000) : msg.slice(0, 2000);
      return NextResponse.json({ ok: false, error: detail, stdout: stdout.slice(0, 2000) }, { status: 422 });
    }
    const notesPath = path.join(root, "state", "vault-notes.json");
    const raw = readFileSync(notesPath, "utf8");
    const doc = JSON.parse(raw) as { note_count?: number };
    return NextResponse.json({
      ok: true,
      noteCount: doc.note_count ?? 0,
      vaultNotes: doc,
      stdout: stdout.slice(0, 4000),
      note: "compiled from working tree (ephemeral on Vercel; commit via git for persistence)",
    });
  } catch (e) {
    return serverError(e);
  }
}
