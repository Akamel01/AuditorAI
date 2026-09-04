// KV-backed discovery ledger — DataStore seam (A1: per-entry + file mirror)
// ponytail: O(500) slice(-500) + SET NX hint ceiling; single-writer for INDEX_KEY
import type { DataStore } from "@/lib/persistence";
import { getDataStore } from "@/lib/persistence/store";
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
