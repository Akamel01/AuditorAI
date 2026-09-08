"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow } from "@/app/_components/ui/chips";
import { adminApi } from "@/lib/client";

type VaultGet = {
  noteCount: number;
  compiledAtCommitOnly: boolean | null;
  zones: Array<{ zone: string; files: number; lastMtime: string | null }>;
  determinism: { check: string; committedNoteCount?: number } | null;
  vaultNotes: unknown;
};

export function VaultPanel() {
  const [data, setData] = useState<VaultGet | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await adminApi<VaultGet>("/api/dev/vault");
      setData(res);
      setMsg(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await adminApi<{ ok: boolean; noteCount: number; vaultNotes: unknown; note?: string }>(
        "/api/dev/vault/sync",
        { method: "POST" },
      );
      setMsg(`synced · ${res.noteCount} notes`);
      // reload to reflect new compilation
      const fresh = await adminApi<VaultGet>("/api/dev/vault");
      setData(fresh);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Panel className="px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow code="CH 0+700">Vault · Obsidian working memory</Eyebrow>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
          vault/ → state/vault-notes.json
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-sunken px-2.5 py-[3px] font-mono text-[10px] tracking-[0.04em] text-subtle">
          notes <span className="text-text">{data?.noteCount ?? "—"}</span>
          {data?.compiledAtCommitOnly ? <span className="text-faint">· commit-only</span> : null}
          {loading && <span className="text-faint">· loading…</span>}
        </span>
        {data?.determinism && (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-[3px] font-mono text-[10px] tracking-[0.04em] ${data.determinism.check.startsWith("ok") ? "border-hairline bg-sunken text-subtle" : "border-accent-line/30 bg-accent-tint text-concern"}`}
          >
            {data.determinism.check}
          </span>
        )}
        <span className="font-mono text-[10px] text-faint">
          zones: {(data?.zones ?? []).map((z) => `${z.zone.split("/")[1]}:${z.files}`).join(" · ") || "—"}
        </span>
      </div>

      {data?.zones && (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {data.zones.map((z) => (
            <div key={z.zone} className="flex items-center justify-between rounded-md border border-hairline bg-sunken px-2.5 py-1.5">
              <span className="font-mono text-[10px] tracking-[0.04em] text-text">{z.zone}</span>
              <span className="font-mono text-[10px] text-subtle">
                {z.files} md{z.lastMtime ? ` · ${z.lastMtime.slice(0, 10)}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex cursor-pointer items-center rounded-md border border-edge bg-surface px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.04em] text-text transition hover:bg-sunken disabled:opacity-50"
          aria-label="Refresh vault view"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        <button
          type="button"
          onClick={sync}
          disabled={syncing}
          className="inline-flex cursor-pointer items-center rounded-md bg-accent px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.04em] text-[color:var(--accent-contrast)] transition hover:bg-accent-strong disabled:opacity-50"
          aria-label="Sync vault — recompile from working tree"
          title="POST /api/dev/vault/sync — runs vault-import + vault-export (ephemeral on Vercel, commit for persistence)"
        >
          {syncing ? "Syncing…" : "Update vault"}
        </button>
        {msg && <span className="font-mono text-[11px] text-ok">{msg}</span>}
        {err && <span className="font-mono text-[11px] text-concern">{err.slice(0, 200)}</span>}
      </div>

      <p className="mt-2 font-mono text-[10.5px] leading-snug text-faint">
        Live read of <span className="text-subtle">state/vault-notes.json</span> (compiled via{" "}
        <span className="text-subtle">scripts/vault-import.mjs</span>). On Vercel sync is ephemeral — use{" "}
        <span className="text-subtle">git commit</span> + <span className="text-subtle">node scripts/vault-sync.mjs</span> for persistence (
        <span className="text-subtle">AGENTS.md: vault determinism</span>).
      </p>
    </Panel>
  );
}
