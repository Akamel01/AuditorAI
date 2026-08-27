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

    // Ledger tail — last 20 entries
    let ledgerTail: unknown[] = [];
    let ledgerTotal = 0;
    let lastAt: string | null = null;
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

    // Dedupe index summary
    let dedupe: unknown = null;
    let dedupeSummary: Record<string, unknown> | null = null;
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
