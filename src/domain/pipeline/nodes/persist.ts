// AG-PERSIST — Persistence Receipt (storage side effect, step-mode only).
// Never executed in batch (runAudit persists nothing). Exposed as an async
// operation because the DataStore seam is I/O-bound; one retry on transient
// store failure.
import { Repository, type DataStore } from "@/lib/persistence";
import { makeArtifact } from "@/domain/pipeline/nodes/shared";
import type {
  AuditArtifact,
  NodeRunCtx,
  PersistenceRefSlice,
  ReportBundleSlice,
} from "@/domain/pipeline/types";

export async function persistRun(
  bundle: ReportBundleSlice,
  store: DataStore,
  workspace: string,
  ctx: Pick<NodeRunCtx, "ranAtIso" | "versionStart">,
): Promise<{ patch: { persistence_ref: PersistenceRefSlice }; artifacts: AuditArtifact[] }> {
  const repo = new Repository(store);
  const coordinates = `${workspace}/${bundle.json.project_id}/${bundle.json.audit_id}`;
  try {
    await repo.saveAudit(workspace, bundle.json);
  } catch (e) {
    console.warn(
      `[persist] save failed for ${coordinates}; retrying once (${e instanceof Error ? e.message : String(e)})`,
    );
    await repo.saveAudit(workspace, bundle.json);
  }

  const slice: PersistenceRefSlice = {
    audit_id: bundle.json.audit_id,
    project_id: bundle.json.project_id,
    stored_at: ctx.ranAtIso,
  };
  return {
    patch: { persistence_ref: slice },
    artifacts: [
      makeArtifact(
        "AG-PERSIST",
        "repository",
        "persistence.receipt",
        1,
        { ranAtIso: ctx.ranAtIso, versionStart: ctx.versionStart } as NodeRunCtx,
        "verified",
        slice,
      ),
    ],
  };
}
