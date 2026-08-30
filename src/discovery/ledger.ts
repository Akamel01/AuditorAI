// KV-backed discovery ledger — DataStore seam (A1: per-entry + file mirror)
import type { DataStore } from "@/lib/persistence";
import { getDataStore } from "@/lib/persistence/store";
const ENTRY_PREFIX = "discovery:ledger:entry:";
const INDEX_KEY = "discovery:ledger:index";
export interface LedgerEntry { seq: number; at: string; payload_kind: string; data: unknown; }
function entryKey(seq: number): string { return `${ENTRY_PREFIX}${seq}`; }
export async function appendLedgerKV(entries: LedgerEntry[], store?: DataStore): Promise<void> {
  if (entries.length === 0) return;
  const s = store ?? getDataStore();
  let index: number[] = [];
  try { const cur = await s.get<number[]>(INDEX_KEY); if (Array.isArray(cur)) index = cur; } catch {}
  for (const e of entries) { try { await s.put(entryKey(e.seq), e); } catch {} if (!index.includes(e.seq)) index.push(e.seq); }
  index.sort((a,b)=>a-b);
  const trimmed = index.slice(-500);
  try { await s.put(INDEX_KEY, trimmed); } catch {}
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
    const entries = vals.filter((v):v is LedgerEntry=>v!==null).sort((a,b)=>a.seq-b.seq);
    return {entries,total};
  } catch { return {entries:[],total:0}; }
}
