// GET /api/dev/discovery — ledgerTail (last 20), dedupe summary, providers list+enabled
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { listProviderIds, providerEnabled } from "@/discovery/providers";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const root = process.cwd();

    // Ledger tail — last 20 entries (KV first, file fallback — Vercel FS ephemeral)
    let ledgerTail: unknown[] = [];
    let ledgerTotal = 0;
    let lastAt: string | null = null;
    try {
      const { getLedgerTailKV } = await import("@/discovery/ledger");
      const kv = await getLedgerTailKV(20);
      if (kv.total > 0) {
        ledgerTail = kv.entries;
        ledgerTotal = kv.total;
        lastAt = kv.entries[kv.entries.length - 1]?.at ?? null;
      } else {
        throw new Error("kv empty");
      }
    } catch {
      try {
        const raw = readFileSync(path.join(root, "state", "discovery-ledger.json"), "utf8");
        const doc = JSON.parse(raw) as { entries?: unknown[] };
        const entries = Array.isArray(doc.entries) ? doc.entries : [];
        ledgerTotal = entries.length;
        ledgerTail = entries.slice(-20);
        if (entries.length > 0) {
          const last = entries[entries.length - 1] as { at?: string };
          lastAt = last?.at ?? null;
        }
      } catch {
        // missing/unreadable ledger — return empty tail (deterministic)
      }
    }

    // Dedupe index summary (KV mirror first)
    let dedupe: unknown = null;
    let dedupeSummary: Record<string, unknown> | null = null;
    try {
      const { getDataStore } = await import("@/lib/persistence/store");
      const { DISCOVERY_DEDUPE_INDEX_KEY } = await import("@/lib/persistence/keys");
      const kvDoc = await getDataStore().get<{
        schema_version?: string;
        near_dup_threshold?: number;
        sha256?: Record<string, string>;
        text_hash?: Record<string, string>;
        clusters?: unknown[];
      }>(DISCOVERY_DEDUPE_INDEX_KEY);
      if (kvDoc && kvDoc.sha256) {
        dedupe = kvDoc;
        dedupeSummary = {
          schema_version: kvDoc.schema_version ?? null,
          near_dup_threshold: kvDoc.near_dup_threshold ?? null,
          sha256Entries: kvDoc.sha256 ? Object.keys(kvDoc.sha256).length : 0,
          textHashEntries: kvDoc.text_hash ? Object.keys(kvDoc.text_hash).length : 0,
          clusters: Array.isArray(kvDoc.clusters) ? kvDoc.clusters.length : 0,
        };
      } else {
        throw new Error("kv miss");
      }
    } catch {
      try {
        const raw = readFileSync(path.join(root, "state", "dedupe-index.json"), "utf8");
        const doc = JSON.parse(raw) as {
          schema_version?: string;
          near_dup_threshold?: number;
          sha256?: Record<string, string>;
          text_hash?: Record<string, string>;
          clusters?: unknown[];
        };
        dedupe = doc;
        dedupeSummary = {
          schema_version: doc.schema_version ?? null,
          near_dup_threshold: doc.near_dup_threshold ?? null,
          sha256Entries: doc.sha256 ? Object.keys(doc.sha256).length : 0,
          textHashEntries: doc.text_hash ? Object.keys(doc.text_hash).length : 0,
          clusters: Array.isArray(doc.clusters) ? doc.clusters.length : 0,
        };
      } catch {
        dedupeSummary = {
          schema_version: null,
          near_dup_threshold: null,
          sha256Entries: 0,
          textHashEntries: 0,
          clusters: 0,
        };
      }
    }

    // Providers — listProviderIds + providerEnabled statuses
    // Import side-effect ensures registration (index.ts registers seed-portals etc)
     
    const _ids = listProviderIds();
    const providers = _ids.map((id) => ({
      id,
      enabled: providerEnabled(id),
    }));

    return NextResponse.json({
      ledgerTail,
      ledgerTotal,
      lastAt,
      dedupe: dedupeSummary,
      dedupeIndex: dedupe,
      providers,
    });
  } catch (e) {
    return serverError(e);
  }
}
