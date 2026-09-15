// KV-backed discovery ledger — DataStore seam (A1: per-entry + file mirror)
// ponytail: O(500) slice(-500) + SET NX hint ceiling; single-writer for INDEX_KEY
import type { DataStore } from "@/lib/persistence";
import { getDataStore } from "@/lib/persistence/store";
import path from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { withPersistenceSingleWriter } from "@/lib/persistence/single-writer";
const ENTRY_PREFIX = "discovery:ledger:entry:";
const INDEX_KEY = "discovery:ledger:index";
export interface LedgerEntry { seq: number; at: string; payload_kind: string; data: unknown; }
function entryKey(seq: number): string { return `${ENTRY_PREFIX}${seq}`; }
export async function appendLedgerKV(entries: LedgerEntry[], store?: DataStore): Promise<void> {
  if (entries.length === 0) return;
  const s = store ?? getDataStore();
  await withPersistenceSingleWriter(async () => {
    let index: number[] = [];
    try { const cur = await s.get<number[]>(INDEX_KEY); if (Array.isArray(cur)) index = cur; } catch {}
    for (const e of entries) {
      try {
        // NX hint: check exists before put to avoid overwriting
        const exists = await s.get(entryKey(e.seq));
        if (exists !== null) {
          if (!index.includes(e.seq)) index.push(e.seq);
          continue;
        }
        await s.put(entryKey(e.seq), e);
        if (!index.includes(e.seq)) index.push(e.seq);
      } catch {
        // swallow per-entry write errors
      }
    }
    index.sort((a,b)=>a-b);
    const trimmed = index.slice(-500);
    try { await s.put(INDEX_KEY, trimmed); } catch {}
  });
}
export async function getLedgerTailKV(limit=20, store?: DataStore): Promise<{entries:LedgerEntry[];total:number}> {
  const s = store ?? getDataStore();
  try {
    const idx = await s.get<number[]>(INDEX_KEY);
    if (!Array.isArray(idx) || idx.length===0) return {entries:[],total:0};
    const total = idx.length;
    const tailSeqs = idx.slice(-limit);
    const keys = tailSeqs.map(entryKey);
    const vals = await s.getMany<LedgerEntry>(keys);
    // orphan prune: filter nulls and rewrite INDEX_KEY if needed
    const entries: LedgerEntry[] = [];
    const missing: number[] = [];
    for (let i=0;i<tailSeqs.length;i++) {
      const v = vals[i];
      if (v !== null) entries.push(v);
      else missing.push(tailSeqs[i]);
    }
    if (missing.length > 0) {
      try {
        const pruned = idx.filter((seq) => !missing.includes(seq));
        await withPersistenceSingleWriter(async () => {
          await s.put(INDEX_KEY, pruned);
        });
      } catch {}
    }
    entries.sort((a,b)=>a.seq-b.seq);
    return {entries,total};
  } catch { return {entries:[],total:0}; }
}

// New seam: appendLedgerRun - encapsulates run-slice persistence behind the ledger seam.
// Slices carry their values inline ([sliceName, payloadKind, value]) so concurrent runs
// never share mutable state (no globals). Values that are null/empty are skipped.
export async function appendLedgerRun(
  slices: [string, string, unknown][],
  ranAtIso: string,
  store?: DataStore,
): Promise<LedgerEntry[]> {
  // Derive next sequence from the tail in KV store
  const tail = await getLedgerTailKV(50, store);
  let lastSeq = tail.entries.length > 0 ? tail.entries[tail.entries.length - 1].seq : 0;
  const appended: LedgerEntry[] = [];
  for (const [, kind, value] of slices) {
    if (value == null || (Array.isArray(value) && value.length === 0)) continue;
    if (kind === "coverage.view" && typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) continue;
    lastSeq += 1;
    const entry: LedgerEntry = { seq: lastSeq, at: ranAtIso, payload_kind: kind, data: value as unknown };
    appended.push(entry);
  }
  if (appended.length) {
    // Persist to file mirror unconditionally (best-effort)
    // Hermeticity: skip the FS mirror under VITEST unless an explicit absolute
    // override is set (tests must opt into a tmp path; never the live mirror).
    try {
      // Mirror path: allow an absolute override via AUDITORAI_LEDGER_MIRROR
      // Absolute path wins when set. If not set or not absolute, fall back to default.
      const defaultLedgerPath = path.join(process.cwd(), "state", "discovery-ledger.json");
      const envMirror = process.env.AUDITORAI_LEDGER_MIRROR;
      // R1: under VITEST a missing OR non-absolute mirror must never resolve to
      // the live path — skip the FS mirror (tests opt in via absolute tmp path).
      const mirrorAbsolute = envMirror && path.isAbsolute(envMirror) ? envMirror : null;
      const skipFsMirror = process.env.VITEST === "true" && !mirrorAbsolute;
      const ledgerPath = mirrorAbsolute ?? defaultLedgerPath;
      if (!skipFsMirror) {
      let ledgerEntries: LedgerEntry[] = [];
      try {
        const raw = readFileSync(ledgerPath, "utf8");
        const parsed = JSON.parse(raw) as { entries: LedgerEntry[] };
        ledgerEntries = parsed.entries ?? [];
      } catch {
        ledgerEntries = [];
      }
      ledgerEntries.push(...appended);
      const dir = path.dirname(ledgerPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(ledgerPath, JSON.stringify({ entries: ledgerEntries }, null, 2) + "\n", "utf8");
      }
    } catch {
      // best-effort: ignore FS failures to keep operation non-blocking
    }
    // KV store write via existing seam
    try {
      await appendLedgerKV(appended, store);
    } catch {
      // ignore KV write failures; callers tolerate missing KV entries
    }
  }
  return appended;
}
