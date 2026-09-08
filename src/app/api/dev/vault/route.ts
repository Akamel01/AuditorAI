// GET /api/dev/vault — vault compilation view (admin-gated)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const root = process.cwd();
    const notesPath = path.join(root, "state", "vault-notes.json");
    let vaultNotes: unknown = null;
    let noteCount = 0;
    let compiledAtCommitOnly: boolean | null = null;
    try {
      const raw = readFileSync(notesPath, "utf8");
      const doc = JSON.parse(raw) as { note_count?: number; notes?: unknown[]; compiled_at_commit_only?: boolean };
      vaultNotes = doc;
      noteCount = doc.note_count ?? (Array.isArray(doc.notes) ? doc.notes.length : 0);
      compiledAtCommitOnly = doc.compiled_at_commit_only ?? null;
    } catch {
      vaultNotes = null;
    }

    // quick fs stats — chartered zones (no .obsidian, not needed)
    const zones = ["vault/journal", "vault/gotchas", "vault/decisions", "vault/research-notes", "vault/views"];
    const zoneStats = zones.map((z) => {
      const dir = path.join(root, z);
      if (!existsSync(dir)) return { zone: z, files: 0, lastMtime: null as string | null };
      try {
        const files = readdirSync(dir)
          .filter((f) => f.endsWith(".md"))
          .map((f) => path.join(dir, f))
          .filter((p) => {
            try {
              return statSync(p).isFile();
            } catch {
              return false;
            }
          });
        const mtimes = files
          .map((f) => statSync(f).mtime.toISOString())
          .sort();
        return { zone: z, files: files.length, lastMtime: mtimes.length ? mtimes[mtimes.length - 1] : null };
      } catch {
        return { zone: z, files: 0, lastMtime: null };
      }
    });

    // determinism hint — committed vs working tree diff (best-effort, no git in prod)
    let determinism: { check: string; committedNoteCount?: number } | null = null;
    try {
      const { execSync } = await import("node:child_process");
      const out = execSync("git show HEAD:state/vault-notes.json 2>/dev/null | python3 -c \"import json,sys;print(json.load(sys.stdin).get('note_count',0))\"", {
        cwd: root,
        encoding: "utf8",
        timeout: 3000,
      }).trim();
      const committed = Number(out);
      if (!Number.isNaN(committed)) {
        determinism = {
          check: committed === noteCount ? "ok — committed matches working tree" : `drift — committed ${committed} vs working ${noteCount}; run vault-sync`,
          committedNoteCount: committed,
        };
      }
    } catch {
      determinism = null;
    }

    return NextResponse.json({
      vaultNotes,
      noteCount,
      compiledAtCommitOnly,
      zones: zoneStats,
      determinism,
    });
  } catch (e) {
    return serverError(e);
  }
}
