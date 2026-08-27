// GET /api/dev/health — provider pings (limit 1) + ledger age + topology drift check
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { listProviderIds, providerEnabled, resolveProvider } from "@/discovery/providers";
import "@/discovery/providers";
import { DESCRIPTORS } from "@/domain/pipeline/registry";
import { DISCOVERY_NODE_IDS } from "@/discovery/types";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const root = process.cwd();

    // Provider pings — try discover with limit 1 per enabled provider
    const providerResults: Array<{
      id: string;
      enabled: boolean;
      ping: { ok: boolean; latencyMs: number | null; hits: number | null; error: string | null };
    }> = [];
    for (const id of listProviderIds()) {
      const enabled = providerEnabled(id);
      if (!enabled) {
        providerResults.push({ id, enabled: false, ping: { ok: false, latencyMs: null, hits: null, error: "disabled (no credentials)" } });
        continue;
      }
      const provider = resolveProvider(id);
      if (!provider) {
        providerResults.push({ id, enabled: true, ping: { ok: false, latencyMs: null, hits: null, error: "not registered" } });
        continue;
      }
      const t0 = Date.now();
      try {
        // Use a bounded query: one jurisdiction, limit 1 to stay light
        const hits = await provider.discover({ jurisdictions: ["US"], themes: ['"road safety audit"'], limit: 1 });
        const latency = Date.now() - t0;
        providerResults.push({ id, enabled: true, ping: { ok: true, latencyMs: latency, hits: hits.length, error: null } });
      } catch (e) {
        const latency = Date.now() - t0;
        providerResults.push({
          id,
          enabled: true,
          ping: { ok: false, latencyMs: latency, hits: null, error: e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500) },
        });
      }
    }

    // Ledger age
    let ledgerAge: { entries: number; lastAt: string | null; ageMs: number | null; ageHuman: string | null } = {
      entries: 0,
      lastAt: null,
      ageMs: null,
      ageHuman: null,
    };
    try {
      const raw = readFileSync(path.join(root, "state", "discovery-ledger.json"), "utf8");
      const doc = JSON.parse(raw) as { entries?: { at?: string }[] };
      const entries = Array.isArray(doc.entries) ? doc.entries : [];
      const lastAt = entries.length ? (entries[entries.length - 1]?.at ?? null) : null;
      let ageMs: number | null = null;
      let ageHuman: string | null = null;
      if (lastAt) {
        const lastTime = Date.parse(lastAt);
        if (!Number.isNaN(lastTime)) {
          ageMs = Date.now() - lastTime;
          const sec = Math.floor(ageMs / 1000);
          if (sec < 60) ageHuman = `${sec}s`;
          else if (sec < 3600) ageHuman = `${Math.floor(sec / 60)}m ${sec % 60}s`;
          else if (sec < 86400) ageHuman = `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
          else ageHuman = `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
        }
      }
      ledgerAge = { entries: entries.length, lastAt, ageMs, ageHuman };
    } catch {
      // ledger unreadable — keep defaults
    }

    // Topology drift check — same logic as scripts/gen-node-topology.ts validation + state/graph-state.json comparison
    let topology: { drift: boolean; details: string[]; auditGraphNodes: number; discoveryGraphNodes: number } = {
      drift: false,
      details: [],
      auditGraphNodes: DESCRIPTORS.length,
      discoveryGraphNodes: DISCOVERY_NODE_IDS.length,
    };
    try {
      const graphRaw = readFileSync(path.join(root, "state", "graph-state.json"), "utf8");
      const graph = JSON.parse(graphRaw) as {
        graphs?: {
          audit_graph?: { nodes?: { id: string }[] };
          discovery_graph?: { nodes?: { id: string }[] };
        };
      };
      const details: string[] = [];
      const auditIds = graph.graphs?.audit_graph?.nodes?.map((n) => n.id) ?? [];
      const discIds = graph.graphs?.discovery_graph?.nodes?.map((n) => n.id) ?? [];

      if (auditIds.length !== DESCRIPTORS.length) {
        details.push(`audit_graph nodes ${auditIds.length} vs DESCRIPTORS ${DESCRIPTORS.length}`);
      } else {
        for (let i = 0; i < DESCRIPTORS.length; i++) {
          if (DESCRIPTORS[i].id !== auditIds[i]) {
            details.push(`audit_graph order drift at ${i}: ${DESCRIPTORS[i].id} vs ${auditIds[i]}`);
          }
        }
      }
      if (discIds.length !== DISCOVERY_NODE_IDS.length) {
        details.push(`discovery_graph nodes ${discIds.length} vs DISCOVERY_NODE_IDS ${DISCOVERY_NODE_IDS.length}`);
      } else {
        for (let i = 0; i < DISCOVERY_NODE_IDS.length; i++) {
          if (DISCOVERY_NODE_IDS[i] !== discIds[i]) {
            details.push(`discovery_graph order drift at ${i}: ${DISCOVERY_NODE_IDS[i]} vs ${discIds[i]}`);
          }
        }
      }
      topology = {
        drift: details.length > 0,
        details,
        auditGraphNodes: auditIds.length,
        discoveryGraphNodes: discIds.length,
      };
    } catch (e) {
      topology = {
        drift: true,
        details: [`graph-state.json unreadable: ${e instanceof Error ? e.message : String(e)}`],
        auditGraphNodes: DESCRIPTORS.length,
        discoveryGraphNodes: DISCOVERY_NODE_IDS.length,
      };
    }

    return NextResponse.json({
      providers: providerResults,
      ledger: ledgerAge,
      ledgerAge,
      topology,
      topologyDrift: topology,
    });
  } catch (e) {
    return serverError(e);
  }
}
