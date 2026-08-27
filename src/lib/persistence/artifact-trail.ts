// ArtifactTrail — artifact persistence hat of the former Repository.
// Shares the DataStore seam; sole key literals live in keys.ts.
import type { AuditArtifact } from "@/domain/pipeline/types";
import type { DataStore } from "./store";
import * as Keys from "./keys";
import { artifactSeqOf } from "./keys";

/** N3: per-artifact byte cap at write time (Upstash 10 MiB request cap measured
 * in M1; 512 KB keeps a wide margin while covering any node payload). */
export const MAX_ARTIFACT_BYTES = 512 * 1000;

export class ArtifactTooLargeError extends Error {
  constructor(nodeId: string, seq: number, bytes: number) {
    super(`artifact ${nodeId}#${seq} is ${bytes} bytes; cap is ${MAX_ARTIFACT_BYTES}`);
    this.name = "ArtifactTooLargeError";
  }
}

/** Summary record kept for pruned (non-latest) runs. */
export interface ArtifactSummary {
  audit_id: string;
  ran_at: string;
  artifact_count: number;
  nodes: { node_id: string; payload_kind: string; validation_status: string }[];
  pruned_at: string;
}

export class ArtifactTrail {
  constructor(private store: DataStore) {}

  /** Store the full artifact trail of one audit run under
   *  ws:{ws}:art:{projectId}:{auditId}:{nodeId}:{seq}; prune any previous full
   *  trail for the same audit to a summary record first (retention policy). */
  async saveArtifactTrailFor(
    ws: string,
    identity: { projectId: string; auditId: string },
    artifacts: AuditArtifact[],
  ) {
    await this.pruneArtifactTrail(ws, identity.projectId, identity.auditId);

    let seq = 0;
    for (const art of artifacts) {
      seq += 1;
      const bytes = Buffer.byteLength(JSON.stringify(art));
      if (bytes > MAX_ARTIFACT_BYTES) {
        throw new ArtifactTooLargeError(art.node_id, seq, bytes);
      }
      await this.store.put(
        Keys.artifactKey(ws, identity.projectId, identity.auditId, art.node_id, seq),
        art,
      );
    }
    return { stored: seq };
  }

  async getArtifact(
    ws: string,
    projectId: string,
    auditId: string,
    nodeId: string,
    seq: number,
  ): Promise<AuditArtifact | null> {
    return this.store.get<AuditArtifact>(
      Keys.artifactKey(ws, projectId, auditId, nodeId, seq),
    );
  }

  async listArtifacts(ws: string, projectId: string, auditId: string): Promise<AuditArtifact[]> {
    const prefix = Keys.artifactTrailPrefix(ws, projectId, auditId);
    const keys = (await this.store.keys(prefix)).filter((k) => !k.endsWith(":_summary"));
    // Trail order is the global write seq encoded in the key tail; numeric
    // ordering survives seq >= 10 where lexicographic order breaks.
    keys.sort((a, b) => artifactSeqOf(a) - artifactSeqOf(b));
    const loaded = await this.store.getMany<AuditArtifact>(keys);
    return loaded.filter((a): a is AuditArtifact => a !== null);
  }

  /** Replay rule: verified artifacts are trusted as-is; anything else must be
   *  regenerated deterministically before use. */
  replayPlan(artifacts: AuditArtifact[]): { trusted: AuditArtifact[]; regenerate: AuditArtifact[] } {
    return {
      trusted: artifacts.filter((a) => a.validation_status === "verified"),
      regenerate: artifacts.filter((a) => a.validation_status !== "verified"),
    };
  }

  async pruneArtifactTrail(ws: string, projectId: string, auditId: string) {
    const prior = await this.listArtifacts(ws, projectId, auditId);
    if (prior.length === 0) return;
    const summary: ArtifactSummary = {
      audit_id: auditId,
      ran_at: String(prior[0].created_at ?? ""),
      artifact_count: prior.length,
      nodes: prior.map((a) => ({
        node_id: a.node_id,
        payload_kind: a.payload_kind,
        validation_status: a.validation_status,
      })),
      pruned_at: new Date().toISOString(),
    };
    // Ordered deletes (KV has no atomic multi-op): clear the old trail and any
    // stale summary first, then commit the fresh summary last.
    await this.store.delByPrefix(Keys.artifactTrailPrefix(ws, projectId, auditId));
    await this.store.put(Keys.artifactSummaryKey(ws, projectId, auditId), summary);
  }
}
