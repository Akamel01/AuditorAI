// POST /api/dev/vault/sync — re-compile vault from working tree (admin-gated)
// ponytail: attempts local compile; on Vercel scripts are not bundled and FS is read-only — fall back to read-only git truth.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const root = process.cwd();
    const notesPath = path.join(root, "state", "vault-notes.json");
    // Try live compile when scripts are available (local dev)
    const scriptPath = path.join(root, "scripts", "vault-import.mjs");
    if (existsSync(scriptPath)) {
      const { execSync } = await import("node:child_process");
      let stdout = "";
      try {
        stdout += execSync("node scripts/vault-import.mjs", { cwd: root, encoding: "utf8", timeout: 8000 });
        stdout += execSync("node scripts/vault-export.mjs", { cwd: root, encoding: "utf8", timeout: 8000 });
        const raw = readFileSync(notesPath, "utf8");
        const doc = JSON.parse(raw) as { note_count?: number };
        return NextResponse.json({
          ok: true,
          noteCount: doc.note_count ?? 0,
          vaultNotes: doc,
          stdout: stdout.slice(0, 4000),
          note: "compiled from working tree (ephemeral on Vercel; commit via git for persistence)",
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const stderr = (e as { stderr?: Buffer | string })?.stderr;
        const detail = stderr ? String(stderr).slice(0, 2000) : msg.slice(0, 2000);
        return NextResponse.json({ ok: false, error: detail, stdout: stdout.slice(0, 2000) }, { status: 422 });
      }
    }
    // Vercel fallback — scripts not bundled, FS read-only: return committed truth
    try {
      const raw = readFileSync(notesPath, "utf8");
      const doc = JSON.parse(raw) as { note_count?: number };
      return NextResponse.json({
        ok: true,
        noteCount: doc.note_count ?? 0,
        vaultNotes: doc,
        stdout: "",
        note: "production (Vercel) — vault is git-committed read-only; run `node scripts/vault-sync.mjs` locally and push",
      });
    } catch {
      return NextResponse.json({ ok: false, error: "vault-notes.json unreadable" }, { status: 500 });
    }
  } catch (e) {
    return serverError(e);
  }
}
